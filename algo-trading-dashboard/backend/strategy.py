"""
Algorithmic Trading Strategy Engine
------------------------------------
Dual Moving Average Crossover + RSI Filter
Author: Owen Hong
"""

import json
import math
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.gridspec import GridSpec

warnings.filterwarnings("ignore")

# ── Try real data first, fall back to synthetic ──────────────────────────────

def fetch_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Fetch OHLCV data via yfinance. Falls back to synthetic data if unavailable."""
    try:
        import yfinance as yf
        df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
        if df.empty:
            raise ValueError("Empty data returned")
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df.index.name = "date"
        print(f"[yfinance] Fetched {len(df)} rows for {ticker}")
        return df
    except Exception as e:
        print(f"[yfinance] Unavailable ({e}), using synthetic data for demo.")
        return _synthetic_ohlcv(ticker, start, end)


def _synthetic_ohlcv(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Generate realistic OHLCV with GBM + mean-reversion drift."""
    rng = np.random.default_rng(42)
    dates = pd.bdate_range(start=start, end=end)
    n = len(dates)

    # GBM parameters
    S0 = 155.0
    mu = 0.0006        # daily drift ~15% annual
    sigma = 0.013      # daily vol

    log_returns = rng.normal(mu - 0.5 * sigma**2, sigma, n)
    # Add trend cycles that reward MA crossovers
    log_returns += 0.003 * np.sin(np.linspace(0, 4 * np.pi, n))
    # Small drawdown in the middle (realistic bear phase)
    mid = n // 2
    log_returns[mid - 60 : mid + 30] -= 0.002

    closes = S0 * np.exp(np.cumsum(log_returns))
    highs  = closes * (1 + rng.uniform(0.001, 0.012, n))
    lows   = closes * (1 - rng.uniform(0.001, 0.012, n))
    opens  = np.roll(closes, 1)
    opens[0] = S0
    volume = rng.integers(15_000_000, 80_000_000, n)

    df = pd.DataFrame({"open": opens, "high": highs, "low": lows,
                       "close": closes, "volume": volume}, index=dates)
    df.index.name = "date"
    return df


# ── Technical Indicators ─────────────────────────────────────────────────────

def add_indicators(df: pd.DataFrame, fast: int = 20, slow: int = 50, rsi_period: int = 14) -> pd.DataFrame:
    df = df.copy()

    # Moving averages
    df["sma_fast"] = df["close"].rolling(fast).mean()
    df["sma_slow"] = df["close"].rolling(slow).mean()
    df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()

    # RSI
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(rsi_period).mean()
    loss = (-delta.clip(upper=0)).rolling(rsi_period).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    # Bollinger Bands
    bb_mid = df["close"].rolling(20).mean()
    bb_std = df["close"].rolling(20).std()
    df["bb_upper"] = bb_mid + 2 * bb_std
    df["bb_lower"] = bb_mid - 2 * bb_std
    df["bb_mid"] = bb_mid

    # Volume MA
    df["vol_ma"] = df["volume"].rolling(20).mean()

    return df


# ── Signal Generation ─────────────────────────────────────────────────────────

