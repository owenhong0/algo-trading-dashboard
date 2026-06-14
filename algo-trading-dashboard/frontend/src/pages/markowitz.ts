// src/pages/markowitz.ts — Page 2: Jensen's alpha → Markowitz/KKT optimizer
//
// Pipeline, recomputed live on every slider move:
//   Rm   = Rf + ERP
//   αᵢ   = R̄ᵢ − Rf − βᵢ·(Rm − Rf)          (Jensen's alpha)
//   μᵢ   = αᵢ + βᵢ·ERP                       (alpha-adjusted expected EXCESS return)
//   Σ_ij = ρ_ij·σᵢ·σⱼ
//   frontier: sweep μ_target, solve the 5×5 KKT system at each step.

import {
  covariance, efficientFrontier, minVariancePortfolio, tangencyPortfolio,
  solveKKT, type Matrix, type PortfolioStats,
} from "../lib/linalg";
import { loadChartJs } from "../lib/chartjs";
import { el, makeSlider, fmt, pct, signClass, kpiCard } from "../lib/ui";

const C = {
  blue: "#58a6ff", green: "#3fb950", red: "#f85149",
  orange: "#ffa657", purple: "#d2a8ff", muted: "#8b949e", border: "#30363d",
};

const ASSET_COLORS = [C.blue, C.orange, C.purple];

interface Asset { name: string; beta: number; rbar: number; sigma: number; }

const state = {
  rf: 0.04,
  erp: 0.055,
  assets: [
    { name: "Asset A", beta: 0.80, rbar: 0.090, sigma: 0.180 },
    { name: "Asset B", beta: 1.10, rbar: 0.120, sigma: 0.240 },
    { name: "Asset C", beta: 1.50, rbar: 0.165, sigma: 0.320 },
  ] as Asset[],
  // pairwise correlations
  corr: { ab: 0.30, ac: 0.20, bc: 0.50 },
};

let chart: any = null; // Chart.js instance

// ── Derived quantities ─────────────────────────────────────────────────────────
interface Derived {
  alpha: number[];
  mu: number[];
  sigma: number[];
  Sigma: Matrix;
}

function derive(): Derived {
  const { rf, erp, assets, corr } = state;
  const rmExcess = erp; // Rm − Rf ≡ ERP given only Rf and ERP as market params

  const alpha = assets.map(a => a.rbar - rf - a.beta * rmExcess);
  const mu = alpha.map((al, i) => al + assets[i].beta * erp);
  const sigma = assets.map(a => a.sigma);

  const cmat: Matrix = [
    [1, corr.ab, corr.ac],
    [corr.ab, 1, corr.bc],
    [corr.ac, corr.bc, 1],
  ];
  const Sigma = covariance(sigma, cmat);
  return { alpha, mu, sigma, Sigma };
}

