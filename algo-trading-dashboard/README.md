# Algorithmic Trading Dashboard

A full-stack algorithmic trading strategy visualizer built with Python and TypeScript.

## Strategy

**Dual Moving Average Crossover + RSI Filter**

| Signal | Condition |
|--------|-----------|
| **BUY**  | SMA(20) crosses above SMA(50) **AND** RSI < 65 |
| **SELL** | SMA(20) crosses below SMA(50) **OR** RSI > 75  |

Additional indicators: Bollinger Bands (20, 2σ), Volume MA

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Data        | `yfinance` (Yahoo Finance API)    |
| Analysis    | `pandas`, `numpy`                 |
| Static viz  | `matplotlib`                      |
| Backend     | Python 3.11+                      |
| Frontend    | TypeScript + Vega-Lite + Vite     |

## Quickstart

### 1. Install Python dependencies
```bash
pip install yfinance pandas numpy matplotlib
```

### 2. Run the strategy engine
```bash
python backend/strategy.py
```
This fetches AAPL data, runs the backtest, generates matplotlib charts, and writes
`frontend/public/trading_data.json` for the frontend.

### 3. Launch the dashboard
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Configuration

Edit the constants at the bottom of `backend/strategy.py`:

```python
TICKER  = "AAPL"   # Any yfinance-supported ticker
START   = "2022-01-01"
END     = "2024-12-31"
```

MA window sizes and RSI period can also be tuned in `add_indicators()`:

```python
def add_indicators(df, fast=20, slow=50, rsi_period=14)
```

## Output

- `frontend/public/trading_data.json` — full timeseries + trade log (consumed by Vega frontend)
- `frontend/public/AAPL_strategy.png` — price/RSI/volume chart (matplotlib)
- `frontend/public/AAPL_performance.png` — portfolio vs buy-and-hold (matplotlib)

## Project Structure

```
algo-trading-dashboard/
├── backend/
│   └── strategy.py          # Data fetch, indicators, signal gen, backtest, export
├── frontend/
│   ├── src/
│   │   ├── main.ts          # Bootstrap, DOM rendering
│   │   ├── charts.ts        # Vega-Lite specs
│   │   └── types.ts         # TypeScript interfaces
│   ├── public/
│   │   ├── style.css
│   │   └── trading_data.json  (generated)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```
