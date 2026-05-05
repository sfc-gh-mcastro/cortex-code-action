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

/**
 * Create prompt for agent mode (direct prompt input, e.g., PR reviews).
 * Uses the provided prompt as the instruction and prepends PR/issue context.
 */
export function createAgentPrompt(
  ctx: GitHubContext,
  data: PRData | IssueData,
  directPrompt: string,
  customSystemPrompt: string
): PromptParts {
  let contextSection: string;
  if (ctx.isPR && "headBranch" in data) {
    contextSection = formatPRContext(data, ctx);
  } else {
    contextSection = formatIssueContext(data as IssueData, ctx);
  }

  const userPrompt = [
    contextSection,
    `\n## Instructions\n${directPrompt}`,
  ].join("\n");

  const systemPromptAppend = buildSystemPromptAppend(ctx, customSystemPrompt);

  return { systemPromptAppend, userPrompt };
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
    `You have a tracking comment on the PR/issue that you MUST update with your results using the update_cortex_comment tool. ` +
    `Always start the comment body with this exact header:\n` +
    `## <img src="https://www.snowflake.com/wp-content/themes/flavor/assets/img/favicons/favicon-32x32.png" width="20" height="20" /> Cortex Code\n\n` +
    `Then write well-formatted markdown with clear sections, headers, and structure. ` +
    `For code reviews, include a brief summary, then detailed findings with file references. ` +
    `Use tables, bullet points, and code blocks where appropriate. ` +
    `Always call update_cortex_comment as your final action with your complete formatted findings.`
  );
  parts.push(
    `You can read files, edit code, run commands, and search the codebase. ` +
    `When you make changes, commit them to the current branch.`
  );

  if (customSystemPrompt) {
    parts.push(`\n${customSystemPrompt}`);
  }

  return parts.join("\n");
}
