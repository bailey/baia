const { Ratelimit } = require("@upstash/ratelimit");
const { clientIp, parseBody } = require("../lib/request");
const { Redis } = require("@upstash/redis");

// Same env-var wiring as api/messages.js — this project's Upstash integration
// provisions KV_REST_API_* names rather than UPSTASH_REDIS_REST_*.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "bbs:presence-ratelimit",
});

const PRESENCE_KEY = "bbs:presence";
// A visitor counts as "online" until this long after their last heartbeat.
const PRESENCE_TTL_MS = 45000;

module.exports = async (req, res) => {
  if (req.method === "POST") {
    return handlePresence(req, res);
  }
  res.setHeader("Allow", "POST");
  return res.status(405).json({ error: "method not allowed" });
};

async function handlePresence(req, res) {
  try {
    const body = parseBody(req);
    const id = typeof (body && body.id) === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(body.id) ? body.id : null;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    if (body.leaving !== undefined && typeof body.leaving !== "boolean") {
      return res.status(400).json({ error: "leaving must be a boolean" });
    }
    const { success } = await ratelimit.limit(clientIp(req));
    if (!success) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "too many presence requests" });
    }
    const now = Date.now();
    await redis.zremrangebyscore(PRESENCE_KEY, 0, now - PRESENCE_TTL_MS);

    if (body.leaving) {
      await redis.zrem(PRESENCE_KEY, id);
    } else {
      await redis.zadd(PRESENCE_KEY, { score: now, member: id });
    }

    const count = await redis.zcard(PRESENCE_KEY);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ count: body.leaving ? count : Math.max(count, 1) });
  } catch (err) {
    return res.status(500).json({ error: "failed to update presence" });
  }
}
