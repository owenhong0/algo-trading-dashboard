// src/pages/learn.ts — Page 3: Learn (Investment Banking / Algo Trading / Formula Reference)

import { loadChartJs } from "../lib/chartjs";
import { el, makeSlider, fmt, pct, signClass, kpiCard } from "../lib/ui";

const C = {
  blue: "#58a6ff", green: "#3fb950", red: "#f85149",
  orange: "#ffa657", purple: "#d2a8ff", muted: "#8b949e", border: "#30363d",
};

// ════════════════════════════════════════════════════════════════════════════════
//  Investment Banking sub-tab
// ════════════════════════════════════════════════════════════════════════════════

const ibState = {
  // WACC / CAPM
  rf: 0.04, erp: 0.055, beta: 1.10, dv: 0.30, kd: 0.06, tax: 0.21,
  // DCF
  fcf1: 100, g: 0.08, gt: 0.025,
};

interface Wacc { ke: number; kdAfterTax: number; ev: number; wacc: number; ev_v: number; }

function computeWacc(): Wacc {
  const { rf, erp, beta, dv, kd, tax } = ibState;
  const ev_v = 1 - dv;                       // E/V
  const ke = rf + beta * erp;                // CAPM cost of equity
  const kdAfterTax = kd * (1 - tax);         // after-tax cost of debt
  const wacc = ev_v * ke + dv * kdAfterTax;  // WACC
  return { ke, kdAfterTax, ev: 0, wacc, ev_v };
}

interface Dcf { pvFcf: number; pvTerminal: number; ev: number; tvPct: number; years: number[]; }

// 5-year explicit FCF projection + Gordon terminal value, discounted at WACC.
function computeDcf(wacc: number): Dcf {
  const { fcf1, g, gt } = ibState;
  const N = 5;
  let pvFcf = 0;
  let lastFcf = 0;
  const years: number[] = [];
  for (let t = 1; t <= N; t++) {
    const fcf = fcf1 * Math.pow(1 + g, t - 1);
    years.push(fcf);
    pvFcf += fcf / Math.pow(1 + wacc, t);
    lastFcf = fcf;
  }
  // Terminal value at year N:  TV = FCF_N·(1+gt) / (WACC − gt)
  const tv = wacc > gt ? (lastFcf * (1 + gt)) / (wacc - gt) : NaN;
  const pvTerminal = isFinite(tv) ? tv / Math.pow(1 + wacc, N) : NaN;
  const ev = pvFcf + (isFinite(pvTerminal) ? pvTerminal : 0);
  const tvPct = isFinite(pvTerminal) && ev > 0 ? pvTerminal / ev : NaN;
  return { pvFcf, pvTerminal, ev, tvPct, years };
}

function renderIbOutputs(): void {
  const w = computeWacc();
  document.getElementById("ib-wacc-readout")!.innerHTML = `
    <div class="readout-line"><span class="readout-key">Cost of equity &nbsp;K<sub>e</sub> = R<sub>f</sub> + β·ERP</span><span>${pct(w.ke)}</span></div>
    <div class="readout-line"><span class="readout-key">After-tax K<sub>d</sub> = K<sub>d</sub>(1 − t)</span><span>${pct(w.kdAfterTax)}</span></div>
    <div class="readout-line"><span class="readout-key">E/V</span><span>${pct(w.ev_v)}</span></div>
    <div class="readout-sep"></div>
    <div class="readout-line readout-total"><span class="readout-key">WACC = (E/V)K<sub>e</sub> + (D/V)K<sub>d</sub>(1 − t)</span><span class="positive">${pct(w.wacc)}</span></div>`;

  const d = computeDcf(w.wacc);
  const waccGtWarn = !(w.wacc > ibState.gt);
  document.getElementById("ib-dcf-kpis")!.innerHTML = [
    kpiCard({ label: "WACC (from above)", value: pct(w.wacc) }),
    kpiCard({ label: "PV of explicit FCFs", value: `$${fmt(d.pvFcf, 1)}` }),
    kpiCard({ label: "PV of terminal value", value: isFinite(d.pvTerminal) ? `$${fmt(d.pvTerminal, 1)}` : "n/a" }),
    kpiCard({ label: "Terminal % of EV", value: isFinite(d.tvPct) ? pct(d.tvPct, 1) : "n/a" }),
    kpiCard({ label: "Enterprise Value", value: `$${fmt(d.ev, 1)}`, sign: 1 }),
  ].join("");

  document.getElementById("ib-dcf-warn")!.innerHTML = waccGtWarn
    ? `<p class="readout-warn">Terminal growth g<sub>t</sub> ≥ WACC — Gordon model undefined. Lower g<sub>t</sub> or raise WACC.</p>`
    : "";
}

