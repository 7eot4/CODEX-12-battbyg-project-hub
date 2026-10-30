from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "battbygg"
OUTPUT = ROOT / "docs" / "data" / "site-data.json"
TERMINOLOGY = SOURCE / "output" / "pdf" / "BATTBYG_learning_package" / "terminology_EN_NO_PL.csv"
DEFINITIONS = ROOT / "knowledge" / "definitions_PL.csv"
DEFINITIONS_ADDED_ON = "2026-10-07"
PUBLIC_UPDATE_DATE = "2026-10-30"

CATEGORY_LABELS = {
    "00_Project_identity_context": "Identyfikacja projektu",
    "10_Drawings_specs_asbuilt": "Rysunki i as-built",
    "20_Hull_deck_yard": "Kadłub, pokład i stocznia",
    "30_Safety_fire_LSA": "Bezpieczeństwo i LSA",
    "40_Electrical_power_distribution": "Rozdział energii",
    "50_Automation_control_instrumentation": "Automatyka i pomiary",
    "60_Machinery_auxiliaries_piping": "Maszyny i instalacje",
    "70_Navigation_scientific_mission": "Nawigacja i systemy specjalne",
    "80_Commissioning_testing_closeout": "Commissioning i testy",
}

PROJECTS = {
    "01_MS_FONNES": {
        "name": "M/S FONNES",
        "code": "NVC 315",
        "focus": "Automatyka, maszyny pomocnicze i dokumentacja systemowa.",
        "learning_categories": [
            "00_Project_identity_context", "10_Drawings_specs_asbuilt", "30_Safety_fire_LSA",
            "50_Automation_control_instrumentation", "60_Machinery_auxiliaries_piping",
        ],
        "learning_domains": {"general", "machinery", "automation", "safety", "process", "documentation"},
    },
    "02_GO_SARS": {
        "name": "G.O. SARS",
        "code": "projekt badawczy",
        "focus": "Rozdział energii, automatyka, nawigacja i systemy specjalistyczne.",
        "learning_categories": [
            "00_Project_identity_context", "10_Drawings_specs_asbuilt", "30_Safety_fire_LSA",
            "40_Electrical_power_distribution", "50_Automation_control_instrumentation",
            "60_Machinery_auxiliaries_piping", "70_Navigation_scientific_mission",
        ],
        "learning_domains": {"general", "machinery", "electrical", "automation", "safety", "process", "research", "documentation"},
    },
    "03_MV_BATSFJORD": {
        "name": "M/V BÅTSFJORD",
        "code": "projekt stoczniowy",
        "focus": "Rysunki as-built, rozdział energii, automatyka i commissioning.",
        "learning_categories": [
            "00_Project_identity_context", "10_Drawings_specs_asbuilt", "20_Hull_deck_yard",
            "30_Safety_fire_LSA", "40_Electrical_power_distribution",
            "50_Automation_control_instrumentation", "60_Machinery_auxiliaries_piping",
            "70_Navigation_scientific_mission", "80_Commissioning_testing_closeout",
        ],
        "learning_domains": {
            "general", "machinery", "electrical", "automation", "safety",
            "process", "research", "commissioning", "documentation",
        },
    },
    "04_VESTFISK": {
        "name": "VESTFISK",
        "code": "projekt stoczniowy",
        "focus": "Automatyka, rysunki i identyfikacja wyposażenia.",
        "learning_categories": [
            "00_Project_identity_context", "10_Drawings_specs_asbuilt", "50_Automation_control_instrumentation",
        ],
        "learning_domains": {"general", "automation", "documentation"},
    },
}

DOMAIN_LABELS = {
    "general": "Statek i przestrzenie",
    "machinery": "Maszyny",
    "electrical": "Elektrotechnika",
    "automation": "Automatyka",
    "safety": "Bezpieczeństwo",
    "process": "Proces i chłodnictwo",
    "research": "Systemy badawcze",
    "commissioning": "Commissioning",
    "documentation": "Dokumentacja",
}

LEARNING_CONTEXTS = {
    "general": "Kontekst ogólnookrętowy projektu",
    "machinery": "Maszyny i instalacje",
    "electrical": "Rozdział energii",
    "automation": "Automatyka i pomiary",
    "safety": "Bezpieczeństwo i LSA",
    "process": "Maszyny i instalacje",
    "research": "Nawigacja i systemy specjalne",
    "commissioning": "Commissioning i testy",
    "documentation": "Rysunki i as-built",
}

def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def category_payload(keys: list[str]) -> list[dict[str, str]]:
    return [{"key": key, "label": CATEGORY_LABELS[key]} for key in keys]


