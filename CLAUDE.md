# CORTEX.md

## Commands

```bash
bun test                # Run tests
bun run typecheck       # TypeScript type checking
bun run format          # Format with prettier
bun run format:check    # Check formatting
```

## What This Is

A GitHub Action that lets Cortex Code respond to `@cortex-code` mentions on issues/PRs (tag mode) or run tasks via `prompt` input (agent mode). Mode is auto-detected: if `prompt` is provided, it's agent mode; if triggered by a comment event with `@cortex-code`, it's tag mode.

Based on [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) but adapted for Snowflake's Cortex Code platform — uses Snowflake authentication (key-pair or API key) and the `cortex-code-agent-sdk` instead of the Anthropic SDK.

## How It Runs

Single entrypoint: `src/entrypoints/run.ts` orchestrates everything in 6 phases:

1. **Parse context** — determine event type, extract trigger info
2. **Auth & permissions** — validate GitHub write access, set up Snowflake connection
3. **Security** — restore sensitive config from base branch on PRs (`restoreConfigFromBase`)
4. **Fetch data** — GraphQL queries for PR/issue data, download images from comments
5. **Run Cortex Code** — invoke the agent via SDK with MCP servers, allowed tools, and constructed prompt
6. **Cleanup** — update tracking comment, write step summary, set outputs

## Key Architecture

```
src/
├── entrypoints/run.ts       # Main orchestrator (single entry point)
├── cortex/                  # Cortex Code CLI installation, connection, SDK runner
├── create-prompt/           # Prompt construction (tag mode and agent mode)
├── github/                  # GitHub API layer
│   ├── context.ts           # Event parsing, trigger detection
│   ├── auth.ts              # Token management, permission checks
│   ├── comments.ts          # Tracking comment CRUD
│   ├── data/fetcher.ts      # GraphQL data fetching (PR/issue/comments)
│   ├── image-downloader.ts  # Download images from comments for multimodal
│   ├── replace-image-urls.ts
│   ├── restore-config.ts    # Security: restore sensitive paths from base branch
│   └── validate-branch.ts   # Branch name validation (anti-injection)
├── mcp/                     # MCP servers (spawned as child processes)
│   ├── github-comment-server.ts        # update_cortex_comment tool
│   ├── github-actions-server.ts        # get_ci_status, get_workflow_run_details
│   ├── github-inline-comment-server.ts # create_inline_comment (line-level review)
│   └── install-mcp.ts                  # Conditional MCP server registration
└── utils/
    ├── sanitize.ts          # Secret redaction + prompt injection defense
    ├── branch.ts            # Branch name generation
    └── retry.ts             # Retry with backoff
```

## Key Concepts

**Auth**: Snowflake auth via `SNOWFLAKE_ACCOUNT` + `SNOWFLAKE_USER` + either `SNOWFLAKE_PRIVATE_KEY` (key-pair) or `SNOWFLAKE_API_KEY` (PAT). GitHub auth via `GITHUB_TOKEN` (default: `github.token`). Connection setup in `src/cortex/connection.ts`.

**MCP servers**: Three built-in servers, conditionally registered in `src/mcp/install-mcp.ts`:
- `github_comment` — always on (tracking comment updates)
- `github_ci` — PRs only, when head SHA is available
- `github_inline_comment` — PRs only (line-level code review)

All run as `bun run <path>` child processes via stdio MCP transport.

**Prompt construction**: `src/create-prompt/index.ts` builds the user prompt from PR/issue context (title, body, changed files, comments) and appends a system prompt with instructions for using the tracking comment. Image URLs are replaced with local file paths before prompt construction.

**Security**: On PR events, `restoreConfigFromBase()` replaces attacker-controlled sensitive paths (`.cortex/`, `.mcp.json`, `CORTEX.md`, `.husky/`, `.gitmodules`) with versions from the base branch. PR versions are preserved in `.cortex-pr/` for review but never executed.
