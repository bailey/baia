const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");

// This project's Upstash integration provisions KV_REST_API_* names
// (the legacy @vercel/kv convention) rather than UPSTASH_REDIS_REST_*,
// so Redis.fromEnv() won't find them — wire them up explicitly.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "20 s"),
  prefix: "bbs:ratelimit",
});

const LIST_KEY = "bbs:messages";
const MAX_STORED = 200;
const MAX_RETURNED = 50;
const MAX_NAME_LEN = 24;
const MAX_MESSAGE_LEN = 280;

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return handleList(req, res);
  }
  if (req.method === "POST") {
    return handlePost(req, res);
  }
  if (req.method === "DELETE") {
    return handleDelete(req, res);
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "method not allowed" });
};

async function handleList(req, res) {
  try {
    const raw = await redis.lrange(LIST_KEY, 0, MAX_RETURNED - 1);
    // @upstash/redis auto-parses JSON values on read, so entries already
    // come back as objects (only fall back to manual parsing for safety).
    const messages = raw
      .map((entry) => (typeof entry === "string" ? safeParse(entry) : entry))
      .filter(Boolean)
      // token is the delete secret handed to the poster only — never echo it back
      .map(({ token, ...rest }) => rest);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ error: "failed to load messages" });
  }
}

async function handlePost(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const name = sanitize(body && body.name, MAX_NAME_LEN) || "anonymous";
    const message = sanitize(body && body.message, MAX_MESSAGE_LEN);
    const honeypot = body && body.website;

    if (honeypot) {
      // bots fill hidden fields; pretend it worked, drop it silently
      return res.status(201).json({ ok: true });
    }

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return res.status(429).json({ error: "slow down a little" });
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      message,
      ts: Date.now(),
      token: Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10),
    };

    await redis.lpush(LIST_KEY, JSON.stringify(entry));
    await redis.ltrim(LIST_KEY, 0, MAX_STORED - 1);

    // give the poster their delete token, but never expose it via GET
    const { token, ...publicEntry } = entry;
    return res.status(201).json({ ok: true, entry: publicEntry, token });
  } catch (err) {
    return res.status(500).json({ error: "failed to post message" });
  }
}

async function handleDelete(req, res) {
  try {
    const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
    const id = body && body.id;
    const token = body && body.token;
    if (!id || !token) {
      return res.status(400).json({ error: "id and token are required" });
    }

    const raw = await redis.lrange(LIST_KEY, 0, MAX_STORED - 1);
    const found = raw
      .map((entry) => (typeof entry === "string" ? safeParse(entry) : entry))
      .find((entry) => entry && entry.id === id);

    if (!found) {
      return res.status(404).json({ error: "message not found" });
    }
    if (found.token !== token) {
      return res.status(403).json({ error: "not your message" });
    }

    await redis.lrem(LIST_KEY, 0, JSON.stringify(found));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to delete message" });
  }
}

function sanitize(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>]/g, "").slice(0, maxLen);
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
