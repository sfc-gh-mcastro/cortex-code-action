import * as core from "@actions/core";

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (attempt === maxAttempts) {
        core.error(`${label} failed after ${maxAttempts} attempts: ${errMsg}`);
        throw error;
      }
      core.warning(
        `${label} attempt ${attempt}/${maxAttempts} failed: ${errMsg}. Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2; // exponential backoff
    }
  }
  throw new Error("Unreachable");
}
