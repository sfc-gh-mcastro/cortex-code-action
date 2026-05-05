import type {
  GitHubContext,
} from "../github/context";
import type { PRData, IssueData, CommentData, ChangedFileData } from "../github/data";

export interface PromptParts {
  systemPromptAppend: string;
  userPrompt: string;
}

export function createPrompt(
  ctx: GitHubContext,
  data: PRData | IssueData,
  triggerPhrase: string,
  customSystemPrompt: string
): PromptParts {
  const userRequest = extractUserRequest(
    ctx.triggerCommentBody,
    triggerPhrase
  );

  let contextSection: string;
  if (ctx.isPR && "headBranch" in data) {
    contextSection = formatPRContext(data, ctx);
  } else {
    contextSection = formatIssueContext(data as IssueData, ctx);
  }

  const commentsSection = formatComments(data.comments);

  const userPrompt = [
    contextSection,
    commentsSection ? `\n## Conversation History\n${commentsSection}` : "",
    `\n## User Request\n${userRequest}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPromptAppend = buildSystemPromptAppend(ctx, customSystemPrompt);

  return { systemPromptAppend, userPrompt };
}

export function extractUserRequest(
  body: string,
  triggerPhrase: string
): string {
  const lowerBody = body.toLowerCase();
  const triggerIdx = lowerBody.indexOf(triggerPhrase.toLowerCase());

  if (triggerIdx === -1) {
    return body.trim();
  }

  const afterTrigger = body.slice(triggerIdx + triggerPhrase.length).trim();
  return afterTrigger || body.trim();
}

function formatPRContext(data: PRData, ctx: GitHubContext): string {
  const lines = [
    `## Pull Request Context`,
    `- **Title:** ${data.title}`,
    `- **Author:** ${data.author}`,
    `- **Branch:** ${data.headBranch} → ${data.baseBranch}`,
    `- **State:** ${data.state}`,
  ];

  if (data.body) {
    lines.push(`\n### Description\n${data.body}`);
  }

  if (data.changedFiles.length > 0) {
    lines.push(`\n### Changed Files`);
    for (const file of data.changedFiles) {
      lines.push(
        `- ${file.filename} (${file.status}) +${file.additions}/-${file.deletions}`
      );
    }
  }

  return lines.join("\n");
}

function formatIssueContext(data: IssueData, ctx: GitHubContext): string {
  const lines = [
    `## Issue Context`,
    `- **Title:** ${data.title}`,
    `- **Author:** ${data.author}`,
    `- **State:** ${data.state}`,
  ];

  if (data.body) {
    lines.push(`\n### Description\n${data.body}`);
  }

  return lines.join("\n");
}

function formatComments(comments: CommentData[]): string {
  if (comments.length === 0) return "";

  return comments
    .map((c) => `[${c.author} at ${c.createdAt}]: ${c.body}`)
    .join("\n\n");
}

function buildSystemPromptAppend(
  ctx: GitHubContext,
  customSystemPrompt: string
): string {
  const parts: string[] = [];

  parts.push(
    `You are operating as a GitHub Action on repository ${ctx.owner}/${ctx.repo}.`
  );
  parts.push(
    `You are responding to a ${ctx.isPR ? "pull request" : "issue"} #${ctx.entityNumber}.`
  );
  parts.push(
    `The user who triggered you is @${ctx.triggerActor}.`
  );
  parts.push(
    `You can read files, edit code, run commands, and search the codebase. ` +
    `When you make changes, commit them to the current branch. ` +
    `When done, update your tracking comment with a summary of what you did.`
  );

  if (customSystemPrompt) {
    parts.push(`\n${customSystemPrompt}`);
  }

  return parts.join("\n");
}
