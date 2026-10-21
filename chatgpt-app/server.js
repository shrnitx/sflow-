import { createServer } from "node:http";
import { createStudyFlowServer } from "./app-server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = Number(process.env.PORT || 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ name: "StudyFlow ChatGPT app", status: "ready", endpoint: MCP_PATH }));
    return;
  }
  if (url.pathname === MCP_PATH && req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    }).end();
    return;
  }
  if (url.pathname === MCP_PATH && ["POST", "GET", "DELETE"].includes(req.method || "")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    const server = createStudyFlowServer(bearer?.[1]);
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
