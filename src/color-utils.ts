export function normalizeHexColor(value: string, fallback: string): string {
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

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex, "#000000");
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function pickReadableIconColor(hex: string): string {
  const normalized = normalizeHexColor(hex, "#000000");
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.68 ? "rgba(0, 0, 0, 0.72)" : "rgba(255, 255, 255, 0.94)";
}
