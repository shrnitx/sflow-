import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const widgetHtml = readFileSync(join(__dirname, "public", "studyflow-widget.html"), "utf8");
const PORT = Number(process.env.PORT || 8787);
const MCP_PATH = "/mcp";
const UI_URI = "ui://studyflow/dashboard.html";
const TABLES = {
  tasks: "studyflow_tasks",
  timetable: "studyflow_timetable",
  focusSessions: "studyflow_focus_sessions",
};

function supabaseForRequest(extra) {
  const token = extra?.authInfo?.token;
  if (!token) {
    throw new Error("StudyFlow needs an authenticated Supabase access token. Configure the app's OAuth/authentication flow before connecting real accounts.");
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Server configuration is incomplete: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { client, token };
}

async function userClient(extra) {
  const { client, token } = supabaseForRequest(extra);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Authentication failed. Sign in to StudyFlow again.");
  return { client, userId: data.user.id };
}

function cleanTask(row) {
  const data = row?.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
  return { ...data, id: row.record_id };
}

async function loadCollection(client, userId, collection) {
  const { data, error } = await client.from(TABLES[collection])
    .select("record_id,data,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load ${collection}: ${error.message}`);
  return (data || []).map(cleanTask);
}

async function saveRecord(client, userId, collection, record) {
  const { error } = await client.from(TABLES[collection]).upsert({
    user_id: userId,
    record_id: record.id,
    data: record,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,record_id" });
  if (error) throw new Error(`Could not save record: ${error.message}`);
}

function result(message, payload = {}) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: payload,
  };
}

function createStudyFlowServer() {
  const server = new McpServer({ name: "studyflow", version: "0.1.0" });

  registerAppResource(server, "studyflow-dashboard", UI_URI, {}, async () => ({
    contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: widgetHtml }],
  }));

  const outputSchema = {
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      subject: z.string().optional(),
      deadline: z.string().optional(),
      priority: z.string().optional(),
      completed: z.boolean().optional(),
      description: z.string().optional(),
    })).optional(),
    timetable: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      day: z.number().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    summary: z.string().optional(),
  };

  registerAppTool(server, "get_studyflow_dashboard", {
    title: "Open StudyFlow dashboard",
    description: "Loads the signed-in user's pending tasks, upcoming deadlines, and timetable for the interactive StudyFlow dashboard.",
    inputSchema: { includeCompleted: z.boolean().optional() },
    outputSchema,
    _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ includeCompleted = false } = {}, extra) => {
    try {
      const { client, userId } = await userClient(extra);
      const [tasks, timetable] = await Promise.all([
        loadCollection(client, userId, "tasks"),
        loadCollection(client, userId, "timetable"),
      ]);
      const visibleTasks = includeCompleted ? tasks : tasks.filter((task) => !task.completed);
      return result("StudyFlow dashboard loaded.", {
        tasks: visibleTasks,
        timetable,
        summary: `${visibleTasks.length} task(s), ${timetable.length} timetable entry/entries.`,
      });
    } catch (error) {
      return result(error.message || "Could not load StudyFlow.");
    }
  });

  registerAppTool(server, "create_study_task", {
    title: "Create study task",
    description: "Creates a task in the signed-in user's StudyFlow account. Use for a concrete task the user asked to add.",
    inputSchema: {
      title: z.string().trim().min(1).max(180),
      subject: z.string().trim().max(80).optional(),
      deadline: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
      priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
      description: z.string().max(2000).optional(),
    },
    outputSchema,
    _meta: { ui: { resourceUri: UI_URI } },
  }, async (args, extra) => {
    try {
      const { client, userId } = await userClient(extra);
      const task = {
        id: crypto.randomUUID(),
        title: args.title.trim(),
        subject: args.subject || "Other",
        deadline: args.deadline || "",
        priority: args.priority || "Medium",
        description: args.description || "",
        completed: false,
        createdAt: new Date().toISOString(),
      };
      await saveRecord(client, userId, "tasks", task);
      const tasks = await loadCollection(client, userId, "tasks");
      return result(`Created task: ${task.title}`, { tasks, summary: "Task created." });
    } catch (error) {
      return result(error.message || "Could not create task.");
    }
  });

  registerAppTool(server, "update_study_task", {
    title: "Update study task",
    description: "Updates fields on a task belonging to the signed-in user. Requires the exact task id from StudyFlow.",
    inputSchema: {
      id: z.string().min(1),
      title: z.string().trim().min(1).max(180).optional(),
      subject: z.string().trim().max(80).optional(),
      deadline: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).or(z.literal("")).optional(),
      priority: z.enum(["Low", "Medium", "High"]).optional(),
      description: z.string().max(2000).optional(),
      completed: z.boolean().optional(),
    },
    outputSchema,
    _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ id, ...patch }, extra) => {
    try {
      const { client, userId } = await userClient(extra);
      const { data, error } = await client.from(TABLES.tasks)
        .select("record_id,data").eq("user_id", userId).eq("record_id", id).maybeSingle();
      if (error) throw error;
      if (!data) return result("Task not found in your account.");
      const task = { ...cleanTask(data), ...patch, id };
      await saveRecord(client, userId, "tasks", task);
      return result(`Updated task: ${task.title}`, {
        tasks: await loadCollection(client, userId, "tasks"),
        summary: "Task updated.",
      });
    } catch (error) {
      return result(error.message || "Could not update task.");
    }
  });

  registerAppTool(server, "delete_study_task", {
    title: "Delete study task",
    description: "Permanently deletes one task belonging to the signed-in user. Only call when the user explicitly asks to delete it.",
    inputSchema: { id: z.string().min(1) },
    outputSchema,
    _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ id }, extra) => {
    try {
      const { client, userId } = await userClient(extra);
      const { data, error } = await client.from(TABLES.tasks).delete()
        .eq("user_id", userId).eq("record_id", id).select("record_id");
      if (error) throw error;
      if (!data?.length) return result("Task not found in your account.");
      return result("Task deleted.", {
        tasks: await loadCollection(client, userId, "tasks"),
        summary: "Task deleted.",
      });
    } catch (error) {
      return result(error.message || "Could not delete task.");
    }
  });

  registerAppTool(server, "get_study_timetable", {
    title: "Get study timetable",
    description: "Returns timetable entries for the authenticated StudyFlow user.",
    inputSchema: {},
    outputSchema,
    _meta: { ui: { resourceUri: UI_URI } },
  }, async (_args, extra) => {
    try {
      const { client, userId } = await userClient(extra);
      const timetable = await loadCollection(client, userId, "timetable");
      return result(`Loaded ${timetable.length} timetable entries.`, { timetable, summary: "Timetable loaded." });
    } catch (error) {
      return result(error.message || "Could not load timetable.");
    }
  });

  return server;
}

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
    const server = createStudyFlowServer();
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
