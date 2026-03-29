import type { EditorView } from "@codemirror/view";
import { MarkdownView, type Plugin, type View } from "obsidian";

import { hexToRgba, normalizeHexColor } from "./color-utils";
import { buildDomSelectionContext, buildEditorSelectionContext } from "./context-extractor";
import type { SelectionSnapshot, TranslatorPluginSettings } from "./types";

interface SelectionControllerOptions {
  getSettings: () => TranslatorPluginSettings;
  onSelectionChange: (snapshot: SelectionSnapshot | null) => void;
  onTranslateRequested: (snapshot: SelectionSnapshot) => void;
}

export class SelectionController {
  private readonly orbEl: HTMLButtonElement;
  private readonly options: SelectionControllerOptions;
  private currentSnapshot: SelectionSnapshot | null = null;
  private selectionTimer: number | null = null;
  private orbRevealTimer: number | null = null;
  private hoverTimer: number | null = null;

  constructor(private readonly plugin: Plugin, options: SelectionControllerOptions) {
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

  destroy(): void {
    this.clearHoverTimer();
    this.clearOrbRevealTimer();
    this.clearSelectionTimer();
    this.orbEl.remove();
  }

  getCurrentSelection(): SelectionSnapshot | null {
    return this.currentSnapshot;
  }

  applyAppearance(settings: TranslatorPluginSettings): void {
    const orbColor = normalizeHexColor(settings.orbColor, "#0A84FF");
    this.orbEl.style.setProperty("--translator-orb-color", orbColor);
    this.orbEl.style.setProperty("--translator-orb-halo", hexToRgba(orbColor, 0.18));
    this.orbEl.style.setProperty("--translator-orb-halo-hover", hexToRgba(orbColor, 0.28));
    this.orbEl.style.backgroundColor = orbColor;
  }

  refreshSelection(): SelectionSnapshot | null {
    const snapshot = this.readSelection();
    if (!snapshot) {
      this.setCurrentSelection(null);
      return null;
    }

    this.setCurrentSelection(snapshot);
    return snapshot;
  }

  private scheduleRefresh(delayMs: number): void {
    this.clearSelectionTimer();
    this.selectionTimer = window.setTimeout(() => {
      this.selectionTimer = null;
      this.refreshSelection();
    }, delayMs);
  }

  private clearSelectionTimer(): void {
    if (this.selectionTimer !== null) {
      window.clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) {
      window.clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private clearOrbRevealTimer(): void {
    if (this.orbRevealTimer !== null) {
      window.clearTimeout(this.orbRevealTimer);
      this.orbRevealTimer = null;
    }
  }

  private scheduleHoverTranslation(): void {
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

  private triggerCurrentSelection(): void {
    if (!this.currentSnapshot) {
      return;
    }

    this.options.onTranslateRequested(this.currentSnapshot);
  }

  private setCurrentSelection(snapshot: SelectionSnapshot | null): void {
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

  private scheduleOrbReveal(snapshot: SelectionSnapshot): void {
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

  private positionOrb(anchorRect: DOMRect): void {
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

  private handlePointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
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

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.setCurrentSelection(null);
    }
  }

  private readSelection(): SelectionSnapshot | null {
    const view = this.plugin.app.workspace.activeLeaf?.view ?? null;
    if (!view) {
      return null;
    }

    const domSnapshot = this.readDomSelection(view);
    if (domSnapshot) {
      return domSnapshot;
    }

    if (view instanceof MarkdownView && view.getMode() !== "preview") {
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

  private readDomSelection(view: View): SelectionSnapshot | null {
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
    const filePath = view instanceof MarkdownView ? view.file?.path : undefined;

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

  private getCodeMirrorSelectionRect(view: MarkdownView): DOMRect | null {
    const editorView = ((view.editor as { cm?: EditorView } | undefined)?.cm ?? null) as EditorView | null;
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

  private getCodeMirrorSelectionAnchorRect(view: MarkdownView): DOMRect | null {
    const editorView = ((view.editor as { cm?: EditorView } | undefined)?.cm ?? null) as EditorView | null;
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

  private isInsideActiveView(node: Node): boolean {
    const view = this.plugin.app.workspace.activeLeaf?.view ?? null;
    return Boolean(view?.containerEl.contains(node));
  }

  private rangeBelongsToView(view: View, range: Range): boolean {
    const commonAncestor = range.commonAncestorContainer;
    return view.containerEl.contains(commonAncestor);
  }
}

function resolveSelectionMode(view: View): SelectionSnapshot["mode"] {
  if (view instanceof MarkdownView) {
    return view.getMode() === "preview" ? "reading" : "editor";
  }

  return view.getViewType() === "pdf" ? "pdf" : "view";
}

function rectFromRange(range: Range): DOMRect | null {
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

function anchorRectFromRange(range: Range): DOMRect | null {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeSelectionKey(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
