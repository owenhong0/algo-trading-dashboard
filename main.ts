// src/main.ts — Algo Trading Dashboard entry point
import embed from "vega-embed";
import type { TradingData } from "./types";
import { priceSpec, rsiSpec, portfolioSpec, drawdownSpec, volumeSpec } from "./charts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function signClass(n: number): string {
  return n >= 0 ? "positive" : "negative";
}

// ── Render KPI Metrics ────────────────────────────────────────────────────────

function renderMetrics(data: TradingData): void {
  const m = data.metrics;

  const kpis: Array<{ label: string; value: string; sub?: string; sign?: number }> = [
    { label: "Total Return",   value: `${m.total_return_pct >= 0 ? "+" : ""}${fmt(m.total_return_pct)}%`,  sign: m.total_return_pct },
    { label: "Final Capital",  value: `$${fmt(m.final_capital)}`,                 sub: `from $${fmt(m.initial_capital)}` },
    { label: "Sharpe Ratio",   value: fmt(m.sharpe_ratio, 3),                      sign: m.sharpe_ratio },
    { label: "Win Rate",       value: `${fmt(m.win_rate_pct, 1)}%`,               sub: `${m.num_trades} trades` },
    { label: "Max Drawdown",   value: `${fmt(m.max_drawdown_pct)}%`,              sign: m.max_drawdown_pct },
  ];

  const container = document.getElementById("metrics")!;
  container.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <span class="kpi-label">${k.label}</span>
      <span class="kpi-value ${k.sign !== undefined ? signClass(k.sign) : ""}">${k.value}</span>
      ${k.sub ? `<span class="kpi-sub">${k.sub}</span>` : ""}
    </div>
  `).join("");
}

// ── Render Trade Log ──────────────────────────────────────────────────────────

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

// ── Render All Charts ─────────────────────────────────────────────────────────

async function renderCharts(data: TradingData): Promise<void> {
  const opts = { actions: false, renderer: "svg" as const };

  await Promise.all([
    embed("#chart-price",     priceSpec(data.timeseries, data.trades), opts),
    embed("#chart-rsi",       rsiSpec(data.timeseries), opts),
    embed("#chart-portfolio", portfolioSpec(data.portfolio_timeseries, data.metrics.initial_capital), opts),
    embed("#chart-drawdown",  drawdownSpec(data.portfolio_timeseries), opts),
    embed("#chart-volume",    volumeSpec(data.timeseries), opts),
  ]);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    const res  = await fetch("/trading_data.json");
    const data: TradingData = await res.json();

    // Update title
    document.querySelector(".ticker-label")!.textContent = data.ticker;

    renderMetrics(data);
    renderTradeLog(data);
    await renderCharts(data);

    document.getElementById("loading")?.remove();
    document.getElementById("dashboard")!.style.display = "block";
  } catch (err) {
    console.error("Failed to load trading data:", err);
    document.getElementById("loading")!.textContent =
      "Error loading data — run python backend/strategy.py first.";
  }
}

init();
