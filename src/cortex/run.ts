import { query } from "cortex-code-agent-sdk";
import * as core from "@actions/core";
import type { McpServerConfig } from "./types";

export interface RunCortexOptions {
  prompt: string;
  cwd: string;
  connection: string;
  model: string;
  allowedTools: string[];
  disallowedTools: string[];
  systemPromptAppend: string;
  maxTurns?: number;
  mcpServers: Record<string, McpServerConfig>;
  cliPath?: string;
}

export interface RunResult {
  success: boolean;
  sessionId: string;
  output: string;
  error?: string;
}

export async function runCortexCode(
  options: RunCortexOptions
): Promise<RunResult> {
  const {
    prompt,
    cwd,
    connection,
    model,
    allowedTools,
    disallowedTools,
    systemPromptAppend,
    maxTurns,
    mcpServers,
    cliPath,
  } = options;

  let sessionId = "";
  let output = "";
  let success = true;

  try {
    const queryOptions: Record<string, any> = {
      cwd,
      connection,
      model,
      permissionMode: "bypassPermissions" as const,
      allowDangerouslySkipPermissions: true,
      allowedTools,
      systemPrompt: {
        type: "preset" as const,
        append: systemPromptAppend,
      },
    };

    if (disallowedTools.length > 0) {
      queryOptions.disallowedTools = disallowedTools;
    }
    if (maxTurns) {
      queryOptions.maxTurns = maxTurns;
    }
    if (Object.keys(mcpServers).length > 0) {
      queryOptions.mcpServers = mcpServers;
    }
    if (cliPath) {
      queryOptions.cliPath = cliPath;
    }

    core.info("Starting Cortex Code agent...");

    for await (const message of query({
      prompt,
      options: queryOptions,
    })) {
      if (message.type === "assistant") {
        for (const block of message.content) {
          if (block.type === "text") {
            output += block.text;
            core.info(block.text);
          } else if (block.type === "tool_use") {
            core.info(`Tool: ${block.name}`);
          }
        }
      } else if (message.type === "result") {
        sessionId = (message as any).session_id ?? "";
        if ((message as any).is_error) {
          success = false;
          output += `\nError: ${(message as any).result ?? "Unknown error"}`;
        }
        core.info(`Agent finished: ${(message as any).subtype}`);
      }
    }
  } catch (error) {
    success = false;
    const errMsg = error instanceof Error ? error.message : String(error);
    output += `\nFatal error: ${errMsg}`;
    core.error(`Cortex Code execution failed: ${errMsg}`);
  }

  return { success, sessionId, output, error: success ? undefined : output };
}