// ── Asset parameter table ────────────────────────────────────────────────────────
function renderAssetTable(d: Derived): void {
  const rows = state.assets.map((a, i) => {
    const al = d.alpha[i];
    return `
      <tr>
        <td><span class="asset-dot" style="background:${ASSET_COLORS[i]}"></span>${a.name}</td>
        <td>${fmt(a.beta, 2)}</td>
        <td>${pct(a.rbar)}</td>
        <td><span class="chip ${al >= 0 ? "chip-green" : "chip-red"}">${al >= 0 ? "+" : ""}${pct(al)}</span></td>
        <td>${pct(d.mu[i])}</td>
        <td>${pct(a.sigma)}</td>
      </tr>`;
  }).join("");

  document.getElementById("mk-asset-table")!.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Asset</th><th>β</th><th>R̄</th><th>Jensen's α</th><th>μ (α-adj.)</th><th>σ</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Weight bar chart (horizontal, signed) ────────────────────────────────────────
function weightBars(w: number[]): string {
  const maxAbs = Math.max(0.01, ...w.map(Math.abs));
  return state.assets.map((a, i) => {
    const pctWidth = (Math.abs(w[i]) / maxAbs) * 100;
    const neg = w[i] < 0;
    return `
      <div class="wbar-row">
        <span class="wbar-name">${a.name}</span>
        <div class="wbar-track">
          <div class="wbar-fill ${neg ? "wbar-neg" : ""}"
               style="width:${pctWidth}%;background:${neg ? C.red : ASSET_COLORS[i]}"></div>
        </div>
        <span class="wbar-val ${signClass(w[i])}">${pct(w[i], 1)}</span>
      </div>`;
  }).join("");
}

// ── Optimal-portfolio cards (KPIs + weight bars) ─────────────────────────────────
function portfolioCard(title: string, tag: string, p: PortfolioStats): string {
  return `
    <div class="opt-card">
      <div class="opt-head">
        <span class="opt-title">${title}</span>
        <span class="opt-tag">${tag}</span>
      </div>
      <div class="opt-kpis">
        ${kpiCard({ label: "E[R] (μ)", value: pct(p.ret), sign: p.ret })}
        ${kpiCard({ label: "σ", value: pct(p.sigma) })}
        ${kpiCard({ label: "Sharpe", value: fmt(p.sharpe, 3), sign: p.sharpe })}
      </div>
      <div class="wbars">${weightBars(p.w)}</div>
    </div>`;
}

// ── KKT readout block ────────────────────────────────────────────────────────────
function renderKKT(d: Derived, tangencyRet: number): void {
  const sol = solveKKT(d.Sigma, d.mu, tangencyRet);
  const box = document.getElementById("mk-kkt")!;
  if (!sol) { box.innerHTML = `<p class="readout-warn">Singular system — adjust correlations.</p>`; return; }

  const wStr = sol.w.map((x, i) => `w${i + 1} = ${fmt(x, 4)}`).join("   ");
  const retOk = Math.abs(sol.checkRet - tangencyRet) < 1e-6;
  const sumOk = Math.abs(sol.checkSum - 1) < 1e-6;

  box.innerHTML = `
    <div class="readout-line"><span class="readout-key">target μₜ</span><span>${fmt(tangencyRet, 6)}</span></div>
    <div class="readout-line"><span class="readout-key">w</span><span>${wStr}</span></div>
    <div class="readout-line"><span class="readout-key">λ (return mult.)</span><span>${fmt(sol.lambda, 6)}</span></div>
    <div class="readout-line"><span class="readout-key">γ (budget mult.)</span><span>${fmt(sol.gamma, 6)}</span></div>
    <div class="readout-sep"></div>
    <div class="readout-line"><span class="readout-key">check &nbsp;wᵀμ = μₜ</span>
      <span class="${retOk ? "positive" : "negative"}">${fmt(sol.checkRet, 6)} ${retOk ? "✓" : "✗"}</span></div>
    <div class="readout-line"><span class="readout-key">check &nbsp;wᵀ1 = 1</span>
      <span class="${sumOk ? "positive" : "negative"}">${fmt(sol.checkSum, 6)} ${sumOk ? "✓" : "✗"}</span></div>`;
}

// ── Efficient frontier chart (Chart.js scatter) ──────────────────────────────────
function renderFrontier(
  d: Derived, minVar: PortfolioStats, tangency: PortfolioStats,
): void {
  if (!chart) return;
  const front = efficientFrontier(d.Sigma, d.mu, 80);

  const assetPts = d.mu.map((m, i) => ({ x: d.sigma[i] * 100, y: m * 100 }));

  // Capital market line: from (0,0) in excess space through the tangency point.
  const cmlSlope = tangency.sigma > 1e-9 ? tangency.ret / tangency.sigma : 0;
  const cmlMaxX = Math.max(...d.sigma, tangency.sigma) * 1.15 * 100;
  const cml = [{ x: 0, y: 0 }, { x: cmlMaxX, y: (cmlSlope * cmlMaxX) / 100 * 100 }];

  chart.data.datasets = [
    {
      label: "Efficient frontier",
      data: front.map(p => ({ x: p.sigma * 100, y: p.mu * 100 })),
      showLine: true, borderColor: C.blue, borderWidth: 2,
      pointRadius: 0, tension: 0.15, order: 3,
    },
    {
      label: "Capital market line",
      data: cml,
      showLine: true, borderColor: C.green, borderWidth: 1,
      borderDash: [5, 4], pointRadius: 0, order: 4,
    },
    {
      label: "Assets", data: assetPts,
      backgroundColor: ASSET_COLORS, pointRadius: 5, pointStyle: "rect", order: 1,
    },
    {
      label: "Min-variance",
      data: [{ x: minVar.sigma * 100, y: minVar.ret * 100 }],
      backgroundColor: C.orange, pointRadius: 7, pointStyle: "triangle", order: 0,
    },
    {
      label: "Max-Sharpe (tangency)",
      data: [{ x: tangency.sigma * 100, y: tangency.ret * 100 }],
      backgroundColor: C.green, pointRadius: 8, pointStyle: "star", order: 0,
    },
  ];
  chart.update("none");
}

// ── Recompute everything ─────────────────────────────────────────────────────────
function recompute(): void {
  const d = derive();
  renderAssetTable(d);

  const minVar = minVariancePortfolio(d.Sigma, d.mu);
  const tangency = tangencyPortfolio(d.Sigma, d.mu);

  const cards = document.getElementById("mk-opt-cards")!;
  if (minVar && tangency) {
    cards.innerHTML =
      portfolioCard("Min-Variance Portfolio", "lowest σ", minVar) +
      portfolioCard("Max-Sharpe Portfolio", "tangency", tangency);
    renderKKT(d, tangency.ret);
    renderFrontier(d, minVar, tangency);
  } else {
    cards.innerHTML = `<p class="readout-warn">Covariance matrix is singular — adjust the correlation sliders.</p>`;
  }
}

// ── Build the page DOM ───────────────────────────────────────────────────────────
function buildControls(): HTMLElement {
  const wrap = el("div", "mk-controls");

  // Market parameters
  const market = el("div", "control-group");
  market.append(el("h3", "control-group-title", "Market Parameters"));
  market.append(makeSlider({
    label: "Risk-free rate R<sub>f</sub>", min: 0, max: 0.08, step: 0.0025, value: state.rf,
    format: pct, onInput: v => { state.rf = v; recompute(); },
  }));
  market.append(makeSlider({
    label: "Equity risk premium (ERP)", min: 0.01, max: 0.10, step: 0.0025, value: state.erp,
    format: pct, onInput: v => { state.erp = v; recompute(); },
  }));
  wrap.append(market);

  // Per-asset parameters
  state.assets.forEach((a, i) => {
    const g = el("div", "control-group");
    g.append(el("h3", "control-group-title",
      `<span class="asset-dot" style="background:${ASSET_COLORS[i]}"></span>${a.name}`));
    g.append(makeSlider({
      label: "Beta β", min: 0, max: 2.5, step: 0.05, value: a.beta,
      format: v => fmt(v, 2), onInput: v => { a.beta = v; recompute(); },
    }));
    g.append(makeSlider({
      label: "Historical return R̄", min: -0.05, max: 0.30, step: 0.005, value: a.rbar,
      format: pct, onInput: v => { a.rbar = v; recompute(); },
    }));
    g.append(makeSlider({
      label: "Annual vol σ", min: 0.05, max: 0.50, step: 0.01, value: a.sigma,
      format: pct, onInput: v => { a.sigma = v; recompute(); },
    }));
    wrap.append(g);
  });

  // Correlations
  const corr = el("div", "control-group");
  corr.append(el("h3", "control-group-title", "Correlations"));
  const pairs: Array<[keyof typeof state.corr, string]> = [
    ["ab", "ρ(A, B)"], ["ac", "ρ(A, C)"], ["bc", "ρ(B, C)"],
  ];
  pairs.forEach(([key, label]) => {
    corr.append(makeSlider({
      label, min: -0.95, max: 0.95, step: 0.05, value: state.corr[key],
      format: v => fmt(v, 2), onInput: v => { state.corr[key] = v; recompute(); },
    }));
  });
  wrap.append(corr);

  return wrap;
}

const FORMULAS: Array<[string, string]> = [
  ["Jensen's α", "αᵢ = R̄ᵢ − R_f − βᵢ(R̄ₘ − R_f)"],
  ["α-adjusted μ", "μᵢ = αᵢ + βᵢ · ERP"],
  ["Markowitz", "min  wᵀΣw   s.t.  wᵀμ = μₜ,  wᵀ1 = 1"],
  ["KKT FOC", "2Σw − λμ − γ1 = 0"],
];

function buildPage(root: HTMLElement): void {
  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Markowitz Optimizer — Jensen's α → Mean-Variance Frontier</h2>
      <p class="section-desc">
        Adjust the market, per-asset and correlation parameters below. Jensen's alpha feeds
        the alpha-adjusted expected returns μ, which drive a mean-variance frontier solved at
        each target return via the 5×5 KKT system (Gaussian elimination). Returns are expressed
        as excess of R<sub>f</sub>.
      </p>
    </section>

    <div class="mk-grid">
      <section class="section" id="mk-controls-host"></section>
      <section class="section chart-section">
        <h2 class="section-title">Efficient Frontier</h2>
        <div class="chart-canvas-wrap"><canvas id="mk-frontier"></canvas></div>
      </section>
    </div>

    <section class="section">
      <h2 class="section-title">Assets</h2>
      <div class="table-wrapper" id="mk-asset-table"></div>
    </section>

    <section class="section">
      <h2 class="section-title">Optimal Portfolios</h2>
      <div class="opt-grid" id="mk-opt-cards"></div>
    </section>

    <section class="section">
      <h2 class="section-title">KKT Solution — Max-Sharpe (Tangency) Portfolio</h2>
      <div class="readout" id="mk-kkt"></div>
    </section>

    <section class="section">
      <h2 class="section-title">Key Equations</h2>
      <div class="formula-strip">
        ${FORMULAS.map(([n, f]) => `
          <div class="formula-chip">
            <span class="formula-name">${n}</span>
            <span class="formula-body">${f}</span>
          </div>`).join("")}
      </div>
    </section>`;

  document.getElementById("mk-controls-host")!.append(buildControls());
}

let started = false;

export async function initMarkowitz(): Promise<void> {
  if (started) return;
  started = true;

  const root = document.getElementById("page-markowitz")!;
  buildPage(root);

  try {
    const Chart = await loadChartJs();
    const ctx = (document.getElementById("mk-frontier") as HTMLCanvasElement).getContext("2d");
    chart = new Chart(ctx, {
      type: "scatter",
      data: { datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: {
            title: { display: true, text: "Risk  σ  (% , annualised)", color: C.muted },
            grid: { color: C.border }, ticks: { color: C.muted }, min: 0,
          },
          y: {
            title: { display: true, text: "Excess return  μ  (%)", color: C.muted },
            grid: { color: C.border }, ticks: { color: C.muted },
          },
        },
        plugins: {
          legend: { labels: { color: C.muted, usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              label: (c: any) => `${c.dataset.label}: σ=${c.parsed.x.toFixed(2)}%, μ=${c.parsed.y.toFixed(2)}%`,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Chart.js failed to load:", err);
    const wrap = document.querySelector("#page-markowitz .chart-canvas-wrap");
    if (wrap) wrap.innerHTML = `<p class="readout-warn">Could not load Chart.js (offline?). Tables still update live.</p>`;
  }

  recompute();
}
