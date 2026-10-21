import { createServer } from "node:http";
import { createStudyFlowServer, validateSupabaseAccessToken } from "./app-server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = Number(process.env.PORT || 8787);
const MCP_PATH = "/mcp";

function originFor(req) {
  return process.env.MCP_PUBLIC_URL || `${req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https")}://${req.headers.host}`;
}

function metadata(req) {
  const origin = originFor(req);
  return {
    resource: new URL(MCP_PATH, origin).toString(),
    authorization_servers: [`${process.env.SUPABASE_URL || ""}/auth/v1`.replace(/\/$/, "")],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
  };
}

function unauthorized(req, res, message = "A valid StudyFlow sign-in is required.") {
  res.writeHead(401, {
    "content-type": "application/json",
    "WWW-Authenticate": `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource", originFor(req))}"`,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify({ error: "unauthorized", error_description: message }));
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ name: "StudyFlow ChatGPT app", status: "ready", endpoint: MCP_PATH }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
    res.writeHead(200, { "content-type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(metadata(req)));
    return;
  }
  if (url.pathname === MCP_PATH && req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
    }).end();
    return;
  }
  if (url.pathname === MCP_PATH && ["POST", "GET", "DELETE"].includes(req.method || "")) {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (!bearer?.[1]) return unauthorized(req, res);
    const auth = await validateSupabaseAccessToken(bearer[1]);
    if (auth.reason === "configuration") {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "server_configuration", error_description: "Supabase environment variables are not configured." }));
      return;
    }
    if (!auth.valid) return unauthorized(req, res, "The access token is invalid or expired. Reconnect StudyFlow.");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
    const server = createStudyFlowServer(bearer[1]);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`StudyFlow MCP server listening on port ${PORT} at ${MCP_PATH}`);
});
