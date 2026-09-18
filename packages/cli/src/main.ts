#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * ieee-check — offline validation of IEEE camera-ready conference papers.
 *
 * Usage:
 *   ieee-check [options] <files... | dirs...>
 *
 * Options:
 *   --json <file>   also write a JSON report
 *   --csv <file>    also write a CSV report
 *   --html <file>   also write a standalone HTML report
 *   --config <file> JSON config overrides
 *   --verbose       show evidence for passing checks too
 *   --quiet         only print the final summary
 *   --help
 *
 * Exit code: 0 if every paper is valid, 1 otherwise, 2 on usage errors.
 * Requires Node >= 22.18 (built-in TypeScript stripping). No network,
 * no install: everything runs locally.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { Config, PaperReport } from "@ieee-check/core";
import { DEFAULT_CONFIG, validate } from "@ieee-check/core";
import { renderConsole, renderCsv, renderHtml, renderJson } from "./report.ts";

function usage(): never {
  console.error(
    "usage: ieee-check [--json f] [--csv f] [--html f] [--config f] [--verbose|--quiet] <files...|dirs...>",
  );
  process.exit(2);
  throw new Error("unreachable");
}

function collectInputs(args: string[]): string[] {
  const files: string[] = [];
  for (const a of args) {
    let st: ReturnType<typeof statSync> | undefined;
    try {
      st = statSync(a);
    } catch {
      console.error(`skipping (not found): ${a}`);
      continue;
    }
    if (st?.isDirectory()) {
      const entries = readdirSync(a)
        .filter((f) => extname(f).toLowerCase() === ".pdf")
        .map((f) => resolve(a, f));
      files.push(...entries);
    } else if (st?.isFile() && extname(a).toLowerCase() === ".pdf") {
      files.push(a);
    } else {
      console.error(`skipping (not a PDF): ${a}`);
    }
  }
  return [...new Set(files)].sort();
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const flags = new Set<string>();
  const outputs: Record<string, string> = {};
  const inputs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) usage();
    if (a === "--help" || a === "-h") usage();
    else if (a === "--verbose" || a === "-v") flags.add("verbose");
    else if (a === "--quiet" || a === "-q") flags.add("quiet");
    else if (a === "--json" || a === "--csv" || a === "--html" || a === "--config") {
      i += 1;
      const v = argv[i];
      if (!v) usage();
      outputs[a] = v;
    } else if (a.startsWith("--")) usage();
    else inputs.push(a);
  }
  if (inputs.length === 0) usage();

  let config: Config = DEFAULT_CONFIG;
  if (outputs["--config"]) {
    const overrides = JSON.parse(readFileSync(outputs["--config"], "utf8")) as Partial<Config>;
    config = { ...DEFAULT_CONFIG, ...overrides };
  }

  const files = collectInputs(inputs);
  if (files.length === 0) {
    console.error("no PDF files found");
    return 2;
  }

  const reports: PaperReport[] = [];
  for (const f of files) {
    if (!flags.has("quiet")) console.error(`checking ${f}`);
    try {
      const bytes = new Uint8Array(readFileSync(f));
      reports.push(await validate(bytes, basename(f), config));
    } catch (e) {
      console.error(`error: ${f}: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  }

  const text = renderConsole(reports, flags.has("verbose"));
  if (flags.has("quiet")) {
    const failed = reports.filter((r) => !r.valid).length;
    console.log(`${reports.length - failed} valid, ${failed} invalid of ${reports.length}`);
  } else {
    console.log(text);
  }
  if (outputs["--json"]) writeFileSync(outputs["--json"], renderJson(reports));
  if (outputs["--csv"]) writeFileSync(outputs["--csv"], renderCsv(reports));
  if (outputs["--html"]) {
    writeFileSync(outputs["--html"], renderHtml(reports, new Date().toISOString()));
  }

  return reports.every((r) => r.valid) ? 0 : 1;
}

process.exitCode = await main();
