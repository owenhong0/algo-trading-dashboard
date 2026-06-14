// src/lib/ui.ts — tiny DOM + formatting helpers shared across pages

// Create an element with an optional class and innerHTML.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// ── Number formatting ──────────────────────────────────────────────────────────
export function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return n > 0 ? "∞" : "−∞";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Format a decimal fraction as a percentage, e.g. 0.0825 → "8.25%".
export function pct(n: number, decimals = 2): string {
  if (!isFinite(n)) return n > 0 ? "∞" : "−∞";
  return `${(n * 100).toFixed(decimals)}%`;
}

// Signed percentage with a leading + for non-negatives.
export function spct(n: number, decimals = 2): string {
  const s = pct(n, decimals);
  return n >= 0 ? `+${s}` : s;
}

export function signClass(n: number): string {
  return n >= 0 ? "positive" : "negative";
}

// ── Slider factory ──────────────────────────────────────────────────────────────
export interface SliderOpts {
  label: string;                    // may contain HTML (e.g. math symbols)
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;   // how to render the live readout
  onInput: (v: number) => void;
}

// Returns a labelled range input whose readout updates live as it is dragged.
export function makeSlider(o: SliderOpts): HTMLElement {
  const fmtFn = o.format ?? ((v: number) => fmt(v));

  const wrap = el("div", "slider");
  const head = el("div", "slider-head");
  const label = el("span", "slider-label", o.label);
  const value = el("span", "slider-value", fmtFn(o.value));
  head.append(label, value);

  const input = el("input", "slider-input");
  input.type = "range";
  input.min = String(o.min);
  input.max = String(o.max);
  input.step = String(o.step);
  input.value = String(o.value);
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    value.textContent = fmtFn(v);
    o.onInput(v);
  });

  wrap.append(head, input);
  return wrap;
}

// ── KPI card ─────────────────────────────────────────────────────────────────────
export interface Kpi { label: string; value: string; sub?: string; sign?: number; }

export function kpiCard(k: Kpi): string {
  return `
    <div class="kpi-card">
      <span class="kpi-label">${k.label}</span>
      <span class="kpi-value ${k.sign !== undefined ? signClass(k.sign) : ""}">${k.value}</span>
      ${k.sub ? `<span class="kpi-sub">${k.sub}</span>` : ""}
    </div>`;
}
