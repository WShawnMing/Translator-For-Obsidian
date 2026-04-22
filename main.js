var global = globalThis;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsidianTranslatorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/color-utils.ts
function normalizeHexColor(value, fallback) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback.toUpperCase();
}
function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex, "#000000");
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
function pickReadableIconColor(hex) {
  const normalized = normalizeHexColor(hex, "#000000");
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.68 ? "rgba(0, 0, 0, 0.72)" : "rgba(255, 255, 255, 0.94)";
}

// src/selection-controller.ts
var import_obsidian = require("obsidian");

// src/context-extractor.ts
function buildEditorSelectionContext(view) {
  const editor = view.editor;
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const lines = getEditorLines(editor);
  return {
    title: view.file?.basename,
    sectionHeading: findNearestMarkdownHeading(lines, from.line),
    previousParagraph: collectParagraph(lines, from.line - 1, -1),
    nextParagraph: collectParagraph(lines, to.line + 1, 1),
    filePath: view.file?.path,
    viewType: view.getViewType(),
    sourceType: "markdown-editor"
  };
}
function buildDomSelectionContext(view, range) {
  const fileInfo = getViewFileInfo(view);
  const anchorElement = resolveElement(range.endContainer) || resolveElement(range.startContainer);
  return {
    title: fileInfo.basename,
    sectionHeading: findNearestHeading(anchorElement, view.containerEl),
    previousParagraph: collectNearbyBlockText(view, anchorElement, -1),
    nextParagraph: collectNearbyBlockText(view, anchorElement, 1),
    filePath: fileInfo.path,
    viewType: view.getViewType(),
    sourceType: "dom-view"
  };
}
function getEditorLines(editor) {
  const lines = [];
  for (let index = 0; index <= editor.lastLine(); index += 1) {
    lines.push(editor.getLine(index));
  }
  return lines;
}
function findNearestMarkdownHeading(lines, startLine) {
  for (let lineIndex = startLine; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]?.trim();
    const match = /^(#{1,6})\s+(.+)$/.exec(line || "");
    if (match?.[2]) {
      return match[2].trim();
    }
  }
  return void 0;
}
function collectParagraph(lines, startLine, step) {
  let lineIndex = startLine;
  while (lineIndex >= 0 && lineIndex < lines.length && !lines[lineIndex].trim()) {
    lineIndex += step;
  }
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return void 0;
  }
  const buffer = [];
  while (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    if (!line) {
      break;
    }
    if (step === -1) {
      buffer.unshift(line);
    } else {
      buffer.push(line);
    }
    if (buffer.join(" ").length >= 420) {
      break;
    }
    lineIndex += step;
  }
  return buffer.length > 0 ? buffer.join("\n") : void 0;
}
function getViewFileInfo(view) {
  const maybeFile = view.file;
  return {
    path: maybeFile?.path,
    basename: maybeFile?.basename
  };
}
function findNearestHeading(anchor, container) {
  if (!anchor) {
    return void 0;
  }
  const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  for (let index = headings.length - 1; index >= 0; index -= 1) {
    const heading = headings[index];
    const position = heading.compareDocumentPosition(anchor);
    if (position === 0 || Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)) {
      const text = normalizeText(heading.textContent || "");
      if (text) {
        return text;
      }
    }
  }
  return void 0;
}
function collectNearbyBlockText(view, anchor, direction) {
  const blocks = collectContextBlocks(view);
  if (!anchor || blocks.length === 0) {
    return void 0;
  }
  const anchorIndex = blocks.findIndex((element) => element === anchor || element.contains(anchor) || anchor.contains(element));
  if (anchorIndex === -1) {
    return void 0;
  }
  const segments = [];
  let cursor = anchorIndex + direction;
  while (cursor >= 0 && cursor < blocks.length && segments.length < 3) {
    const text = normalizeText(blocks[cursor].textContent || "");
    if (text) {
      segments.push(text);
    }
    cursor += direction;
  }
  if (direction === -1) {
    segments.reverse();
  }
  const combined = segments.join("\n");
  return combined || void 0;
}
function collectContextBlocks(view) {
  const selectors = view.getViewType() === "pdf" ? [".textLayer span", ".textLayer div"] : ["p", "li", "blockquote", "pre", "figcaption", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6"];
  return Array.from(view.containerEl.querySelectorAll(selectors.join(","))).filter(
    (element) => Boolean(normalizeText(element.textContent || ""))
  );
}
function resolveElement(node) {
  if (!node) {
    return null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node;
  }
  return node.parentElement;
}
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

// src/selection-controller.ts
var SelectionController = class {
  constructor(plugin, options) {
    this.plugin = plugin;
    this.currentSnapshot = null;
    this.selectionTimer = null;
    this.orbRevealTimer = null;
    this.hoverTimer = null;
    this.options = options;
    this.orbEl = document.createElement("button");
    this.orbEl.type = "button";
    this.orbEl.className = "obsidian-translator-orb";
    this.orbEl.setAttribute("aria-label", "Translate selection");
    document.body.appendChild(this.orbEl);
    this.applyAppearance(this.options.getSettings());
    this.plugin.register(() => this.destroy());
    this.plugin.registerDomEvent(document, "selectionchange", () => this.scheduleRefresh(32));
    this.plugin.registerDomEvent(document, "mouseup", () => this.scheduleRefresh(10));
    this.plugin.registerDomEvent(document, "keyup", () => this.scheduleRefresh(10));
    this.plugin.registerDomEvent(document, "scroll", () => this.scheduleRefresh(32), true);
    this.plugin.registerDomEvent(window, "resize", () => this.scheduleRefresh(32));
    this.plugin.registerDomEvent(document, "pointerdown", (event) => this.handlePointerDown(event), true);
    this.plugin.registerDomEvent(document, "keydown", (event) => this.handleKeyDown(event));
    this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", () => this.refreshSelection()));
    this.plugin.registerEvent(this.plugin.app.workspace.on("layout-change", () => this.scheduleRefresh(32)));
    this.orbEl.addEventListener("mouseenter", () => this.scheduleHoverTranslation());
    this.orbEl.addEventListener("mouseleave", () => this.clearHoverTimer());
    this.orbEl.addEventListener("click", (event) => {
      event.preventDefault();
      this.clearHoverTimer();
      this.triggerCurrentSelection();
    });
  }
  destroy() {
    this.clearHoverTimer();
    this.clearOrbRevealTimer();
    this.clearSelectionTimer();
    this.orbEl.remove();
  }
  getCurrentSelection() {
    return this.currentSnapshot;
  }
  applyAppearance(settings) {
    const orbColor = normalizeHexColor(settings.orbColor, "#0A84FF");
    this.orbEl.style.setProperty("--translator-orb-color", orbColor);
    this.orbEl.style.setProperty("--translator-orb-halo", hexToRgba(orbColor, 0.18));
    this.orbEl.style.setProperty("--translator-orb-halo-hover", hexToRgba(orbColor, 0.28));
    this.orbEl.style.backgroundColor = orbColor;
  }
  refreshSelection() {
    const snapshot = this.readSelection();
    if (!snapshot) {
      this.setCurrentSelection(null);
      return null;
    }
    this.setCurrentSelection(snapshot);
    return snapshot;
  }
  scheduleRefresh(delayMs) {
    this.clearSelectionTimer();
    this.selectionTimer = window.setTimeout(() => {
      this.selectionTimer = null;
      this.refreshSelection();
    }, delayMs);
  }
  clearSelectionTimer() {
    if (this.selectionTimer !== null) {
      window.clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }
  }
  clearHoverTimer() {
    if (this.hoverTimer !== null) {
      window.clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }
  clearOrbRevealTimer() {
    if (this.orbRevealTimer !== null) {
      window.clearTimeout(this.orbRevealTimer);
      this.orbRevealTimer = null;
    }
  }
  scheduleHoverTranslation() {
    if (!this.currentSnapshot) {
      return;
    }
    const delay = Math.max(0, this.options.getSettings().hoverDelayMs);
    this.clearHoverTimer();
    this.hoverTimer = window.setTimeout(() => {
      this.hoverTimer = null;
      this.triggerCurrentSelection();
    }, delay);
  }
  triggerCurrentSelection() {
    if (!this.currentSnapshot) {
      return;
    }
    this.options.onTranslateRequested(this.currentSnapshot);
  }
  setCurrentSelection(snapshot) {
    const previousKey = this.currentSnapshot?.key ?? null;
    this.currentSnapshot = snapshot;
    this.options.onSelectionChange(snapshot);
    if (!snapshot) {
      this.clearHoverTimer();
      this.clearOrbRevealTimer();
      this.orbEl.classList.remove("is-visible");
      return;
    }
    this.positionOrb(snapshot.anchorRect);
    const isSameSelection = previousKey === snapshot.key;
    if (this.orbEl.classList.contains("is-visible") && isSameSelection) {
      return;
    }
    this.clearHoverTimer();
    this.clearOrbRevealTimer();
    this.orbEl.classList.remove("is-visible");
    this.scheduleOrbReveal(snapshot);
  }
  scheduleOrbReveal(snapshot) {
    const revealDelay = Math.max(0, this.options.getSettings().orbRevealDelayMs);
    this.orbRevealTimer = window.setTimeout(() => {
      this.orbRevealTimer = null;
      if (this.currentSnapshot?.key !== snapshot.key) {
        return;
      }
      this.positionOrb(snapshot.anchorRect);
      this.orbEl.classList.add("is-visible");
    }, revealDelay);
  }
  positionOrb(anchorRect) {
    const orbSize = this.orbEl.offsetWidth || 14;
    const left = clamp(anchorRect.right + 6, 8, window.innerWidth - orbSize - 8);
    const top = clamp(
      anchorRect.bottom - orbSize / 2,
      8,
      window.innerHeight - orbSize - 8
    );
    this.orbEl.style.left = `${left}px`;
    this.orbEl.style.top = `${top}px`;
  }
  handlePointerDown(event) {
    const target = event.target;
    if (!target) {
      this.setCurrentSelection(null);
      return;
    }
    if (target.closest(".obsidian-translator-orb, .obsidian-translator-panel")) {
      return;
    }
    if (!this.isInsideActiveView(target)) {
      this.setCurrentSelection(null);
    }
  }
  handleKeyDown(event) {
    if (event.key === "Escape") {
      this.setCurrentSelection(null);
    }
  }
  readSelection() {
    const view = this.plugin.app.workspace.activeLeaf?.view ?? null;
    if (!view) {
      return null;
    }
    const domSnapshot = this.readDomSelection(view);
    if (domSnapshot) {
      return domSnapshot;
    }
    if (view instanceof import_obsidian.MarkdownView && view.getMode() !== "preview") {
      const text = view.editor?.getSelection() || "";
      if (!text.trim()) {
        return null;
      }
      const rect = this.getCodeMirrorSelectionRect(view);
      const anchorRect = this.getCodeMirrorSelectionAnchorRect(view);
      if (!rect || !anchorRect) {
        return null;
      }
      return {
        key: `editor:${view.file?.path || "active"}:${normalizeSelectionKey(text)}`,
        text,
        mode: "editor",
        viewType: view.getViewType(),
        filePath: view.file?.path,
        context: buildEditorSelectionContext(view),
        rect,
        anchorRect
      };
    }
    return null;
  }
  readDomSelection(view) {
    const selection = window.getSelection();
    const text = selection?.toString() || "";
    if (!selection || selection.rangeCount === 0 || !text.trim()) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (!range || !this.rangeBelongsToView(view, range)) {
      return null;
    }
    const rect = rectFromRange(range);
    const anchorRect = anchorRectFromRange(range);
    if (!rect || !anchorRect) {
      return null;
    }
    const mode = resolveSelectionMode(view);
    const filePath = view instanceof import_obsidian.MarkdownView ? view.file?.path : void 0;
    return {
      key: `${mode}:${view.getViewType()}:${filePath || "active"}:${normalizeSelectionKey(text)}`,
      text,
      mode,
      viewType: view.getViewType(),
      filePath,
      context: buildDomSelectionContext(view, range),
      rect,
      anchorRect
    };
  }
  getCodeMirrorSelectionRect(view) {
    const editorView = view.editor?.cm ?? null;
    if (!editorView) {
      return null;
    }
    const selection = editorView.state.selection.main;
    if (!selection || selection.empty) {
      return null;
    }
    const start = editorView.coordsAtPos(selection.from);
    const end = editorView.coordsAtPos(selection.to);
    if (!start || !end) {
      return null;
    }
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    return new DOMRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
  }
  getCodeMirrorSelectionAnchorRect(view) {
    const editorView = view.editor?.cm ?? null;
    if (!editorView) {
      return null;
    }
    const selection = editorView.state.selection.main;
    if (!selection || selection.empty) {
      return null;
    }
    const anchor = editorView.coordsAtPos(selection.to);
    if (!anchor) {
      return null;
    }
    return new DOMRect(anchor.left, anchor.top, Math.max(anchor.right - anchor.left, 1), Math.max(anchor.bottom - anchor.top, 1));
  }
  isInsideActiveView(node) {
    const view = this.plugin.app.workspace.activeLeaf?.view ?? null;
    return Boolean(view?.containerEl.contains(node));
  }
  rangeBelongsToView(view, range) {
    const commonAncestor = range.commonAncestorContainer;
    return view.containerEl.contains(commonAncestor);
  }
};
function resolveSelectionMode(view) {
  if (view instanceof import_obsidian.MarkdownView) {
    return view.getMode() === "preview" ? "reading" : "editor";
  }
  return view.getViewType() === "pdf" ? "pdf" : "view";
}
function rectFromRange(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) {
    const boundingRect = range.getBoundingClientRect();
    if (boundingRect.width === 0 && boundingRect.height === 0) {
      return null;
    }
    return new DOMRect(
      boundingRect.left,
      boundingRect.top,
      Math.max(boundingRect.width, 1),
      Math.max(boundingRect.height, 1)
    );
  }
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
}
function anchorRectFromRange(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) {
    const boundingRect = range.getBoundingClientRect();
    if (boundingRect.width === 0 && boundingRect.height === 0) {
      return null;
    }
    return new DOMRect(
      boundingRect.left,
      boundingRect.top,
      Math.max(boundingRect.width, 1),
      Math.max(boundingRect.height, 1)
    );
  }
  const anchorRect = rects.reduce((current, rect) => {
    if (rect.bottom > current.bottom + 0.5) {
      return rect;
    }
    if (Math.abs(rect.bottom - current.bottom) <= 0.5 && rect.right > current.right) {
      return rect;
    }
    return current;
  });
  return new DOMRect(
    anchorRect.left,
    anchorRect.top,
    Math.max(anchorRect.width, 1),
    Math.max(anchorRect.height, 1)
  );
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function normalizeSelectionKey(text) {
  return text.replace(/\s+/g, " ").trim();
}

// src/settings-tab.ts
var import_obsidian2 = require("obsidian");

// src/translation-modes.ts
var BUILT_IN_TRANSLATION_MODES = [
  {
    id: "general",
    label: "\u901A\u7528",
    description: "\u9ED8\u8BA4\u6A21\u5F0F\uFF0C\u4F18\u5148\u51C6\u786E\u4E0E\u81EA\u7136\u3002",
    systemPrompt: "Act as a high-quality general translator. Prioritize accuracy, clarity, and natural phrasing without sounding mechanical.",
    builtIn: true
  },
  {
    id: "smart-auto",
    label: "\u667A\u80FD\u9009\u62E9",
    description: "\u6839\u636E\u6587\u672C\u548C\u4E0A\u4E0B\u6587\u81EA\u52A8\u9009\u62E9\u6700\u5408\u9002\u7684\u98CE\u683C\u3002",
    systemPrompt: "Infer the best translation style from the selected text and surrounding context. Adjust terminology, tone, and formality automatically.",
    builtIn: true
  },
  {
    id: "mixed-zh-en",
    label: "\u4E2D\u82F1\u5939\u6742",
    description: "\u5904\u7406\u4E2D\u82F1\u6DF7\u6392\u3001\u672F\u8BED\u6DF7\u7528\u548C\u4EE3\u7801\u5F0F\u8868\u8FBE\u3002",
    systemPrompt: "Specialize in mixed Chinese-English text. Preserve intentional bilingual phrasing, product terms, and code-like expressions while smoothing the target language.",
    builtIn: true
  },
  {
    id: "technology",
    label: "\u79D1\u6280\u7C7B\u7FFB\u8BD1\u5927\u5E08",
    description: "\u9002\u5408\u6280\u672F\u6587\u7AE0\u3001\u4EA7\u54C1\u6587\u6863\u548C\u5DE5\u7A0B\u5185\u5BB9\u3002",
    systemPrompt: "Specialize in technology writing. Preserve precise technical terminology, APIs, product names, abbreviations, and engineering intent.",
    builtIn: true
  },
  {
    id: "academic",
    label: "\u5B66\u672F\u8BBA\u6587\u7FFB\u8BD1\u5E08",
    description: "\u9002\u5408\u8BBA\u6587\u3001\u7814\u7A76\u62A5\u544A\u548C\u6587\u732E\u9605\u8BFB\u3002",
    systemPrompt: "Specialize in academic papers and research writing. Preserve formal tone, field-specific terminology, citations, equations, and hedging language.",
    builtIn: true
  },
  {
    id: "news",
    label: "\u65B0\u95FB\u5A92\u4F53\u8BD1\u8005",
    description: "\u9002\u5408\u65B0\u95FB\u3001\u62A5\u9053\u548C\u8BC4\u8BBA\u7C7B\u5185\u5BB9\u3002",
    systemPrompt: "Specialize in journalism and media writing. Keep facts precise, tone neutral unless the source is clearly opinionated, and preserve named entities faithfully.",
    builtIn: true
  },
  {
    id: "finance",
    label: "\u91D1\u878D\u7FFB\u8BD1\u987E\u95EE",
    description: "\u9002\u5408\u8D22\u62A5\u3001\u5E02\u573A\u5206\u6790\u548C\u6295\u8D44\u5185\u5BB9\u3002",
    systemPrompt: "Specialize in finance and markets. Use standard financial terminology, preserve quantitative nuance, and avoid casual reinterpretation of risk-related statements.",
    builtIn: true
  },
  {
    id: "novel",
    label: "\u5C0F\u8BF4\u8BD1\u8005",
    description: "\u9002\u5408\u5C0F\u8BF4\u3001\u53D9\u4E8B\u6587\u672C\u548C\u5BF9\u8BDD\u3002",
    systemPrompt: "Specialize in literary and narrative translation. Preserve voice, pacing, dialogue rhythm, subtext, and character tone while remaining readable.",
    builtIn: true
  },
  {
    id: "medical",
    label: "\u533B\u5B66\u7FFB\u8BD1\u5927\u5E08",
    description: "\u9002\u5408\u533B\u5B66\u3001\u751F\u547D\u79D1\u5B66\u548C\u4E34\u5E8A\u8D44\u6599\u3002",
    systemPrompt: "Specialize in medical and biomedical writing. Use precise clinical terminology, preserve uncertainty qualifiers, and avoid inventing interpretations.",
    builtIn: true
  },
  {
    id: "legal",
    label: "\u6CD5\u5F8B\u884C\u4E1A\u8BD1\u8005",
    description: "\u9002\u5408\u6CD5\u5F8B\u6761\u6587\u3001\u5408\u540C\u548C\u6CD5\u89C4\u5185\u5BB9\u3002",
    systemPrompt: "Specialize in legal writing. Preserve defined terms, obligations, conditions, and formal legal structure with high fidelity.",
    builtIn: true
  },
  {
    id: "github",
    label: "GitHub \u7FFB\u8BD1\u589E\u5F3A\u5668",
    description: "\u9002\u5408 issue\u3001PR\u3001README\u3001\u63D0\u4EA4\u8BF4\u660E\u7B49\u5F00\u53D1\u534F\u4F5C\u6587\u672C\u3002",
    systemPrompt: "Specialize in GitHub and software collaboration content. Preserve Markdown, issue/PR terminology, commit style, code identifiers, and concise developer tone.",
    builtIn: true
  }
];
function getTranslationMode(modes, id) {
  const normalizedModes = normalizeTranslationModes(modes);
  return normalizedModes.find((mode) => mode.id === id) || normalizedModes[0];
}
function getTranslationModeOptions(modes) {
  return Object.fromEntries(normalizeTranslationModes(modes).map((mode) => [mode.id, mode.label]));
}
function normalizeTranslationModes(modes) {
  const incomingModes = Array.isArray(modes) ? modes : [];
  const normalizedModes = [];
  const usedIds = /* @__PURE__ */ new Set();
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
function createCustomTranslationMode(existingModes) {
  const usedIds = new Set(existingModes.map((mode) => mode.id));
  const id = ensureUniqueModeId(`custom-${Date.now().toString(36)}`, usedIds);
  return {
    id,
    label: "\u65B0\u6A21\u5F0F",
    description: "\u81EA\u5B9A\u4E49\u7FFB\u8BD1\u98CE\u683C\u3002",
    systemPrompt: "Define the translation style, terminology preference, tone, and domain constraints for this mode.",
    builtIn: false
  };
}
function getBuiltInTranslationMode(id) {
  const builtInMode = BUILT_IN_TRANSLATION_MODES.find((mode) => mode.id === id);
  return builtInMode ? { ...builtInMode } : void 0;
}
function normalizeModeText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function normalizeModeId(value) {
  const source = typeof value === "string" && value.trim() ? value.trim() : "custom-mode";
  return source.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "custom-mode";
}
function ensureUniqueModeId(candidate, usedIds) {
  let nextId = candidate;
  let suffix = 1;
  while (usedIds.has(nextId)) {
    nextId = `${candidate}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

// src/types.ts
var DEFAULT_SETTINGS = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  translationMode: "general",
  translationModes: [],
  targetLanguage: "\u4E2D\u6587",
  orbRevealDelayMs: 500,
  hoverDelayMs: 150,
  requestTimeoutMs: 3e4,
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

// src/settings-tab.ts
var ObsidianTranslatorSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.editingModeId = null;
  }
  display() {
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
    new import_obsidian2.Setting(connectionSection.groupEl).setName("Base URL").setDesc("Root URLs and full /chat/completions URLs are both accepted.").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.baseUrl).onChange(async (value) => {
        this.plugin.settings.baseUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(connectionSection.groupEl).setName("API key").setDesc("Stored in this vault only.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(connectionSection.groupEl).setName("Model").setDesc("Model name sent to the OpenAI-compatible API.").addText(
      (text) => text.setPlaceholder("gpt-4.1-mini").setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value.trim();
        await this.plugin.saveSettings();
      })
    );
    const behaviorSection = this.createSection(
      containerEl,
      "Behavior",
      "Control when the orb appears and how translation is triggered."
    );
    new import_obsidian2.Setting(behaviorSection.groupEl).setName("Default translation mode").setDesc("Choose which mode is used unless you switch it in the floating panel.").addDropdown(
      (dropdown) => dropdown.addOptions(getTranslationModeOptions(this.plugin.settings.translationModes)).setValue(this.plugin.settings.translationMode).onChange(async (value) => {
        this.plugin.settings.translationMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(behaviorSection.groupEl).setName("Target language").setDesc("Target language used by the selected mode prompt.").addText(
      (text) => text.setPlaceholder("\u4E2D\u6587").setValue(this.plugin.settings.targetLanguage).onChange(async (value) => {
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
        this.plugin.settings.orbRevealDelayMs = Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_SETTINGS.orbRevealDelayMs;
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
        this.plugin.settings.hoverDelayMs = Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_SETTINGS.hoverDelayMs;
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
        this.plugin.settings.requestTimeoutMs = Number.isFinite(parsed) ? Math.max(1e3, parsed) : DEFAULT_SETTINGS.requestTimeoutMs;
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
    new import_obsidian2.Setting(debugSection.groupEl).setName("Debug mode").setDesc("Show structured request, response, selection, and timing details in the translation panel.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
        this.plugin.settings.debugMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(debugSection.groupEl).setName("Test connection").setDesc("Send a small translation request with the current settings.").addButton(
      (button) => button.setButtonText("Test API").onClick(async () => {
        button.setDisabled(true);
        try {
          const preview = await this.plugin.runConnectionTest();
          new import_obsidian2.Notice(`API ok: ${preview.slice(0, 48)}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          new import_obsidian2.Notice(`API test failed: ${message}`);
        } finally {
          button.setDisabled(false);
        }
      })
    ).addButton(
      (button) => button.setButtonText("Copy debug").onClick(async () => {
        try {
          await navigator.clipboard.writeText(this.plugin.getLatestDebugReport());
          new import_obsidian2.Notice("Latest debug report copied.");
        } catch {
          new import_obsidian2.Notice("Failed to copy the debug report.");
        }
      })
    );
  }
  createSection(containerEl, title, description) {
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
  renderTranslationModesSection(section) {
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
  renderModeCard(containerEl, mode) {
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
          this.plugin.settings.translationMode = this.plugin.settings.translationModes[0]?.id || DEFAULT_SETTINGS.translationMode;
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
  createModeField(containerEl, label, description, value, placeholder, onChange, multiline = false) {
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
  updateMode(modeId, updater) {
    this.plugin.settings.translationModes = this.plugin.settings.translationModes.map(
      (mode) => mode.id === modeId ? updater(mode) : mode
    );
  }
  getEditingMode() {
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
  addNumberSetting(containerEl, name, description, value, onChange) {
    new import_obsidian2.Setting(containerEl).setName(name).setDesc(description).addText((text) => {
      text.inputEl.inputMode = "numeric";
      text.inputEl.pattern = "[0-9]*";
      text.setValue(value).onChange(onChange);
    });
  }
  addContextToggle(containerEl, name, description, key) {
    new import_obsidian2.Setting(containerEl).setName(name).setDesc(description).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      })
    );
  }
  addColorSetting(containerEl, name, description, key, defaultValue) {
    new import_obsidian2.Setting(containerEl).setName(name).setDesc(description).addColorPicker(
      (picker) => picker.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value.toUpperCase();
        await this.plugin.saveSettings();
      })
    ).addExtraButton(
      (button) => button.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
        this.plugin.settings[key] = defaultValue;
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
};

// src/translation-client.ts
var import_obsidian3 = require("obsidian");
var TranslationClient = class {
  constructor(getSettings) {
    this.getSettings = getSettings;
  }
  async translate(text, context) {
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
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const startedMs = Date.now();
    let messageStrategy = "system-user";
    let fallbackReason;
    let payload = buildRequestPayload(trimmedText, settings, context, messageStrategy);
    let responseText = "";
    try {
      let response = await sendChatRequest(url, payload, settings);
      responseText = response.text;
      if (shouldRetryWithoutSystemRole(response)) {
        fallbackReason = extractErrorMessage(response.json, response.text) || "Provider rejected the system role.";
        messageStrategy = "user-only";
        payload = buildRequestPayload(trimmedText, settings, context, messageStrategy);
        response = await sendChatRequest(url, payload, settings);
        responseText = response.text;
      }
      const status = response.status;
      const responseJson = response.json;
      const debugInfo = {
        ...buildBaseDebugInfo(url, settings, translationMode.id, filteredContext, payload, messageStrategy, fallbackReason),
        timing: {
          startedAt,
          durationMs: Date.now() - startedMs
        },
        response: {
          status,
          model: responseJson?.model?.trim() || settings.model.trim(),
          headers: response.headers,
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
        ...buildBaseDebugInfo(url, settings, translationMode.id, filteredContext, payload, messageStrategy, fallbackReason),
        timing: {
          startedAt,
          durationMs: Date.now() - startedMs
        },
        response: responseText ? {
          status: 0,
          model: settings.model.trim(),
          headers: {},
          textPreview: summarizeText(responseText),
          json: parseJson(responseText)
        } : void 0,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message
        }
      });
    }
  }
  async testConnection() {
    return this.translate("The quick brown fox jumps over the lazy dog.");
  }
};
var TranslationError = class extends Error {
  constructor(message, debugInfo) {
    super(message);
    this.debugInfo = debugInfo;
    this.name = "TranslationError";
  }
};
function normalizeChatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/chat/completions`;
}
function buildRequestPayload(text, settings, context, messageStrategy) {
  return {
    model: settings.model.trim(),
    stream: false,
    temperature: 0.2,
    messages: buildMessages(text, settings, context, messageStrategy)
  };
}
async function sendChatRequest(url, payload, settings) {
  const response = await withTimeout(
    (0, import_obsidian3.requestUrl)({
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
  const responseText = response.text ?? "";
  return {
    status: response.status,
    text: responseText,
    json: response.json ?? parseJson(responseText),
    headers: response.headers ?? {}
  };
}
function buildBaseDebugInfo(url, settings, translationModeId, filteredContext, payload, messageStrategy, fallbackReason) {
  return {
    timing: {
      startedAt: "",
      durationMs: 0
    },
    request: {
      url,
      method: "POST",
      configuredModel: settings.model.trim(),
      translationMode: translationModeId,
      targetLanguage: settings.targetLanguage.trim() || "\u4E2D\u6587",
      context: filteredContext,
      messageStrategy,
      fallbackReason,
      body: sanitizeBody(payload)
    }
  };
}
function buildMessages(text, settings, context, messageStrategy) {
  const systemPrompt = buildSystemPrompt(settings);
  const userContent = buildUserMessage(text, resolveTranslationContext(context, settings));
  if (messageStrategy === "user-only") {
    return [
      {
        role: "user",
        content: `[Translation instructions]
