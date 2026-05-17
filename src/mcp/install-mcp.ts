import * as path from "path";
import type { McpServerConfig } from "../cortex/types";

export interface McpInstallOptions {
  githubToken: string;
  owner: string;
  repo: string;
  commentId: number;
  headSha?: string;
  isPR: boolean;
  prNumber?: number;
  actionPath: string;
}

export function prepareMcpConfig(
  options: McpInstallOptions
): Record<string, McpServerConfig> {
  const { githubToken, owner, repo, commentId, headSha, isPR, prNumber, actionPath } =
    options;

  const servers: Record<string, McpServerConfig> = {};

  // Always include the comment server for updating progress
  servers["github_comment"] = {
    command: "bun",
    args: ["run", path.join(actionPath, "src/mcp/github-comment-server.ts")],
    env: {
      GITHUB_TOKEN: githubToken,
      REPO_OWNER: owner,
      REPO_NAME: repo,
      CORTEX_COMMENT_ID: String(commentId),
    },
  };

  // Include CI server only for PRs with a head SHA
  if (isPR && headSha) {
    servers["github_ci"] = {
      command: "bun",
      args: [
        "run",
        path.join(actionPath, "src/mcp/github-actions-server.ts"),
      ],
      env: {
        GITHUB_TOKEN: githubToken,
        REPO_OWNER: owner,
        REPO_NAME: repo,
        HEAD_SHA: headSha,
      },
    };
  }

  // Include inline comment server for PRs (allows line-level review comments)
  if (isPR && prNumber) {
    servers["github_inline_comment"] = {
      command: "bun",
      args: [
        "run",
        path.join(actionPath, "src/mcp/github-inline-comment-server.ts"),
      ],
      env: {
        GITHUB_TOKEN: githubToken,
        REPO_OWNER: owner,
        REPO_NAME: repo,
        PR_NUMBER: String(prNumber),
      },
    };
  }

  return servers;
}
