// src/main.ts — app shell + hash-based router for the 4-page dashboard

import { initDashboard } from "./pages/dashboard";
import { initMarkowitz } from "./pages/markowitz";
import { initLearn } from "./pages/learn";
import { initKronos } from "./pages/kronos";

type PageName = "dashboard" | "markowitz" | "learn" | "kronos";
const PAGES: PageName[] = ["dashboard", "markowitz", "learn", "kronos"];

const inited: Record<PageName, boolean> = { dashboard: false, markowitz: false, learn: false, kronos: false };

function initPage(name: PageName): void {
  if (inited[name]) return;
  inited[name] = true;
  if (name === "dashboard") void initDashboard();
  else if (name === "markowitz") void initMarkowitz();
  else if (name === "learn") initLearn();
  else initKronos();
}

function showPage(name: PageName): void {
  PAGES.forEach(p => {
    const node = document.getElementById(`page-${p}`);
    if (node) node.style.display = p === name ? "block" : "none";
  });
  document.querySelectorAll<HTMLButtonElement>(".nav-link").forEach(b => {
    b.classList.toggle("active", b.dataset.page === name);
  });
  // Ticker meta in the header is dashboard-specific.
  const meta = document.querySelector<HTMLElement>(".header-meta");
  if (meta) meta.style.visibility = name === "dashboard" ? "visible" : "hidden";

  initPage(name);

  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
}

function currentPage(): PageName {
  const h = location.hash.replace("#", "") as PageName;
  return PAGES.includes(h) ? h : "dashboard";
}

document.querySelectorAll<HTMLButtonElement>(".nav-link").forEach(b => {
  b.addEventListener("click", () => showPage(b.dataset.page as PageName));
});
window.addEventListener("hashchange", () => showPage(currentPage()));

showPage(currentPage());
