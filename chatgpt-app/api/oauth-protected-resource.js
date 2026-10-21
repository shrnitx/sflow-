export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return res.status(503).json({ error: "server_configuration", error_description: "SUPABASE_URL is not configured." });
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = process.env.MCP_PUBLIC_URL || `${proto}://${req.headers.host}`;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    resource: new URL("/mcp", origin).toString(),
    authorization_servers: [new URL("/auth/v1", supabaseUrl).toString()],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"]
  });
}
