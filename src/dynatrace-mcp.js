// Genuine runtime Dynatrace MCP client.
//
// This is the path that makes the hackathon's "partner MCP server is imported and
// CALLED at runtime" requirement literally true: we spawn the real
// @dynatrace-oss/dynatrace-mcp-server over stdio, complete the MCP handshake,
// discover its tools, and call them. Enabled by DT_USE_MCP=true; otherwise the app
// uses the Dynatrace REST API v2 path in dynatrace.js.
//
// Auth (the REAL server's env contract — NOT the REST Api-Token):
//   DT_ENVIRONMENT      e.g. https://abc12345.apps.dynatrace.com   (Platform URL, not classic .live.)
//   DT_PLATFORM_TOKEN   e.g. dt0s16.SAMPLE.xxxx                    (or OAUTH_CLIENT_ID/SECRET)
//
// [TESTED: NO] against a live Dynatrace tenant (no creds in this environment). The
// spawn + connect + listTools + callTool flow uses the verified MCP SDK 1.x API.

import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const require = createRequire(import.meta.url);
// Resolve the installed server's entry point (package main/bin → ./index.js).
const SERVER_ENTRY = require.resolve("@dynatrace-oss/dynatrace-mcp-server");

let _session = null; // lazy singleton: { client, tools: Map<name, toolDef> }

async function session() {
  if (_session) return _session;
  if (!process.env.DT_ENVIRONMENT) {
    throw new Error("DT_ENVIRONMENT not set — required by the Dynatrace MCP server (e.g. https://abc12345.apps.dynatrace.com)");
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      ...process.env,
      DT_ENVIRONMENT: process.env.DT_ENVIRONMENT,
      ...(process.env.DT_PLATFORM_TOKEN ? { DT_PLATFORM_TOKEN: process.env.DT_PLATFORM_TOKEN } : {}),
      // Cloud Run's FS is read-only except /tmp; the server writes telemetry/cache to
      // $HOME, so point it at /tmp and disable telemetry or it crashes on startup.
      HOME: process.env.HOME && process.env.HOME !== "/" ? process.env.HOME : "/tmp",
      DT_MCP_DISABLE_TELEMETRY: "true",
    },
    stderr: "inherit",
  });
  const client = new Client({ name: "dynacompliance", version: "2.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  _session = { client, tools: new Map(tools.map((t) => [t.name, t])) };
  return _session;
}

/** Pick the first available tool whose name matches one of the candidates (runtime discovery,
 *  so we don't hardcode a tool list that can drift between server versions). */
function pickTool(toolMap, candidates) {
  for (const name of candidates) if (toolMap.has(name)) return name;
  // loose contains-match fallback
  for (const name of toolMap.keys())
    if (candidates.some((c) => name.toLowerCase().includes(c.toLowerCase()))) return name;
  return null;
}

/** Parse an MCP tool result (content blocks) into JS — JSON when the text is JSON, else raw text. */
function parseResult(result) {
  const text = (result?.content || [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
  try { return JSON.parse(text); } catch { return text; }
}

async function call(toolCandidates, args) {
  const { client, tools } = await session();
  const name = pickTool(tools, toolCandidates);
  if (!name) throw new Error(`Dynatrace MCP exposes none of: ${toolCandidates.join(", ")} (have: ${[...tools.keys()].join(", ")})`);
  const result = await client.callTool({ name, arguments: args || {} });
  return parseResult(result);
}

/** List open problems via the MCP server (real tool: list_problems). */
export const listProblemsViaMCP = () => call(["list_problems", "get_problems", "problems"], {});

/** Fetch a single problem. The server is DQL-first, so prefer a problem-id filter on
 *  list_problems, falling back to a direct execute_dql query. */
export async function getProblemViaMCP(problemId) {
  const { client, tools } = await session();
  if (pickTool(tools, ["list_problems"])) {
    const out = await call(["list_problems"], { problemId, filter: `problemId="${problemId}"` });
    const arr = Array.isArray(out) ? out : out?.problems || (out ? [out] : []);
    const hit = arr.find?.((p) => p?.problemId === problemId || p?.displayId === problemId) || arr[0];
    if (hit) return hit;
  }
  const dqlTool = pickTool(tools, ["execute_dql"]);
  if (dqlTool) {
    const dql = `fetch dt.davis.problems | filter problemId == "${problemId}" | limit 1`;
    const out = await client.callTool({ name: dqlTool, arguments: { dqlStatement: dql, query: dql } });
    const parsed = parseResult(out);
    const rows = parsed?.records || parsed?.result || (Array.isArray(parsed) ? parsed : []);
    if (rows?.length) return rows[0];
  }
  throw new Error(`Dynatrace MCP: no usable tool to fetch problem ${problemId}`);
}

/** Health probe: connect + count discovered tools. Returns null on failure (never throws). */
export async function mcpStatus() {
  try {
    const { tools } = await session();
    return { connected: true, tools: tools.size, names: [...tools.keys()].slice(0, 12) };
  } catch (e) {
    return { connected: false, error: String(e.message || e).slice(0, 160) };
  }
}

export async function closeMCP() {
  try { await _session?.client?.close(); } finally { _session = null; }
}
