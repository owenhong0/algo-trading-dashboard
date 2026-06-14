// src/lib/chartjs.ts — dynamic Chart.js loader
//
// The Markowitz and Learn pages load Chart.js as a UMD bundle from a CDN on
// demand (injected once). The Dashboard imports Chart.js from the npm package
// directly (see pages/dashboard.ts); this loader is kept for the other pages.

const CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

let chartPromise: Promise<any> | null = null;

export function loadChartJs(): Promise<any> {
  const existing = (window as any).Chart;
  if (existing) return Promise.resolve(existing);
  if (chartPromise) return chartPromise;

  chartPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CDN;
    script.async = true;
    script.onload = () => {
      const Chart = (window as any).Chart;
      if (Chart) resolve(Chart);
      else reject(new Error("Chart.js loaded but window.Chart is undefined"));
    };
    script.onerror = () => reject(new Error("Failed to load Chart.js from CDN"));
    document.head.appendChild(script);
  });
  return chartPromise;
}