def vocabulary_payload(
    terminology: list[dict[str, str]],
    definitions: dict[str, dict[str, str]],
    domains: set[str],
) -> list[dict[str, str]]:
    return [
        {
            "id": f"term-{index:03d}",
            "english": row["english"],
            "norwegian": row["norsk"],
            "polish": row["polski"],
            "domain": row["domain"],
            "domain_label": DOMAIN_LABELS[row["domain"]],
            "learning_context": LEARNING_CONTEXTS[row["domain"]],
            "definition_pl": definitions[row["english"]]["definition_pl"],
            "application_pl": definitions[row["english"]]["application_pl"],
            "definition_added_on": DEFINITIONS_ADDED_ON,
            "definition_status": "opis edukacyjny — potwierdź zastosowanie w aktualnej dokumentacji projektu",
        }
        for index, row in enumerate(terminology, start=1)
        if row["domain"] in domains
    ]


def build() -> dict[str, object]:
    if not SOURCE.is_dir():
        raise FileNotFoundError(f"Brak katalogu źródłowego: {SOURCE}")

    terminology = read_csv(TERMINOLOGY)
    if len(terminology) != 77:
        raise RuntimeError(f"Oczekiwano 77 terminów, znaleziono {len(terminology)}")
    if any(row["domain"] not in DOMAIN_LABELS for row in terminology):
        raise RuntimeError("Glosariusz zawiera nieznaną domenę")

    definition_rows = read_csv(DEFINITIONS)
    definitions = {row["english"]: row for row in definition_rows}
    terminology_keys = {row["english"] for row in terminology}
    if len(definition_rows) != 77 or len(definitions) != 77:
        raise RuntimeError("Oczekiwano 77 unikalnych definicji")
    if set(definitions) != terminology_keys:
        missing = sorted(terminology_keys - set(definitions))
        extra = sorted(set(definitions) - terminology_keys)
        raise RuntimeError(f"Niezgodne definicje; brak={missing}, nadmiar={extra}")
    if any(not row["definition_pl"].strip() or not row["application_pl"].strip() for row in definition_rows):
        raise RuntimeError("Glosariusz zawiera pustą definicję lub kontekst praktyczny")

    projects = []
    total_categories: list[str] = []

    for project_id, meta in PROJECTS.items():
        categories = meta["learning_categories"]
        total_categories.extend(key for key in categories if key not in total_categories)
        vocabulary = vocabulary_payload(terminology, definitions, meta["learning_domains"])
        projects.append(
            {
                "id": project_id,
                "name": meta["name"],
                "code": meta["code"],
                "focus": meta["focus"],
                "categories": category_payload(categories),
                "language_learning": {
                    "term_count": len(vocabulary),
                    "domains": sorted(
                        {item["domain_label"] for item in vocabulary}
                    ),
                    "terms": vocabulary,
                },
                "public_scope": "personal-learning-only",
            }
        )

    updates = [
        {
            "date": PUBLIC_UPDATE_DATE,
            "tag_pl": "Profil edukacyjny",
            "tag_en": "Learning profile",
            "title_pl": "Doprecyzowano cel i granice publicznej strony.",
            "title_en": "The purpose and boundaries of the public page were clarified.",
            "detail_pl": "Warsztat opisuje samodzielny rozwój zawodowy, a słownik, fiszki i dziennik tworzą jeden spójny proces nauki.",
            "detail_en": "The workspace now presents independent professional development, with the glossary, flashcards and journal forming one learning process.",
        },
        {
            "date": PUBLIC_UPDATE_DATE,
            "tag_pl": "Interfejs PL/EN",
            "tag_en": "PL/EN interface",
            "title_pl": "Dodano pełną angielską wersję interfejsu.",
            "title_en": "A complete English interface was added.",
            "detail_pl": "Uporządkowano układ, nawigację i widok mobilny oraz dodano zapamiętywanie wybranego języka.",
            "detail_en": "The layout, navigation and mobile view were refined, and the selected language is now remembered.",
        },
        {
            "date": DEFINITIONS_ADDED_ON,
            "tag_pl": "Definicje",
            "tag_en": "Definitions",
            "title_pl": "Dodano autorskie definicje do 77 pojęć.",
            "title_en": "Original definitions were added to 77 terms.",
            "detail_pl": "Każdy wpis otrzymał datę opracowania, kontekst praktyczny i źródła referencyjne.",
            "detail_en": "Each entry received a preparation date, practical context and reference sources.",
        },
        {
            "date": DEFINITIONS_ADDED_ON,
            "tag_pl": "Narzędzia nauki",
            "tag_en": "Learning tools",
            "title_pl": "Uruchomiono wyszukiwarkę wiedzy i prywatny dziennik.",
            "title_en": "Knowledge search and a private journal were introduced.",
            "detail_pl": "Wyszukiwanie łączy terminy, systemy i konteksty jednostek, a datowane notatki pozostają wyłącznie w przeglądarce.",
            "detail_en": "Search connects terms, systems and vessel contexts, while dated notes remain only in the browser.",
        },
        {
            "date": "2026-10-06",
            "tag_pl": "Fiszki EN–NO–PL",
            "tag_en": "EN–NO–PL flashcards",
            "title_pl": "Rozbudowano naukę języka technicznego.",
            "title_en": "Technical-language learning was expanded.",
            "detail_pl": "Dodano losową kolejność, cofanie fiszki, filtry dziedzin, odsłuch wymowy i regulację tempa lektora.",
            "detail_en": "Random order, previous-card navigation, domain filters, pronunciation playback and narrator speed control were added.",
        },
        {
            "date": "2026-10-06",
            "tag_pl": "Początek warsztatu",
            "tag_en": "Workspace launch",
            "title_pl": "Powstała pierwsza wersja BATTBYG Project Hub.",
            "title_en": "The first BATTBYG Project Hub version was created.",
            "detail_pl": "Połączono konteksty jednostek, obszary techniczne i bazę pojęć w jednym publicznym narzędziu do nauki.",
            "detail_en": "Vessel contexts, technical areas and the terminology base were brought together in one public learning tool.",
        },
    ]
    published_terms = {
        item["english"]
        for project in projects
        for item in project["language_learning"]["terms"]
    }
    if published_terms != {row["english"] for row in terminology}:
        raise RuntimeError("Nie wszystkie terminy źródłowe zostały przypisane do projektów")

    return {
        "site": {
            "title": "BATTBYG Project Hub",
            "description": "Osobisty warsztat nauki zawodowej w środowisku stoczniowym BATTBYG.",
            "data_snapshot": PUBLIC_UPDATE_DATE,
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "publication_mode": "public-sanitized",
        },
        "summary": {
            "projects": len(projects),
            "terms": len(terminology),
            "languages": 3,
            "journal": "local",
        },
        "projects": projects,
        "categories": category_payload(total_categories),
        "updates": updates,
        "language_learning": {
            "source_terms": len(terminology),
            "defined_terms": len(definitions),
            "languages": ["English", "Norsk", "Polski"],
            "definitions_added_on": DEFINITIONS_ADDED_ON,
            "definition_note": (
                "Definicje są autorskim opisem edukacyjnym. Nie zastępują instrukcji producenta, "
                "aktualnych rysunków, procedur stoczni ani wymagań klasyfikacyjnych."
            ),
            "assignment_rule": (
                "Pojęcia i ich przypisanie do kontekstów jednostek są redagowane ręcznie "
                "na potrzeby własnej nauki zawodowej."
            ),
            "reference_sources": [
                {
                    "title": "IEC Electropedia — International Electrotechnical Vocabulary",
                    "url": "https://www.electropedia.org/",
                    "scope": "terminologia elektrotechniczna",
                    "accessed_on": DEFINITIONS_ADDED_ON,
                },
                {
                    "title": "IMO — SOLAS 1974",
                    "url": "https://www.imo.org/en/about/conventions/pages/international-convention-for-the-safety-of-life-at-sea-%28solas%29%2C-1974.aspx",
                    "scope": "bezpieczeństwo statku, ochrona pożarowa i środki ratunkowe",
                    "accessed_on": DEFINITIONS_ADDED_ON,
                },
                {
                    "title": "IMO — Life-saving appliances",
                    "url": "https://www.imo.org/en/ourwork/safety/pages/lifesavingappliances-default.aspx",
                    "scope": "wyposażenie ratunkowe i kod LSA",
                    "accessed_on": DEFINITIONS_ADDED_ON,
                },
                {
                    "title": "DNV — Rules and standards",
                    "url": "https://www.dnv.com/rules-standards/",
                    "scope": "kontekst klasyfikacyjny systemów okrętowych",
                    "accessed_on": DEFINITIONS_ADDED_ON,
                },
                {
                    "title": "ABB — Technical guide No. 9",
                    "url": "https://library.e.abb.com/public/84352e619dba456689ed2688017c9f56/Technical_guide_No_9_3AFE68695201_RevC_EN.pdf",
                    "scope": "napędy, HMI i automatyka",
                    "accessed_on": DEFINITIONS_ADDED_ON,
                },
            ],
        },
        "methodology": {
            "facts": "Samodzielnie zapisane pojęcia i obserwacje przeznaczone do nauki zawodowej.",
            "interpretations": "Robocze wnioski techniczne wymagające potwierdzenia w aktualnej dokumentacji.",
            "limitations": "Strona nie jest dokumentacją projektu, instrukcją wykonawczą ani potwierdzeniem odbioru instalacji.",
        },
    }


def main() -> None:
    payload = build()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wygenerowano: {OUTPUT}")
    print(f"Konteksty jednostek: {payload['summary']['projects']}; pojęcia: {payload['summary']['terms']}")


if __name__ == "__main__":
    main()
