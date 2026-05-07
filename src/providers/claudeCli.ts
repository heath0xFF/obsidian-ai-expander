import { spawn } from "child_process";
import type { AIProvider, ExpandRequest } from "./types";
import { buildUserMessage } from "../prompts";

export class ClaudeCliProvider implements AIProvider {
  readonly id = "claude-cli" as const;

  constructor(private opts: { binaryPath: string; model: string }) {}

  expand(req: ExpandRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["-p", "--append-system-prompt", req.systemPrompt];
      if (this.opts.model) args.push("--model", this.opts.model);

      let child;
      try {
        child = spawn(this.opts.binaryPath || "claude", args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        reject(new Error(`Failed to spawn '${this.opts.binaryPath}': ${(err as Error).message}`));
        return;
      }

      let full = "";
      let stderr = "";
      let settled = false;

      const onAbort = () => {
        if (!settled) {
          settled = true;
          try {
            child.kill();
          } catch {
            /* ignore */
          }
          reject(new DOMException("Aborted", "AbortError"));
        }
      };

      if (req.signal.aborted) {
        onAbort();
        return;
      }
      req.signal.addEventListener("abort", onAbort, { once: true });

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (data: string) => {
        full += data;
        req.onToken(data);
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (data: string) => {
        stderr += data;
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        req.signal.removeEventListener("abort", onAbort);
        reject(new Error(`claude CLI error: ${err.message}`));
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        req.signal.removeEventListener("abort", onAbort);
        if (code === 0) {
          resolve(full);
        } else {
          reject(
            new Error(
              `claude CLI exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`
            )
          );
        }
      });

      try {
        child.stdin.write(buildUserMessage(req.userPrompt, req.selection));
        child.stdin.end();
      } catch (err) {
        if (settled) return;
        settled = true;
        req.signal.removeEventListener("abort", onAbort);
        reject(new Error(`Failed to write to claude stdin: ${(err as Error).message}`));
      }
    });
  }
}
