import { createStudyFlowServer } from "../app-server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
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
  const server = createStudyFlowServer(bearer?.[1]);
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
