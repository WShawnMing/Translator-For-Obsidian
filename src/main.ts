import { Notice, Plugin } from "obsidian";

import { normalizeHexColor } from "./color-utils";
import { SelectionController } from "./selection-controller";
import { ObsidianTranslatorSettingTab } from "./settings-tab";
import { normalizeTranslationModes } from "./translation-modes";
import { resolveTranslationContext, TranslationClient, TranslationError } from "./translation-client";
import { TranslationPanel } from "./translation-panel";
import {
  DEFAULT_SETTINGS,
  type SelectionSnapshot,
  type TranslationModeId,
  type TranslatorPluginSettings
} from "./types";

export default class ObsidianTranslatorPlugin extends Plugin {
  settings: TranslatorPluginSettings = DEFAULT_SETTINGS;
  translationClient!: TranslationClient;
  private selectionController!: SelectionController;
  private translationPanel!: TranslationPanel;
  private currentSelectionKey: string | null = null;
  private selectionEpoch = 0;
  private requestSequence = 0;
  private latestDebugReport: unknown = null;
  private lastSelectionSnapshot: SelectionSnapshot | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.translationClient = new TranslationClient(() => this.settings);
    this.translationPanel = new TranslationPanel({
      onClose: () => {
        this.requestSequence += 1;
      },
      onModeChange: (mode) => {
        void this.changeTranslationMode(mode, true);
      }
    });

    this.selectionController = new SelectionController(this, {
      getSettings: () => this.settings,
      onSelectionChange: (snapshot) => this.handleSelectionChange(snapshot),
      onTranslateRequested: (snapshot) => {
        void this.translateSelection(snapshot);
      }
    });
    this.applyAppearanceSettings();

    this.addSettingTab(new ObsidianTranslatorSettingTab(this.app, this));

    this.addCommand({
      id: "translate-current-selection",
      name: "Translate current selection",
      callback: () => {
        void this.translateSelectionFromCommand();
      }
    });
  }

  onunload(): void {
    this.translationPanel?.destroy();
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    });
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    this.applyAppearanceSettings();
  }

  getLatestDebugReport(): string {
    if (!this.latestDebugReport) {
      return "No debug report has been captured yet.";
    }

    return JSON.stringify(this.latestDebugReport, null, 2);
  }

  async runConnectionTest(): Promise<string> {
    try {
      const result = await this.translationClient.testConnection();
      this.recordDebugReport({
        context: "settings-test",
        translation: result.debugInfo
      });
      return result.text;
    } catch (error) {
      this.recordDebugReport({
        context: "settings-test",
        error: serializeError(error),
        translation: error instanceof TranslationError ? error.debugInfo : undefined
      });
      throw error;
    }
  }

  private handleSelectionChange(snapshot: SelectionSnapshot | null): void {
    const nextSelectionKey = snapshot?.key ?? null;
    const didSelectionChange = nextSelectionKey !== this.currentSelectionKey;
    this.currentSelectionKey = nextSelectionKey;

    if (didSelectionChange) {
      this.selectionEpoch += 1;
    }

    if (snapshot) {
      this.lastSelectionSnapshot = snapshot;
      this.translationPanel.updateAnchor(snapshot.anchorRect);
      return;
    }

    this.translationPanel.hide();
  }

  private async translateSelection(snapshot: SelectionSnapshot): Promise<void> {
    const requestId = ++this.requestSequence;
    const requestEpoch = this.selectionEpoch;
    const loadingDebugInfo = {
      stage: "pending",
      selection: buildSelectionDebugInfo(snapshot, this.settings)
    };

    this.translationPanel.showLoading(
      snapshot.anchorRect,
      this.settings.model,
      loadingDebugInfo,
      this.settings.debugMode
    );

    try {
      const result = await this.translationClient.translate(snapshot.text, snapshot.context);
      if (this.isStaleRequest(snapshot.key, requestId, requestEpoch)) {
        return;
      }

      const debugReport = {
        stage: "completed",
        selection: buildSelectionDebugInfo(snapshot, this.settings),
        translation: result.debugInfo
      };
      this.recordDebugReport(debugReport);
      this.translationPanel.showResult(
        snapshot.anchorRect,
        result.model,
        result.text,
        debugReport,
        this.settings.debugMode
      );
    } catch (error) {
      if (this.isStaleRequest(snapshot.key, requestId, requestEpoch)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Translation failed.";
      const debugReport = {
        stage: "failed",
        selection: buildSelectionDebugInfo(snapshot, this.settings),
        error: serializeError(error),
        translation: error instanceof TranslationError ? error.debugInfo : undefined
      };
      this.recordDebugReport(debugReport);
      this.translationPanel.showError(
        snapshot.anchorRect,
        this.settings.model,
        message,
        debugReport,
        this.settings.debugMode
      );
    }
  }

  private async translateSelectionFromCommand(): Promise<void> {
    const snapshot =
      this.selectionController.refreshSelection() ||
      this.selectionController.getCurrentSelection() ||
      this.lastSelectionSnapshot;
    if (!snapshot) {
      new Notice("Select text in the active Markdown or PDF view before translating.");
      return;
    }

    await this.translateSelection(snapshot);
  }

  private isStaleRequest(selectionKey: string, requestId: number, requestEpoch: number): boolean {
    if (requestId !== this.requestSequence) {
      return true;
    }

    if (this.translationPanel.isPinned()) {
      return false;
    }

    return requestEpoch !== this.selectionEpoch || this.currentSelectionKey !== selectionKey;
  }

  private recordDebugReport(report: unknown): void {
    this.latestDebugReport = report;
    if (this.settings.debugMode) {
      console.debug("[translator-for-obsidian]", report);
    }
  }

  private applyAppearanceSettings(): void {
    this.selectionController?.applyAppearance(this.settings);
    this.translationPanel?.applyAppearance(this.settings);
  }

  private async changeTranslationMode(mode: TranslationModeId, retranslate = false): Promise<void> {
    if (this.settings.translationMode === mode) {
      return;
    }

    this.settings.translationMode = mode;
    await this.saveSettings();

    if (retranslate) {
      const snapshot = this.selectionController.getCurrentSelection() || this.lastSelectionSnapshot;
      if (snapshot) {
        void this.translateSelection(snapshot);
      }
    }
  }
}

