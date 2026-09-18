// SPDX-License-Identifier: MIT
export type CheckId =
  | "copyright"
  | "appendix"
  | "title"
  | "artifact_appendix"
  | "anonymized"
  | "undefined_refs"
  | "page_limit"
  | "page_numbers"
  | "fonts_embedded"
  | "fonts_type3";

export type CheckStatus = "PASS" | "FAIL";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Evidence {
  page?: number;
  detail: string;
  /** Location of the evidence on the page (top-origin coordinates). */
  rect?: Rect;
}

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  evidence: Evidence[];
}

export interface FontInfo {
  page: number;
  name: string;
  subtype: string;
  embedded: boolean;
}

export interface PageLine {
  page: number; // 1-based
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
  pageWidth: number;
  pageHeight: number;
}

export interface PaperData {
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  lines: PageLine[];
  fonts: FontInfo[];
}

export interface PaperReport {
  file: string;
  pageCount: number;
  results: CheckResult[];
  valid: boolean;
}

export interface Config {
  pageLimit: number;
  smallWords: string[];
  acronyms: string[];
  /** Appendices are forbidden in the paper body (submitted separately). */
  forbidAppendices: boolean;
}

export const DEFAULT_CONFIG: Config = {
  pageLimit: 12,
  forbidAppendices: true,
  smallWords: [
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "from",
    "in",
    "into",
    "nor",
    "of",
    "on",
    "onto",
    "or",
    "per",
    "the",
    "to",
    "up",
    "via",
    "with",
    "without",
  ],
  acronyms: [
    "IEEE",
    "HPC",
    "GPU",
    "CPU",
    "TPU",
    "MPI",
    "PDE",
    "ODE",
    "AI",
    "ML",
    "DL",
    "SC",
    "KV",
    "SSD",
    "NVM",
    "OS",
    "IO",
    "IIoT",
    "IoT",
    "GNN",
    "CNN",
    "RNN",
    "LSTM",
    "SGD",
    "QoS",
    "SDN",
    "NFV",
    "VM",
    "OS",
  ],
};
