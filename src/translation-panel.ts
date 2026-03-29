import { Notice, setIcon } from "obsidian";

import { hexToRgba, normalizeHexColor, pickReadableIconColor } from "./color-utils";
import type { TranslationModeId, TranslatorPluginSettings } from "./types";

interface TranslationPanelOptions {
  onClose: () => void;
  onModeChange: (mode: TranslationModeId) => void;
}

export class TranslationPanel {
  private readonly rootEl: HTMLDivElement;
  private readonly modeSelectEl: HTMLSelectElement;
  private readonly modelEl: HTMLDivElement;
  private readonly statusEl: HTMLParagraphElement;
  private readonly contentEl: HTMLParagraphElement;
  private readonly debugDetailsEl: HTMLDetailsElement;
  private readonly debugPreEl: HTMLPreElement;
  private readonly pinButtonEl: HTMLButtonElement;
  private copyButtonEl: HTMLButtonElement;
  private readonly closeButtonEl: HTMLButtonElement;
  private readonly headerEl: HTMLDivElement;
  private anchorRect: DOMRect | null = null;
  private pinned = false;
  private manualPosition: { left: number; top: number } | null = null;
  private isVisible = false;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private unregisterDragHandlers: (() => void) | null = null;
  private currentDebugText = "";

  constructor(private readonly options: TranslationPanelOptions) {
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
      this.options.onModeChange(this.modeSelectEl.value as TranslationModeId);
    });

    this.headerEl.addEventListener("pointerdown", (event) => this.startDrag(event));
  }

  destroy(): void {
    this.unregisterDragHandlers?.();
    this.rootEl.remove();
  }

  isPinned(): boolean {
    return this.pinned;
  }

  applyAppearance(settings: TranslatorPluginSettings): void {
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

  showLoading(anchorRect: DOMRect, model: string, debugInfo?: unknown, debugEnabled = false): void {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "Translating selection...";
    this.contentEl.textContent = "Working on the translation...";
    this.rootEl.classList.add("is-loading");
    this.rootEl.classList.remove("is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }

  showResult(anchorRect: DOMRect, model: string, text: string, debugInfo?: unknown, debugEnabled = false): void {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "";
    this.contentEl.textContent = text;
    this.rootEl.classList.remove("is-loading", "is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }

  showError(anchorRect: DOMRect, model: string, message: string, debugInfo?: unknown, debugEnabled = false): void {
    this.anchorRect = cloneRect(anchorRect);
    this.modelEl.textContent = model;
    this.statusEl.textContent = "Translation failed";
    this.contentEl.textContent = message;
    this.rootEl.classList.remove("is-loading");
    this.rootEl.classList.add("is-error");
    this.renderDebugInfo(debugInfo, debugEnabled);
    this.show();
  }

  updateAnchor(anchorRect: DOMRect): void {
    this.anchorRect = cloneRect(anchorRect);
    if (this.isVisible && !this.pinned && !this.manualPosition) {
      this.positionPanel();
    }
  }

  hide(force = false): void {
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
    this.renderDebugInfo(undefined, false);
    this.options.onClose();
  }

  private show(): void {
    this.isVisible = true;
    this.rootEl.classList.add("is-visible");
    if (!this.pinned && !this.manualPosition) {
      this.positionPanel();
    } else if (this.manualPosition) {
      this.applyPosition(this.manualPosition.left, this.manualPosition.top);
    }
  }

  private positionPanel(): void {
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

  private applyPosition(left: number, top: number): void {
    const boundedLeft = clamp(left, 12, Math.max(12, window.innerWidth - this.rootEl.offsetWidth - 12));
    const boundedTop = clamp(top, 12, Math.max(12, window.innerHeight - this.rootEl.offsetHeight - 12));

    this.rootEl.style.left = `${boundedLeft}px`;
    this.rootEl.style.top = `${boundedTop}px`;
  }

  private setPinned(pinned: boolean): void {
    this.pinned = pinned;
    this.rootEl.classList.toggle("is-pinned", pinned);
    this.pinButtonEl.classList.toggle("is-active", pinned);
  }

  private async copyContent(): Promise<void> {
    const content = this.contentEl.textContent?.trim() || "";
    if (!content) {
      new Notice("Nothing to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      new Notice("Translation copied.");
    } catch {
      new Notice("Failed to copy translation.");
    }
  }

  private renderDebugInfo(debugInfo: unknown, enabled: boolean): void {
    this.rootEl.classList.toggle("is-debug", enabled);
    if (!enabled || debugInfo === undefined) {
      this.currentDebugText = "";
      this.debugPreEl.textContent = "";
      this.debugDetailsEl.hidden = true;
      return;
    }

    this.currentDebugText = JSON.stringify(debugInfo, null, 2);
    this.debugPreEl.textContent = this.currentDebugText;
    this.debugDetailsEl.hidden = false;
  }

  private startDrag(event: PointerEvent): void {
    if ((event.target as HTMLElement | null)?.closest("button, select")) {
      return;
    }

    const rect = this.rootEl.getBoundingClientRect();
    this.isDragging = true;
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const handleMove = (moveEvent: PointerEvent) => {
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

  private createControlButton(kind: "close" | "pin" | "copy", label: string): HTMLButtonElement {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = `obsidian-translator-panel__control obsidian-translator-panel__control--${kind}`;
    buttonEl.setAttribute("aria-label", label);
    buttonEl.title = label;
    setIcon(buttonEl, kind === "close" ? "x" : kind === "pin" ? "pin" : "copy");
    return buttonEl;
  }

  private syncModeOptions(settings: TranslatorPluginSettings): void {
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function cloneRect(rect: DOMRect): DOMRect {
  return new DOMRect(rect.x, rect.y, rect.width, rect.height);
}
