import type { Octokit } from "@octokit/rest";

export async function createTrackingComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  botName: string
): Promise<number> {
  const body = `> 🔄 **${botName}** is working on this...\n\n_Processing your request. This comment will be updated with results._`;

  const { data } = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  return data.id;
}

export async function updateTrackingComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  await octokit.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });
}