${systemPrompt}

${userContent}`
      }
    ];
  }
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
function buildSystemPrompt(settings) {
  const mode = getTranslationMode(settings.translationModes, settings.translationMode);
  return `You are ${mode.label}.
${mode.systemPrompt}
Detect the source language automatically and translate only the selected text into ${settings.targetLanguage.trim() || "\u4E2D\u6587"}.
You may use any contextual metadata that is provided only to disambiguate terminology, references, omitted subjects, and tone.
Never translate the surrounding context itself unless it is part of the selected text.
Preserve Markdown links, inline code, citations, equations, bullet structure, and paragraph breaks when possible.
Return only the translated selected text. Do not add explanations, labels, or surrounding commentary.`;
}
function buildUserMessage(text, context) {
  const parts = [`[Selected text]
${text}`];
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
      parts.push(`[Context]
${contextLines.join("\n")}`);
    }
  }
  return parts.join("\n\n");
}
function resolveTranslationContext(context, settings) {
  if (!context) {
    return void 0;
  }
  const filteredContext = {};
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
  return hasContextContent(filteredContext) ? filteredContext : void 0;
}
function extractMessageContent(responseJson) {
  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text?.trim() || "").filter(Boolean).join("\n");
  }
  return "";
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function extractErrorMessage(responseJson, responseText) {
  return responseJson?.error?.message?.trim() || summarizeText(responseText, 200);
}
function shouldRetryWithoutSystemRole(response) {
  if (response.status < 400) {
    return false;
  }
  const message = extractErrorMessage(response.json, response.text).toLowerCase();
  return message.includes("role must be in [user,assistant]") || message.includes("role") && message.includes("[user,assistant]") || message.includes("system role") || message.includes("role 'system'") || message.includes('role "system"');
}
function sanitizeBody(payload) {
  return JSON.parse(JSON.stringify(payload));
}
function summarizeText(text, maxLength = 4e3) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}
...<truncated>`;
}
function withTimeout(promise, timeoutMs, message) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
  });
}
function hasContextContent(context) {
  return Object.values(context).some(Boolean);
}

