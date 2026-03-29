import type { TranslationModeDefinition, TranslationModeId } from "./types";

const BUILT_IN_TRANSLATION_MODES: TranslationModeDefinition[] = [
  {
    id: "general",
    label: "通用",
    description: "默认模式，优先准确与自然。",
    systemPrompt:
      "Act as a high-quality general translator. Prioritize accuracy, clarity, and natural phrasing without sounding mechanical.",
    builtIn: true
  },
  {
    id: "smart-auto",
    label: "智能选择",
    description: "根据文本和上下文自动选择最合适的风格。",
    systemPrompt:
      "Infer the best translation style from the selected text and surrounding context. Adjust terminology, tone, and formality automatically.",
    builtIn: true
  },
  {
    id: "mixed-zh-en",
    label: "中英夹杂",
    description: "处理中英混排、术语混用和代码式表达。",
    systemPrompt:
      "Specialize in mixed Chinese-English text. Preserve intentional bilingual phrasing, product terms, and code-like expressions while smoothing the target language.",
    builtIn: true
  },
  {
    id: "technology",
    label: "科技类翻译大师",
    description: "适合技术文章、产品文档和工程内容。",
    systemPrompt:
      "Specialize in technology writing. Preserve precise technical terminology, APIs, product names, abbreviations, and engineering intent.",
    builtIn: true
  },
  {
    id: "academic",
    label: "学术论文翻译师",
    description: "适合论文、研究报告和文献阅读。",
    systemPrompt:
      "Specialize in academic papers and research writing. Preserve formal tone, field-specific terminology, citations, equations, and hedging language.",
    builtIn: true
  },
  {
    id: "news",
    label: "新闻媒体译者",
    description: "适合新闻、报道和评论类内容。",
    systemPrompt:
      "Specialize in journalism and media writing. Keep facts precise, tone neutral unless the source is clearly opinionated, and preserve named entities faithfully.",
    builtIn: true
  },
  {
    id: "finance",
    label: "金融翻译顾问",
    description: "适合财报、市场分析和投资内容。",
    systemPrompt:
      "Specialize in finance and markets. Use standard financial terminology, preserve quantitative nuance, and avoid casual reinterpretation of risk-related statements.",
    builtIn: true
  },
  {
    id: "novel",
    label: "小说译者",
    description: "适合小说、叙事文本和对话。",
    systemPrompt:
      "Specialize in literary and narrative translation. Preserve voice, pacing, dialogue rhythm, subtext, and character tone while remaining readable.",
    builtIn: true
  },
  {
    id: "medical",
    label: "医学翻译大师",
    description: "适合医学、生命科学和临床资料。",
    systemPrompt:
      "Specialize in medical and biomedical writing. Use precise clinical terminology, preserve uncertainty qualifiers, and avoid inventing interpretations.",
    builtIn: true
  },
  {
    id: "legal",
    label: "法律行业译者",
    description: "适合法律条文、合同和法规内容。",
    systemPrompt:
      "Specialize in legal writing. Preserve defined terms, obligations, conditions, and formal legal structure with high fidelity.",
    builtIn: true
  },
  {
    id: "github",
    label: "GitHub 翻译增强器",
    description: "适合 issue、PR、README、提交说明等开发协作文本。",
    systemPrompt:
      "Specialize in GitHub and software collaboration content. Preserve Markdown, issue/PR terminology, commit style, code identifiers, and concise developer tone.",
    builtIn: true
  }
];

export function createDefaultTranslationModes(): TranslationModeDefinition[] {
  return BUILT_IN_TRANSLATION_MODES.map((mode) => ({ ...mode }));
}

export function getTranslationMode(
  modes: TranslationModeDefinition[] | undefined,
  id: string | undefined
): TranslationModeDefinition {
  const normalizedModes = normalizeTranslationModes(modes);
  return normalizedModes.find((mode) => mode.id === id) || normalizedModes[0];
}

export function getTranslationModeOptions(
  modes: TranslationModeDefinition[] | undefined
): Record<string, string> {
  return Object.fromEntries(normalizeTranslationModes(modes).map((mode) => [mode.id, mode.label]));
}

export function normalizeTranslationModes(
  modes: TranslationModeDefinition[] | undefined
): TranslationModeDefinition[] {
  const incomingModes = Array.isArray(modes) ? modes : [];
  const normalizedModes: TranslationModeDefinition[] = [];
  const usedIds = new Set<string>();

  for (const builtInMode of BUILT_IN_TRANSLATION_MODES) {
    const savedMode = incomingModes.find((mode) => mode?.id === builtInMode.id);
    normalizedModes.push({
      ...builtInMode,
      label: normalizeModeText(savedMode?.label, builtInMode.label),
      description: normalizeModeText(savedMode?.description, builtInMode.description),
      systemPrompt: normalizeModeText(savedMode?.systemPrompt, builtInMode.systemPrompt),
      builtIn: true
    });
    usedIds.add(builtInMode.id);
  }

  for (const mode of incomingModes) {
    if (!mode || typeof mode !== "object" || usedIds.has(mode.id)) {
      continue;
    }

    const label = normalizeModeText(mode.label, "");
    const description = normalizeModeText(mode.description, "");
    const systemPrompt = normalizeModeText(mode.systemPrompt, "");
    if (!label || !systemPrompt) {
      continue;
    }

    const id = ensureUniqueModeId(normalizeModeId(mode.id || label), usedIds);
    normalizedModes.push({
      id,
      label,
      description,
      systemPrompt,
      builtIn: false
    });
    usedIds.add(id);
  }

  return normalizedModes;
}

export function createCustomTranslationMode(
  existingModes: TranslationModeDefinition[]
): TranslationModeDefinition {
  const usedIds = new Set(existingModes.map((mode) => mode.id));
  const id = ensureUniqueModeId(`custom-${Date.now().toString(36)}`, usedIds);

  return {
    id,
    label: "新模式",
    description: "自定义翻译风格。",
    systemPrompt: "Define the translation style, terminology preference, tone, and domain constraints for this mode.",
    builtIn: false
  };
}

export function getBuiltInTranslationMode(id: TranslationModeId): TranslationModeDefinition | undefined {
  const builtInMode = BUILT_IN_TRANSLATION_MODES.find((mode) => mode.id === id);
  return builtInMode ? { ...builtInMode } : undefined;
}

function normalizeModeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeModeId(value: unknown): string {
  const source = typeof value === "string" && value.trim() ? value.trim() : "custom-mode";
  return source
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-mode";
}

function ensureUniqueModeId(candidate: string, usedIds: Set<string>): string {
  let nextId = candidate;
  let suffix = 1;

  while (usedIds.has(nextId)) {
    nextId = `${candidate}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}
