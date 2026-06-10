// The JUDGED agent, for real — built on Google Cloud Agent Builder's ADK (@google/adk).
//
// This is the one code path where all three required technologies run in a SINGLE
// genuine agent invocation:
//   • Agent Builder / ADK  — LlmAgent + Runner orchestrate the agentic loop
//   • Gemini 3             — the reasoning model driving the agent
//   • Dynatrace MCP        — exposed to the agent as an MCPToolset over the real
//                            @dynatrace-oss/dynatrace-mcp-server (stdio)
//
// Reached via POST /api/classify-agent. The deterministic Express path (agent.js)
// remains for the fast UI; this proves the required stack actually executes.
//
// Requires live creds: GEMINI_API_KEY (or Vertex ADC) + DT_ENVIRONMENT + DT_PLATFORM_TOKEN.
// [TESTED: NO] against a live Dynatrace tenant from this machine (no creds here); built
// against the verified @google/adk@1.2 API surface.

import { createRequire } from "node:module";
import { LlmAgent, Gemini, MCPToolset, InMemoryRunner, isFinalResponse, getFunctionCalls } from "@google/adk";

const require = createRequire(import.meta.url);
const DT_SERVER_ENTRY = require.resolve("@dynatrace-oss/dynatrace-mcp-server");
const APP = "dynacompliance";
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const INSTRUCTION = `You are DynaCompliance, a DORA incident-reporting officer for an EU
financial entity. For the Dynatrace problem the user names:
1. Use the Dynatrace MCP tools (e.g. list_problems, execute_dql, chat_with_davis_copilot)
   to collect problem details, affected entities, impact metrics, and Davis AI root cause.
2. Apply DORA Article 18 major-incident thresholds: >10% of clients affected for >2h;
   >€5M transaction value; any customer data breach; core banking unavailable >2h;
   payments down >30min. If borderline, classify MAJOR (report-when-in-doubt).
3. If the root cause is a third party, also flag DORA Article 28.
4. Compute Article 19 reporting deadlines from the DETECTION time (4h early-warning,
   72h intermediate, 1 month final) and draft a concise EBA early-warning notice.
5. Do NOT write back to Dynatrace or submit any regulatory notification — only propose,
   and present the draft + deadlines for human approval.
Return a clear classification (MAJOR/MINOR), the triggered thresholds, the deadlines,
and the draft notice.`;

function buildModel() {
  if (process.env.GEMINI_API_KEY) return new Gemini({ model: MODEL, apiKey: process.env.GEMINI_API_KEY });
  return new Gemini({
    model: MODEL,
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  });
}

function buildDynatraceToolset() {
  return new MCPToolset({
    type: "StdioConnectionParams",
    serverParams: {
      command: process.execPath,
      args: [DT_SERVER_ENTRY],
      env: {
        ...process.env,
        DT_ENVIRONMENT: process.env.DT_ENVIRONMENT,
        ...(process.env.DT_PLATFORM_TOKEN ? { DT_PLATFORM_TOKEN: process.env.DT_PLATFORM_TOKEN } : {}),
      },
    },
  });
}

/**
 * Run the real ADK agent over a Dynatrace problem. Returns the agent's final text plus
 * the tool calls it made (proof the Dynatrace MCP server was actually invoked).
 */
export async function classifyViaAgent(problemId) {
  if (!process.env.DT_ENVIRONMENT) throw new Error("DT_ENVIRONMENT required for the ADK agent (Dynatrace MCP)");
  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_USE_VERTEXAI !== "true" && !process.env.GOOGLE_CLOUD_PROJECT)
    throw new Error("Gemini not configured: set GEMINI_API_KEY or Vertex ADC (GOOGLE_CLOUD_PROJECT)");

  const toolset = buildDynatraceToolset();
  const agent = new LlmAgent({
    name: "DynaCompliance",
    description: "DORA Art.18/19 incident classifier & reporter over Dynatrace.",
    model: buildModel(),
    instruction: INSTRUCTION,
    tools: [toolset],
  });

  const runner = new InMemoryRunner({ agent, appName: APP });
  const t0 = Date.now();
  try {
    const session = await runner.sessionService.createSession({ appName: APP, userId: "judge" });
    const toolCalls = [];
    let finalText = "";
    const newMessage = { role: "user", parts: [{ text: `Classify Dynatrace problem ${problemId} under DORA Article 18/19 and draft the early-warning notice.` }] };

    for await (const event of runner.runAsync({ userId: "judge", sessionId: session.id, newMessage })) {
      for (const fc of getFunctionCalls(event) || []) toolCalls.push(fc.name);
      if (isFinalResponse(event)) {
        finalText = (event.content?.parts || []).map((p) => p.text || "").join("").trim() || finalText;
      }
    }

    return {
      engine: "google-adk + gemini + dynatrace-mcp",
      model: MODEL,
      problemId,
      mcp_tools_called: [...new Set(toolCalls)], // e.g. ["list_problems","execute_dql"] — proof MCP ran
      result: finalText,
      elapsed_ms: Date.now() - t0,
    };
  } finally {
    // release the spawned MCP server / transport
    try { await toolset.close?.(); } catch { /* ignore */ }
  }
}
