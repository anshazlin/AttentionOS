import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "./llm.ts";

/**
 * Experimental ChatGPT-plan Codex CLI bridge.
 * Runs only after the user authenticates with 'codex login --device-auth'.
 * Intentionally does not pass OPENAI_API_KEY (separately billed API usage).
 */
export function codexCliQuery({ bin = "codex" }: { bin?: string } = {}): QueryFn {
  return async function* ({ prompt, options = {} }: { prompt: string; options?: Options }): AsyncIterable<SDKMessage> {
    const env = { ...process.env, ...(options.env ?? {}) } as NodeJS.ProcessEnv;
    delete env.OPENAI_API_KEY;
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
    const promptText = typeof options.systemPrompt === "string" ? options.systemPrompt + "\n\n" + prompt : prompt;
    const args = ["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "-"];
    const child = spawn(bin, args, { cwd: options.cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.end(promptText);
    const errors: string[] = [];
    child.stderr.on("data", data => errors.push(String(data)));
    const status = new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    const onAbort = () => child.kill("SIGTERM");
    options.abortController?.signal.addEventListener("abort", onAbort, { once: true });
    let answer = "";
    let sessionId = "";
    try {
      for await (const line of createInterface({ input: child.stdout })) {
        let event: any;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === "thread.started") {
          sessionId = event.thread_id || "";
          yield { type: "system", subtype: "init", session_id: sessionId, apiKeySource: "none" } as unknown as SDKMessage;
        } else if (event.type === "item.completed" && event.item?.type === "agent_message") {
          answer = event.item.text || "";
          yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text: answer }] } } as unknown as SDKMessage;
        } else if (event.type === "turn.failed" || event.type === "error") {
          errors.push(event.message || "Codex run failed");
        }
      }
      const code = await status;
      yield { type: "result", subtype: code === 0 && answer ? "success" : "error_during_execution", is_error: code !== 0 || !answer, result: answer || errors.join("\n"), duration_ms: 0, duration_api_ms: 0, num_turns: 1, total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 } } as unknown as SDKMessage;
    } finally {
      options.abortController?.signal.removeEventListener("abort", onAbort);
      if (!child.killed) child.kill();
    }
  };
}
