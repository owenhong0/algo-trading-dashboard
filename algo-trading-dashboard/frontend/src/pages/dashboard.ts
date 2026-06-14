// src/pages/dashboard.ts — Page 1: strategy backtest dashboard (Chart.js)

import Chart from "chart.js/auto";
import type { TradingData } from "../types";
import { fmt, signClass } from "../lib/ui";

const C = {
  muted:  "#8b949e",
  blue:   "#58a6ff",
  green:  "#3fb950",
  red:    "#f85149",
  purple: "#d2a8ff",
  grid:   "#30363d",
};

// ── KPI metrics ─────────────────────────────────────────────────────────────────
function renderMetrics(data: TradingData): void {
  const m = data.metrics;

  const kpis: Array<{ label: string; value: string; sub?: string; sign?: number }> = [
    { label: "Total Return",  value: `${m.total_return_pct >= 0 ? "+" : ""}${fmt(m.total_return_pct)}%`, sign: m.total_return_pct },
    { label: "Final Capital", value: `$${fmt(m.final_capital)}`, sub: `from $${fmt(m.initial_capital)}` },
    { label: "Sharpe Ratio",  value: fmt(m.sharpe_ratio, 3), sign: m.sharpe_ratio },
    { label: "Win Rate",      value: `${fmt(m.win_rate_pct, 1)}%`, sub: `${m.num_trades} trades` },
    { label: "Max Drawdown",  value: `${fmt(m.max_drawdown_pct)}%`, sign: m.max_drawdown_pct },
  ];

  document.getElementById("metrics")!.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <span class="kpi-label">${k.label}</span>
      <span class="kpi-value ${k.sign !== undefined ? signClass(k.sign) : ""}">${k.value}</span>
      ${k.sub ? `<span class="kpi-sub">${k.sub}</span>` : ""}
    </div>
  `).join("");
}

// ── Trade log ─────────────────────────────────────────────────────────────────
function renderTradeLog(data: TradingData): void {
  const tbody = document.getElementById("trade-log")!;
  tbody.innerHTML = data.trades.map(t => `
    <tr>
      <td>${t.date}</td>
      <td class="${t.type.startsWith("BUY") ? "buy" : "sell"}">${t.type}</td>
      <td>$${fmt(t.price)}</td>
      <td>${t.shares.toLocaleString()}</td>
      <td class="${t.pnl !== undefined ? signClass(t.pnl) : ""}">${
        t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}$${fmt(t.pnl)}` : "—"
      }</td>
    </tr>
  `).join("");
}

// ── Chart.js shared option helpers ──────────────────────────────────────────────
// Faint dark-theme grid, muted ticks, capped x labels so dates don't overlap.
function xScale(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    grid: { color: C.grid },
    border: { display: false },
    ticks: { color: C.muted, maxTicksLimit: 8, autoSkip: true, maxRotation: 0 },
    ...extra,
  };
}

function yScale(extra: any = {}): Record<string, unknown> {
  const { ticks, ...rest } = extra;
  return {
    grid: { color: C.grid },
    border: { display: false },
    ticks: { color: C.muted, ...(ticks || {}) },
    ...rest,
  };
}

// Destroy any existing chart bound to the canvas before creating a new one
// (guards against double-mount, e.g. dev HMR re-running the module).
function mount(id: string, config: any): Chart {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  return new Chart(canvas, config);
}

