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
        const raw = editor.getSelection();
        let selection = typeof raw === "string" ? raw : "";
        if (!selection) {
          const domSel = window.getSelection()?.toString() ?? "";
          if (domSel) selection = domSel;
        }
        if (!selection) {
          console.warn("[ai-expander] empty selection. editor.getSelection() returned:", raw);
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

function mergeSettings(
  base: AIExpanderSettings,
  patch: Partial<AIExpanderSettings>
): AIExpanderSettings {
  return {
    defaultProvider: patch.defaultProvider ?? base.defaultProvider,
    acceptBehavior: patch.acceptBehavior ?? base.acceptBehavior,
    systemPrompt: patch.systemPrompt ?? base.systemPrompt,
    ollama: { ...base.ollama, ...(patch.ollama ?? {}) },
    openrouter: { ...base.openrouter, ...(patch.openrouter ?? {}) },
    claudeCli: { ...base.claudeCli, ...(patch.claudeCli ?? {}) },
  };
}
