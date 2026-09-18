// SPDX-License-Identifier: MIT
import type { PaperReport } from "@ieee-check/core";
import { CHECK_LABELS, CHECK_ORDER, DEFAULT_CONFIG, renderCsv, validate } from "@ieee-check/core";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing #${id}`);
  return el as T;
}

const dropzone = byId<HTMLButtonElement>("dropzone");
const fileInput = byId<HTMLInputElement>("file-input");
const results = byId<HTMLDivElement>("results");
const actions = byId<HTMLDivElement>("actions");
const summary = byId<HTMLSpanElement>("summary");
const csvBtn = byId<HTMLButtonElement>("csv-btn");
const clearBtn = byId<HTMLButtonElement>("clear-btn");

const reports: PaperReport[] = [];

// Configure the pdf.js worker before any document is opened.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function downloadCsv(): void {
  const blob = new Blob([renderCsv(reports)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ieee-check-report.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function refreshActions(): void {
  if (reports.length === 0) {
    actions.hidden = true;
    return;
  }
  actions.hidden = false;
  const valid = reports.filter((r) => r.valid).length;
  summary.textContent = `${valid} valid · ${reports.length - valid} invalid · ${reports.length} total`;
}

function esc(s: string): string {
  const d = document.createElement("span");
  d.textContent = s;
  return d.innerHTML;
}

function reportCard(r: PaperReport): HTMLElement {
  const card = document.createElement("article");
  card.className = `card ${r.valid ? "valid" : "invalid"}`;

  const head = document.createElement("div");
  head.className = "card-head";
  const badge = r.valid ? "✓ VALID" : "✗ INVALID";
  head.innerHTML = `<span class="badge">${badge}</span><span class="fname">${esc(r.file)}</span><span class="pages">${r.pageCount} pages</span>`;
  card.append(head);

  const grid = document.createElement("div");
  grid.className = "checks";
  for (const id of CHECK_ORDER) {
    const c = r.results.find((x) => x.id === id)!;
    const row = document.createElement("div");
    row.className = `check ${c.status.toLowerCase()}`;
    const label = CHECK_LABELS[id];
    if (c.status === "PASS" && c.evidence.length === 0) {
      row.innerHTML = `<span class="mark">✓</span><span class="label">${esc(label)}</span>`;
    } else {
      const ev = c.evidence
        .map((e) => `${e.page ? `[p.${e.page}] ` : ""}${esc(e.detail)}`)
        .join("<br>");
      row.innerHTML = `<span class="mark">${c.status === "PASS" ? "✓" : "✗"}</span><span class="label">${esc(label)}</span><span class="evidence">${ev}</span>`;
      row.classList.add("has-evidence");
    }
    grid.append(row);
  }
  card.append(grid);
  return card;
}

async function handleFiles(files: FileList | File[]): Promise<void> {
  for (const f of Array.from(files)) {
    if (!f.name.toLowerCase().endsWith(".pdf")) continue;
    let card: HTMLElement | null = null;
    try {
      // Await the WASM backend (already imported at module load).
      const bytes = new Uint8Array(await f.arrayBuffer());
      const r = await validate(bytes, f.name, DEFAULT_CONFIG);
      reports.push(r);
      card = reportCard(r);
    } catch (e) {
      const err = document.createElement("article");
      err.className = "card invalid";
      err.innerHTML = `<div class="card-head"><span class="badge">ERROR</span><span class="fname">${esc(f.name)}</span></div><div class="checks"><div class="check fail has-evidence"><span class="mark">✗</span><span class="label">Could not analyse this PDF</span><span class="evidence">${esc((e as Error).message)}</span></div></div>`;
      card = err;
    }
    results.append(card);
  }
  refreshActions();
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => {
  void handleFiles(fileInput.files ?? []);
  fileInput.value = "";
});

for (const ev of ["dragenter", "dragover"]) {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
}
for (const ev of ["dragleave", "drop"]) {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  });
}
dropzone.addEventListener("drop", (e) => {
  void handleFiles(e.dataTransfer?.files ?? []);
});

csvBtn.addEventListener("click", downloadCsv);
clearBtn.addEventListener("click", () => {
  reports.length = 0;
  results.replaceChildren();
  refreshActions();
});
