export default defineEventHandler((event) => {
  const origin = getHeader(event, "origin");

  // Base headers
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Vary": "Origin", // Prevent caching issues
  };

  // Allow all origins - reflect the origin back if present, otherwise use wildcard
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  else {
    // No origin header (same-origin request or tools like curl)
    headers["Access-Control-Allow-Origin"] = "*";
  }

  setResponseHeaders(event, headers);

  // Handle preflight OPTIONS requests
  if (event.method === "OPTIONS") {
    event.node.res.statusCode = 204;
    event.node.res.end();
  }
});
