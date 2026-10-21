# AttentionOS Free Mobile — JARVIS + integrations

## Working now
- Tap-to-speak or typed JARVIS commands (Web Speech support depends on Chrome/Android and microphone permissions). Browser speech synthesis reads replies. Not always listening.
- Create draft captions from spoken topics, navigate planner, read upcoming schedules.
- Existing browser-local content planner, calendar, backup/export, ChatGPT prompt builder.
- Instagram publishing and keyword-to-DM editor connected to a server-side **Zernio API adapter**. Adapter refuses all writes until owner secret and Zernio key are set in Vercel.

## Private setup required before sending real posts/DMs
1. Connect an Instagram Business or Creator account at https://zernio.com using official OAuth. Only owner can do this. Personal Instagram accounts aren't eligible.
2. In Zernio, create a read/write API key. **Do not put it in git, ChatGPT messages, or the website.**
3. In the Vercel project `attentionos-free-mobile` add **encrypted environment variables**: `ZERNIO_API_KEY` and `ATTENTIONOS_OWNER_TOKEN` (a separate long random value).
4. Redeploy. In the app Automate page, enter the **owner access code** when needed; it remains in memory only, not localStorage. Enter the Zernio profile/account IDs (these are non-secret).
5. Click Check connection, then create a draft before scheduling or posting publicly. Confirm an automation only after reviewing the DM.

## AI limitations
ChatGPT Plus does not grant unattended OpenAI API access for a hosted web app. The free AI Studio can copy prompts to ChatGPT, or the experimental Codex CLI bridge can be run interactively in a GitHub Codespace with ChatGPT login. Codespaces is not continuously available for free. No honest claim is made that this hosted app has autonomous LLM execution.

## Security limits
- Site is publicly reachable and uses browser-local data, not accounts/sync. Do not use it on shared devices with confidential content.
- Every Zernio operation is protected by a separate owner access code and same-origin checking. API keys are server-side only.
- Zernio has free connected-account allowances but messaging overages may bill; check current pricing.
- Browser voice commands do not auto-post or send DMs. Confirmation and valid credentials are required.