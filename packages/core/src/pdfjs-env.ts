// SPDX-License-Identifier: MIT
/**
 * Environment-conditional pdf.js loader.
 * - Node (CLI, validation harness): legacy build, no worker needed.
 * - Browser (web app): modern build; the web app sets
 *   GlobalWorkerOptions.workerSrc before any document is opened.
 */
export type PdfjsModule = typeof import("pdfjs-dist");

let cached: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  cached ??=
    typeof window === "undefined"
      ? (import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfjsModule>)
      : (import("pdfjs-dist") as Promise<PdfjsModule>);
  return cached;
}
