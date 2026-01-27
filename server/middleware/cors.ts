export default defineEventHandler((event) => {
  const origin = getHeader(event, "origin");

  // Get allowlist from environment (comma-separated)
  // eslint-disable-next-line node/no-process-env
  const allowlistEnv = process.env.CORS_ALLOWED_ORIGINS || "";
  const allowlist = allowlistEnv.split(",").map(o => o.trim()).filter(Boolean);

  // Default development allowlist (includes Capacitor)
  const defaultAllowlist = [
    "capacitor://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  // Combine allowlists (env overrides defaults in production)
  // eslint-disable-next-line node/no-process-env
  const isDevelopment = process.env.NODE_ENV !== "production";
  const finalAllowlist = isDevelopment
    ? [...defaultAllowlist, ...allowlist]
    : (allowlist.length > 0 ? allowlist : defaultAllowlist);

  // Check if origin is allowed
  const isAllowed = origin && finalAllowlist.includes(origin);

  // Base headers
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Vary": "Origin", // Prevent caching issues
  };

  // Only reflect origin and allow credentials if origin is explicitly allowed
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  else if (!origin) {
    // No origin header (same-origin request or tools like curl)
    headers["Access-Control-Allow-Origin"] = "*";
  }
  // else: origin not allowed, don't set CORS headers

  setResponseHeaders(event, headers);

  // Handle preflight OPTIONS requests
  if (event.method === "OPTIONS") {
    event.node.res.statusCode = 204;
    event.node.res.end();
  }
});
