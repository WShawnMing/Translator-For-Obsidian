import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import {
  createCustomTranslationMode,
  getBuiltInTranslationMode,
  getTranslationModeOptions
} from "./translation-modes";
import { DEFAULT_SETTINGS, type TranslationModeDefinition } from "./types";
import type ObsidianTranslatorPlugin from "./main";

type ColorSettingKey = "orbColor" | "closeButtonColor" | "pinButtonColor" | "copyButtonColor";
type ContextSettingKey =
  | "includeContextTitle"
  | "includeContextSectionHeading"
  | "includeContextPreviousParagraph"
  | "includeContextNextParagraph"
  | "includeContextFilePath"
  | "includeContextViewType"
  | "includeContextSourceType";

interface SettingsSectionElements {
  sectionEl: HTMLDivElement;
  groupEl: HTMLDivElement;
}

export class ObsidianTranslatorSettingTab extends PluginSettingTab {
  private editingModeId: string | null = null;

  constructor(app: App, private readonly plugin: ObsidianTranslatorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("translator-for-obsidian-settings");

    const introEl = containerEl.createDiv({ cls: "translator-for-obsidian-settings__intro" });
    introEl.createEl("h2", { text: "Translator For Obsidian" });
    introEl.createEl("p", {
      text: "Selection translation for Markdown and PDF views with a restrained floating panel."
    });

    const connectionSection = this.createSection(
      containerEl,
      "Connection",
      "Connect to any OpenAI-compatible /chat/completions endpoint."
    );

    new Setting(connectionSection.groupEl)
      .setName("Base URL")
      .setDesc("Root URLs and full /chat/completions URLs are both accepted.")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(connectionSection.groupEl)
      .setName("API key")
      .setDesc("Stored in this vault only.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(connectionSection.groupEl)
      .setName("Model")
      .setDesc("Model name sent to the OpenAI-compatible API.")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4.1-mini")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim();
            await this.plugin.saveSettings();
          })
      );

    const behaviorSection = this.createSection(
      containerEl,
      "Behavior",
      "Control when the orb appears and how translation is triggered."
    );

    new Setting(behaviorSection.groupEl)
      .setName("Default translation mode")
      .setDesc("Choose which mode is used unless you switch it in the floating panel.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(getTranslationModeOptions(this.plugin.settings.translationModes))
          .setValue(this.plugin.settings.translationMode)
          .onChange(async (value) => {
            this.plugin.settings.translationMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(behaviorSection.groupEl)
      .setName("Target language")
      .setDesc("Target language used by the selected mode prompt.")
      .addText((text) =>
        text
          .setPlaceholder("中文")
          .setValue(this.plugin.settings.targetLanguage)
          .onChange(async (value) => {
            this.plugin.settings.targetLanguage = value.trim() || DEFAULT_SETTINGS.targetLanguage;
            await this.plugin.saveSettings();
          })
      );

    this.addNumberSetting(
      behaviorSection.groupEl,
      "Orb reveal delay (ms)",
      "How long the selection must stay stable before the blue dot appears.",
      String(this.plugin.settings.orbRevealDelayMs),
      async (value) => {
        const parsed = Number.parseInt(value, 10);
        this.plugin.settings.orbRevealDelayMs = Number.isFinite(parsed)
          ? Math.max(0, parsed)
          : DEFAULT_SETTINGS.orbRevealDelayMs;
        await this.plugin.saveSettings();
      }
    );

    this.addNumberSetting(
      behaviorSection.groupEl,
      "Hover delay (ms)",
      "How long the pointer needs to stay on the orb before translation starts.",
      String(this.plugin.settings.hoverDelayMs),
      async (value) => {
        const parsed = Number.parseInt(value, 10);
        this.plugin.settings.hoverDelayMs = Number.isFinite(parsed)
          ? Math.max(0, parsed)
          : DEFAULT_SETTINGS.hoverDelayMs;
        await this.plugin.saveSettings();
      }
    );

    this.addNumberSetting(
      behaviorSection.groupEl,
      "Request timeout (ms)",
      "Client-side timeout protection for translation requests.",
      String(this.plugin.settings.requestTimeoutMs),
      async (value) => {
        const parsed = Number.parseInt(value, 10);
        this.plugin.settings.requestTimeoutMs = Number.isFinite(parsed)
          ? Math.max(1000, parsed)
          : DEFAULT_SETTINGS.requestTimeoutMs;
        await this.plugin.saveSettings();
      }
    );

    this.renderTranslationModesSection(
      this.createSection(
        containerEl,
        "Translation Modes",
        "Edit built-in prompts, rename modes, or add your own domain-specific translator personas."
      )
    );

    const contextSection = this.createSection(
      containerEl,
      "Context",
      "Choose which nearby signals are sent with the selected text to improve disambiguation."
    );

    this.addContextToggle(
      contextSection.groupEl,
      "Document title",
      "Use the note title or PDF filename when it helps resolve references.",
      "includeContextTitle"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "Nearest heading",
      "Send the closest heading above the selection.",
      "includeContextSectionHeading"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "Previous paragraph",
      "Send the paragraph before the selection.",
      "includeContextPreviousParagraph"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "Next paragraph",
      "Send the paragraph after the selection.",
      "includeContextNextParagraph"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "File path",
      "Include the file path for repository, project, or chapter disambiguation.",
      "includeContextFilePath"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "View type",
      "Tell the model whether the selection came from Markdown, reading mode, or PDF.",
      "includeContextViewType"
    );
    this.addContextToggle(
      contextSection.groupEl,
      "Source type",
      "Include the internal source type used by the plugin for debugging and prompt steering.",
      "includeContextSourceType"
    );

    const appearanceSection = this.createSection(
      containerEl,
      "Appearance",
      "Tune the orb and panel control colors without changing the rest of the UI."
    );

    this.addColorSetting(
      appearanceSection.groupEl,
      "Orb color",
      "Selection trigger dot color.",
      "orbColor",
      DEFAULT_SETTINGS.orbColor
    );
    this.addColorSetting(
      appearanceSection.groupEl,
      "Close button color",
      "Top-left close control color.",
      "closeButtonColor",
      DEFAULT_SETTINGS.closeButtonColor
    );
    this.addColorSetting(
      appearanceSection.groupEl,
      "Pin button color",
      "Top control color used for pin and unpin.",
      "pinButtonColor",
      DEFAULT_SETTINGS.pinButtonColor
    );
    this.addColorSetting(
      appearanceSection.groupEl,
      "Copy button color",
      "Top control color used for copy.",
      "copyButtonColor",
      DEFAULT_SETTINGS.copyButtonColor
    );

    const debugSection = this.createSection(
      containerEl,
      "Debug",
      "Inspect translation state, request details, and the exact context sent to the model."
    );

    new Setting(debugSection.groupEl)
      .setName("Debug mode")
      .setDesc("Show structured request, response, selection, and timing details in the translation panel.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(debugSection.groupEl)
      .setName("Test connection")
      .setDesc("Send a small translation request with the current settings.")
      .addButton((button) =>
        button.setButtonText("Test API").onClick(async () => {
          button.setDisabled(true);
          try {
            const preview = await this.plugin.runConnectionTest();
            new Notice(`API ok: ${preview.slice(0, 48)}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            new Notice(`API test failed: ${message}`);
          } finally {
            button.setDisabled(false);
          }
        })
      )
      .addButton((button) =>
        button.setButtonText("Copy debug").onClick(async () => {
          try {
            await navigator.clipboard.writeText(this.plugin.getLatestDebugReport());
            new Notice("Latest debug report copied.");
          } catch {
            new Notice("Failed to copy the debug report.");
          }
        })
      );
  }

  private createSection(containerEl: HTMLElement, title: string, description: string): SettingsSectionElements {
    const sectionEl = containerEl.createDiv({ cls: "translator-for-obsidian-settings__section" });
    const headerEl = sectionEl.createDiv({ cls: "translator-for-obsidian-settings__section-header" });
    headerEl.createEl("h3", {
      cls: "translator-for-obsidian-settings__section-title",
      text: title
    });
    headerEl.createEl("p", {
      cls: "translator-for-obsidian-settings__section-description",
      text: description
    });

    return {
      sectionEl,
      groupEl: sectionEl.createDiv({ cls: "translator-for-obsidian-settings__group" })
    };
  }

  private renderTranslationModesSection(section: SettingsSectionElements): void {
    const mode = this.getEditingMode();
    if (!mode) {
      return;
    }

    const toolbarEl = section.groupEl.createDiv({ cls: "translator-for-obsidian-settings__mode-toolbar" });
    const summaryEl = toolbarEl.createDiv({ cls: "translator-for-obsidian-settings__mode-toolbar-copy" });
    summaryEl.createEl("div", {
      cls: "translator-for-obsidian-settings__mode-toolbar-title",
      text: "Mode Editor"
    });
    summaryEl.createEl("p", {
      text: "Switch the mode you want to edit. Only the selected mode is shown below."
    });

    const controlsEl = toolbarEl.createDiv({ cls: "translator-for-obsidian-settings__mode-toolbar-controls" });
    const modeSelectEl = controlsEl.createEl("select", {
      cls: "translator-for-obsidian-settings__mode-picker"
    });
    for (const translationMode of this.plugin.settings.translationModes) {
      const optionEl = modeSelectEl.createEl("option");
      optionEl.value = translationMode.id;
      optionEl.textContent = translationMode.label;
    }
    modeSelectEl.value = mode.id;
    modeSelectEl.addEventListener("change", () => {
      this.editingModeId = modeSelectEl.value;
      this.display();
    });

    const addModeButton = controlsEl.createEl("button", {
      cls: "mod-cta",
      text: "Add mode"
    });
    addModeButton.type = "button";
    addModeButton.addEventListener("click", async () => {
      const newMode = createCustomTranslationMode(this.plugin.settings.translationModes);
      this.plugin.settings.translationModes = [...this.plugin.settings.translationModes, newMode];
      this.editingModeId = newMode.id;
      await this.plugin.saveSettings();
      this.display();
    });

    const editorEl = section.groupEl.createDiv({ cls: "translator-for-obsidian-settings__mode-editor" });
    this.renderModeCard(editorEl, mode);
  }

  private renderModeCard(containerEl: HTMLElement, mode: TranslationModeDefinition): void {
    const cardEl = containerEl.createDiv({ cls: "translator-for-obsidian-settings__mode-card" });
    const headerEl = cardEl.createDiv({ cls: "translator-for-obsidian-settings__mode-card-header" });
    const titleWrapEl = headerEl.createDiv({ cls: "translator-for-obsidian-settings__mode-card-title" });
    titleWrapEl.createEl("h4", { text: mode.label });
    titleWrapEl.createEl("span", {
      cls: "translator-for-obsidian-settings__mode-badge",
      text: mode.builtIn ? "Built-in" : "Custom"
    });

    const actionsEl = headerEl.createDiv({ cls: "translator-for-obsidian-settings__mode-card-actions" });
    if (mode.builtIn) {
      const resetButton = actionsEl.createEl("button", { text: "Reset" });
      resetButton.type = "button";
      resetButton.addEventListener("click", async () => {
        const originalMode = getBuiltInTranslationMode(mode.id);
        if (!originalMode) {
          return;
        }

        this.updateMode(mode.id, () => ({ ...originalMode }));
        await this.plugin.saveSettings();
        this.display();
      });
    } else {
      const deleteButton = actionsEl.createEl("button", {
        cls: "mod-warning",
        text: "Delete"
      });
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.translationModes = this.plugin.settings.translationModes.filter(
          (candidate) => candidate.id !== mode.id
        );
        this.editingModeId = this.plugin.settings.translationModes[0]?.id || null;
        if (this.plugin.settings.translationMode === mode.id) {
          this.plugin.settings.translationMode =
            this.plugin.settings.translationModes[0]?.id || DEFAULT_SETTINGS.translationMode;
        }
        await this.plugin.saveSettings();
        this.display();
      });
    }

    this.createModeField(
      cardEl,
      "Mode name",
      "Used in the dropdown and panel selector.",
      mode.label,
      "Text shown to the user",
      async (value) => {
        this.updateMode(mode.id, (currentMode) => ({
          ...currentMode,
          label: value.trim() || currentMode.label
        }));
        await this.plugin.saveSettings();
        this.display();
      }
    );

    this.createModeField(
      cardEl,
      "Description",
      "Short helper text for settings and future mode browsing.",
      mode.description,
      "Optional description",
      async (value) => {
        this.updateMode(mode.id, (currentMode) => ({
          ...currentMode,
          description: value.trim()
        }));
        await this.plugin.saveSettings();
        this.display();
      }
    );

    this.createModeField(
      cardEl,
      "System prompt",
      "The core prompt template for this mode.",
      mode.systemPrompt,
      "Describe the translation style, terminology, tone, and constraints",
      async (value) => {
        this.updateMode(mode.id, (currentMode) => ({
          ...currentMode,
          systemPrompt: value.trim() || currentMode.systemPrompt
        }));
        await this.plugin.saveSettings();
        this.display();
      },
      true
    );
  }

  private createModeField(
    containerEl: HTMLElement,
    label: string,
    description: string,
    value: string,
    placeholder: string,
    onChange: (value: string) => Promise<void>,
    multiline = false
  ): void {
    const fieldEl = containerEl.createDiv({ cls: "translator-for-obsidian-settings__mode-field" });
    const metaEl = fieldEl.createDiv({ cls: "translator-for-obsidian-settings__mode-field-meta" });
    metaEl.createEl("label", {
      cls: "translator-for-obsidian-settings__mode-field-label",
      text: label
    });
    metaEl.createEl("p", {
      cls: "translator-for-obsidian-settings__mode-field-description",
      text: description
    });

    if (multiline) {
      const textareaEl = fieldEl.createEl("textarea", {
        cls: "translator-for-obsidian-settings__mode-field-input"
      });
      textareaEl.rows = 6;
      textareaEl.placeholder = placeholder;
      textareaEl.value = value;
      textareaEl.addEventListener("change", () => {
        void onChange(textareaEl.value);
      });
      return;
    }

    const inputEl = fieldEl.createEl("input", {
      cls: "translator-for-obsidian-settings__mode-field-input",
      type: "text"
    });
    inputEl.placeholder = placeholder;
    inputEl.value = value;
    inputEl.addEventListener("change", () => {
      void onChange(inputEl.value);
    });
  }

  private updateMode(
    modeId: string,
    updater: (mode: TranslationModeDefinition) => TranslationModeDefinition
  ): void {
    this.plugin.settings.translationModes = this.plugin.settings.translationModes.map((mode) =>
      mode.id === modeId ? updater(mode) : mode
    );
  }

  private getEditingMode(): TranslationModeDefinition | null {
    const modes = this.plugin.settings.translationModes;
    if (modes.length === 0) {
      this.editingModeId = null;
      return null;
    }

    const preferredId = this.editingModeId || this.plugin.settings.translationMode || modes[0].id;
    const mode = modes.find((candidate) => candidate.id === preferredId) || modes[0];
    this.editingModeId = mode.id;
    return mode;
  }

  private addNumberSetting(
    containerEl: HTMLElement,
    name: string,
    description: string,
    value: string,
    onChange: (value: string) => Promise<void>
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.inputEl.inputMode = "numeric";
        text.inputEl.pattern = "[0-9]*";
        text.setValue(value).onChange(onChange);
      });
  }

  private addContextToggle(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: ContextSettingKey
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private addColorSetting(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: ColorSettingKey,
    defaultValue: string
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addColorPicker((picker) =>
        picker.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value.toUpperCase();
          await this.plugin.saveSettings();
        })
      )
      .addExtraButton((button) =>
        button.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
          this.plugin.settings[key] = defaultValue;
          await this.plugin.saveSettings();
          this.display();
        })
      );
  }
}
