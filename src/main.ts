import { Editor, Notice, Plugin } from "obsidian";
import { AIExpanderSettings, DEFAULT_SETTINGS } from "./settings";
import { ExpandModal } from "./expandModal";
import { AIExpanderSettingTab } from "./settingsTab";

export default class AIExpanderPlugin extends Plugin {
  settings: AIExpanderSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "expand-selection",
      name: "Expand selection with AI",
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection();
        if (!selection) {
          new Notice("Select some text first");
          return;
        }
        new ExpandModal(this.app, this.settings, selection, ({ expansion, selection: original }) => {
          if (!expansion.trim()) {
            new Notice("Empty expansion — nothing to insert");
            return;
          }
          if (this.settings.acceptBehavior === "append") {
            editor.replaceSelection(original + "\n\n" + expansion);
          } else {
            editor.replaceSelection(expansion);
          }
        }).open();
      },
    });

    this.addSettingTab(new AIExpanderSettingTab(this.app, this));
  }

  onunload() {
    /* commands and settings tab are auto-cleaned by Obsidian */
  }

  async loadSettings() {
    const stored = (await this.loadData()) as Partial<AIExpanderSettings> | null;
    this.settings = mergeSettings(DEFAULT_SETTINGS, stored ?? {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Older versions stored an Ollama-shaped block under `ollama` and used the
// "ollama" provider id. oMLX speaks a different (OpenAI-compatible) API on a
// different URL, so the old baseUrl/model are not reusable — only the
// provider-selection intent is migrated; the rest falls back to oMLX defaults.
type LegacySettings = Omit<Partial<AIExpanderSettings>, "defaultProvider"> & {
  defaultProvider?: AIExpanderSettings["defaultProvider"] | "ollama";
  ollama?: { baseUrl?: string; model?: string };
};

function mergeSettings(
  base: AIExpanderSettings,
  rawPatch: Partial<AIExpanderSettings>
): AIExpanderSettings {
  const patch = rawPatch as LegacySettings;
  const defaultProvider =
    patch.defaultProvider === "ollama"
      ? "omlx"
      : patch.defaultProvider ?? base.defaultProvider;
  return {
    defaultProvider,
    acceptBehavior: patch.acceptBehavior ?? base.acceptBehavior,
    systemPrompt: patch.systemPrompt ?? base.systemPrompt,
    omlx: { ...base.omlx, ...(patch.omlx ?? {}) },
    openrouter: { ...base.openrouter, ...(patch.openrouter ?? {}) },
    claudeCli: { ...base.claudeCli, ...(patch.claudeCli ?? {}) },
  };
}
