/**
 * Downloads images attached to GitHub comments, issues, and PRs.
 *
 * GitHub user-attachment URLs require authentication. This module:
 * 1. Extracts image URLs from markdown/HTML in comment bodies
 * 2. Fetches HTML-rendered versions to get signed download URLs
 * 3. Downloads images to a local temp directory
 * 4. Returns a URL-to-path map for replacement in prompt text
 */

import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import type { Octokit } from "@octokit/rest";

const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL ?? "https://github.com";

const escapedUrl = GITHUB_SERVER_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches markdown image syntax with GitHub user-attachment URLs */
const MARKDOWN_IMAGE_REGEX = new RegExp(
  `!\\[[^\\]]*\\]\\((${escapedUrl}\\/user-attachments\\/assets\\/[^)]+)\\)`,
  "g"
);

/** Matches HTML img tags with GitHub user-attachment URLs */
const HTML_IMG_REGEX = new RegExp(
  `<img[^>]+src=["']([^"']*${escapedUrl}\\/user-attachments\\/assets\\/[^"']+)["'][^>]*>`,
  "gi"
);

/** Matches signed URLs in GitHub's rendered HTML */
const SIGNED_URL_REGEX =
  /https:\/\/private-user-images\.githubusercontent\.com\/[^"'\s]+\?jwt=[^"'\s]+/g;

const DOWNLOADS_DIR = "/tmp/github-images";

export interface ImageSource {
  type: "issue_body" | "pr_body" | "comment";
  id: number;
  body: string;
}

/**
 * Extracts GitHub user-attachment image URLs from a text body.
 */
export function extractImageUrls(body: string): string[] {
  const markdownMatches = [...body.matchAll(MARKDOWN_IMAGE_REGEX)];
  const markdownUrls = markdownMatches.map((m) => m[1]!);

  const htmlMatches = [...body.matchAll(HTML_IMG_REGEX)];
  const htmlUrls = htmlMatches.map((m) => m[1]!);

  return [...new Set([...markdownUrls, ...htmlUrls])];
}

/**
 * Downloads images from GitHub comments/issues/PRs and returns a
 * map of original URLs to local file paths.
 */
export async function downloadImages(
  octokit: Octokit,
  owner: string,
  repo: string,
  sources: ImageSource[]
): Promise<Map<string, string>> {
  const urlToPath = new Map<string, string>();

  // Find sources that actually contain images
  const sourcesWithImages = sources
    .map((s) => ({ source: s, urls: extractImageUrls(s.body) }))
    .filter(({ urls }) => urls.length > 0);

  if (sourcesWithImages.length === 0) {
    return urlToPath;
  }

  await mkdir(DOWNLOADS_DIR, { recursive: true });
  console.log(
    `Found images in ${sourcesWithImages.length} source(s), downloading...`
  );

  for (const { source, urls } of sourcesWithImages) {
    try {
      const bodyHtml = await fetchHtmlBody(octokit, owner, repo, source);
      if (!bodyHtml) {
        console.warn(
          `Could not get HTML body for ${source.type} ${source.id}`
        );
        continue;
      }

      // Extract signed URLs from the HTML
      const signedUrls = bodyHtml.match(SIGNED_URL_REGEX) || [];

      // Download each image (match signed URLs to original URLs by position)
      for (let i = 0; i < Math.min(signedUrls.length, urls.length); i++) {
        const signedUrl = signedUrls[i]!;
        const originalUrl = urls[i]!;

        if (urlToPath.has(originalUrl)) continue;

        try {
          const ext = getImageExtension(originalUrl);
          const filename = `image-${Date.now()}-${i}${ext}`;
          const localPath = path.join(DOWNLOADS_DIR, filename);

          const response = await fetch(signedUrl);
          if (!response.ok) {
            console.warn(
              `Failed to download ${originalUrl}: HTTP ${response.status}`
            );
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          await writeFile(localPath, buffer);

          urlToPath.set(originalUrl, localPath);
          console.log(`  Downloaded: ${originalUrl} -> ${localPath}`);
        } catch (err) {
          console.warn(
            `Failed to download image: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      console.warn(
        `Failed to process images for ${source.type} ${source.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(`Downloaded ${urlToPath.size} image(s) total.`);
  return urlToPath;
}

/**
 * Fetches the HTML-rendered body of a GitHub entity to get signed image URLs.
 */
async function fetchHtmlBody(
  octokit: Octokit,
  owner: string,
  repo: string,
  source: ImageSource
): Promise<string | undefined> {
  switch (source.type) {
    case "comment": {
      const { data } = await octokit.issues.getComment({
        owner,
        repo,
        comment_id: source.id,
        mediaType: { format: "full+json" },
      });
      return (data as any).body_html;
    }
    case "issue_body": {
      const { data } = await octokit.issues.get({
        owner,
        repo,
        issue_number: source.id,
        mediaType: { format: "full+json" },
      });
      return (data as any).body_html;
    }
    case "pr_body": {
      const { data } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: source.id,
        mediaType: { format: "full+json" },
      });
      return (data as any).body_html;
    }
  }
}

function getImageExtension(url: string): string {
  const match = url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i);
  return match ? `.${match[1]}` : ".png";
}
