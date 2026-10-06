from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "battbygg"
OUTPUT = ROOT / "docs" / "data" / "site-data.json"

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
    },
    "02_GO_SARS": {
        "name": "G.O. SARS",
        "code": "projekt badawczy",
        "focus": "Rozdział energii, automatyka, nawigacja i systemy specjalistyczne.",
    },
    "03_MV_BATSFJORD": {
        "name": "M/V BÅTSFJORD",
        "code": "projekt stoczniowy",
        "focus": "Rysunki as-built, rozdział energii, automatyka i commissioning.",
    },
    "04_VESTFISK": {
        "name": "VESTFISK",
        "code": "projekt stoczniowy",
        "focus": "Automatyka, rysunki i identyfikacja wyposażenia.",
    },
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_filename_date(name: str) -> str:
    return datetime.strptime(name[:8], "%Y%m%d").date().isoformat()


def category_payload(counter: Counter[str]) -> list[dict[str, object]]:
    result = []
    for key, count in counter.most_common():
        if key not in CATEGORY_LABELS:
            continue
        result.append({"key": key, "label": CATEGORY_LABELS[key], "count": count})
    return result


def build() -> dict[str, object]:
    if not SOURCE.is_dir():
        raise FileNotFoundError(f"Brak katalogu źródłowego: {SOURCE}")

    projects = []
    total_categories: Counter[str] = Counter()
    total_photos = 0
    total_high = 0
    total_medium = 0

    for project_id, meta in PROJECTS.items():
        register = SOURCE / "projects" / project_id / "project_register.csv"
        rows = read_csv(register)
        if not rows:
            raise RuntimeError(f"Pusty rejestr: {register}")

        categories = Counter(row["category"] for row in rows)
        public_categories = Counter(
            {key: value for key, value in categories.items() if key != "99_Restricted_sensitive"}
        )
        confidence = Counter(row["confidence"].strip().lower() for row in rows)
        filenames = sorted(row["file_name"] for row in rows)
        total_photos += len(rows)
        total_high += confidence.get("high", 0)
        total_medium += confidence.get("medium", 0)
        total_categories.update(public_categories)

        projects.append(
            {
                "id": project_id,
                "name": meta["name"],
                "code": meta["code"],
                "focus": meta["focus"],
                "photos": len(rows),
                "date_from": parse_filename_date(filenames[0]),
                "date_to": parse_filename_date(filenames[-1]),
                "confidence": {
                    "high": confidence.get("high", 0),
                    "medium": confidence.get("medium", 0),
                },
                "categories": category_payload(public_categories),
                "restricted_material_published": False,
            }
        )

    update_rows = read_csv(SOURCE / "UPDATE_LOG.csv")
    updates = []
    for row in sorted(update_rows, key=lambda item: item["update_date"], reverse=True):
        targets = row["project"].split(";")
        labels = [PROJECTS[item]["name"] for item in targets if item in PROJECTS]
        updates.append(
            {
                "date": row["update_date"],
                "included": int(row["included"]),
                "excluded": int(row["excluded"]),
                "projects": labels,
                "status": "zweryfikowana" if row["status"] == "verified" else "w toku",
            }
        )

    latest = max(row["update_date"] for row in update_rows)
    return {
        "site": {
            "title": "BATTBYG Project Hub",
            "description": "Publiczny, zagregowany rejestr wiedzy z projektów okrętowych BATTBYG.",
            "data_snapshot": latest,
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "publication_mode": "public-sanitized",
        },
        "summary": {
            "projects": len(projects),
            "photos": total_photos,
            "updates": len(updates),
            "high_confidence": total_high,
            "medium_confidence": total_medium,
        },
        "projects": projects,
        "categories": category_payload(total_categories),
        "updates": updates,
        "methodology": {
            "facts": "Dane widoczne w rejestrach projektu lub bezpośrednio na materiale źródłowym.",
            "interpretations": "Robocze wnioski techniczne wymagające potwierdzenia dokumentacją.",
            "limitations": "Zdjęcia nie potwierdzają rewizji, wyniku testu ani aktualnego stanu urządzenia.",
        },
    }


def main() -> None:
    payload = build()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wygenerowano: {OUTPUT}")
    print(f"Projekty: {payload['summary']['projects']}; zdjęcia: {payload['summary']['photos']}")


if __name__ == "__main__":
    main()
