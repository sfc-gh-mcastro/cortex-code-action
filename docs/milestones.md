# Cortex Code Action — Milestones

Roadmap for feature parity with [claude-code-action](https://github.com/anthropics/claude-code-action) and beyond, organized by priority.

---

## Currently Implemented (v1.0)

- [x] `@cortex-code` trigger in PR/issue comments (tag mode)
- [x] Direct `prompt` input for automated workflows (agent mode)
- [x] PR review workflow on `pull_request` events
- [x] Cortex Code Agent SDK integration (`query()` API)
- [x] MCP server: GitHub comment updates (`update_cortex_comment`)
- [x] MCP server: CI status inspection (`get_ci_status`, `get_workflow_run_details`)
- [x] Snowflake key-pair and API key authentication
- [x] Write permission validation
- [x] Bot actor filtering
- [x] Content sanitization (token/secret redaction)
- [x] TOCTOU protection (comment time filtering)
- [x] Tracking comment with branding, timing, and job link
- [x] GitHub Step Summary output
- [x] Configurable model, tools, system prompt, max turns

---

## Milestone 1: GitHub App Authentication & OIDC

**Goal:** Support GitHub App token acquisition via OIDC, eliminating the need for users to pass `github_token`.

- [ ] GitHub App OIDC token exchange (like claude-code-action's built-in Claude App)
- [ ] Automatic token generation with minimal permissions
- [ ] `additional_permissions` input for requesting extra scopes
- [ ] Token revocation in post-step cleanup

---

## Milestone 2: Commit Signing & File Operations MCP

**Goal:** Enable verified commits directly from the action via GitHub's API.

- [ ] `use_commit_signing` input flag
- [ ] MCP server: `github-file-ops-server` with `commit_files` and `delete_files` tools
- [ ] Atomic commits via GitHub Git Trees API (creates verified/signed commits)
- [ ] `ssh_signing_key` input for SSH-based commit signing
- [ ] Path validation to prevent traversal attacks

---

## Milestone 3: Inline PR Review Comments

**Goal:** Post review comments on specific lines of code, not just a single tracking comment.

- [ ] MCP server: `github-inline-comment-server`
- [ ] `create_inline_comment` tool with line range support
- [ ] Code suggestion blocks (```suggestion syntax)
- [ ] Comment buffering system (prevent probe/test comments from being posted)
- [ ] `classify_inline_comments` input — classify buffered comments as real vs. test using AI
- [ ] Post-step: flush buffered inline comments after classification

---

## Milestone 4: Advanced Trigger Modes

**Goal:** Support all trigger mechanisms from claude-code-action.

- [ ] `assignee_trigger` — trigger when a specific username is assigned
- [ ] `label_trigger` — trigger when a label (e.g., `cortex-code`) is applied
- [ ] `allowed_bots` — allow specific bot usernames to trigger (or `*` for all)
- [ ] `include_comments_by_actor` / `exclude_comments_by_actor` — filter which comments are included in context
- [ ] Support for `pull_request_review` event (review body triggers)
- [ ] Support for `workflow_dispatch` / `repository_dispatch` events

---

## Milestone 5: Branch Management

**Goal:** Automatically create and manage branches for changes.

- [ ] `branch_name_template` with variables (`{{prefix}}`, `{{entityType}}`, `{{entityNumber}}`, `{{timestamp}}`, `{{sha}}`, `{{description}}`)
- [ ] Auto-create branch from base when agent makes changes
- [ ] `base_branch` input (defaults to repo default branch)
- [ ] Branch name validation to prevent injection
- [ ] Checkout created branch before running agent

---

## Milestone 6: Security Hardening

**Goal:** Match claude-code-action's security posture for enterprise use.

- [ ] `restoreConfigFromBase()` — restore `.cortex/` and settings from base branch on PRs (prevent attacker-controlled config in PR branches)
- [ ] Subprocess isolation via bubblewrap (Linux sandboxing for untrusted users)
- [ ] `allowed_non_write_users` input — allow non-collaborators with sandboxed execution
- [ ] Secret scrubbing from subprocess environments
- [ ] `acceptEdits` permission mode — restrict file writes to `$GITHUB_WORKSPACE`
- [ ] WebSearch/WebFetch disabled by default (prevent data exfiltration)

---

## Milestone 7: Sticky Comments & UX Polish

**Goal:** Better comment management and user experience.

- [ ] `use_sticky_comment` — reuse a single comment across multiple triggers (edit instead of creating new)
- [ ] `include_fix_links` — add "Fix this" links in review feedback that re-trigger the action
- [ ] `display_report` — show Cortex Code Report in GitHub Step Summary
- [ ] `show_full_output` — option to show full JSON execution output (with warning about secrets)
- [ ] Progress streaming — update tracking comment with real-time tool calls

---

## Milestone 8: Plugins & Extensibility

**Goal:** Support custom plugins and marketplace extensions.

- [ ] `plugins` input — newline-separated plugin directory names
- [ ] `plugin_marketplaces` — Git URLs for plugin marketplace repos
- [ ] Plugin installation step in composite action
- [ ] Custom MCP server configuration via user input (connect arbitrary MCP servers)

---

## Milestone 9: Multi-Provider Support

**Goal:** Run Cortex Code through different cloud providers.

- [ ] `use_bedrock` — Amazon Bedrock with OIDC authentication
- [ ] `use_vertex` — Google Vertex AI with OIDC authentication
- [ ] Cross-region inference configuration
- [ ] Provider-specific model routing

---

## Milestone 10: Session Management & Structured Output

**Goal:** Advanced agent control and output capabilities.

- [ ] `--resume` support — continue a previous session by ID
- [ ] `--json-schema` structured output — force agent to return validated JSON
- [ ] `structured_output` action output — parsed JSON from schema enforcement
- [ ] Multi-turn sessions for complex tasks (agent can ask follow-up questions via comments)
- [ ] `claude_code_config_file` equivalent — point to a project-level settings file

---

## Milestone 11: Base Action (Standalone)

**Goal:** A minimal action for running Cortex Code without GitHub PR/issue orchestration.

- [ ] Separate `base-action/action.yml` for headless execution
- [ ] Inputs: `prompt`, `prompt_file`, `settings`, `claude_args`
- [ ] Outputs: `conclusion`, `execution_file`, `structured_output`, `session_id`
- [ ] No GitHub context parsing, no trigger detection, no branching
- [ ] Useful for CI pipelines, scheduled tasks, custom automation

---

## Milestone 12: Testing & Reliability

**Goal:** Production-grade testing and reliability guarantees.

- [ ] Integration tests with mock GitHub API
- [ ] End-to-end tests in a dedicated test repository
- [ ] Retry logic for all API calls (GitHub + Snowflake)
- [ ] Graceful timeout handling for long-running agent tasks
- [ ] Rate limit detection and backoff for GitHub API
- [ ] Comprehensive error taxonomy and user-friendly error messages

---

## Future Ideas

- **PR auto-merge** — merge PRs automatically after successful review + CI
- **Issue triage** — auto-label and assign issues based on content analysis
- **Codebase onboarding** — generate documentation for new contributors
- **Dependency updates** — review and approve Dependabot PRs
- **Custom workflows** — user-defined multi-step workflows (review → fix → test → merge)
- **Slack/Teams notifications** — post results to messaging platforms
- **Cost tracking** — report token usage and cost per run
- **Dashboard** — web UI showing action history and analytics
