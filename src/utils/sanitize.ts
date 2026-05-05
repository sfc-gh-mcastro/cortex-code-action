/**
 * Sanitize content to remove potential secrets before posting publicly.
 */
export function sanitizeContent(content: string): string {
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
