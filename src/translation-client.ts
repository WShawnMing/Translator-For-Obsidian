import { requestUrl } from "obsidian";

import { getTranslationMode } from "./translation-modes";
import type { TranslationContext, TranslationDebugInfo, TranslationResult, TranslatorPluginSettings } from "./types";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface ChatCompletionResponse {
  model?: string;
  choices?: ChatCompletionChoice[];
  error?: {
    message?: string;
  };
}

export class TranslationClient {
  constructor(private readonly getSettings: () => TranslatorPluginSettings) {}

  async translate(text: string, context?: TranslationContext): Promise<TranslationResult> {
    const settings = this.getSettings();
    const trimmedText = text.trim();
    const translationMode = getTranslationMode(settings.translationModes, settings.translationMode);
    const filteredContext = resolveTranslationContext(context, settings);

    if (!trimmedText) {
      throw new Error("No text selected.");
    }

    if (!settings.baseUrl.trim()) {
      throw new Error("Please set the OpenAI-compatible base URL.");
    }

    if (!settings.apiKey.trim()) {
      throw new Error("Please set the API key.");
    }

    if (!settings.model.trim()) {
      throw new Error("Please set the model name.");
    }

    const url = normalizeChatCompletionsUrl(settings.baseUrl);
    const payload = {
      model: settings.model.trim(),
      stream: false,
      temperature: 0.2,
      messages: buildMessages(trimmedText, settings, context)
    };
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const baseDebugInfo: TranslationDebugInfo = {
      timing: {
        startedAt,
        durationMs: 0
      },
      request: {
        url,
        method: "POST",
        configuredModel: settings.model.trim(),
        translationMode: translationMode.id,
        targetLanguage: settings.targetLanguage.trim() || "中文",
        context: filteredContext,
        body: sanitizeBody(payload)
      }
    };

    let responseText = "";

    try {
      const response = await withTimeout(
        requestUrl({
          url,
          method: "POST",
          throw: false,
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${settings.apiKey.trim()}`
          },
          body: JSON.stringify(payload)
        }),
        settings.requestTimeoutMs,
        `Translation request timed out after ${settings.requestTimeoutMs}ms.`
      );

      responseText = response.text ?? "";
      const status = response.status;
      const responseJson = (response.json ?? parseJson<ChatCompletionResponse>(responseText)) as
        | ChatCompletionResponse
        | undefined;
      const debugInfo: TranslationDebugInfo = {
        ...baseDebugInfo,
        timing: {
          startedAt,
          durationMs: Date.now() - startedMs
        },
        response: {
          status,
          model: responseJson?.model?.trim() || settings.model.trim(),
          headers: response.headers ?? {},
          textPreview: summarizeText(responseText),
          json: responseJson
        }
      };

      if (status >= 400) {
        const fallbackMessage = `Translation request failed with status ${status}.`;
        throw new TranslationError(responseJson?.error?.message?.trim() || fallbackMessage, debugInfo);
      }

      const translation = extractMessageContent(responseJson);
      if (!translation) {
        throw new TranslationError("The API response did not include a translation result.", debugInfo);
      }

      return {
        text: translation.trim(),
        model: responseJson?.model?.trim() || settings.model.trim(),
        debugInfo
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Translation request failed.";
      throw new TranslationError(message, {
        ...baseDebugInfo,
        timing: {
          startedAt,
          durationMs: Date.now() - startedMs
        },
        response: responseText
          ? {
              status: 0,
              model: settings.model.trim(),
              headers: {},
              textPreview: summarizeText(responseText),
              json: parseJson<ChatCompletionResponse>(responseText)
            }
          : undefined,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message
        }
      });
    }
  }

  async testConnection(): Promise<TranslationResult> {
    return this.translate("The quick brown fox jumps over the lazy dog.");
  }
}

export class TranslationError extends Error {
  constructor(
    message: string,
    readonly debugInfo: TranslationDebugInfo
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/chat/completions`;
}

function buildMessages(text: string, settings: TranslatorPluginSettings, context?: TranslationContext): ChatMessage[] {
  const mode = getTranslationMode(settings.translationModes, settings.translationMode);
  const systemPrompt = `You are ${mode.label}.
${mode.systemPrompt}
Detect the source language automatically and translate only the selected text into ${settings.targetLanguage.trim() || "中文"}.
You may use any contextual metadata that is provided only to disambiguate terminology, references, omitted subjects, and tone.
Never translate the surrounding context itself unless it is part of the selected text.
Preserve Markdown links, inline code, citations, equations, bullet structure, and paragraph breaks when possible.
Return only the translated selected text. Do not add explanations, labels, or surrounding commentary.`;

  const userContent = buildUserMessage(text, resolveTranslationContext(context, settings));

  return [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userContent
    }
  ];
}

function buildUserMessage(text: string, context?: TranslationContext): string {
  const parts: string[] = [`[Selected text]\n${text}`];

  if (context) {
    const contextLines = [
      context.title ? `Title: ${context.title}` : "",
      context.sectionHeading ? `Section heading: ${context.sectionHeading}` : "",
      context.previousParagraph ? `Previous paragraph: ${context.previousParagraph}` : "",
      context.nextParagraph ? `Next paragraph: ${context.nextParagraph}` : "",
      context.filePath ? `File path: ${context.filePath}` : "",
      context.viewType ? `View type: ${context.viewType}` : "",
      context.sourceType ? `Source type: ${context.sourceType}` : ""
    ].filter(Boolean);

    if (contextLines.length > 0) {
      parts.push(`[Context]\n${contextLines.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

export function resolveTranslationContext(
  context: TranslationContext | undefined,
  settings: TranslatorPluginSettings
): TranslationContext | undefined {
  if (!context) {
    return undefined;
  }

  const filteredContext: TranslationContext = {};

  if (settings.includeContextTitle && context.title) {
    filteredContext.title = context.title;
  }

  if (settings.includeContextSectionHeading && context.sectionHeading) {
    filteredContext.sectionHeading = context.sectionHeading;
  }

  if (settings.includeContextPreviousParagraph && context.previousParagraph) {
    filteredContext.previousParagraph = context.previousParagraph;
  }

  if (settings.includeContextNextParagraph && context.nextParagraph) {
    filteredContext.nextParagraph = context.nextParagraph;
  }

  if (settings.includeContextFilePath && context.filePath) {
    filteredContext.filePath = context.filePath;
  }

  if (settings.includeContextViewType && context.viewType) {
    filteredContext.viewType = context.viewType;
  }

  if (settings.includeContextSourceType && context.sourceType) {
    filteredContext.sourceType = context.sourceType;
  }

  return hasContextContent(filteredContext) ? filteredContext : undefined;
}

function extractMessageContent(responseJson: ChatCompletionResponse | undefined): string {
  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text?.trim() || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function parseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function sanitizeBody(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

function summarizeText(text: string, maxLength = 4000): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...<truncated>`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeoutHandle: number | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
  });
}

function hasContextContent(context: TranslationContext): boolean {
  return Object.values(context).some(Boolean);
}
