// SPDX-License-Identifier: MIT
import { loadPdfjs } from "./pdfjs-env.ts";
import type { FontInfo, PageLine, PaperData } from "./types.ts";

interface TextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

interface CompatFont {
  name: string;
  isType3Font: boolean;
  missingFile: boolean;
}

interface PageLike {
  view: unknown;
  commonObjs: { get: (k: string) => unknown };
}

interface LinePart {
  str: string;
  x: number;
  w: number;
}

interface LineAcc {
  parts: LinePart[];
  x0: number;
  yTop: number;
  width: number;
  height: number;
  dominant: TextItem;
  dominantW: number;
}

function fontFromCommon(page: PageLike, ref: string): CompatFont | undefined {
  try {
    const f = page.commonObjs.get(ref) as CompatFont | undefined;
    if (f && typeof f.name === "string") return f;
  } catch {
    // Font object not resolved (yet): fall back to the raw reference.
  }
  return undefined;
}

/** Open a PDF from bytes and extract all data the checks need. */
export async function extractPaperData(bytes: Uint8Array): Promise<PaperData> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: bytes,
    verbosity: 0,
    disableFontFace: true,
  }).promise;

  const lines: PageLine[] = [];
  const fonts: FontInfo[] = [];
  const seenFonts = new Set<string>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = (await doc.getPage(p)) as unknown as PageLike & {
      getTextContent: () => Promise<{ items: TextItem[] }>;
      getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    };
    const view = page.view as [number, number, number, number];
    const pageWidth = view[2] - view[0];
    const pageHeight = view[3] - view[1];

    // Running the operator list first compiles every font used on the
    // page, so commonObjs lookups afterwards are resolved.
    const opList = await page.getOperatorList();
    const refs: string[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === pdfjs.OPS.setFont) {
        const ref = opList.argsArray[i]?.[0] as string | undefined;
        if (ref && !refs.includes(ref)) refs.push(ref);
      }
    }
    for (const ref of refs) {
      const key = `${p}:${ref}`;
      if (seenFonts.has(key)) continue;
      const f = fontFromCommon(page, ref);
      if (!f) continue;
      seenFonts.add(key);
      fonts.push({
        page: p,
        name: f.name,
        type3: f.isType3Font,
        embedded: !f.missingFile,
      });
    }

    // --- positioned text lines ------------------------------------------
    const tc = await page.getTextContent();
    let line: LineAcc | null = null;
    const flush = () => {
      if (line === null) return;
      // Join runs with a space when there is a positional gap between
      // them (pdf.js splits at style changes, e.g. "1st" + "Anonymous").
      let text = "";
      let prevX1: number | null = null;
      for (const part of line.parts) {
        if (prevX1 !== null && part.x - prevX1 > 0.75) text += " ";
        text += part.str;
        prevX1 = part.x + part.w;
      }
      if (text.trim().length > 0) {
        const f = fontFromCommon(page, line.dominant.fontName);
        lines.push({
          page: p,
          text,
          x: line.x0,
          y: line.yTop,
          w: line.width,
          h: line.height,
          font: f?.name ?? line.dominant.fontName,
          size: line.dominant.height,
          pageWidth,
          pageHeight,
        });
      }
      line = null;
    };

    for (const raw of tc.items) {
      const tr = raw.transform;
      if (raw.str.trim().length === 0) continue;
      const baseline = tr[5] ?? 0;
      const height = raw.height || Math.abs(tr[3] ?? 0) || 10;
      const x = tr[4] ?? 0;
      const yTop = pageHeight - baseline - height;
      const sameLine =
        line !== null &&
        Math.abs(yTop - line.yTop) < 3 &&
        Math.abs(x - (line.x0 + line.width)) < 24;
      if (sameLine && line !== null) {
        line.parts.push({ str: raw.str, x, w: raw.width });
        const right = x + raw.width;
        if (right > line.x0 + line.width) line.width = right - line.x0;
        if (raw.width > line.dominantW) {
          line.dominant = raw;
          line.dominantW = raw.width;
        }
      } else {
        flush();
        line = {
          parts: [{ str: raw.str, x, w: raw.width }],
          x0: x,
          yTop,
          width: raw.width,
          height,
          dominant: raw,
          dominantW: raw.width,
        };
      }
    }
    flush();
  }

  const first = lines.find((l) => l.page === 1);
  return {
    pageCount: doc.numPages,
    pageWidth: first?.pageWidth ?? 612,
    pageHeight: first?.pageHeight ?? 792,
    lines,
    fonts,
  };
}
