export interface TranslatorPluginSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  translationMode: TranslationModeId;
  translationModes: TranslationModeDefinition[];
  targetLanguage: string;
  orbRevealDelayMs: number;
  hoverDelayMs: number;
  requestTimeoutMs: number;
  debugMode: boolean;
  includeContextTitle: boolean;
  includeContextSectionHeading: boolean;
  includeContextPreviousParagraph: boolean;
  includeContextNextParagraph: boolean;
  includeContextFilePath: boolean;
  includeContextViewType: boolean;
  includeContextSourceType: boolean;
  orbColor: string;
  closeButtonColor: string;
  pinButtonColor: string;
  copyButtonColor: string;
}

export type TranslationModeId = string;

export interface TranslationModeDefinition {
  id: TranslationModeId;
  label: string;
  description: string;
  systemPrompt: string;
  builtIn?: boolean;
}

export interface TranslationContext {
  title?: string;
  sectionHeading?: string;
  previousParagraph?: string;
  nextParagraph?: string;
  filePath?: string;
  viewType?: string;
  sourceType?: "markdown-editor" | "dom-view";
}

export interface TranslationDebugInfo {
  timing: {
    startedAt: string;
    durationMs: number;
  };
  request: {
    url: string;
    method: string;
    configuredModel: string;
    translationMode: string;
    targetLanguage: string;
    context?: TranslationContext;
    body: Record<string, unknown>;
  };
  response?: {
    status: number;
    model: string;
    headers: Record<string, string>;
    textPreview: string;
    json?: unknown;
  };
  error?: {
    name: string;
    message: string;
  };
}

export interface TranslationResult {
  text: string;
  model: string;
  debugInfo: TranslationDebugInfo;
}

export interface SelectionSnapshot {
  key: string;
  text: string;
  mode: "editor" | "reading" | "pdf" | "view";
  viewType: string;
  filePath?: string;
  context: TranslationContext;
  rect: DOMRect;
  anchorRect: DOMRect;
}

export const DEFAULT_SETTINGS: TranslatorPluginSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  translationMode: "general",
  translationModes: [],
  targetLanguage: "中文",
  orbRevealDelayMs: 500,
  hoverDelayMs: 150,
  requestTimeoutMs: 30000,
  debugMode: false,
  includeContextTitle: true,
  includeContextSectionHeading: true,
  includeContextPreviousParagraph: true,
  includeContextNextParagraph: true,
  includeContextFilePath: true,
  includeContextViewType: true,
  includeContextSourceType: true,
  orbColor: "#0A84FF",
  closeButtonColor: "#FF5F57",
  pinButtonColor: "#FFBD2E",
  copyButtonColor: "#28C840"
};