// ── Render all 5 charts ─────────────────────────────────────────────────────────
function renderCharts(data: TradingData): void {
  const ts = data.timeseries;
  const labels = ts.map(d => d.date);

  // Chart 1 — Price & moving averages, with buy/sell signal markers.
  const buyByDate = new Map(data.trades.filter(t => t.type === "BUY").map(t => [t.date, t.price]));
  const sellByDate = new Map(data.trades.filter(t => t.type.startsWith("SELL")).map(t => [t.date, t.price]));
  const buyData = labels.map(d => (buyByDate.has(d) ? buyByDate.get(d)! : null));
  const sellData = labels.map(d => (sellByDate.has(d) ? sellByDate.get(d)! : null));

  mount("chart-price", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Close", data: ts.map(d => d.close), borderColor: C.muted, borderWidth: 1.2, pointRadius: 0, tension: 0.1 },
        { label: "SMA 20", data: ts.map(d => d.sma_fast), borderColor: C.blue, borderWidth: 1.5, pointRadius: 0, tension: 0.1, spanGaps: true },
        { label: "SMA 50", data: ts.map(d => d.sma_slow), borderColor: C.red, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.1, spanGaps: true },
        { label: "Buy", data: buyData, showLine: false, pointStyle: "triangle", pointRadius: 8, pointBackgroundColor: C.green, pointBorderColor: C.green },
        { label: "Sell", data: sellData, showLine: false, pointStyle: "triangle", rotation: 180, pointRadius: 8, pointBackgroundColor: C.red, pointBorderColor: C.red },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => c.parsed.y != null ? `${c.dataset.label}: $${fmt(c.parsed.y)}` : "" } },
      },
      scales: { x: xScale(), y: yScale({ title: { display: true, text: "Price (USD)", color: C.muted } }) },
    },
  });

  // Chart 2 — RSI with 70/30 threshold rules (constant-value datasets).
  mount("chart-rsi", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "RSI", data: ts.map(d => d.rsi), borderColor: C.purple, borderWidth: 1.4, pointRadius: 0, tension: 0.1 },
        { label: "Overbought", data: labels.map(() => 70), borderColor: C.red, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
        { label: "Oversold", data: labels.map(() => 30), borderColor: C.green, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => c.datasetIndex === 0 ? `RSI: ${c.parsed.y.toFixed(1)}` : "" } },
      },
      scales: { x: xScale(), y: yScale({ min: 0, max: 100, ticks: { stepSize: 25 } }) },
    },
  });

  // Chart 3 — Volume, green when in a long signal else gray.
  mount("chart-volume", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Volume",
        data: ts.map(d => d.volume),
        backgroundColor: ts.map(d => (d.signal === 1 ? C.green : C.muted)),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => `Vol: ${(c.parsed.y / 1e6).toFixed(1)}M` } },
      },
      scales: { x: xScale(), y: yScale({ ticks: { callback: (v: any) => `${(Number(v) / 1e6).toFixed(0)}M` } }) },
    },
  });

  // Chart 4 — Strategy portfolio vs buy-and-hold benchmark.
  const pts = data.portfolio_timeseries;
  const pLabels = pts.map(p => p.date);
  const bhShares = data.metrics.initial_capital / pts[0].close;
  const bhValue = pts.map(p => bhShares * p.close);

  mount("chart-portfolio", {
    type: "line",
    data: {
      labels: pLabels,
      datasets: [
        { label: "Strategy", data: pts.map(p => p.value), borderColor: C.blue, borderWidth: 1.8, pointRadius: 0, tension: 0.1 },
        { label: "Buy & Hold", data: bhValue, borderColor: C.muted, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: $${fmt(c.parsed.y)}` } },
      },
      scales: { x: xScale(), y: yScale({ ticks: { callback: (v: any) => `$${(Number(v) / 1000).toFixed(0)}K` } }) },
    },
  });

  // Chart 5 — Drawdown (% from running peak), red filled area.
  let peak = -Infinity;
  const dd = pts.map(p => {
    if (p.value > peak) peak = p.value;
    return ((p.value - peak) / peak) * 100;
  });

  mount("chart-drawdown", {
    type: "line",
    data: {
      labels: pLabels,
      datasets: [{
        label: "Drawdown",
        data: dd,
        borderColor: C.red,
        borderWidth: 1.4,
        backgroundColor: "rgba(248,81,73,0.4)",
        fill: true,
        pointRadius: 0,
        tension: 0.1,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => `Drawdown: ${c.parsed.y.toFixed(2)}%` } },
      },
      scales: { x: xScale(), y: yScale({ max: 0, ticks: { callback: (v: any) => `${v}%` } }) },
    },
  });
}

// Runs once, the first time the Dashboard page is shown.
export async function initDashboard(): Promise<void> {
  try {
    // Use Vite's base URL so the fetch works both in dev ("/") and on GitHub
    // Pages ("/algo-trading-dashboard/"). A bare "/trading_data.json" would hit
    // the domain root and 404 under the project base path.
    const res = await fetch(`${import.meta.env.BASE_URL}trading_data.json`);
    const data: TradingData = await res.json();

    document.querySelector(".ticker-label")!.textContent = data.ticker;

    renderMetrics(data);
    renderTradeLog(data);

    // Reveal the dashboard before creating charts so the sized wrappers have
    // a laid-out width; Chart.js also re-fits via its own resize observer.
    document.getElementById("loading")?.remove();
    document.getElementById("dashboard")!.style.display = "block";

    renderCharts(data);
  } catch (err) {
    console.error("Failed to load trading data:", err);
    const loading = document.getElementById("loading");
    if (loading) loading.textContent =
      "Error loading data — run python backend/strategy.py first.";
  }
}
