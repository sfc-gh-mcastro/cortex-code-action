# cortex-code-action

A GitHub Action that integrates [Snowflake Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) as an AI assistant for pull requests and issues. Mention `@cortex-code` in a comment and it will read your codebase, make changes, and respond.

## Features

- **`@cortex-code` trigger** — Mention `@cortex-code` in any PR or issue comment to invoke the agent
- **Full codebase access** — Reads, writes, edits files, runs commands, searches code
- **PR-aware context** — Automatically includes PR title, description, changed files, and conversation history
- **CI inspection** — Can check GitHub Actions workflow status and debug failures
- **Tracking comments** — Posts a progress comment that updates as work completes
- **Custom MCP servers** — GitHub operations (comment updates, CI status) via Model Context Protocol

## Quick Start

```yaml
# .github/workflows/cortex-code.yml
name: Cortex Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: read

jobs:
  cortex-code:
    if: contains(github.event.comment.body, '@cortex-code')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: sfc-gh-mcastro/cortex-code-action@v1
        with:
          snowflake_account: ${{ secrets.SNOWFLAKE_ACCOUNT }}
          snowflake_user: ${{ secrets.SNOWFLAKE_USER }}
          snowflake_private_key: ${{ secrets.SNOWFLAKE_PRIVATE_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `snowflake_account` | Yes | — | Snowflake account identifier (e.g., `myorg-myaccount`) |
| `snowflake_user` | Yes | — | Snowflake username |
| `snowflake_private_key` | No* | — | Key-pair private key (PEM). *One of `private_key` or `api_key` is required. |
| `snowflake_api_key` | No* | — | API key or PAT. *One of `private_key` or `api_key` is required. |
| `trigger_phrase` | No | `@cortex-code` | Phrase that triggers the action |
| `github_token` | No | `${{ github.token }}` | GitHub token for API operations |
| `model` | No | `auto` | Model identifier (`auto`, `claude-sonnet-4-6`, `openai-gpt-5.2`, etc.) |
| `allowed_tools` | No | — | Comma-separated additional tools to allow |
| `disallowed_tools` | No | — | Comma-separated tools to deny |
| `system_prompt` | No | — | Additional system prompt text |
| `branch_prefix` | No | `cortex-code/` | Prefix for branches created by the agent |
| `max_turns` | No | — | Maximum number of agentic turns |

## Outputs

| Output | Description |
|--------|-------------|
| `branch_name` | Branch created or used by Cortex Code |
| `session_id` | Session ID for resuming conversations |
| `conclusion` | Result status: `success` or `failure` |

## Authentication

### Key-Pair Authentication (recommended)

1. Generate a key pair for your Snowflake user:
   ```sql
   ALTER USER myuser SET RSA_PUBLIC_KEY='...';
   ```
2. Store the private key as a GitHub secret (`SNOWFLAKE_PRIVATE_KEY`)

### API Key Authentication

1. Generate a PAT or API key in Snowflake
2. Store it as a GitHub secret (`SNOWFLAKE_API_KEY`)

## How It Works

1. A user comments `@cortex-code <request>` on a PR or issue
2. The action validates the user has write permissions
3. Posts a tracking comment ("Working on this...")
4. Gathers context: PR/issue metadata, comments, changed files
5. Invokes Cortex Code via the [Agent SDK](https://docs.snowflake.com/en/user-guide/cortex-code-agent-sdk/cortex-code-agent-sdk) with full codebase access
6. Updates the tracking comment with results

## Security

- **Permission checks** — Only users with write access can trigger the action
- **Bot filtering** — Bot accounts are automatically ignored
- **Content sanitization** — Tokens and secrets are redacted from posted comments
- **TOCTOU protection** — Comments created after the trigger event are filtered out

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bunx tsc --noEmit
```

## License

MIT
