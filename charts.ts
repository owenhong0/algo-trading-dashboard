// src/charts.ts — Vega-Lite specs for the trading dashboard

import type { TopLevelSpec } from "vega-lite";
import type { OHLCV, PortfolioPoint, Trade } from "./types";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:       "#0d1117",
  panel:    "#161b22",
  border:   "#30363d",
  muted:    "#8b949e",
  text:     "#e6edf3",
  blue:     "#58a6ff",
  green:    "#3fb950",
  red:      "#f85149",
  orange:   "#ffa657",
  purple:   "#d2a8ff",
};

// ── Price + Moving Averages ───────────────────────────────────────────────────
export function priceSpec(timeseries: OHLCV[], trades: Trade[]): TopLevelSpec {
  const buyPoints  = trades.filter(t => t.type === "BUY");
  const sellPoints = trades.filter(t => t.type.startsWith("SELL"));

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: {
      text: "Price & Moving Averages",
      color: C.text, fontSize: 13, fontWeight: "bold",
    },
    background: C.panel,
    width: "container",
    height: 280,
    layer: [
      // Bollinger band fill
      {
        data: { values: timeseries.filter(d => d.bb_upper !== null) },
        mark: { type: "area", opacity: 0.08, color: C.blue },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "bb_upper", type: "quantitative" },
          y2: { field: "bb_lower" },
        },
      },
      // Close price
      {
        data: { values: timeseries },
        mark: { type: "line", strokeWidth: 1.2, color: C.muted },
        encoding: {
          x: { field: "date", type: "temporal", axis: { labels: false, title: null, grid: false, tickColor: C.border, domainColor: C.border } },
          y: { field: "close", type: "quantitative", axis: { title: "Price (USD)", titleColor: C.muted, labelColor: C.muted, gridColor: C.border, domainColor: C.border, tickColor: C.border } },
          tooltip: [
            { field: "date",     type: "temporal",     title: "Date" },
            { field: "close",    type: "quantitative",  title: "Close",    format: ".2f" },
            { field: "sma_fast", type: "quantitative",  title: "SMA 20",   format: ".2f" },
            { field: "sma_slow", type: "quantitative",  title: "SMA 50",   format: ".2f" },
          ],
        },
      },
      // SMA Fast
      {
        data: { values: timeseries },
        mark: { type: "line", strokeWidth: 1.5, color: C.blue },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "sma_fast", type: "quantitative" },
        },
      },
      // SMA Slow
      {
        data: { values: timeseries },
        mark: { type: "line", strokeWidth: 1.5, color: C.red, strokeDash: [4, 3] },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "sma_slow", type: "quantitative" },
        },
      },
      // Buy markers
      {
        data: { values: buyPoints },
        mark: { type: "point", shape: "triangle-up", size: 120, color: C.green, filled: true },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "price", type: "quantitative" },
          tooltip: [
            { field: "date",   type: "temporal",    title: "Buy Date" },
            { field: "price",  type: "quantitative", title: "Price",  format: ".2f" },
            { field: "shares", type: "quantitative", title: "Shares" },
          ],
        },
      },
      // Sell markers
      {
        data: { values: sellPoints },
        mark: { type: "point", shape: "triangle-down", size: 120, color: C.red, filled: true },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "price", type: "quantitative" },
          tooltip: [
            { field: "date",  type: "temporal",    title: "Sell Date" },
            { field: "price", type: "quantitative", title: "Price",   format: ".2f" },
            { field: "pnl",   type: "quantitative", title: "P&L",     format: "+,.2f" },
          ],
        },
      },
    ],
    config: {
      view: { stroke: C.border },
      axis: { labelColor: C.muted, titleColor: C.muted, gridColor: C.border },
      legend: { labelColor: C.muted, titleColor: C.muted },
    },
  };
}

// ── RSI Panel ─────────────────────────────────────────────────────────────────
export function rsiSpec(timeseries: OHLCV[]): TopLevelSpec {
  const ob = timeseries.map(d => ({ ...d, ob: 70 }));
  const os = timeseries.map(d => ({ ...d, os: 30 }));

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: "RSI (14)", color: C.text, fontSize: 13, fontWeight: "bold" },
    background: C.panel,
    width: "container",
    height: 120,
    layer: [
      // Overbought fill
      {
        data: { values: timeseries.filter(d => d.rsi >= 70) },
        mark: { type: "area", color: C.red, opacity: 0.15, baseline: 70 },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "rsi", type: "quantitative" },
        },
      },
      // Oversold fill
      {
        data: { values: timeseries.filter(d => d.rsi <= 30) },
        mark: { type: "area", color: C.green, opacity: 0.15, baseline: 30 },
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "rsi", type: "quantitative" },
        },
      },
      // RSI line
      {
        data: { values: timeseries },
        mark: { type: "line", strokeWidth: 1.3, color: C.purple },
        encoding: {
          x: { field: "date", type: "temporal", axis: { title: null, labels: false, grid: false, domainColor: C.border, tickColor: C.border } },
          y: { field: "rsi", type: "quantitative", scale: { domain: [0, 100] }, axis: { title: "RSI", titleColor: C.muted, labelColor: C.muted, gridColor: C.border, values: [0, 30, 50, 70, 100], domainColor: C.border } },
          tooltip: [
            { field: "date", type: "temporal",    title: "Date" },
            { field: "rsi",  type: "quantitative", title: "RSI", format: ".1f" },
          ],
        },
      },
      // OB line
      {
        data: { values: ob.slice(0, 2) },
        mark: { type: "rule", strokeDash: [3, 3], color: C.red, opacity: 0.6, strokeWidth: 1 },
        encoding: { y: { field: "ob", type: "quantitative" } },
      },
      // OS line
      {
        data: { values: os.slice(0, 2) },
        mark: { type: "rule", strokeDash: [3, 3], color: C.green, opacity: 0.6, strokeWidth: 1 },
        encoding: { y: { field: "os", type: "quantitative" } },
      },
    ],
    config: {
      view: { stroke: C.border },
      axis: { labelColor: C.muted, gridColor: C.border },
    },
  };
}

