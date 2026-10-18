# ChatGPT Plus / Codex mobile setup (EXPERIMENTAL)

This branch adds a **Codex CLI runner** as an alternative to Claude. It is not yet production-tested and does not provide a running server by itself.

## No extra AI subscription
- Use GitHub Codespaces from your Android browser. GitHub's free quota is limited and Codespaces suspends when idle.
- In the Codespaces terminal, install the official CLI: `npm install -g @openai/codex`.
- Sign in to your own Plus account: `codex login --device-auth`, then complete the login in your phone browser. Do not send login codes or tokens to anyone.
- In your AttentionOS workspace configuration set `runner: { engine: "codex" }`.
- Run `codex exec --json --sandbox read-only "Say hello"` first to test login.

## Limitations
- ChatGPT Plus is **not** a general-purpose OpenAI API key and cannot be plugged into API endpoints.
- Codex CLI usage has plan limits. Free GitHub Codespaces compute also has limits. Never select billable overages.
- This Codex bridge is experimental: tools, MCP, structured output and session persistence may need further adjustments.
- The project still has other Claude-specific paths and onboarding checks; these are **not fully migrated**.
- No Zernio or Instagram credentials have been added. Do not commit API keys or private tokens.
- Do not enable automatic posting or DMs until permissions and approvals have been verified.
