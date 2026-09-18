# AGENTS.md — ieee-paper-check

Offline validator for IEEE camera-ready conference papers (10 checks, all
hard failures). MIT-licensed; PDF engine is pdf.js (Apache-2.0) — do NOT
reintroduce mupdf (AGPL, incompatible with MIT).

## Commands

Verify everything (run before committing):

```sh
pnpm check        # tsc --noEmit (all packages) + biome
pnpm test         # corpus validation harness + CLI batch run
pnpm corpus:check # ruff + ty on the Python corpus generators
```

Rebuild the test corpus (needs tectonic + soffice + uv; PDFs are committed
so tests run without them):

```sh
pnpm corpus       # regenerates corpus/pdfs + ground-truth.json
```

Web app (GitHub Pages target):

```sh
pnpm build                            # vite build + PWA
pnpm --filter @ieee-check/web preview # then run the smoke test:
uv run --with playwright python tools/webtest/smoke.py
```

## Rules

- The corpus is the specification: `corpus/ground-truth.json` defines
  expected verdicts. Any change to check logic must keep
  `node packages/core/scripts/validate.ts` at 0 FP / 0 FN (the single
  `model_tier` entry is a documented limitation, see README).
- Never commit a real author's paper into the corpus. Encode lessons from
  real papers into the *fake* papers in `tools/generate/` instead.
- `corpus/pdfs` and `corpus/ground-truth.json` are committed test fixtures;
  `corpus/src/latex/variants`, `corpus/build`, and the unpacked Word base
  are generated — do not commit them.
- tectonic lives at `tools/bin/tectonic` locally but is gitignored; the
  README documents how the generators work.
- Node >= 22.18 (built-in TS stripping) is required to run the CLI and
  harness without a build step.
- Binary artifacts (corpus PDFs, template zips/docx) are git-LFS
  tracked; never commit raw binaries matching those patterns.
- Follow kernel-style commits (imperative subject, detailed body,
  `Assisted-by: LLM` trailer when AI-assisted, no agent-added
  Signed-off-by).
