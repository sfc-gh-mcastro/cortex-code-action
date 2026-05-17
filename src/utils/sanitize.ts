/**
 * Strip invisible and zero-width characters that can be used for prompt injection.
 */
export function stripInvisibleCharacters(content: string): string {
  // Zero-width chars (ZWSP, ZWNJ, ZWJ, BOM)
  content = content.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
  // C0/C1 control characters (except \t, \n, \r)
  content = content.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
    ""
  );
  // Soft hyphen
  content = content.replace(/\u00AD/g, "");
  // Bidi overrides and isolates
  content = content.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
  return content;
}

/**
 * Strip markdown image alt text to prevent hidden prompt injection in images.
 */
export function stripMarkdownImageAltText(content: string): string {
  return content.replace(/!\[[^\]]*\]\(/g, "![](");
}

/**
 * Redact known secret/token patterns from content.
 */
export function redactSecrets(content: string): string {
  return content
    // GitHub tokens
    .replace(/ghp_[A-Za-z0-9_]{36,}/g, "[REDACTED]")
    .replace(/ghs_[A-Za-z0-9_]{36,}/g, "[REDACTED]")
    .replace(/gho_[A-Za-z0-9_]{36,}/g, "[REDACTED]")
    .replace(/github_pat_[A-Za-z0-9_]{22,}/g, "[REDACTED]")
    // Snowflake tokens
    .replace(/[A-Za-z0-9+/]{64,}={0,2}/g, (match) => {
      // Only redact if it looks like a base64 key (not just normal text)
      if (match.length > 100) return "[REDACTED_KEY]";
      return match;
    })
    // Generic API keys
    .replace(/(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^\s'"]+/gi, "[REDACTED]")
    // Slack tokens
    .replace(/xoxb-[0-9-]+[a-zA-Z0-9-]+/g, "[REDACTED]");
}

/**
 * Sanitize content to remove potential secrets and prompt injection vectors
 * before posting publicly.
 */
export function sanitizeContent(content: string): string {
  content = stripInvisibleCharacters(content);
  content = stripMarkdownImageAltText(content);
  content = redactSecrets(content);
  return content;
}