def generate_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Buy  when: fast SMA crosses above slow SMA AND RSI < 65 (not overbought)
    Sell when: fast SMA crosses below slow SMA OR RSI > 75 (overbought exit)
    """
    df = df.copy()

    cross_above = (df["sma_fast"] > df["sma_slow"]) & (df["sma_fast"].shift(1) <= df["sma_slow"].shift(1))
    cross_below = (df["sma_fast"] < df["sma_slow"]) & (df["sma_fast"].shift(1) >= df["sma_slow"].shift(1))

    df["signal"] = 0
    df.loc[cross_above & (df["rsi"] < 65), "signal"] = 1
    df.loc[cross_below | (df["rsi"] > 75),  "signal"] = -1

    # Remove duplicate consecutive signals
    df["position"] = df["signal"].replace(0, np.nan).ffill().fillna(0)
    df["trade"] = df["signal"] != 0

    return df


# ── Backtesting ───────────────────────────────────────────────────────────────

def backtest(df: pd.DataFrame, initial_capital: float = 100_000.0) -> dict:
    df = df.copy().dropna(subset=["sma_fast", "sma_slow", "rsi"])

    capital = initial_capital
    shares = 0
    position = 0
    trades = []
    portfolio_values = []
    entry_price = 0.0

    for i, (idx, row) in enumerate(df.iterrows()):
        price = row["close"]
        sig   = row["signal"]

        if sig == 1 and position == 0:       # BUY
            shares = math.floor(capital / price)
            cost   = shares * price
            capital -= cost
            position = 1
            entry_price = price
            trades.append({"date": str(idx.date()), "type": "BUY",
                           "price": round(price, 2), "shares": shares})

        elif sig == -1 and position == 1:    # SELL
            proceeds  = shares * price
            pnl       = proceeds - shares * entry_price
            capital  += proceeds
            position  = 0
            trades.append({"date": str(idx.date()), "type": "SELL",
                           "price": round(price, 2), "shares": shares,
                           "pnl": round(pnl, 2)})
            shares = 0

        total_value = capital + shares * price
        portfolio_values.append({"date": str(idx.date()),
                                  "value": round(total_value, 2),
                                  "close": round(price, 2)})

    # Close open position at end
    if position == 1:
        final_price = df["close"].iloc[-1]
        proceeds = shares * final_price
        capital += proceeds
        trades.append({"date": str(df.index[-1].date()), "type": "SELL (close)",
                       "price": round(final_price, 2), "shares": shares,
                       "pnl": round(proceeds - shares * entry_price, 2)})

    total_return  = (capital - initial_capital) / initial_capital * 100
    sell_trades   = [t for t in trades if "SELL" in t["type"]]
    winning       = [t for t in sell_trades if t.get("pnl", 0) > 0]
    win_rate      = len(winning) / len(sell_trades) * 100 if sell_trades else 0

    # Sharpe (annualised, daily returns)
    pv   = pd.Series([p["value"] for p in portfolio_values])
    rets = pv.pct_change().dropna()
    sharpe = (rets.mean() / rets.std() * math.sqrt(252)) if rets.std() > 0 else 0

    # Max drawdown
    roll_max = pv.cummax()
    drawdown = (pv - roll_max) / roll_max
    max_dd   = drawdown.min() * 100

    return {
        "initial_capital": initial_capital,
        "final_capital": round(capital, 2),
        "total_return_pct": round(total_return, 2),
        "num_trades": len(trades),
        "win_rate_pct": round(win_rate, 1),
        "sharpe_ratio": round(sharpe, 3),
        "max_drawdown_pct": round(max_dd, 2),
        "trades": trades,
        "portfolio_timeseries": portfolio_values,
    }


# ── Matplotlib Charts ─────────────────────────────────────────────────────────

def plot_strategy(df: pd.DataFrame, results: dict, ticker: str, out_dir: Path) -> list[str]:
    df_plot = df.dropna(subset=["sma_fast", "sma_slow"]).copy()
    dates   = df_plot.index

    trades_df = pd.DataFrame(results["trades"])
    buys  = trades_df[trades_df["type"] == "BUY"].copy()
    sells = trades_df[trades_df["type"].str.contains("SELL")].copy()

    # ── Figure 1: Price + Indicators ─────────────────────────────────────────
    fig = plt.figure(figsize=(14, 10), facecolor="#0d1117")
    fig.suptitle(f"{ticker} — Dual MA Crossover + RSI Strategy",
                 color="#e6edf3", fontsize=15, fontweight="bold", y=0.97)

    gs = GridSpec(3, 1, figure=fig, hspace=0.08,
                  height_ratios=[3, 1, 1])
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1], sharex=ax1)
    ax3 = fig.add_subplot(gs[2], sharex=ax1)

    for ax in [ax1, ax2, ax3]:
        ax.set_facecolor("#161b22")
        ax.tick_params(colors="#8b949e", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#30363d")
        ax.grid(axis="y", color="#21262d", linewidth=0.6, linestyle="--")

    # Price + MAs + Bollinger
    ax1.fill_between(dates, df_plot["bb_lower"], df_plot["bb_upper"],
                     alpha=0.07, color="#58a6ff", label="Bollinger Bands")
    ax1.plot(dates, df_plot["close"],    color="#8b949e", lw=0.9, label="Close")
    ax1.plot(dates, df_plot["sma_fast"], color="#58a6ff", lw=1.3, label="SMA 20")
    ax1.plot(dates, df_plot["sma_slow"], color="#f78166", lw=1.3, label="SMA 50")

    # Trade markers
    for _, row in buys.iterrows():
        d = pd.to_datetime(row["date"])
        if d in df_plot.index:
            ax1.scatter(d, df_plot.loc[d, "close"] * 0.985,
                        marker="^", color="#3fb950", s=80, zorder=5)
    for _, row in sells.iterrows():
        d = pd.to_datetime(row["date"])
        if d in df_plot.index:
            ax1.scatter(d, df_plot.loc[d, "close"] * 1.015,
                        marker="v", color="#f85149", s=80, zorder=5)

    ax1.set_ylabel("Price (USD)", color="#8b949e", fontsize=9)
    ax1.legend(loc="upper left", fontsize=8, framealpha=0.3,
               labelcolor="#e6edf3", facecolor="#21262d")
    plt.setp(ax1.get_xticklabels(), visible=False)

    # RSI
    ax2.plot(dates, df_plot["rsi"], color="#d2a8ff", lw=1.1)
    ax2.axhline(70, color="#f85149", lw=0.8, linestyle="--", alpha=0.7)
    ax2.axhline(30, color="#3fb950", lw=0.8, linestyle="--", alpha=0.7)
    ax2.fill_between(dates, df_plot["rsi"], 70,
                     where=df_plot["rsi"] >= 70, alpha=0.2, color="#f85149")
    ax2.fill_between(dates, df_plot["rsi"], 30,
                     where=df_plot["rsi"] <= 30, alpha=0.2, color="#3fb950")
    ax2.set_ylim(0, 100)
    ax2.set_ylabel("RSI", color="#8b949e", fontsize=9)
    ax2.text(dates[-1], 72, "OB", color="#f85149", fontsize=7, ha="right")
    ax2.text(dates[-1], 28, "OS", color="#3fb950", fontsize=7, ha="right")
    plt.setp(ax2.get_xticklabels(), visible=False)

    # Volume
    colors = ["#3fb950" if c >= o else "#f85149"
              for c, o in zip(df_plot["close"], df_plot["open"])]
    ax3.bar(dates, df_plot["volume"] / 1e6, color=colors, alpha=0.7, width=0.8)
    ax3.plot(dates, df_plot["vol_ma"] / 1e6, color="#ffa657", lw=1.0, label="Vol MA")
    ax3.set_ylabel("Vol (M)", color="#8b949e", fontsize=9)
    ax3.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax3.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.setp(ax3.get_xticklabels(), rotation=30, ha="right", color="#8b949e")

    path1 = out_dir / f"{ticker}_strategy.png"
    fig.savefig(path1, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    # ── Figure 2: Portfolio Performance ──────────────────────────────────────
    pv_df = pd.DataFrame(results["portfolio_timeseries"])
    pv_df["date"] = pd.to_datetime(pv_df["date"])
    pv_df = pv_df.set_index("date")

    # Buy-and-hold benchmark
    bh_start   = pv_df["close"].iloc[0]
    bh_shares  = results["initial_capital"] / bh_start
    pv_df["bh_value"] = bh_shares * pv_df["close"]

    fig2, axes = plt.subplots(1, 2, figsize=(14, 5), facecolor="#0d1117")
    fig2.suptitle(f"{ticker} — Portfolio Performance vs Buy & Hold",
                  color="#e6edf3", fontsize=13, fontweight="bold")

    for ax in axes:
        ax.set_facecolor("#161b22")
        ax.tick_params(colors="#8b949e", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#30363d")
        ax.grid(color="#21262d", linewidth=0.5, linestyle="--")

    # Equity curves
    axes[0].fill_between(pv_df.index, pv_df["value"] / 1e3,
                         pv_df["bh_value"] / 1e3,
                         where=pv_df["value"] >= pv_df["bh_value"],
                         alpha=0.15, color="#3fb950")
    axes[0].fill_between(pv_df.index, pv_df["value"] / 1e3,
                         pv_df["bh_value"] / 1e3,
                         where=pv_df["value"] < pv_df["bh_value"],
                         alpha=0.15, color="#f85149")
    axes[0].plot(pv_df.index, pv_df["value"] / 1e3,
                 color="#58a6ff", lw=1.8, label="Strategy")
    axes[0].plot(pv_df.index, pv_df["bh_value"] / 1e3,
                 color="#8b949e", lw=1.2, linestyle="--", label="Buy & Hold")
    axes[0].set_ylabel("Portfolio Value ($K)", color="#8b949e", fontsize=9)
    axes[0].legend(fontsize=9, framealpha=0.3,
                   labelcolor="#e6edf3", facecolor="#21262d")
    axes[0].xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    axes[0].xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    plt.setp(axes[0].get_xticklabels(), rotation=30, ha="right")

    # Drawdown
    pv_roll_max = pv_df["value"].cummax()
    drawdown    = (pv_df["value"] - pv_roll_max) / pv_roll_max * 100
    axes[1].fill_between(pv_df.index, drawdown, 0,
                         color="#f85149", alpha=0.5, label="Drawdown")
    axes[1].set_ylabel("Drawdown (%)", color="#8b949e", fontsize=9)
    axes[1].set_ylim(drawdown.min() * 1.2, 2)
    axes[1].xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    axes[1].xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    plt.setp(axes[1].get_xticklabels(), rotation=30, ha="right")
    axes[1].legend(fontsize=9, framealpha=0.3,
                   labelcolor="#e6edf3", facecolor="#21262d")

    path2 = out_dir / f"{ticker}_performance.png"
    fig2.savefig(path2, dpi=150, bbox_inches="tight", facecolor=fig2.get_facecolor())
    plt.close(fig2)

    print(f"[charts] Saved → {path1.name}, {path2.name}")
    return [str(path1), str(path2)]


# ── JSON Export (for Vega frontend) ──────────────────────────────────────────

def export_vega_data(df: pd.DataFrame, results: dict, ticker: str, out_dir: Path) -> str:
    df_export = df.dropna(subset=["sma_fast", "sma_slow", "rsi"]).copy()
    df_export.index = df_export.index.astype(str)

    timeseries = []
    for date_str, row in df_export.iterrows():
        timeseries.append({
            "date":     date_str,
            "close":    round(row["close"], 2),
            "sma_fast": round(row["sma_fast"], 2),
            "sma_slow": round(row["sma_slow"], 2),
            "rsi":      round(row["rsi"], 2),
            "bb_upper": round(row["bb_upper"], 2) if not math.isnan(row["bb_upper"]) else None,
            "bb_lower": round(row["bb_lower"], 2) if not math.isnan(row["bb_lower"]) else None,
            "volume":   int(row["volume"]),
            "signal":   int(row["signal"]) if "signal" in row else 0,
        })

    payload = {
        "ticker":  ticker,
        "metrics": {
            "total_return_pct":   results["total_return_pct"],
            "win_rate_pct":       results["win_rate_pct"],
            "sharpe_ratio":       results["sharpe_ratio"],
            "max_drawdown_pct":   results["max_drawdown_pct"],
            "num_trades":         results["num_trades"],
            "initial_capital":    results["initial_capital"],
            "final_capital":      results["final_capital"],
        },
        "timeseries":          timeseries,
        "trades":              results["trades"],
        "portfolio_timeseries": results["portfolio_timeseries"],
    }

    out_path = out_dir / "trading_data.json"
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[export] Saved → {out_path.name}  ({len(timeseries)} rows)")
    return str(out_path)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    TICKER  = "AAPL"
    START   = "2022-01-01"
    END     = "2024-12-31"
    OUT_DIR = Path(__file__).parent.parent / "frontend" / "public"
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*50}")
    print(f" Algo Trading Strategy — {TICKER}  {START} → {END}")
    print(f"{'='*50}\n")

    df = fetch_data(TICKER, START, END)
    df = add_indicators(df)
    df = generate_signals(df)

    results = backtest(df)

    print("\n── Backtest Results ─────────────────────────────")
    print(f"  Return:        {results['total_return_pct']:>8.2f}%")
    print(f"  Win Rate:      {results['win_rate_pct']:>8.1f}%")
    print(f"  Sharpe Ratio:  {results['sharpe_ratio']:>8.3f}")
    print(f"  Max Drawdown:  {results['max_drawdown_pct']:>8.2f}%")
    print(f"  # Trades:      {results['num_trades']:>8}")
    print(f"  Final Capital: ${results['final_capital']:>10,.2f}")
    print("─────────────────────────────────────────────────\n")

    plot_strategy(df, results, TICKER, OUT_DIR)
    export_vega_data(df, results, TICKER, OUT_DIR)

    print("\n✓ All outputs written to frontend/public/")
    print("  Run `cd frontend && npm install && npm run dev` to start the dashboard.\n")
