"""Browser smoke test for the ieee-check web app.
# SPDX-License-Identifier: MIT

Serves the built app, drops three corpus PDFs onto the page, and verifies
the rendered results match the expected verdicts.

Usage: uv run --with playwright python tools/webtest/smoke.py
(run from the repo root; needs `playwright install chromium` once)
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    ROOT / "corpus/pdfs/good.pdf",
    ROOT / "corpus/pdfs/bad_type3.pdf",
    ROOT / "corpus/pdfs/bad_title_case.pdf",
]
EXPECT = {
    "good.pdf": ("✓ VALID", []),
    "bad_type3.pdf": ("✗ INVALID", ["No Type 3 fonts"]),
    "bad_title_case.pdf": ("✗ INVALID", ["Title capitalization"]),
}


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://localhost:4173/")
        page.wait_for_load_state("networkidle")
        page.locator("#file-input").set_input_files([str(f) for f in FILES])
        page.wait_for_selector(".card", timeout=60000)
        page.wait_for_timeout(1500)
        cards = page.locator(".card").all()
        print(f"cards: {len(cards)}")
        ok = len(cards) == len(FILES)
        for c in cards:
            name = c.locator(".fname").inner_text()
            badge = c.locator(".badge").inner_text()
            fails = [l.inner_text() for l in c.locator(".check.fail .label").all()]
            print(f"  {name}: {badge} fails={fails}")
            exp_badge, exp_fails = EXPECT[name]
            ok = ok and badge == exp_badge and fails == exp_fails
        print("summary:", page.locator("#summary").inner_text())
        if errors:
            print("CONSOLE ERRORS:", errors[:5])
        browser.close()
        if errors or not ok:
            return 1
        print("SMOKE OK")
        return 0


if __name__ == "__main__":
    sys.exit(main())
