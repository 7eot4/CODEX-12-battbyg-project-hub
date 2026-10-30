from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA = DOCS / "data" / "site-data.json"
HERO = DOCS / "assets" / "shipyard-hero.webp"

REQUIRED = [
    DOCS / "index.html",
    DOCS / "assets" / "styles.css",
    DOCS / "assets" / "i18n.js",
    DOCS / "assets" / "app.js",
    HERO,
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
    if payload["summary"].get("terms") != 77 or payload["summary"].get("languages") != 3:
        raise SystemExit("Niespójne podsumowanie materiału edukacyjnego")
    if any(item.get("public_scope") != "personal-learning-only" for item in payload["projects"]):
        raise SystemExit("Nieprawidłowy zakres publikacji projektu")

    forbidden_public_keys = {
        "photos", "confidence", "included", "excluded", "evidence_basis",
        "date_from", "date_to", "high_confidence", "medium_confidence",
    }
    def find_forbidden_keys(value: object, path: str = "root") -> list[str]:
        found: list[str] = []
        if isinstance(value, dict):
            for key, item in value.items():
                if key in forbidden_public_keys:
                    found.append(f"{path}.{key}")
                found.extend(find_forbidden_keys(item, f"{path}.{key}"))
        elif isinstance(value, list):
            for index, item in enumerate(value):
                found.extend(find_forbidden_keys(item, f"{path}[{index}]"))
        return found

    forbidden_paths = find_forbidden_keys(payload)
    if forbidden_paths:
        raise SystemExit(f"Publiczne dane zawierają metadane materiału źródłowego: {forbidden_paths[:5]}")

    if payload.get("language_learning", {}).get("source_terms") != 77:
        raise SystemExit("Niepełny glosariusz źródłowy")
    if payload.get("language_learning", {}).get("defined_terms") != 77:
        raise SystemExit("Nie wszystkie pojęcia mają definicję")
    definition_date = payload.get("language_learning", {}).get("definitions_added_on", "")
    try:
        date.fromisoformat(definition_date)
    except ValueError as error:
        raise SystemExit("Nieprawidłowa data opracowania definicji") from error
    sources = payload.get("language_learning", {}).get("reference_sources", [])
    if len(sources) < 4 or any(
        not source.get("title")
        or not source.get("url", "").startswith("https://")
        or source.get("accessed_on") != definition_date
        for source in sources
    ):
        raise SystemExit("Niepełne źródła referencyjne definicji")
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
                "learning_context",
                "definition_pl",
                "application_pl",
                "definition_added_on",
                "definition_status",
            }
            if any(not term.get(field) for field in required_fields):
                raise SystemExit(f"Niepełny termin językowy: {project['id']}")
            if term["definition_added_on"] != definition_date:
                raise SystemExit(f"Niespójna data definicji: {term['english']}")
        all_terms.update(project_terms)
    if len(all_terms) != 77:
        raise SystemExit("Nie wszystkie terminy są dostępne w projektach")

    text_suffixes = {"", ".html", ".css", ".js", ".json", ".svg", ".txt"}
    published = "\n".join(
        path.read_text(encoding="utf-8", errors="strict")
        for path in DOCS.rglob("*")
        if path.is_file() and path.suffix.lower() in text_suffixes
    )
    banned = [
        r"99_Restricted_sensitive",
        r"_analysis_staging",
        r"photos[/\\]",
        r"project_register\.csv",
        r"[A-Fa-f0-9]{64}",
        r'"photos"\s*:',
        r"verified photo register",
        r"Evidence material",
        r"Materiał dowodowy",
        r"High confidence",
        r"Wysoka pewność",
    ]
    for pattern in banned:
        if re.search(pattern, published):
            raise SystemExit(f"Niedozwolona treść publiczna: {pattern}")

    forbidden_suffixes = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".csv", ".xlsx"}
    allowed_binary_assets = {HERO.resolve()}
    leaked = [
        str(path.relative_to(DOCS))
        for path in DOCS.rglob("*")
        if path.suffix.lower() in forbidden_suffixes and path.resolve() not in allowed_binary_assets
    ]
    if leaked:
        raise SystemExit(f"Niedozwolone artefakty w publikacji: {leaked}")
    hero_bytes = HERO.read_bytes()
    if len(hero_bytes) > 500_000 or hero_bytes[:4] != b"RIFF" or hero_bytes[8:12] != b"WEBP":
        raise SystemExit("Nieprawidłowa lub zbyt duża ilustracja publiczna")

    html = (DOCS / "index.html").read_text(encoding="utf-8")
    required_ui = [
        "language-lab",
        "flashcard",
        "vocabulary-body",
        "data-language",
        "previous-card",
        "shuffle-cards",
        "voice-english",
        "voice-norwegian",
        "speech-rate",
        "global-search",
        "search-results",
        "shipyard-hero.webp",
        "definition-note",
        "definition-sources",
        "field-journal",
        "journal-form",
        "export-journal",
        "ship-guide",
        "data-ui-language=\"pl\"",
        "data-ui-language=\"en\"",
        "assets/i18n.js",
    ]
    if any(marker not in html for marker in required_ui):
        raise SystemExit("Brak kompletnego interfejsu nauki języków")

    required_public_positioning = [
        "Wpisy słownikowe i objaśnienia dodaję ręcznie.",
        "I add the vocabulary entries and explanations manually.",
        "personal-learning-only",
    ]
    if any(marker not in published for marker in required_public_positioning):
        raise SystemExit("Brak jednoznacznego opisu osobistego warsztatu nauki")

    script = (DOCS / "assets" / "app.js").read_text(encoding="utf-8")
    translations = (DOCS / "assets" / "i18n.js").read_text(encoding="utf-8")
    required_translation_logic = ["battbyg-ui-language-v1", "BattbygI18n", "battbyg:languagechange"]
    if any(marker not in translations for marker in required_translation_logic):
        raise SystemExit("Brak kompletnej obsługi języka interfejsu")
    required_english_ui = [
        '"hero.title": "Turn shipboard observations into structured knowledge."',
        '"journal.title": "Shipboard learning and work journal"',
        '"guide.title": "Turn a day on board into useful knowledge"',
    ]
    if any(marker not in translations for marker in required_english_ui):
        raise SystemExit("Niepełne angielskie tłumaczenie interfejsu")
    used_translation_keys = set(re.findall(r'data-i18n(?:-[a-z]+)?="([^"]+)"', html))
    used_translation_keys.update(re.findall(r'\bt\("([^"$]+)"', script))
    missing_translation_keys = sorted(
        key for key in used_translation_keys if translations.count(f'"{key}":') < 2
    )
    if missing_translation_keys:
        raise SystemExit(f"Brak tłumaczenia PL/EN dla kluczy: {missing_translation_keys}")
    required_search_logic = ["buildSearchIndex", "findSearchResults", "normalizeSearch", "openSearchResult"]
    if any(marker not in script for marker in required_search_logic):
        raise SystemExit("Brak kompletnej logiki wyszukiwarki")
    required_journal_logic = ["loadJournalEntries", "persistJournalEntries", "journalAsMarkdown", "exportJournal"]
    if any(marker not in script for marker in required_journal_logic):
        raise SystemExit("Brak kompletnej logiki lokalnego dziennika")

    print("SITE_VALIDATION_OK")
    assignments = sum(project["language_learning"]["term_count"] for project in payload["projects"])
    print(
        f"vessel_contexts={payload['summary']['projects']} terms={payload['summary']['terms']} "
        f"learning_updates={len(payload['updates'])} source_terms={len(all_terms)} "
        f"project_assignments={assignments}"
    )


if __name__ == "__main__":
    main()
