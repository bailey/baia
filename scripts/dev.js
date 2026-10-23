const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// Simple KEY=value and quoted values, sufficient for Vercel's env export.
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
const server = http.createServer(async (req, res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (["/api/messages", "/api/presence"].includes(pathname)) {
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return res.status(503).json({ error: "Configure KV_REST_API_URL and KV_REST_API_TOKEN in .env.local" });
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 8192) return res.status(413).json({ error: "body too large" });
      }
      req.body = body || undefined;
      // Ignore client-supplied forwarding headers on the local server.
      delete req.headers["x-forwarded-for"];
      return await require(path.join(root, pathname + ".js"))(req, res);
    }
    if (!["GET", "HEAD"].includes(req.method)) return res.status(405).end();
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const allowed = ["index.html", "index_style.css", "script.js"].includes(relative) || /^(assets|ponggame|games)\/[\w./-]+$/.test(relative);
    const file = path.resolve(root, relative);
    if (!allowed || !file.startsWith(root + path.sep) || relative.split("/").some((part) => part.startsWith("."))) return res.status(404).end("Not found");
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat?.isFile()) return res.status(404).end("Not found");
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    res.status(500).json({ error: "local server request failed" });
  }
});
server.listen(Number(process.env.PORT || 8080), "127.0.0.1", () => {
  console.log(`Local site: http://127.0.0.1:${server.address().port}`);
});