const SECTORS = [
  { name: "Technology", range: "15–25×", color: C.blue,
    driver: "High revenue growth, scalable margins, and recurring/SaaS revenue justify premium multiples. Multiple compresses as growth matures." },
  { name: "Healthcare", range: "12–18×", color: C.green,
    driver: "Stable demand and patent-protected cash flows, offset by R&D risk, regulatory approval timelines, and patent cliffs." },
  { name: "Consumer", range: "10–16×", color: C.purple,
    driver: "Brand strength and pricing power lift multiples; cyclicality and private-label competition cap them. Staples > discretionary." },
  { name: "Industrials", range: "8–12×", color: C.orange,
    driver: "Capital-intensive and cyclical with the business cycle. Backlog visibility and aftermarket/service revenue support multiples." },
  { name: "Energy", range: "5–9×", color: C.red,
    driver: "Commodity-price exposure and heavy capex compress multiples; reserves, breakeven costs, and cash return policy matter most." },
  { name: "Utilities", range: "6–9×", color: C.muted,
    driver: "Regulated, bond-like cash flows give low but stable multiples. Rate-base growth and allowed ROE drive the modest variation." },
];

function buildIb(): HTMLElement {
  const root = el("div", "learn-panel");
  root.innerHTML = `
    <div class="mk-grid">
      <section class="section">
        <h2 class="section-title">WACC / CAPM Calculator</h2>
        <div id="ib-wacc-controls"></div>
        <div class="readout" id="ib-wacc-readout"></div>
      </section>
      <section class="section">
        <h2 class="section-title">DCF Valuation</h2>
        <p class="section-desc">5-year explicit FCF projection + Gordon terminal value, discounted at the WACC above.</p>
        <div id="ib-dcf-controls"></div>
        <div class="metrics-grid metrics-grid-dcf" id="ib-dcf-kpis"></div>
        <div id="ib-dcf-warn"></div>
      </section>
    </div>

    <section class="section">
      <h2 class="section-title">EV / EBITDA — Sector Multiples</h2>
      <p class="section-desc">Click a sector to see what drives its multiple.</p>
      <div class="sector-grid" id="ib-sectors"></div>
      <div class="sector-detail" id="ib-sector-detail">
        <span class="muted-note">Select a sector above.</span>
      </div>
    </section>`;

  // WACC sliders
  const wc = root.querySelector("#ib-wacc-controls")!;
  wc.append(
    makeSlider({ label: "Risk-free R<sub>f</sub>", min: 0, max: 0.08, step: 0.0025, value: ibState.rf, format: pct, onInput: v => { ibState.rf = v; renderIbOutputs(); } }),
    makeSlider({ label: "Equity risk premium ERP", min: 0.01, max: 0.10, step: 0.0025, value: ibState.erp, format: pct, onInput: v => { ibState.erp = v; renderIbOutputs(); } }),
    makeSlider({ label: "Levered beta β", min: 0, max: 2.5, step: 0.05, value: ibState.beta, format: v => fmt(v, 2), onInput: v => { ibState.beta = v; renderIbOutputs(); } }),
    makeSlider({ label: "Debt weight D/V", min: 0, max: 0.8, step: 0.025, value: ibState.dv, format: pct, onInput: v => { ibState.dv = v; renderIbOutputs(); } }),
    makeSlider({ label: "Pre-tax cost of debt K<sub>d</sub>", min: 0.01, max: 0.15, step: 0.0025, value: ibState.kd, format: pct, onInput: v => { ibState.kd = v; renderIbOutputs(); } }),
    makeSlider({ label: "Tax rate t", min: 0, max: 0.40, step: 0.01, value: ibState.tax, format: pct, onInput: v => { ibState.tax = v; renderIbOutputs(); } }),
  );

  // DCF sliders
  const dc = root.querySelector("#ib-dcf-controls")!;
  dc.append(
    makeSlider({ label: "Year-1 FCF ($)", min: 10, max: 500, step: 5, value: ibState.fcf1, format: v => `$${fmt(v, 0)}`, onInput: v => { ibState.fcf1 = v; renderIbOutputs(); } }),
    makeSlider({ label: "FCF growth g", min: -0.05, max: 0.25, step: 0.005, value: ibState.g, format: pct, onInput: v => { ibState.g = v; renderIbOutputs(); } }),
    makeSlider({ label: "Terminal growth g<sub>t</sub>", min: 0, max: 0.05, step: 0.0025, value: ibState.gt, format: pct, onInput: v => { ibState.gt = v; renderIbOutputs(); } }),
  );

  // Sector cards
  const grid = root.querySelector("#ib-sectors")!;
  SECTORS.forEach((s, i) => {
    const card = el("button", "sector-card");
    card.innerHTML = `
      <span class="sector-bar" style="background:${s.color}"></span>
      <span class="sector-name">${s.name}</span>
      <span class="sector-range">${s.range}</span>`;
    card.addEventListener("click", () => {
      grid.querySelectorAll(".sector-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      root.querySelector("#ib-sector-detail")!.innerHTML = `
        <strong style="color:${s.color}">${s.name} · EV/EBITDA ${s.range}</strong>
        <p>${s.driver}</p>`;
    });
    if (i === 0) card.classList.add("active");
    grid.append(card);
  });
  // Seed detail with first sector.
  root.querySelector("#ib-sector-detail")!.innerHTML = `
    <strong style="color:${SECTORS[0].color}">${SECTORS[0].name} · EV/EBITDA ${SECTORS[0].range}</strong>
    <p>${SECTORS[0].driver}</p>`;

  return root;
}

// ════════════════════════════════════════════════════════════════════════════════
//  Algo Trading sub-tab
// ════════════════════════════════════════════════════════════════════════════════

const algoState = {
  rsiPeriod: 14,
  overbought: 70,
  muBps: 5,    // daily mean return, basis points
  sigmaBps: 80, // daily vol, basis points
};

// Deterministic synthetic price series (seeded LCG so it doesn't jump on recompute).
function syntheticPrices(n: number): number[] {
  let seed = 987654321;
  const rand = () => { seed = (1103515245 * seed + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const prices: number[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    // gentle trend + cyclical component + noise
    const drift = 0.0004;
    const cycle = 0.012 * Math.sin(i / 9);
    const shock = (rand() - 0.5) * 0.03;
    p = p * (1 + drift + cycle + shock);
    prices.push(p);
  }
  return prices;
}

const PRICES = syntheticPrices(120);

// Wilder's RSI.
function computeRSI(prices: number[], period: number): Array<number | null> {
  const rsi: Array<number | null> = new Array(prices.length).fill(null);
  if (prices.length <= period) return rsi;

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = prices[i] - prices[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const ch = prices[i] - prices[i - 1];
    const g = ch >= 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

let rsiChart: any = null;

function renderRsiChart(): void {
  if (!rsiChart) return;
  const rsi = computeRSI(PRICES, algoState.rsiPeriod);
  const ob = algoState.overbought;
  const os = 100 - ob;
  const labels = PRICES.map((_, i) => String(i));

  rsiChart.data.labels = labels;
  rsiChart.data.datasets = [
    {
      label: `RSI(${algoState.rsiPeriod})`, data: rsi,
      borderColor: C.purple, borderWidth: 1.6, pointRadius: 0,
      spanGaps: true, tension: 0.2,
    },
    {
      label: `Overbought ${ob}`, data: labels.map(() => ob),
      borderColor: C.red, borderWidth: 1, borderDash: [4, 4], pointRadius: 0,
    },
    {
      label: `Oversold ${os}`, data: labels.map(() => os),
      borderColor: C.green, borderWidth: 1, borderDash: [4, 4], pointRadius: 0,
    },
  ];
  rsiChart.update("none");
}

interface BtStats { annRet: number; annVol: number; sharpe: number; emdd: number; }

function computeBacktest(): BtStats {
  const muD = algoState.muBps / 10000;     // daily mean, decimal
  const sigD = algoState.sigmaBps / 10000; // daily vol, decimal
  const annRet = muD * 252;
  const annVol = sigD * Math.sqrt(252);
  const sharpe = annVol > 1e-9 ? annRet / annVol : 0;
  // Expected max drawdown of an arithmetic Brownian motion with positive drift:
  //   E[MDD] ≈ σ² / (2μ)   (annualised). Undefined / unbounded when drift ≤ 0.
  const emdd = annRet > 1e-9 ? (annVol * annVol) / (2 * annRet) : Infinity;
  return { annRet, annVol, sharpe, emdd };
}

function sharpeSign(s: number): number | undefined {
  if (s > 1) return 1;       // green
  if (s < 0) return -1;      // red
  return undefined;          // neutral
}

function renderBacktest(): void {
  const b = computeBacktest();
  document.getElementById("algo-bt-kpis")!.innerHTML = [
    kpiCard({ label: "Annualised return", value: pct(b.annRet), sign: b.annRet }),
    kpiCard({ label: "Annualised vol", value: pct(b.annVol) }),
    kpiCard({ label: "Sharpe ratio", value: fmt(b.sharpe, 2), sign: sharpeSign(b.sharpe) }),
    kpiCard({ label: "Exp. max drawdown", value: isFinite(b.emdd) ? pct(b.emdd) : "∞", sign: -1 }),
  ].join("");
}

function buildAlgo(): HTMLElement {
  const root = el("div", "learn-panel");
  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">RSI Simulator</h2>
      <p class="section-desc">RSI computed (Wilder's smoothing) over a fixed synthetic price series. Adjust the period and overbought threshold.</p>
      <div id="algo-rsi-controls" class="inline-controls"></div>
      <div class="chart-canvas-wrap chart-canvas-sm"><canvas id="algo-rsi-chart"></canvas></div>
    </section>

    <section class="section">
      <h2 class="section-title">Backtest Metric Calculator</h2>
      <p class="section-desc">From daily return assumptions to annualised performance. Sharpe is green above 1, red below 0.</p>
      <div id="algo-bt-controls" class="inline-controls"></div>
      <div class="metrics-grid metrics-grid-dcf" id="algo-bt-kpis"></div>
    </section>`;

  const rc = root.querySelector("#algo-rsi-controls")!;
  rc.append(
    makeSlider({ label: "RSI period n", min: 2, max: 40, step: 1, value: algoState.rsiPeriod, format: v => fmt(v, 0), onInput: v => { algoState.rsiPeriod = v; renderRsiChart(); } }),
    makeSlider({ label: "Overbought threshold", min: 55, max: 90, step: 1, value: algoState.overbought, format: v => fmt(v, 0), onInput: v => { algoState.overbought = v; renderRsiChart(); } }),
  );

  const bc = root.querySelector("#algo-bt-controls")!;
  bc.append(
    makeSlider({ label: "Daily μ (bps)", min: -20, max: 30, step: 1, value: algoState.muBps, format: v => `${fmt(v, 0)} bps`, onInput: v => { algoState.muBps = v; renderBacktest(); } }),
    makeSlider({ label: "Daily σ (bps)", min: 10, max: 200, step: 5, value: algoState.sigmaBps, format: v => `${fmt(v, 0)} bps`, onInput: v => { algoState.sigmaBps = v; renderBacktest(); } }),
  );

  return root;
}

// ════════════════════════════════════════════════════════════════════════════════
//  Formula Reference sub-tab
// ════════════════════════════════════════════════════════════════════════════════

const REFERENCE: Array<{ name: string; formula: string; note: string }> = [
  { name: "Jensen's Alpha", formula: "α = R̄ − R_f − β(R̄ₘ − R_f)", note: "Excess return beyond what CAPM predicts for the asset's systematic risk." },
  { name: "α-adjusted μ", formula: "μ = α + β · ERP", note: "Expected excess return rebuilt from alpha plus the systematic (beta × premium) component." },
  { name: "CAPM", formula: "E[Rᵢ] = R_f + βᵢ(E[Rₘ] − R_f)", note: "Equilibrium expected return as a linear function of market beta." },
  { name: "WACC", formula: "WACC = (E/V)K_e + (D/V)K_d(1 − t)", note: "Blended after-tax cost of capital; the discount rate for unlevered cash flows." },
  { name: "Markowitz Objective", formula: "min  wᵀΣw   s.t.  wᵀμ = μₜ,  wᵀ1 = 1", note: "Minimise portfolio variance for a target expected return, fully invested." },
  { name: "KKT First-Order Cond.", formula: "2Σw − λμ − γ1 = 0", note: "Stationarity condition of the Lagrangian; solved with the two constraints as a linear system." },
  { name: "Portfolio Variance", formula: "σ_p² = wᵀΣw = ΣᵢΣⱼ wᵢwⱼ σᵢⱼ", note: "Quadratic form in the weights; correlations drive the cross terms." },
  { name: "Sharpe Ratio", formula: "S = (E[R_p] − R_f) / σ_p", note: "Excess return per unit of total risk. Above 1 is generally considered good." },
  { name: "RSI", formula: "RSI = 100 − 100 / (1 + RS),  RS = avg gain / avg loss", note: "Momentum oscillator (0–100) using Wilder's smoothed average gains and losses." },
  { name: "DCF Terminal Value", formula: "TV = FCF_N(1 + gₜ) / (WACC − gₜ)", note: "Gordon growth perpetuity; requires WACC > gₜ. Often the bulk of enterprise value." },
  { name: "SMA Crossover", formula: "signal = 1 if SMA_fast > SMA_slow else −1", note: "Trend-following rule: go long when the fast average leads the slow average." },
  { name: "Max Drawdown", formula: "MDD = min_t (V_t − max_{s≤t} V_s) / max_{s≤t} V_s", note: "Largest peak-to-trough decline in portfolio value; a key downside-risk measure." },
];

function buildReference(): HTMLElement {
  const root = el("div", "learn-panel");
  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Formula Reference</h2>
      <div class="ref-grid">
        ${REFERENCE.map(r => `
          <div class="ref-card">
            <span class="ref-name">${r.name}</span>
            <span class="ref-formula">${r.formula}</span>
            <span class="ref-note">${r.note}</span>
          </div>`).join("")}
      </div>
    </section>`;
  return root;
}

// ── Sub-tab orchestration ────────────────────────────────────────────────────────
type SubTab = "ib" | "algo" | "ref";
const subInited: Record<SubTab, boolean> = { ib: false, algo: false, ref: false };

async function showSubTab(name: SubTab): Promise<void> {
  document.querySelectorAll<HTMLElement>(".learn-panel-host").forEach(p => {
    p.style.display = p.dataset.sub === name ? "block" : "none";
  });
  document.querySelectorAll<HTMLButtonElement>(".subtab").forEach(b => {
    b.classList.toggle("active", b.dataset.sub === name);
  });

  if (subInited[name]) return;
  subInited[name] = true;

  if (name === "ib") {
    document.querySelector('.learn-panel-host[data-sub="ib"]')!.append(buildIb());
    renderIbOutputs();
  } else if (name === "algo") {
    document.querySelector('.learn-panel-host[data-sub="algo"]')!.append(buildAlgo());
    renderBacktest();
    try {
      const Chart = await loadChartJs();
      const ctx = (document.getElementById("algo-rsi-chart") as HTMLCanvasElement).getContext("2d");
      rsiChart = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            x: { grid: { color: C.border }, ticks: { color: C.muted, maxTicksLimit: 12 }, title: { display: true, text: "Day", color: C.muted } },
            y: { min: 0, max: 100, grid: { color: C.border }, ticks: { color: C.muted, stepSize: 20 }, title: { display: true, text: "RSI", color: C.muted } },
          },
          plugins: { legend: { labels: { color: C.muted, usePointStyle: true, boxWidth: 8 } } },
        },
      });
      renderRsiChart();
    } catch (err) {
      console.error("Chart.js failed to load:", err);
      const wrap = document.querySelector('.learn-panel-host[data-sub="algo"] .chart-canvas-wrap');
      if (wrap) wrap.innerHTML = `<p class="readout-warn">Could not load Chart.js (offline?).</p>`;
    }
  } else {
    document.querySelector('.learn-panel-host[data-sub="ref"]')!.append(buildReference());
  }
}

let started = false;

export function initLearn(): void {
  if (started) return;
  started = true;

  const root = document.getElementById("page-learn")!;
  root.innerHTML = `
    <div class="subtab-bar">
      <button class="subtab active" data-sub="ib">Investment Banking</button>
      <button class="subtab" data-sub="algo">Algo Trading</button>
      <button class="subtab" data-sub="ref">Formula Reference</button>
    </div>
    <div class="learn-panel-host" data-sub="ib"></div>
    <div class="learn-panel-host" data-sub="algo" style="display:none"></div>
    <div class="learn-panel-host" data-sub="ref" style="display:none"></div>`;

  root.querySelectorAll<HTMLButtonElement>(".subtab").forEach(b => {
    b.addEventListener("click", () => { void showSubTab(b.dataset.sub as SubTab); });
  });

  void showSubTab("ib");
}
