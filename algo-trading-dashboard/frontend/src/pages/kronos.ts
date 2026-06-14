// src/pages/kronos.ts — Page 4: Kronos foundation model explainer (static content)

interface Model {
  name: string;
  params: string;
  context: string;
  tokenizer: string;
  recommended?: boolean;
}

const MODELS: Model[] = [
  { name: "Kronos-mini",  params: "4.1M",   context: "2048", tokenizer: "Kronos-Tokenizer-2k",   recommended: true },
  { name: "Kronos-small", params: "24.7M",  context: "512",  tokenizer: "Kronos-Tokenizer-base" },
  { name: "Kronos-base",  params: "102.3M", context: "512",  tokenizer: "Kronos-Tokenizer-base" },
  { name: "Kronos-large", params: "499.2M", context: "512",  tokenizer: "Not open source yet" },
];

const CODE_STEPS: Array<{ title: string; code: string }> = [
  {
    title: "Step 1 — Install",
    code: `pip install -r requirements.txt`,
  },
  {
    title: "Step 2 — Load model",
    code: `from model import Kronos, KronosTokenizer, KronosPredictor

tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
predictor = KronosPredictor(model, tokenizer, max_context=512)`,
  },
  {
    title: "Step 3 — Prepare data",
    code: `# df must be a pandas DataFrame with columns:
#   open, high, low, close   (volume and amount are optional)
x_timestamp = ...   # historical timestamps (Series)
y_timestamp = ...   # future timestamps to predict into`,
  },
  {
    title: "Step 4 — Predict",
    code: `pred_df = predictor.predict(
    df=x_df,
    x_timestamp=x_timestamp,
    y_timestamp=y_timestamp,
    pred_len=120,
    T=1.0,        # temperature
    top_p=0.9,    # nucleus sampling
    sample_count=1,
)
# Returns a DataFrame with forecasted open/high/low/close/volume/amount`,
  },
];

// Escape text destined for innerHTML inside <pre>/<code>.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function flowDiagram(nodes: string[]): string {
  return `<div class="flow-diagram">${
    nodes.map((n, i) =>
      `<span class="flow-node">${n}</span>${i < nodes.length - 1 ? `<span class="flow-arrow">→</span>` : ""}`
    ).join("")
  }</div>`;
}

let started = false;

export function initKronos(): void {
  if (started) return;
  started = true;

  const root = document.getElementById("page-kronos")!;
  root.innerHTML = `
    <!-- SECTION 1 — What is Kronos? -->
    <section class="section">
      <h2 class="section-title">What is Kronos?</h2>
      <p class="kronos-lead">
        Kronos is the first open-source <strong>foundation model for financial candlestick
        sequences (K-lines)</strong>, pre-trained on OHLCV data from <strong>45+ global
        exchanges</strong> and accepted at <strong>AAAI 2026</strong>. Its key idea: treat
        OHLCV sequences as a "language" and train a GPT-style model on them — enabling
        zero-shot forecasting and finetuning for downstream quant tasks.
      </p>
      <div class="stat-chip-row">
        <span class="stat-chip">★ 29.7k GitHub stars</span>
        <span class="stat-chip">AAAI 2026</span>
      </div>
    </section>

    <!-- SECTION 2 — Architecture -->
    <section class="section">
      <h2 class="section-title">Architecture — Two-Stage Pipeline</h2>
      ${flowDiagram(["Raw OHLCV Data", "Kronos Tokenizer", "Discrete Tokens", "Autoregressive Transformer", "Forecast"])}
      <div class="two-col">
        <div class="explain-card">
          <span class="explain-head">① Tokenizer</span>
          <p>Quantizes continuous, multi-dimensional K-line data (open, high, low, close,
          volume) into <strong>hierarchical discrete tokens</strong> — analogous to how BPE
          tokenizes text into sub-word units.</p>
        </div>
        <div class="explain-card">
          <span class="explain-head">② Transformer</span>
          <p>A <strong>decoder-only architecture (like GPT)</strong> pre-trained
          autoregressively on the token sequences. Context length up to
          <strong>2048 tokens</strong> for Kronos-mini.</p>
        </div>
      </div>
    </section>

    <!-- SECTION 3 — Model zoo -->
    <section class="section">
      <h2 class="section-title">Model Zoo</h2>
      <div class="model-grid">
        ${MODELS.map(m => `
          <div class="model-card${m.recommended ? " model-card-rec" : ""}">
            ${m.recommended ? `<span class="model-rec-tag">Start here</span>` : ""}
            <span class="model-name">${m.name}</span>
            <div class="model-stat"><span class="model-stat-val">${m.params}</span><span class="model-stat-lbl">parameters</span></div>
            <div class="model-stat"><span class="model-stat-val">${m.context}</span><span class="model-stat-lbl">context length</span></div>
            <span class="model-tok">${m.tokenizer}</span>
          </div>`).join("")}
      </div>
    </section>

    <!-- SECTION 4 — How to use it -->
    <section class="section">
      <h2 class="section-title">How To Use It</h2>
      <div class="code-steps">
        ${CODE_STEPS.map(s => `
          <div class="code-card">
            <span class="code-step-title">${s.title}</span>
            <pre class="code-block"><code>${esc(s.code)}</code></pre>
          </div>`).join("")}
      </div>
    </section>

    <!-- SECTION 5 — How it connects -->
    <section class="section">
      <h2 class="section-title">How It Connects To This Project</h2>
      <p class="kronos-lead">
        The strategy on the <strong>Dashboard</strong> uses hand-crafted signals
        (SMA crossover + RSI). Kronos replaces that signal-generation step — instead of
        rule-based indicators, the model directly <strong>forecasts future OHLCV
        sequences</strong>, which can then feed into the <strong>Markowitz optimizer</strong>
        as the expected return vector μ.
      </p>
      ${flowDiagram(["Kronos forecast", "Expected returns μ", "Markowitz KKT solver", "Optimal weights w*"])}
    </section>

    <!-- SECTION 6 — Links -->
    <section class="section">
      <h2 class="section-title">Links</h2>
      <div class="link-row">
        <a class="link-btn" href="https://github.com/shiyu-coder/Kronos" target="_blank" rel="noopener noreferrer">View on GitHub →</a>
        <a class="link-btn" href="https://shiyu-coder.github.io/Kronos-demo/" target="_blank" rel="noopener noreferrer">Live Demo →</a>
        <a class="link-btn" href="https://arxiv.org/abs/2508.02739" target="_blank" rel="noopener noreferrer">Paper on arXiv →</a>
      </div>
    </section>`;
}
