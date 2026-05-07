# Obsidian AI Expander

Highlight text in a note, run **AI Expander: Expand selection with AI** from the command palette, type a prompt, and watch an LLM stream an expansion into a preview. Accept to insert it; reject to discard.

Local-first by default (Ollama). Optional providers: OpenRouter (any model, BYO API key) and the `claude` CLI (reuses your existing Claude Code login).

## Install (development)

```sh
npm install
npm run build
```

Then symlink (or copy) the project into a vault's plugins folder:

```sh
ln -s "$PWD" "/path/to/your/vault/.obsidian/plugins/ai-expander"
```

In Obsidian: Settings → Community plugins → enable **AI Expander**.

For iterative development, `npm run dev` runs esbuild in watch mode; reload Obsidian (Cmd-R inside the developer console, or use the Hot Reload plugin) to pick up changes.

## Usage

1. Highlight a passage in any note.
2. Open the command palette and run **AI Expander: Expand selection with AI**.
3. Enter a directive (e.g. "Expand this into a longer paragraph with more concrete examples"). Optionally switch the provider for this invocation.
4. Press **Expand** (or Cmd/Ctrl-Enter). Tokens stream into the preview.
5. **Accept** replaces (or appends, per settings) your selection with the expansion. **Reject** discards it. **Stop** mid-stream cancels the request.

No default hotkey is registered — bind one in Obsidian's hotkey settings if you want.

## Providers

### Ollama (default, local)

Requires a running Ollama server and at least one pulled model:

```sh
ollama serve
ollama pull llama3.1
```

If the plugin can't reach Ollama from Obsidian's renderer due to CORS, restart the server with the Obsidian origin allowed:

```sh
OLLAMA_ORIGINS='app://obsidian.md' ollama serve
```

(Or set `OLLAMA_ORIGINS=*` for permissive local development.)

In settings, click **Refresh models** to populate the autocomplete dropdown from your local install.

### OpenRouter

Paste your API key in settings, then click **Refresh models** to pull the live catalog. Pick any model id (e.g. `anthropic/claude-sonnet-4.6`, `openai/gpt-4o`, `meta-llama/llama-3.3-70b-instruct`).

### Claude CLI

Uses your existing Claude Code login — no API key needed. Make sure `claude` is on your PATH (or set an absolute path in settings) and you've signed in once interactively. The plugin runs `claude -p --append-system-prompt <system> [--model <model>]` and pipes the directive + selection over stdin.

## Settings

- **Default provider** — which backend the modal picks initially. Override per-invocation in the modal.
- **Accept behavior** — `replace` swaps the selection for the expansion; `append` keeps the original and adds the expansion after it (separated by a blank line).
- **System prompt** — sent to every provider. Edit to change tone or output format.
- Per-provider: base URL / API key / binary path, plus model selector.

## Limitations

- Desktop only (`isDesktopOnly: true`) — the Claude CLI provider needs Node's `child_process`, and streaming `fetch` to `localhost` requires Electron.
- Single-shot only: no multi-turn chat in the modal.
- No persistent history — each expansion is independent.
