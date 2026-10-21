import { createStudyFlowServer, validateSupabaseAccessToken } from "../app-server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

function resourceMetadataUrl(req) {
  const origin = process.env.MCP_PUBLIC_URL || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  return new URL("/.well-known/oauth-protected-resource", origin).toString();
}

function unauthorized(req, res, message = "A valid StudyFlow sign-in is required.") {
  res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${resourceMetadataUrl(req)}"`);
  return res.status(401).json({ error: "unauthorized", error_description: message });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, mcp-session-id, mcp-protocol-version");
    return res.status(204).end();
  }
  if (!["POST", "GET", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "POST, GET, DELETE, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!bearer?.[1]) return unauthorized(req, res);
  const auth = await validateSupabaseAccessToken(bearer[1]);
  if (auth.reason === "configuration") {
    return res.status(503).json({ error: "server_configuration", error_description: "Supabase environment variables are not configured." });
  }
  if (!auth.valid) return unauthorized(req, res, "The access token is invalid or expired. Reconnect StudyFlow.");

  const server = createStudyFlowServer(bearer[1]);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("StudyFlow MCP request failed:", error);
    if (!res.headersSent) res.status(500).send("Internal server error");
  }
}