function buildSelectionDebugInfo(
  snapshot: SelectionSnapshot,
  settings: TranslatorPluginSettings
): Record<string, unknown> {
  return {
    key: snapshot.key,
    mode: snapshot.mode,
    viewType: snapshot.viewType,
    filePath: snapshot.filePath ?? null,
    capturedContext: snapshot.context,
    requestContext: resolveTranslationContext(snapshot.context, settings) ?? null,
    textLength: snapshot.text.length,
    textPreview: snapshot.text.slice(0, 500),
    rect: {
      left: round(snapshot.rect.left),
      top: round(snapshot.rect.top),
      width: round(snapshot.rect.width),
      height: round(snapshot.rect.height)
    },
    anchorRect: {
      left: round(snapshot.anchorRect.left),
      top: round(snapshot.anchorRect.top),
      width: round(snapshot.anchorRect.width),
      height: round(snapshot.anchorRect.height)
    }
  };
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: "Error",
    message: String(error)
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeSettings(settings: TranslatorPluginSettings): TranslatorPluginSettings {
  const orbRevealDelayMs = Number(settings.orbRevealDelayMs);
  const hoverDelayMs = Number(settings.hoverDelayMs);
  const requestTimeoutMs = Number(settings.requestTimeoutMs);
  const translationModes = normalizeTranslationModes(settings.translationModes);
  const hasSelectedMode = translationModes.some((mode) => mode.id === settings.translationMode);

  return {
    baseUrl: settings.baseUrl?.trim?.() || DEFAULT_SETTINGS.baseUrl,
    apiKey: settings.apiKey?.trim?.() || "",
    model: settings.model?.trim?.() || DEFAULT_SETTINGS.model,
    translationMode: hasSelectedMode
      ? settings.translationMode
      : translationModes[0]?.id || DEFAULT_SETTINGS.translationMode,
    translationModes,
    targetLanguage: settings.targetLanguage?.trim?.() || DEFAULT_SETTINGS.targetLanguage,
    orbRevealDelayMs: Number.isFinite(orbRevealDelayMs) ? Math.max(0, orbRevealDelayMs) : DEFAULT_SETTINGS.orbRevealDelayMs,
    hoverDelayMs: Number.isFinite(hoverDelayMs) ? Math.max(0, hoverDelayMs) : DEFAULT_SETTINGS.hoverDelayMs,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs)
      ? Math.max(1000, requestTimeoutMs)
      : DEFAULT_SETTINGS.requestTimeoutMs,
    debugMode: Boolean(settings.debugMode),
    includeContextTitle: settings.includeContextTitle ?? DEFAULT_SETTINGS.includeContextTitle,
    includeContextSectionHeading:
      settings.includeContextSectionHeading ?? DEFAULT_SETTINGS.includeContextSectionHeading,
    includeContextPreviousParagraph:
      settings.includeContextPreviousParagraph ?? DEFAULT_SETTINGS.includeContextPreviousParagraph,
    includeContextNextParagraph: settings.includeContextNextParagraph ?? DEFAULT_SETTINGS.includeContextNextParagraph,
    includeContextFilePath: settings.includeContextFilePath ?? DEFAULT_SETTINGS.includeContextFilePath,
    includeContextViewType: settings.includeContextViewType ?? DEFAULT_SETTINGS.includeContextViewType,
    includeContextSourceType: settings.includeContextSourceType ?? DEFAULT_SETTINGS.includeContextSourceType,
    orbColor: normalizeHexColor(settings.orbColor, DEFAULT_SETTINGS.orbColor),
    closeButtonColor: normalizeHexColor(settings.closeButtonColor, DEFAULT_SETTINGS.closeButtonColor),
    pinButtonColor: normalizeHexColor(settings.pinButtonColor, DEFAULT_SETTINGS.pinButtonColor),
    copyButtonColor: normalizeHexColor(settings.copyButtonColor, DEFAULT_SETTINGS.copyButtonColor)
  };
}
