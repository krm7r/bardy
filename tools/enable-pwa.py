"""Synchronize PWA metadata and service-worker registration on root HTML pages."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "manifest.webmanifest"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
THEME_COLOR = MANIFEST.get("theme_color", "#b8862b")

LINKS = (
    ("manifest", '<link rel="manifest" href="/manifest.webmanifest" />'),
    ("icon", '<link rel="icon" href="/assets/favicon.png" sizes="64x64" type="image/png" />'),
    ("apple-touch-icon", '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />'),
)
REGISTRATION = (
    "<script>if ('serviceWorker' in navigator) "
    "navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).catch(() => {});"
    "</script>"
)


def upsert_tag(text, pattern, replacement):
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
        return text[:match.start()] + replacement + text[match.end():]
    return re.sub(r"</head\s*>", f"  {replacement}\n</head>", text, count=1, flags=re.IGNORECASE)


def has_local_service_worker_registration(text):
    if "navigator.serviceWorker.register" in text:
        return True
    sources = re.findall(r"<script\b[^>]*\bsrc\s*=\s*['\"]([^'\"]+)['\"][^>]*>", text, flags=re.IGNORECASE)
    for source in sources:
        parsed = urlparse(source)
        if parsed.scheme or parsed.netloc:
            continue
        script_path = ROOT / parsed.path.lstrip("/")
        if script_path.is_file() and "navigator.serviceWorker.register" in script_path.read_text(encoding="utf-8"):
            return True
    return False


for page in sorted(ROOT.glob("*.html")):
    original = page.read_text(encoding="utf-8")
    updated = original
    updated = upsert_tag(
        updated,
        r"<meta\b(?=[^>]*\bname\s*=\s*['\"]theme-color['\"])[^>]*>",
        f'<meta name="theme-color" content="{THEME_COLOR}" />',
    )
    for rel, tag in LINKS:
        pattern = rf"<link\b(?=[^>]*\brel\s*=\s*['\"]{re.escape(rel)}['\"])[^>]*>"
        updated = upsert_tag(updated, pattern, tag)
    if not has_local_service_worker_registration(updated):
        updated = re.sub(r"</body\s*>", f"  {REGISTRATION}\n</body>", updated, count=1, flags=re.IGNORECASE)
    if updated != original:
        page.write_text(updated, encoding="utf-8")
        print(f"updated {page.name}")
