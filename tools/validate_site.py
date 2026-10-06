from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA = DOCS / "data" / "site-data.json"

REQUIRED = [
    DOCS / "index.html",
    DOCS / "assets" / "styles.css",
    DOCS / "assets" / "app.js",
    DATA,
    DOCS / ".nojekyll",
]


def main() -> None:
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED if not path.exists()]
    if missing:
        raise SystemExit(f"Brak wymaganych plików: {missing}")

    payload = json.loads(DATA.read_text(encoding="utf-8"))
    if payload["summary"]["projects"] != 4:
        raise SystemExit("Nieprawidłowa liczba projektów")
    if payload["summary"]["photos"] != sum(item["photos"] for item in payload["projects"]):
        raise SystemExit("Niespójny licznik zdjęć")
    if any(item.get("restricted_material_published") for item in payload["projects"]):
        raise SystemExit("Materiał wrażliwy oznaczony do publikacji")

    published = "\n".join(
        path.read_text(encoding="utf-8", errors="strict")
        for path in DOCS.rglob("*")
        if path.is_file()
    )
    banned = [
        r"99_Restricted_sensitive",
        r"_analysis_staging",
        r"photos[/\\]",
        r"project_register\.csv",
        r"[A-Fa-f0-9]{64}",
    ]
    for pattern in banned:
        if re.search(pattern, published):
            raise SystemExit(f"Niedozwolona treść publiczna: {pattern}")

    forbidden_suffixes = {".jpg", ".jpeg", ".png", ".pdf", ".csv", ".xlsx"}
    leaked = [str(path.relative_to(DOCS)) for path in DOCS.rglob("*") if path.suffix.lower() in forbidden_suffixes]
    if leaked:
        raise SystemExit(f"Niedozwolone artefakty w publikacji: {leaked}")

    print("SITE_VALIDATION_OK")
    print(f"projects={payload['summary']['projects']} photos={payload['summary']['photos']} updates={payload['summary']['updates']}")


if __name__ == "__main__":
    main()
