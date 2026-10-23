// Vercel supplies x-forwarded-for; local development falls back to the socket.
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return (typeof forwarded === "string" && forwarded.split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
}

function parseBody(req) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch { return null; }
}

module.exports = { clientIp, parseBody };
