import { App, DropdownComponent, Notice, PluginSettingTab, Setting } from "obsidian";
import type AIExpanderPlugin from "./main";
import { OllamaProvider } from "./providers/ollama";
import { OpenRouterProvider } from "./providers/openrouter";

export class AIExpanderSettingTab extends PluginSettingTab {
  plugin: AIExpanderPlugin;

  constructor(app: App, plugin: AIExpanderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Default provider")
      .setDesc("Which backend to use by default. You can override per-expansion in the modal.")
      .addDropdown((dd) =>
        dd
          .addOption("ollama", "Ollama (local)")
          .addOption("openrouter", "OpenRouter")
          .addOption("claude-cli", "Claude CLI")
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value as
              | "ollama"
              | "openrouter"
              | "claude-cli";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Accept behavior")
      .setDesc("What happens to your selection when you accept an expansion.")
      .addDropdown((dd) =>
        dd
          .addOption("replace", "Replace selection")
          .addOption("append", "Append after selection")
          .setValue(this.plugin.settings.acceptBehavior)
          .onChange(async (value) => {
            this.plugin.settings.acceptBehavior = value as "replace" | "append";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("System prompt")
      .setDesc("Sent as the system message to every provider. Edit to change tone or instructions.")
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.systemPrompt).onChange(async (value) => {
          this.plugin.settings.systemPrompt = value;
          await this.plugin.saveSettings();
        });
        t.inputEl.rows = 5;
        t.inputEl.style.width = "100%";
      });

    containerEl.createEl("h3", { text: "Ollama" });

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("Where your local Ollama server is listening.")
      .addText((t) =>
        t
          .setPlaceholder("http://localhost:11434")
          .setValue(this.plugin.settings.ollama.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollama.baseUrl = value.trim() || "http://localhost:11434";
            await this.plugin.saveSettings();
          })
      );

    let ollamaDropdown: DropdownComponent | null = null;

    const populateOllama = (models: string[]) => {
      if (!ollamaDropdown) return;
      const current = this.plugin.settings.ollama.model;
      ollamaDropdown.selectEl.empty();
      for (const m of models) {
        const opt = ollamaDropdown.selectEl.createEl("option");
        opt.value = m;
        opt.text = m;
      }
      if (current && !models.includes(current)) {
        const opt = ollamaDropdown.selectEl.createEl("option");
        opt.value = current;
        opt.text = `${current} (not installed)`;
      }
      if (!current && models.length) {
        this.plugin.settings.ollama.model = models[0];
        void this.plugin.saveSettings();
      }
      ollamaDropdown.setValue(this.plugin.settings.ollama.model);
    };

    const refreshOllama = async (showNotice: boolean) => {
      try {
        const provider = new OllamaProvider(this.plugin.settings.ollama);
        const models = await provider.listModels();
        populateOllama(models);
        if (showNotice) new Notice(`Found ${models.length} Ollama models`);
      } catch (err) {
        if (showNotice) new Notice(`Ollama: ${(err as Error).message}`);
      }
    };

    new Setting(containerEl)
      .setName("Model")
      .setDesc(
        "Select a model you have pulled. Click Refresh after starting Ollama or pulling a new model."
      )
      .addDropdown((dd) => {
        ollamaDropdown = dd;
        const current = this.plugin.settings.ollama.model;
        if (current) {
          dd.addOption(current, current);
          dd.setValue(current);
        }
        dd.onChange(async (value) => {
          this.plugin.settings.ollama.model = value;
          await this.plugin.saveSettings();
        });
      })
      .addButton((btn) =>
        btn.setButtonText("Refresh").onClick(() => refreshOllama(true))
      );

    void refreshOllama(false);

    containerEl.createEl("h3", { text: "OpenRouter" });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Get one at openrouter.ai. Stored locally in plugin data.json.")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openrouter.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.openrouter.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    let orDatalist: HTMLDataListElement | null = null;

    const populateOpenRouter = (models: string[]) => {
      if (!orDatalist) return;
      orDatalist.empty();
      for (const m of models) {
        const o = orDatalist.createEl("option");
        o.value = m;
      }
    };

    const refreshOpenRouter = async (showNotice: boolean) => {
      try {
        const provider = new OpenRouterProvider(this.plugin.settings.openrouter);
        const models = await provider.listModels();
        populateOpenRouter(models);
        if (showNotice) new Notice(`Found ${models.length} OpenRouter models`);
      } catch (err) {
        if (showNotice) new Notice(`OpenRouter: ${(err as Error).message}`);
      }
    };

    new Setting(containerEl)
      .setName("Model")
      .setDesc(
        "OpenRouter model id (start typing to autocomplete after Refresh). e.g. anthropic/claude-sonnet-4.6, openai/gpt-4o."
      )
      .addText((t) => {
        t.setValue(this.plugin.settings.openrouter.model).onChange(async (value) => {
          this.plugin.settings.openrouter.model = value.trim();
          await this.plugin.saveSettings();
        });
        const dlId = "ai-expander-openrouter-models";
        t.inputEl.setAttr("list", dlId);
        orDatalist = containerEl.createEl("datalist");
        orDatalist.id = dlId;
      })
      .addButton((btn) =>
        btn.setButtonText("Refresh").onClick(() => refreshOpenRouter(true))
      );

    if (this.plugin.settings.openrouter.apiKey) {
      void refreshOpenRouter(false);
    }

    containerEl.createEl("h3", { text: "Claude CLI" });

    new Setting(containerEl)
      .setName("Binary path")
      .setDesc("Path to the `claude` executable. Use 'claude' if it's on your PATH, or an absolute path.")
      .addText((t) =>
        t
          .setPlaceholder("claude")
          .setValue(this.plugin.settings.claudeCli.binaryPath)
          .onChange(async (value) => {
            this.plugin.settings.claudeCli.binaryPath = value.trim() || "claude";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Optional. Passed as `--model` to the CLI. Leave blank to use Claude Code's default.")
      .addText((t) =>
        t
          .setPlaceholder("e.g. claude-opus-4-7")
          .setValue(this.plugin.settings.claudeCli.model)
          .onChange(async (value) => {
            this.plugin.settings.claudeCli.model = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}
