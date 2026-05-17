/**
 * Validates a branch name to prevent shell injection via git commands.
 * Branch names come from PR payloads which are attacker-controlled.
 */

const DANGEROUS_PATTERNS = [
  /\.\./,           // Path traversal
  /[;|&$`\\]/,     // Shell metacharacters
  /\s/,            // Whitespace
  /[\x00-\x1f]/,  // Control characters
  /^-/,            // Starts with dash (git flag injection)
];

export function validateBranchName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error("Branch name cannot be empty");
  }

  if (name.length > 255) {
    throw new Error("Branch name exceeds maximum length (255)");
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(name)) {
      throw new Error(
        `Branch name "${name}" contains dangerous characters and cannot be used`
      );
    }
  }
}