// src/translation-panel.ts
var import_obsidian4 = require("obsidian");
var TranslationPanel = class {
  constructor(options) {
    this.options = options;
    this.anchorRect = null;
    this.pinned = false;
    this.manualPosition = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.unregisterDragHandlers = null;
    this.currentDebugText = "";
    this.rootEl = document.createElement("div");
    this.rootEl.className = "obsidian-translator-panel";
    this.headerEl = document.createElement("div");
    this.headerEl.className = "obsidian-translator-panel__header";
    const controlsEl = document.createElement("div");
    controlsEl.className = "obsidian-translator-panel__controls";
    const metaEl = document.createElement("div");
    metaEl.className = "obsidian-translator-panel__meta";
    this.modeSelectEl = document.createElement("select");
    this.modeSelectEl.className = "obsidian-translator-panel__mode-select";
    this.modelEl = document.createElement("div");
    this.modelEl.className = "obsidian-translator-panel__model";
    this.closeButtonEl = this.createControlButton("close", "Close translation");
    this.pinButtonEl = this.createControlButton("pin", "Pin translation");
    this.copyButtonEl = this.createControlButton("copy", "Copy translation");
    controlsEl.append(this.closeButtonEl, this.pinButtonEl, this.copyButtonEl);
    metaEl.append(this.modeSelectEl, this.modelEl);
    this.headerEl.append(controlsEl, metaEl);
    const bodyEl = document.createElement("div");
    bodyEl.className = "obsidian-translator-panel__body";
    this.statusEl = document.createElement("p");
    this.statusEl.className = "obsidian-translator-panel__status";
    this.contentEl = document.createElement("p");
    this.contentEl.className = "obsidian-translator-panel__content";
    this.debugDetailsEl = document.createElement("details");
    this.debugDetailsEl.className = "obsidian-translator-panel__debug";
    this.debugDetailsEl.open = true;
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Debug";
    this.debugPreEl = document.createElement("pre");
    this.debugPreEl.className = "obsidian-translator-panel__debug-pre";
    this.debugDetailsEl.append(summaryEl, this.debugPreEl);
    bodyEl.append(this.statusEl, this.contentEl, this.debugDetailsEl);
    this.rootEl.append(this.headerEl, bodyEl);
    document.body.appendChild(this.rootEl);
    this.pinButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      this.setPinned(!this.pinned);
    });
    this.copyButtonEl.addEventListener("click", async (event) => {
      event.stopPropagation();
      await this.copyContent();
    });
    this.closeButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      this.hide(true);
    });
    this.modeSelectEl.addEventListener("change", () => {
      this.options.onModeChange(this.modeSelectEl.value);
    });
    this.headerEl.addEventListener("pointerdown", (event) => this.startDrag(event));
  }
  destroy() {
    this.unregisterDragHandlers?.();
    this.rootEl.remove();
  }
  isPinned() {
    return this.pinned;
  }
  applyAppearance(settings) {
    this.syncModeOptions(settings);
    const closeColor = normalizeHexColor(settings.closeButtonColor, "#FF5F57");
    const pinColor = normalizeHexColor(settings.pinButtonColor, "#FFBD2E");
    const copyColor = normalizeHexColor(settings.copyButtonColor, "#28C840");
    this.rootEl.style.setProperty("--translator-close-color", closeColor);
    this.rootEl.style.setProperty("--translator-close-icon-color", pickReadableIconColor(closeColor));
    this.rootEl.style.setProperty("--translator-pin-color", pinColor);
    this.rootEl.style.setProperty("--translator-pin-icon-color", pickReadableIconColor(pinColor));
    this.rootEl.style.setProperty("--translator-copy-color", copyColor);
    this.rootEl.style.setProperty("--translator-copy-icon-color", pickReadableIconColor(copyColor));
    this.rootEl.style.setProperty("--translator-pin-ring", hexToRgba(pinColor, 0.3));
    this.closeButtonEl.style.backgroundColor = closeColor;
    this.closeButtonEl.style.color = pickReadableIconColor(closeColor);
    this.pinButtonEl.style.backgroundColor = pinColor;
    this.pinButtonEl.style.color = pickReadableIconColor(pinColor);
    this.copyButtonEl.style.backgroundColor = copyColor;
    this.copyButtonEl.style.color = pickReadableIconColor(copyColor);
  }
  showLoading(anchorRect, model, debugInfo, debugEnabled = false) {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "Translating selection...";
    this.contentEl.textContent = "Working on the translation...";
    this.rootEl.classList.add("is-loading");
    this.rootEl.classList.remove("is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }
  showResult(anchorRect, model, text, debugInfo, debugEnabled = false) {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "";
    this.contentEl.textContent = text;
    this.rootEl.classList.remove("is-loading", "is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }
  showError(anchorRect, model, message, debugInfo, debugEnabled = false) {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "Translation failed";
    this.contentEl.textContent = message;
    this.rootEl.classList.remove("is-loading");
    this.rootEl.classList.add("is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }
  updateAnchor(anchorRect) {
    this.anchorRect = cloneRect(anchorRect);
    if (this.isVisible && !this.pinned && !this.manualPosition) {
      this.positionPanel();
    }
  }
  hide(force = false) {
    if (!this.isVisible && !force) {
      return;
    }
    if (this.pinned && !force) {
      return;
    }
    this.isVisible = false;
    if (force) {
      this.manualPosition = null;
      this.setPinned(false);
    }
    this.rootEl.classList.remove("is-visible", "is-loading", "is-error");
    this.rootEl.style.left = "";
    this.rootEl.style.top = "";
    this.renderDebugInfo(void 0, false);
    this.options.onClose();
  }
  show() {
    this.isVisible = true;
    this.rootEl.classList.add("is-visible");
    if (!this.pinned && !this.manualPosition) {
      this.positionPanel();
    } else if (this.manualPosition) {
      this.applyPosition(this.manualPosition.left, this.manualPosition.top);
    }
  }
  positionPanel() {
    if (!this.anchorRect) {
      return;
    }
    const margin = 12;
    const panelRect = this.rootEl.getBoundingClientRect();
    const panelWidth = panelRect.width || 440;
    const panelHeight = panelRect.height || 240;
    let left = this.anchorRect.right + 14;
    let top = this.anchorRect.bottom + 14;
    if (left + panelWidth > window.innerWidth - margin) {
      left = Math.max(margin, this.anchorRect.right - panelWidth);
    }
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, this.anchorRect.top - panelHeight - 14);
    }
    this.applyPosition(left, top);
  }
  applyPosition(left, top) {
    const boundedLeft = clamp2(left, 12, Math.max(12, window.innerWidth - this.rootEl.offsetWidth - 12));
    const boundedTop = clamp2(top, 12, Math.max(12, window.innerHeight - this.rootEl.offsetHeight - 12));
    this.rootEl.style.left = `${boundedLeft}px`;
    this.rootEl.style.top = `${boundedTop}px`;
  }
  setPinned(pinned) {
    this.pinned = pinned;
    this.rootEl.classList.toggle("is-pinned", pinned);
    this.pinButtonEl.classList.toggle("is-active", pinned);
  }
  async copyContent() {
    const content = this.contentEl.textContent?.trim() || "";
    if (!content) {
      new import_obsidian4.Notice("Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      new import_obsidian4.Notice("Translation copied.");
    } catch {
      new import_obsidian4.Notice("Failed to copy translation.");
    }
  }
  renderDebugInfo(debugInfo, enabled) {
    this.rootEl.classList.toggle("is-debug", enabled);
    if (!enabled || debugInfo === void 0) {
      this.currentDebugText = "";
      this.debugPreEl.textContent = "";
      this.debugDetailsEl.hidden = true;
      return;
    }
    this.currentDebugText = JSON.stringify(debugInfo, null, 2);
    this.debugPreEl.textContent = this.currentDebugText;
    this.debugDetailsEl.hidden = false;
  }
  startDrag(event) {
    if (event.target?.closest("button, select")) {
      return;
    }
    const rect = this.rootEl.getBoundingClientRect();
    this.isDragging = true;
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const handleMove = (moveEvent) => {
      if (!this.isDragging) {
        return;
      }
      this.manualPosition = {
        left: moveEvent.clientX - this.dragOffset.x,
        top: moveEvent.clientY - this.dragOffset.y
      };
      this.applyPosition(this.manualPosition.left, this.manualPosition.top);
    };
    const handleUp = () => {
      this.isDragging = false;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      this.unregisterDragHandlers = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    this.unregisterDragHandlers = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }
  createControlButton(kind, label) {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = `obsidian-translator-panel__control obsidian-translator-panel__control--${kind}`;
    buttonEl.setAttribute("aria-label", label);
    buttonEl.title = label;
    (0, import_obsidian4.setIcon)(buttonEl, kind === "close" ? "x" : kind === "pin" ? "pin" : "copy");
    return buttonEl;
  }
  syncModeOptions(settings) {
    const previousValue = this.modeSelectEl.value;
    const fragment = document.createDocumentFragment();
    for (const mode of settings.translationModes) {
      const optionEl = document.createElement("option");
      optionEl.value = mode.id;
      optionEl.textContent = mode.label;
      fragment.appendChild(optionEl);
    }
    this.modeSelectEl.replaceChildren(fragment);
    this.modeSelectEl.value = settings.translationMode;
    if (!this.modeSelectEl.value && previousValue) {
      this.modeSelectEl.value = previousValue;
    }
  }
};
function clamp2(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function cloneRect(rect) {
  return new DOMRect(rect.x, rect.y, rect.width, rect.height);
}

// src/main.ts
var ObsidianTranslatorPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.currentSelectionKey = null;
    this.selectionEpoch = 0;
    this.requestSequence = 0;
    this.latestDebugReport = null;
    this.lastSelectionSnapshot = null;
  }
  async onload() {
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
  onunload() {
    this.translationPanel?.destroy();
  }
  async loadSettings() {
    this.settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...await this.loadData()
    });
  }
  async saveSettings() {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    this.applyAppearanceSettings();
  }
  getLatestDebugReport() {
    if (!this.latestDebugReport) {
      return "No debug report has been captured yet.";
    }
    return JSON.stringify(this.latestDebugReport, null, 2);
  }
  async runConnectionTest() {
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
        translation: error instanceof TranslationError ? error.debugInfo : void 0
      });
      throw error;
    }
  }
  handleSelectionChange(snapshot) {
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
  async translateSelection(snapshot) {
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
        translation: error instanceof TranslationError ? error.debugInfo : void 0
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
  async translateSelectionFromCommand() {
    const snapshot = this.selectionController.refreshSelection() || this.selectionController.getCurrentSelection() || this.lastSelectionSnapshot;
    if (!snapshot) {
      new import_obsidian5.Notice("Select text in the active Markdown or PDF view before translating.");
      return;
    }
    await this.translateSelection(snapshot);
  }
  isStaleRequest(selectionKey, requestId, requestEpoch) {
    if (requestId !== this.requestSequence) {
      return true;
    }
    if (this.translationPanel.isPinned()) {
      return false;
    }
    return requestEpoch !== this.selectionEpoch || this.currentSelectionKey !== selectionKey;
  }
  recordDebugReport(report) {
    this.latestDebugReport = report;
    if (this.settings.debugMode) {
      console.debug("[translator-for-obsidian]", report);
    }
  }
  applyAppearanceSettings() {
    this.selectionController?.applyAppearance(this.settings);
    this.translationPanel?.applyAppearance(this.settings);
  }
  async changeTranslationMode(mode, retranslate = false) {
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
};
function buildSelectionDebugInfo(snapshot, settings) {
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
function serializeError(error) {
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
function round(value) {
  return Math.round(value * 100) / 100;
}
function normalizeSettings(settings) {
  const orbRevealDelayMs = Number(settings.orbRevealDelayMs);
  const hoverDelayMs = Number(settings.hoverDelayMs);
  const requestTimeoutMs = Number(settings.requestTimeoutMs);
  const translationModes = normalizeTranslationModes(settings.translationModes);
  const hasSelectedMode = translationModes.some((mode) => mode.id === settings.translationMode);
  return {
    baseUrl: settings.baseUrl?.trim?.() || DEFAULT_SETTINGS.baseUrl,
    apiKey: settings.apiKey?.trim?.() || "",
    model: settings.model?.trim?.() || DEFAULT_SETTINGS.model,
    translationMode: hasSelectedMode ? settings.translationMode : translationModes[0]?.id || DEFAULT_SETTINGS.translationMode,
    translationModes,
    targetLanguage: settings.targetLanguage?.trim?.() || DEFAULT_SETTINGS.targetLanguage,
    orbRevealDelayMs: Number.isFinite(orbRevealDelayMs) ? Math.max(0, orbRevealDelayMs) : DEFAULT_SETTINGS.orbRevealDelayMs,
    hoverDelayMs: Number.isFinite(hoverDelayMs) ? Math.max(0, hoverDelayMs) : DEFAULT_SETTINGS.hoverDelayMs,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) ? Math.max(1e3, requestTimeoutMs) : DEFAULT_SETTINGS.requestTimeoutMs,
    debugMode: Boolean(settings.debugMode),
    includeContextTitle: settings.includeContextTitle ?? DEFAULT_SETTINGS.includeContextTitle,
    includeContextSectionHeading: settings.includeContextSectionHeading ?? DEFAULT_SETTINGS.includeContextSectionHeading,
    includeContextPreviousParagraph: settings.includeContextPreviousParagraph ?? DEFAULT_SETTINGS.includeContextPreviousParagraph,
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
