// src/types.ts — Trading data type definitions

export interface OHLCV {
  date: string;
  close: number;
  sma_fast: number;
  sma_slow: number;
  rsi: number;
  bb_upper: number | null;
  bb_lower: number | null;
  volume: number;
  signal: number; // -1 = sell, 0 = hold, 1 = buy
}

export interface Trade {
  date: string;
  type: "BUY" | "SELL" | "SELL (close)";
  price: number;
  shares: number;
  pnl?: number;
}

export interface PortfolioPoint {
  date: string;
  value: number;
  close: number;
}

export interface StrategyMetrics {
  total_return_pct: number;
  win_rate_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  num_trades: number;
  initial_capital: number;
  final_capital: number;
}

export interface TradingData {
  ticker: string;
  metrics: StrategyMetrics;
  timeseries: OHLCV[];
  trades: Trade[];
  portfolio_timeseries: PortfolioPoint[];
}
