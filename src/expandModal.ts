import { App, Modal, Notice, Setting } from "obsidian";
import type { AIExpanderSettings, ProviderId } from "./settings";
import type { AIProvider } from "./providers/types";
import { OmlxProvider } from "./providers/omlx";
import { OpenRouterProvider } from "./providers/openrouter";
import { ClaudeCliProvider } from "./providers/claudeCli";

type Phase = "compose" | "streaming" | "done" | "error";

export type ExpandResult = {
  expansion: string;
  selection: string;
};

export class ExpandModal extends Modal {
  private settings: AIExpanderSettings;
  private selection: string;
  private onAccept: (result: ExpandResult) => void;

  private prompt = "";
  private provider: ProviderId;
  private phase: Phase = "compose";
  private accumulated = "";
  private errorMessage = "";
  private abortController: AbortController | null = null;

  constructor(
    app: App,
    settings: AIExpanderSettings,
    selection: string,
    onAccept: (result: ExpandResult) => void
  ) {
    super(app);
    this.settings = settings;
    this.selection = selection;
    this.onAccept = onAccept;
    this.provider = settings.defaultProvider;
  }

  onOpen() {
    this.modalEl.addClass("ai-expander-modal");
    this.render();
  }

  onClose() {
    this.abortController?.abort();
    this.contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Expand selection with AI" });

    if (this.phase === "compose") {
      this.renderCompose(contentEl);
    } else {
      this.renderPreview(contentEl);
    }
  }

  private renderCompose(root: HTMLElement) {
    const selField = root.createDiv({ cls: "ai-expander-field" });
    selField.createEl("label", { text: "Selection" });
    const selBox = selField.createEl("textarea", { cls: "ai-expander-selection" });
    selBox.value = this.selection;
    selBox.readOnly = true;
    selBox.rows = 6;

    const promptField = root.createDiv({ cls: "ai-expander-field" });
    promptField.createEl("label", { text: "Your prompt" });
    const promptBox = promptField.createEl("textarea", { cls: "ai-expander-prompt" });
    promptBox.placeholder = "e.g. Expand this into a longer paragraph with more concrete examples";
    promptBox.value = this.prompt;
    promptBox.rows = 4;
    promptBox.addEventListener("input", () => {
      this.prompt = promptBox.value;
    });
    setTimeout(() => promptBox.focus(), 0);

    const row = root.createDiv({ cls: "ai-expander-row" });
    row.createEl("label", { text: "Provider:" });
    const providerSel = row.createEl("select", { cls: "ai-expander-provider" });
    for (const opt of [
      { v: "omlx", t: "oMLX (local)" },
      { v: "openrouter", t: "OpenRouter" },
      { v: "claude-cli", t: "Claude CLI" },
    ] as const) {
      const o = providerSel.createEl("option", { text: opt.t });
      o.value = opt.v;
      if (opt.v === this.provider) o.selected = true;
    }
    providerSel.addEventListener("change", () => {
      this.provider = providerSel.value as ProviderId;
    });

    const buttons = root.createDiv({ cls: "ai-expander-buttons" });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    const expandBtn = buttons.createEl("button", { text: "Expand", cls: "mod-cta" });
    expandBtn.addEventListener("click", () => {
      if (!this.prompt.trim()) {
        new Notice("Enter a prompt first");
        return;
      }
      this.startStreaming();
    });

    promptBox.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey)) {
        evt.preventDefault();
        expandBtn.click();
      }
    });
  }

  private renderPreview(root: HTMLElement) {
    const out = root.createDiv({ cls: "ai-expander-output" });
    out.setText(this.accumulated || "…");

    const status = root.createDiv({ cls: "ai-expander-status" });
    if (this.phase === "streaming") {
      status.setText(`Streaming from ${this.providerLabel()}…`);
    } else if (this.phase === "done") {
      status.setText(`Done. ${this.accumulated.length} characters generated.`);
    } else if (this.phase === "error") {
      status.setText("Failed.");
      const err = root.createDiv({ cls: "ai-expander-error" });
      err.setText(this.errorMessage);
    }

    const buttons = root.createDiv({ cls: "ai-expander-buttons" });

    if (this.phase === "streaming") {
      const stop = buttons.createEl("button", { text: "Stop" });
      stop.addEventListener("click", () => {
        this.abortController?.abort();
      });
      return;
    }

    const back = buttons.createEl("button", { text: "Back" });
    back.addEventListener("click", () => {
      this.accumulated = "";
      this.errorMessage = "";
      this.phase = "compose";
      this.render();
    });

    if (this.phase === "error") {
      const retry = buttons.createEl("button", { text: "Retry", cls: "mod-cta" });
      retry.addEventListener("click", () => this.startStreaming());
      return;
    }

    const reject = buttons.createEl("button", { text: "Reject" });
    reject.addEventListener("click", () => {
      new Notice("Expansion discarded");
      this.close();
    });
    const accept = buttons.createEl("button", { text: "Accept", cls: "mod-cta" });
    accept.addEventListener("click", () => {
      this.onAccept({ expansion: this.accumulated, selection: this.selection });
      this.close();
    });
  }

  private async startStreaming() {
    this.accumulated = "";
    this.errorMessage = "";
    this.phase = "streaming";
    this.abortController = new AbortController();
    this.render();

    const outEl = () => this.contentEl.querySelector(".ai-expander-output");

    const provider = this.makeProvider();
    try {
      await provider.expand({
        systemPrompt: this.settings.systemPrompt,
        userPrompt: this.prompt,
        selection: this.selection,
        signal: this.abortController.signal,
        onToken: (chunk) => {
          this.accumulated += chunk;
          const el = outEl();
          if (el) el.setText(this.accumulated);
        },
      });
      this.phase = "done";
    } catch (err) {
      const e = err as Error;
      if (e.name === "AbortError") {
        this.phase = this.accumulated ? "done" : "compose";
      } else {
        this.errorMessage = e.message ?? String(err);
        this.phase = "error";
      }
    } finally {
      this.abortController = null;
      this.render();
    }
  }

  private makeProvider(): AIProvider {
    switch (this.provider) {
      case "omlx":
        return new OmlxProvider(this.settings.omlx);
      case "openrouter":
        return new OpenRouterProvider(this.settings.openrouter);
      case "claude-cli":
        return new ClaudeCliProvider(this.settings.claudeCli);
    }
  }

  private providerLabel(): string {
    switch (this.provider) {
      case "omlx":
        return `oMLX (${this.settings.omlx.model})`;
      case "openrouter":
        return `OpenRouter (${this.settings.openrouter.model})`;
      case "claude-cli":
        return `Claude CLI${this.settings.claudeCli.model ? ` (${this.settings.claudeCli.model})` : ""}`;
    }
  }
}

// Hint to satisfy unused-import lint if Setting helper proves unneeded.
void Setting;