// ── Portfolio vs Buy & Hold ───────────────────────────────────────────────────
export function portfolioSpec(
  portfolio: PortfolioPoint[],
  initialCapital: number,
): TopLevelSpec {
  const bh0     = portfolio[0].close;
  const bhShares = initialCapital / bh0;

  const combined = portfolio.map(p => [
    { date: p.date, value: p.value / 1000, series: "Strategy" },
    { date: p.date, value: (bhShares * p.close) / 1000, series: "Buy & Hold" },
  ]).flat();

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: "Portfolio Value vs Buy & Hold ($K)", color: C.text, fontSize: 13, fontWeight: "bold" },
    background: C.panel,
    width: "container",
    height: 220,
    data: { values: combined },
    mark: { type: "line", strokeWidth: 2 },
    encoding: {
      x: {
        field: "date", type: "temporal",
        axis: { labelColor: C.muted, titleColor: C.muted, gridColor: C.border, domainColor: C.border, tickColor: C.border },
      },
      y: {
        field: "value", type: "quantitative",
        axis: { title: "Value ($K)", titleColor: C.muted, labelColor: C.muted, gridColor: C.border, domainColor: C.border, tickColor: C.border },
      },
      color: {
        field: "series",
        scale: { domain: ["Strategy", "Buy & Hold"], range: [C.blue, C.muted] },
        legend: { labelColor: C.text, titleColor: C.muted, orient: "top-right" },
      },
      strokeDash: {
        field: "series",
        scale: { domain: ["Strategy", "Buy & Hold"], range: [[1, 0], [4, 3]] },
        legend: null,
      },
      tooltip: [
        { field: "date",   type: "temporal",    title: "Date" },
        { field: "value",  type: "quantitative", title: "Value ($K)", format: ",.1f" },
        { field: "series", type: "nominal",      title: "Series" },
      ],
    },
    config: { view: { stroke: C.border }, axis: { labelColor: C.muted } },
  };
}

// ── Drawdown Chart ────────────────────────────────────────────────────────────
export function drawdownSpec(portfolio: PortfolioPoint[]): TopLevelSpec {
  let peak = -Infinity;
  const dd = portfolio.map(p => {
    if (p.value > peak) peak = p.value;
    return {
      date: p.date,
      drawdown: ((p.value - peak) / peak) * 100,
    };
  });

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: "Drawdown (%)", color: C.text, fontSize: 13, fontWeight: "bold" },
    background: C.panel,
    width: "container",
    height: 130,
    data: { values: dd },
    layer: [
      {
        mark: { type: "area", color: C.red, opacity: 0.4, line: { color: C.red, strokeWidth: 1 } },
        encoding: {
          x: { field: "date", type: "temporal", axis: { title: "Date", labelColor: C.muted, titleColor: C.muted, gridColor: C.border, domainColor: C.border, tickColor: C.border } },
          y: { field: "drawdown", type: "quantitative", axis: { title: "Drawdown (%)", titleColor: C.muted, labelColor: C.muted, gridColor: C.border, domainColor: C.border }, scale: { domainMax: 0 } },
          tooltip: [
            { field: "date",     type: "temporal",    title: "Date" },
            { field: "drawdown", type: "quantitative", title: "Drawdown", format: ".2f" },
          ],
        },
      },
    ],
    config: { view: { stroke: C.border } },
  };
}

// ── Volume Bar Chart ──────────────────────────────────────────────────────────
export function volumeSpec(timeseries: OHLCV[]): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: { text: "Volume (M)", color: C.text, fontSize: 13, fontWeight: "bold" },
    background: C.panel,
    width: "container",
    height: 100,
    data: { values: timeseries.map(d => ({ ...d, vol_m: d.volume / 1e6 })) },
    mark: { type: "bar", opacity: 0.7 },
    encoding: {
      x: {
        field: "date", type: "temporal",
        axis: { title: "Date", labelColor: C.muted, titleColor: C.muted, gridColor: C.border, domainColor: C.border, tickColor: C.border },
      },
      y: {
        field: "vol_m", type: "quantitative",
        axis: { title: "Vol (M)", titleColor: C.muted, labelColor: C.muted, gridColor: C.border, domainColor: C.border },
      },
      color: {
        condition: {
          test: "datum.signal === 1",
          value: C.green,
        },
        value: C.muted,
      },
      tooltip: [
        { field: "date",   type: "temporal",    title: "Date" },
        { field: "vol_m",  type: "quantitative", title: "Volume (M)", format: ".1f" },
      ],
    },
    config: { view: { stroke: C.border } },
  };
}
