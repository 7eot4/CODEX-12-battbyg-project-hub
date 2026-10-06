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

    if payload.get("language_learning", {}).get("source_terms") != 77:
        raise SystemExit("Niepełny glosariusz źródłowy")
    all_terms: set[str] = set()
    for project in payload["projects"]:
        learning = project.get("language_learning", {})
        terms = learning.get("terms", [])
        if not terms or learning.get("term_count") != len(terms):
            raise SystemExit(f"Niespójna sekcja językowa: {project['id']}")
        project_terms = {term.get("english", "") for term in terms}
        if len(project_terms) != len(terms):
            raise SystemExit(f"Powtórzone terminy w projekcie: {project['id']}")
        for term in terms:
            required_fields = {
                "english",
                "norwegian",
                "polish",
                "domain",
                "domain_label",
                "evidence_basis",
            }
            if any(not term.get(field) for field in required_fields):
                raise SystemExit(f"Niepełny termin językowy: {project['id']}")
        all_terms.update(project_terms)
    if len(all_terms) != 77:
        raise SystemExit("Nie wszystkie terminy są dostępne w projektach")

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

    html = (DOCS / "index.html").read_text(encoding="utf-8")
    required_ui = ["language-lab", "flashcard", "vocabulary-body", "data-language"]
    if any(marker not in html for marker in required_ui):
        raise SystemExit("Brak kompletnego interfejsu nauki języków")

    print("SITE_VALIDATION_OK")
    assignments = sum(project["language_learning"]["term_count"] for project in payload["projects"])
    print(
        f"projects={payload['summary']['projects']} photos={payload['summary']['photos']} "
        f"updates={payload['summary']['updates']} source_terms={len(all_terms)} "
        f"project_assignments={assignments}"
    )


if __name__ == "__main__":
    main()
