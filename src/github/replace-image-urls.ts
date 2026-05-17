/**
 * Replaces GitHub image URLs with local file paths in text content.
 * Used after downloading images to rewrite prompt text so the agent
 * can read the images from disk.
 */

/**
 * Replaces all occurrences of original URLs with local file paths.
 */
export function replaceImageUrls(
  text: string,
  urlMap: Map<string, string>
): string {
  let result = text;
  for (const [originalUrl, localPath] of urlMap) {
    result = result.replaceAll(originalUrl, localPath);
  }
  return result;
}
