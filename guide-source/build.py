"""
Turns every guide-source/*.html file into a PDF in the pdfs/ folder.

Usage:  python guide-source/build.py            (builds all guides)
        python guide-source/build.py founder    (builds just founder.html)

It prints each HTML page with Google Chrome (or Microsoft Edge) in headless mode,
so the PDF looks exactly like the page does in the browser's print preview.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "pdfs"

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]


def find_browser():
    for b in BROWSERS:
        if os.path.exists(b):
            return b
    sys.exit("Could not find Chrome or Edge.")


def build(page: Path, browser: str):
    target = OUT / (page.stem + ".pdf")
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                f"--user-data-dir={profile}",
                "--no-pdf-header-footer",
                "--virtual-time-budget=10000",  # give web fonts time to load
                f"--print-to-pdf={target}",
                page.as_uri(),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    print(f"built {target.relative_to(HERE.parent)}  ({target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    browser = find_browser()
    names = sys.argv[1:]
    pages = [HERE / f"{n}.html" for n in names] if names else sorted(HERE.glob("*.html"))
    for p in pages:
        build(p, browser)
