// src/lib/linalg.ts — linear algebra + Markowitz/KKT solver
//
// Everything here works in "excess-return" space: the μ vector passed in is the
// alpha-adjusted expected EXCESS return (μᵢ = R̄ᵢ − Rf, see markowitz.ts), so the
// portfolio Sharpe ratio is simply μ_p / σ_p (no further Rf subtraction).

export type Matrix = number[][];
export type Vec = number[];

// ── Gaussian elimination with partial pivoting ─────────────────────────────────
// Solve A·x = b. Returns x, or null if the system is singular.
export function solveLinear(Ain: Matrix, bin: Vec): Vec | null {
  const n = bin.length;
  // Work on an augmented copy so callers' matrices are untouched.
  const A: Matrix = Ain.map((row, i) => [...row, bin[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the row with the largest |value| in this column.
    let pivot = col;
    let maxAbs = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r][col]);
      if (v > maxAbs) { maxAbs = v; pivot = r; }
    }
    if (maxAbs < 1e-12) return null; // singular / ill-conditioned

    if (pivot !== col) { const tmp = A[col]; A[col] = A[pivot]; A[pivot] = tmp; }

    // Eliminate entries below the pivot.
    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / A[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) A[r][c] -= factor * A[col][c];
    }
  }

  // Back-substitution.
  const x: Vec = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

// ── Small vector/matrix helpers ────────────────────────────────────────────────
export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// wᵀ Σ w
export function quadForm(Sigma: Matrix, w: Vec): number {
  const n = w.length;
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) s += w[i] * Sigma[i][j] * w[j];
  return s;
}

// Build the covariance matrix Σ from per-asset vols σ and a correlation matrix:
//   Σ_ij = ρ_ij · σ_i · σ_j   (Σ_ii = σ_i²)
export function covariance(sigma: Vec, corr: Matrix): Matrix {
  const n = sigma.length;
  const S: Matrix = [];
  for (let i = 0; i < n; i++) {
    const row: Vec = [];
    for (let j = 0; j < n; j++) row.push(corr[i][j] * sigma[i] * sigma[j]);
    S.push(row);
  }
  return S;
}

// ── Portfolio statistics ───────────────────────────────────────────────────────
export interface PortfolioStats {
  w: Vec;
  ret: number;     // wᵀμ  (expected excess return)
  variance: number;
  sigma: number;
  sharpe: number;  // ret / sigma  (μ is already excess of Rf)
}

export function portfolioStats(Sigma: Matrix, mu: Vec, w: Vec): PortfolioStats {
  const variance = quadForm(Sigma, w);
  const sigma = Math.sqrt(Math.max(variance, 0));
  const ret = dot(w, mu);
  return { w, ret, variance, sigma, sharpe: sigma > 1e-9 ? ret / sigma : 0 };
}

// ── KKT system for the constrained minimum-variance problem ────────────────────
//
//   minimize   wᵀ Σ w
//   subject to wᵀ μ = μ_target   and   wᵀ 1 = 1
//
// Lagrangian FOC gives the (n+2)×(n+2) block system:
//
//   ┌ 2Σ   −μ  −1 ┐ ┌ w ┐   ┌ 0        ┐
//   │ μᵀ    0   0 │ │ λ │ = │ μ_target │
//   └ 1ᵀ    0   0 ┘ └ γ ┘   └ 1        ┘
//
// Solved here with the same Gaussian elimination routine.
export interface KKTResult {
  w: Vec;
  lambda: number;
  gamma: number;
  variance: number;
  sigma: number;
  ret: number;       // wᵀμ
  checkRet: number;  // wᵀμ  — should equal μ_target
  checkSum: number;  // wᵀ1  — should equal 1
}

export function solveKKT(Sigma: Matrix, mu: Vec, muTarget: number): KKTResult | null {
  const n = mu.length;
  const m = n + 2;
  const A: Matrix = Array.from({ length: m }, () => new Array(m).fill(0));
  const b: Vec = new Array(m).fill(0);

  // Top-left block: 2Σ
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) A[i][j] = 2 * Sigma[i][j];

  // −μ column and −1 column
  for (let i = 0; i < n; i++) {
    A[i][n] = -mu[i];
    A[i][n + 1] = -1;
  }
  // μᵀ row and 1ᵀ row
  for (let j = 0; j < n; j++) {
    A[n][j] = mu[j];
    A[n + 1][j] = 1;
  }
  // Right-hand side
  b[n] = muTarget;
  b[n + 1] = 1;

  const sol = solveLinear(A, b);
  if (!sol) return null;

  const w = sol.slice(0, n);
  const lambda = sol[n];
  const gamma = sol[n + 1];

  const variance = quadForm(Sigma, w);
  const ret = dot(w, mu);

  return {
    w, lambda, gamma,
    variance,
    sigma: Math.sqrt(Math.max(variance, 0)),
    ret,
    checkRet: ret,
    checkSum: w.reduce((a, x) => a + x, 0),
  };
}

// ── Efficient frontier ─────────────────────────────────────────────────────────
export interface FrontierPoint { mu: number; sigma: number; w: Vec; sharpe: number; }

// Sweep μ_target across [min μ, max μ], solving the KKT system at each step.
export function efficientFrontier(
  Sigma: Matrix, mu: Vec, steps = 60,
): FrontierPoint[] {
  const lo = Math.min(...mu);
  const hi = Math.max(...mu);
  const pts: FrontierPoint[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = lo + (hi - lo) * (k / steps);
    const r = solveKKT(Sigma, mu, t);
    if (!r) continue;
    pts.push({
      mu: r.ret,
      sigma: r.sigma,
      w: r.w,
      sharpe: r.sigma > 1e-9 ? r.ret / r.sigma : 0,
    });
  }
  return pts;
}

// Global minimum-variance portfolio:  w = Σ⁻¹1 / (1ᵀ Σ⁻¹1)
export function minVariancePortfolio(Sigma: Matrix, mu: Vec): PortfolioStats | null {
  const n = mu.length;
  const ones = new Array(n).fill(1);
  const z = solveLinear(Sigma, ones); // Σ⁻¹1
  if (!z) return null;
  const denom = z.reduce((a, b) => a + b, 0); // 1ᵀΣ⁻¹1
  if (Math.abs(denom) < 1e-12) return null;
  return portfolioStats(Sigma, mu, z.map(x => x / denom));
}

// Tangency (max-Sharpe) portfolio. In excess-return space (Rf already netted out
// of μ) this is  w ∝ Σ⁻¹μ, normalised so the weights sum to 1.
export function tangencyPortfolio(Sigma: Matrix, mu: Vec): PortfolioStats | null {
  const z = solveLinear(Sigma, mu); // Σ⁻¹μ
  if (!z) return null;
  const denom = z.reduce((a, b) => a + b, 0);
  if (Math.abs(denom) < 1e-12) return null;
  return portfolioStats(Sigma, mu, z.map(x => x / denom));
}
