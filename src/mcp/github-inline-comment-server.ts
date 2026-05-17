#!/usr/bin/env bun
/**
 * MCP server that exposes a tool to create inline review comments
 * on specific lines of a PR diff.
 *
 * Security notes:
 * - Only exposes createReviewComment (not createReview), so the agent
 *   cannot approve or request changes on a PR.
 * - PR_NUMBER is fixed at startup — the agent cannot target other PRs.
 * - Comment bodies are sanitized before posting to strip secrets and
 *   prompt injection vectors.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { sanitizeContent } from "../utils/sanitize";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO_OWNER = process.env.REPO_OWNER!;
const REPO_NAME = process.env.REPO_NAME!;
const PR_NUMBER = parseInt(process.env.PR_NUMBER!, 10);

if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME || !process.env.PR_NUMBER) {
  console.error(
    "Error: GITHUB_TOKEN, REPO_OWNER, REPO_NAME, and PR_NUMBER environment variables are required"
  );
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const server = new Server(
  {
    name: "github-inline-comment-server",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_inline_comment",
      description:
        "Create an inline review comment on a specific line or line range in a PR file. " +
        "Supports GitHub code suggestion blocks. " +
        "For code suggestions use: ```suggestion\\nreplacement code\\n```. " +
        "The suggestion block REPLACES the entire selected line range.",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description:
              "The file path to comment on, relative to the repo root (e.g., 'src/index.ts')",
          },
          body: {
            type: "string",
            description:
              "The comment text in markdown. Supports GitHub suggestion blocks: ```suggestion\\ncode\\n```",
          },
          line: {
            type: "number",
            description:
              "Line number for single-line comments, or end line for multi-line comments",
          },
          start_line: {
            type: "number",
            description:
              "Start line for multi-line comments. Use with 'line' as the end line. Omit for single-line comments.",
          },
          side: {
            type: "string",
            enum: ["LEFT", "RIGHT"],
            description:
              "Side of the diff to comment on: LEFT (deleted/old code) or RIGHT (added/new code). Defaults to RIGHT.",
          },
          commit_id: {
            type: "string",
            description:
              "Specific commit SHA to comment on. Defaults to the PR's latest head commit.",
          },
        },
        required: ["path", "body", "line"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "create_inline_comment") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const args = request.params.arguments as {
    path: string;
    body: string;
    line: number;
    start_line?: number;
    side?: "LEFT" | "RIGHT";
    commit_id?: string;
  };

  const sanitizedBody = sanitizeContent(args.body);

  try {
    // Resolve commit_id: use provided or fetch PR head SHA
    let commitId = args.commit_id;
    if (!commitId) {
      const { data: pr } = await octokit.pulls.get({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: PR_NUMBER,
      });
      commitId = pr.head.sha;
    }

    const side = args.side ?? "RIGHT";
    const isSingleLine = !args.start_line;

    const baseParams = {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      pull_number: PR_NUMBER,
      body: sanitizedBody,
      path: args.path,
      side: side as "LEFT" | "RIGHT",
      commit_id: commitId,
    };

    let result;
    if (isSingleLine) {
      const { data } = await octokit.pulls.createReviewComment({
        ...baseParams,
        line: args.line,
      });
      result = data;
    } else {
      const { data } = await octokit.pulls.createReviewComment({
        ...baseParams,
        start_line: args.start_line!,
        start_side: side as "LEFT" | "RIGHT",
        line: args.line,
      });
      result = data;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              comment_id: result.id,
              html_url: result.html_url,
              path: result.path,
              line: result.line ?? result.original_line,
              message: `Inline comment posted on ${args.path}${
                isSingleLine
                  ? ` at line ${args.line}`
                  : ` from line ${args.start_line} to ${args.line}`
              }`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    let helpMessage = "";
    if (errorMessage.includes("Validation Failed")) {
      helpMessage =
        " This usually means the line number is not part of the PR diff, or the file path is incorrect. " +
        "Only lines that appear in the diff can receive inline comments.";
    } else if (errorMessage.includes("Not Found")) {
      helpMessage =
        " The PR, repository, or file path could not be found. Verify the path is correct.";
    }

    return {
      content: [
        {
          type: "text",
          text: `Error creating inline comment: ${errorMessage}${helpMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server fatal error:", error);
  process.exit(1);
});
