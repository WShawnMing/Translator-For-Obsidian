import { MarkdownView, type View } from "obsidian";

import type { TranslationContext } from "./types";

export function buildEditorSelectionContext(view: MarkdownView): TranslationContext {
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

export function buildDomSelectionContext(view: View, range: Range): TranslationContext {
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

function getEditorLines(editor: MarkdownView["editor"]): string[] {
  const lines: string[] = [];
  for (let index = 0; index <= editor.lastLine(); index += 1) {
    lines.push(editor.getLine(index));
  }
  return lines;
}

function findNearestMarkdownHeading(lines: string[], startLine: number): string | undefined {
  for (let lineIndex = startLine; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]?.trim();
    const match = /^(#{1,6})\s+(.+)$/.exec(line || "");
    if (match?.[2]) {
      return match[2].trim();
    }
  }

  return undefined;
}

function collectParagraph(lines: string[], startLine: number, step: -1 | 1): string | undefined {
  let lineIndex = startLine;

  while (lineIndex >= 0 && lineIndex < lines.length && !lines[lineIndex].trim()) {
    lineIndex += step;
  }

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return undefined;
  }

  const buffer: string[] = [];
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

  return buffer.length > 0 ? buffer.join("\n") : undefined;
}

function getViewFileInfo(view: View): { path?: string; basename?: string } {
  const maybeFile = (view as { file?: { path?: string; basename?: string } }).file;
  return {
    path: maybeFile?.path,
    basename: maybeFile?.basename
  };
}

function findNearestHeading(anchor: Element | null, container: HTMLElement): string | undefined {
  if (!anchor) {
    return undefined;
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

  return undefined;
}

function collectNearbyBlockText(view: View, anchor: Element | null, direction: -1 | 1): string | undefined {
  const blocks = collectContextBlocks(view);
  if (!anchor || blocks.length === 0) {
    return undefined;
  }

  const anchorIndex = blocks.findIndex((element) => element === anchor || element.contains(anchor) || anchor.contains(element));
  if (anchorIndex === -1) {
    return undefined;
  }

  const segments: string[] = [];
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
  return combined || undefined;
}

function collectContextBlocks(view: View): Element[] {
  const selectors =
    view.getViewType() === "pdf"
      ? [".textLayer span", ".textLayer div"]
      : ["p", "li", "blockquote", "pre", "figcaption", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6"];

  return Array.from(view.containerEl.querySelectorAll(selectors.join(","))).filter((element) =>
    Boolean(normalizeText(element.textContent || ""))
  );
}

function resolveElement(node: Node | null): Element | null {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }

  return node.parentElement;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
