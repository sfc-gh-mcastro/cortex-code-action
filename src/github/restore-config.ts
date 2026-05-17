/**
 * Restores security-sensitive config paths from the PR base branch.
 *
 * When a PR is checked out, the working directory contains attacker-controlled
 * files. Cortex Code reads config from cwd at startup — `.mcp.json`, settings,
 * instruction files — which could execute hooks, set dangerous env vars
 * (NODE_OPTIONS, LD_PRELOAD), or auto-approve MCP servers.
 *
 * This module replaces those files with the versions from the PR's base branch
 * (which a maintainer has reviewed and merged). Paths that don't exist on
 * base are deleted.
 *
 * Known limitation: if a PR legitimately modifies these paths and the CLI later
 * commits with `git add -A`, the revert will be included. This is a narrow UX
 * tradeoff for closing the RCE surface.
 */

import { execFileSync } from "child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "fs";
import { dirname } from "path";
import { validateBranchName } from "./validate-branch";

/**
 * Paths that are PR-controllable and read from cwd at CLI startup.
 *
 * Deliberately excluded:
 *   .git/        — not tracked by git; PR commits cannot place files there.
 *   .gitconfig   — git reads ~/.gitconfig and .git/config, never cwd/.gitconfig.
 *   .bashrc etc. — shells source from $HOME; checkout cannot reach $HOME.
 *   .vscode/.idea— IDE config; nothing in the CLI's startup path reads them.
 */
const SENSITIVE_PATHS = [
  ".cortex",
  ".mcp.json",
  ".gitmodules",
  ".ripgreprc",
  "CORTEX.md",
  "CORTEX.local.md",
  ".husky",
];

const CORTEX_PR_EXCLUDE_PATTERN = "/.cortex-pr/";

/**
 * Ensures .cortex-pr/ is excluded from git staging via .git/info/exclude.
 * This prevents the snapshot directory from leaking into commits.
 */
function ensureCortexPrExcludedFromGit(): void {
  const excludePath = execFileSync(
    "git",
    ["rev-parse", "--git-path", "info/exclude"],
    { encoding: "utf8" }
  ).trim();

  const excludeContents = existsSync(excludePath)
    ? readFileSync(excludePath, "utf8")
    : "";

  if (excludeContents.split(/\r?\n/).includes(CORTEX_PR_EXCLUDE_PATTERN)) {
    return;
  }

  mkdirSync(dirname(excludePath), { recursive: true });

  const prefix =
    excludeContents.length === 0 || excludeContents.endsWith("\n") ? "" : "\n";
  appendFileSync(excludePath, `${prefix}${CORTEX_PR_EXCLUDE_PATTERN}\n`);
}

/**
 * Restores security-sensitive config paths from the PR base branch.
 *
 * @param baseBranch - PR base branch name. Validated before use.
 */
export function restoreConfigFromBase(baseBranch: string): void {
  validateBranchName(baseBranch);

  console.log(
    `[Security] Restoring sensitive paths from origin/${baseBranch} (PR head is untrusted)`
  );
  console.log(`  Paths: ${SENSITIVE_PATHS.join(", ")}`);

  // Snapshot PR-authored sensitive paths into .cortex-pr/ before deletion.
  // Review agents can inspect what the PR changed without those files ever
  // being executed by the CLI.
  rmSync(".cortex-pr", { recursive: true, force: true });
  for (const p of SENSITIVE_PATHS) {
    if (existsSync(p)) {
      cpSync(p, `.cortex-pr/${p}`, { recursive: true, dereference: true });
    }
  }
  if (existsSync(".cortex-pr")) {
    console.log(
      "  Preserved PR's sensitive paths -> .cortex-pr/ (for inspection, not executed)"
    );
    ensureCortexPrExcludedFromGit();
  }

  // Delete PR-controlled versions BEFORE fetching so attacker-controlled
  // .gitmodules is absent during the network operation. If git reads .gitmodules
  // during fetch (fetch.recurseSubmodules=on-demand), it would attempt to fetch
  // submodule objects and block on credential prompts — causing an indefinite hang.
  for (const p of SENSITIVE_PATHS) {
    rmSync(p, { recursive: true, force: true });
  }

  // Fetch the base branch. --no-recurse-submodules is defense-in-depth
  // alongside the .gitmodules delete above.
  execFileSync(
    "git",
    ["fetch", "origin", baseBranch, "--depth=1", "--no-recurse-submodules"],
    { stdio: "inherit" }
  );

  // Restore each sensitive path from the base branch.
  // Paths that don't exist on base stay deleted (safe default).
  for (const p of SENSITIVE_PATHS) {
    try {
      execFileSync("git", ["checkout", `origin/${baseBranch}`, "--", p], {
        stdio: "pipe",
      });
    } catch {
      // Path doesn't exist on base — it stays deleted. This is expected.
    }
  }

  // `git checkout <ref> -- <path>` stages the restored files. Unstage them
  // so the revert doesn't silently leak into commits the CLI makes later.
  try {
    execFileSync("git", ["reset", "--", ...SENSITIVE_PATHS], {
      stdio: "pipe",
    });
  } catch {
    // Nothing was staged, or paths don't exist on HEAD — either is fine.
  }

  console.log("  [Security] Sensitive paths restored from base branch.");
}
