from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import threading
import traceback
import webbrowser
from collections import Counter, defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "battbygg"
VIEWER = ROOT / "local-viewer"
TIMELINE = SOURCE / "timeline_selection" / "timeline_register.csv"
ANNOTATIONS = SOURCE / "photo_annotations.csv"
CACHE = Path(os.environ.get("LOCALAPPDATA", str(ROOT / ".local"))) / "BATTBYG-PhotoViewer"
THUMBNAILS = CACHE / "thumbnails"

PROJECTS = {
    "01_MS_FONNES": "M/S FONNES",
    "02_GO_SARS": "G.O. SARS",
    "03_MV_BATSFJORD": "M/V BÅTSFJORD",
    "04_VESTFISK": "VESTFISK",
}

CATEGORY_META = {
    "00_Project_identity_context": (
        "Identyfikacja projektu",
        "Tabliczka, nazwa lub kontekst umożliwiający przypisanie materiału do projektu.",
    ),
    "10_Drawings_specs_asbuilt": (
        "Schematy i dokumentacja",
        "Rysunek, wykaz, instrukcja albo dokumentacja techniczna. Treść i rewizję trzeba potwierdzić w źródle kontrolowanym.",
    ),
    "20_Hull_deck_yard": (
        "Kadłub, pokład i stocznia",
        "Konstrukcja jednostki, pokład, przestrzeń robocza albo kontekst prac stoczniowych.",
    ),
    "30_Safety_fire_LSA": (
        "Bezpieczeństwo i LSA",
        "Element ochrony przeciwpożarowej, drogi ewakuacyjnej lub wyposażenia ratunkowego.",
    ),
    "40_Electrical_power_distribution": (
        "Rozdział energii",
        "Element rozdziału energii: rozdzielnica, aparatura, zasilacz, okablowanie, PE lub oznaczenie obwodu.",
    ),
    "50_Automation_control_instrumentation": (
        "Automatyka i pomiary",
        "Element automatyki: szafa sterownicza, PLC/I/O, przekaźnik, panel HMI, czujnik albo okablowanie sygnałowe.",
    ),
    "60_Machinery_auxiliaries_piping": (
        "Maszyny i instalacje",
        "Maszyna pomocnicza, napęd, zawór, rurociąg lub kontekst instalacji procesowej.",
    ),
    "70_Navigation_scientific_mission": (
        "Nawigacja i systemy specjalne",
        "Urządzenie nawigacyjne, naukowe lub związane z wyposażeniem misyjnym jednostki.",
    ),
    "80_Commissioning_testing_closeout": (
        "Commissioning i testy",
        "Kontekst czynności commissioning, testu albo zamknięcia prac; fotografia nie potwierdza wyniku próby.",
    ),
}

CLASSIFICATION_LABELS = {
    "FIRE_AND_SAFETY_PLAN": "Plan ochrony przeciwpożarowej i bezpieczeństwa",
    "ELECTRICAL_DRAWING_SEQUENCE": "Sekwencja rysunków elektrycznych",
    "POSTED_ELECTRICAL_SCHEMATIC": "Schemat elektryczny umieszczony przy urządzeniu",
    "ELECTRICAL_DRAWING_DETAILS": "Szczegóły rysunku elektrycznego",
    "ELECTRICAL_DRAWING": "Rysunek elektryczny",
    "SYSTEM_BLOCK_DIAGRAM": "Schemat blokowy systemu",
    "TERMINAL_DRAWING": "Rysunek zacisków",
    "ELECTRICAL_SCHEDULE": "Wykaz elektryczny",
    "CABLE_AND_IO_LIST": "Lista kabli i sygnałów I/O",
    "CABLE_LIST": "Lista kablowa",
    "IO_LIST": "Lista wejść i wyjść",
    "FUSE_LIST": "Lista bezpieczników",
    "EQUIPMENT_LIST": "Lista urządzeń",
    "EQUIPMENT_AND_CABLE_LISTS": "Listy urządzeń i kabli",
    "EQUIPMENT_INSTRUCTIONS_AND_LISTS": "Instrukcje i listy urządzeń",
    "BOTTOM_EQUIPMENT_LAYOUT": "Plan rozmieszczenia wyposażenia dennego",
    "SYSTEM_LAYOUT": "Plan rozmieszczenia systemu",
    "TECHNICAL_SKETCH": "Szkic techniczny",
    "MANUAL_EXCERPT": "Fragment instrukcji",
    "TECHNICAL_FORMS": "Formularze techniczne",
    "POSTED_SCHEDULE": "Wykaz umieszczony przy urządzeniu",
    "MOUNTED_SCHEDULE": "Wykaz zamontowany przy urządzeniu",
    "HANDWRITTEN_TERMINAL_NOTES": "Notatki zaciskowe",
    "CHECKLIST_OR_WORK_INSTRUCTION": "Checklista lub instrukcja pracy",
    "WORK_SHEET": "Arkusz roboczy",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def capture_time(file_name: str) -> datetime:
    match = re.match(r"(\d{8})_(\d{6})", file_name)
    if not match:
        raise ValueError(f"Brak czasu w nazwie pliku: {file_name}")
    return datetime.strptime("".join(match.groups()), "%Y%m%d%H%M%S")


def classification_label(value: str) -> str:
    upper = value.upper()
    for key in sorted(CLASSIFICATION_LABELS, key=len, reverse=True):
        if key in upper:
            return CLASSIFICATION_LABELS[key]
    cleaned = re.sub(r"^SET-\d+_", "", upper)
    cleaned = cleaned.replace("COMPLETE_PHOTO_SEQUENCE__", "")
    cleaned = cleaned.replace("COMPLETENESS_NOT_VERIFIED__", "")
    return cleaned.replace("_", " ").strip().capitalize() or "Zestaw dokumentacji"


def build_catalog() -> tuple[dict[str, object], dict[tuple[str, str], Path]]:
    if not SOURCE.is_dir():
        raise FileNotFoundError(f"Brak źródła BATTBYG: {SOURCE}")

    timeline_rows = read_csv(TIMELINE)
    annotation_rows = read_csv(ANNOTATIONS)
    annotations = {
        (row["project"], row["file_name"]): row
        for row in annotation_rows
    }
    if len(annotations) != len(annotation_rows):
        raise RuntimeError("Powtórzone wpisy w photo_annotations.csv")
    timeline_map: dict[tuple[str, str], dict[str, str]] = {}
    for row in timeline_rows:
        project = row.get("source_project_hint", "")
        file_name = row.get("file_name", "")
        if project in PROJECTS and file_name:
            timeline_map[(project, file_name)] = row

    records: list[dict[str, object]] = []
    source_index: dict[tuple[str, str], Path] = {}
    excluded_restricted = 0
    source_rows = 0

    for project_id, project_name in PROJECTS.items():
        register = SOURCE / "projects" / project_id / "project_register.csv"
        for row in read_csv(register):
            source_rows += 1
            category = row["category"]
            if category == "99_Restricted_sensitive":
                excluded_restricted += 1
                continue
            if category not in CATEGORY_META:
                raise RuntimeError(f"Nieznana kategoria {category}: {project_id}/{row['file_name']}")

            source_relative = row["source_relative"].replace("\\", "/")
            expected_prefix = f"photos/{project_id}/"
            if not source_relative.startswith(expected_prefix):
                raise RuntimeError(f"Niebezpieczna ścieżka źródłowa: {source_relative}")
            source_path = (SOURCE / source_relative).resolve()
            photos_root = (SOURCE / "photos").resolve()
            if photos_root not in source_path.parents or not source_path.is_file():
                raise FileNotFoundError(f"Brak zdjęcia źródłowego: {source_path}")

            file_name = row["file_name"]
            captured = capture_time(file_name)
            timeline = timeline_map.get((project_id, file_name), {})
            annotation = annotations.get((project_id, file_name))
            category_label, description = CATEGORY_META[category]
            kind = "schematic" if category == "10_Drawings_specs_asbuilt" else "photo"
            item_id = f"{project_id}:{file_name}"
            record = {
                "id": item_id,
                "project": project_id,
                "project_name": project_name,
                "file_name": file_name,
                "captured_at": captured.isoformat(timespec="seconds"),
                "time_basis": "czas zakodowany w nazwie pliku",
                "category": category,
                "category_label": category_label,
                "title": annotation["title"] if annotation else category_label,
                "description": annotation["fact_description"] if annotation else f"Klasyfikacja robocza rejestru: {description}",
                "learning_note": annotation["learning_note"] if annotation else "Odczytaj tag urządzenia i porównaj go z właściwym rysunkiem lub listą.",
                "limitation": annotation["limitation"] if annotation else "Dokładny typ, funkcja i stan urządzenia nie są potwierdzone na podstawie samej kategorii.",
                "claim_class": annotation["claim_class"] if annotation else "INTERPRETACJA",
                "description_level": "curated" if annotation else "category-only",
                "analysis_date": annotation["analysis_date"] if annotation else "",
                "annotation_source": annotation["source"] if annotation else "project_register.csv",
                "kind": kind,
                "confidence": row.get("confidence", "unknown"),
                "classification_method": row.get("classification_method", "unknown"),
                "manifest_verified": row.get("manifest_verified", "").lower() == "true",
                "sha256_short": row.get("sha256", "")[:12],
                "session_id": timeline.get("session_id", ""),
                "document_set": timeline.get("document_set", ""),
                "completeness": timeline.get("completeness", ""),
                "thumbnail_url": f"/thumbs/{quote(project_id)}/{quote(file_name)}.webp",
                "photo_url": f"/photos/{quote(project_id)}/{quote(file_name)}",
            }
            records.append(record)
            source_index[(project_id, file_name)] = source_path

    record_by_id = {str(item["id"]): item for item in records}
    missing_annotations = sorted(set(annotations) - set(source_index))
    if missing_annotations:
        raise RuntimeError(f"Opis wskazuje brakujące zdjęcie: {missing_annotations[0]}")
    physical_records = [item for item in records if item["kind"] == "photo"]
    physical_by_session: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    physical_by_project: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in physical_records:
        project = str(item["project"])
        physical_by_project[project].append(item)
        session_id = str(item["session_id"])
        if session_id:
            physical_by_session[(project, session_id)].append(item)

    known_groups: dict[tuple[str, str, str], list[dict[str, object]]] = defaultdict(list)
    ungrouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in records:
        if item["kind"] != "schematic":
            continue
        document_set = str(item["document_set"])
        session_id = str(item["session_id"])
        if document_set and session_id:
            known_groups[(str(item["project"]), session_id, document_set)].append(item)
        else:
            ungrouped[str(item["project"])].append(item)

    raw_groups: list[dict[str, object]] = []
    for (project, session_id, document_set), items in known_groups.items():
        raw_groups.append(
            {
                "project": project,
                "session_id": session_id,
                "key": document_set,
                "title": classification_label(document_set),
                "completeness": str(items[0].get("completeness") or "NOT_VERIFIED"),
                "items": sorted(items, key=lambda item: str(item["captured_at"])),
                "group_method": "zarejestrowany zestaw dokumentów",
            }
        )

    for project, items in ungrouped.items():
        ordered = sorted(items, key=lambda item: str(item["captured_at"]))
        sequences: list[list[dict[str, object]]] = []
        for item in ordered:
            if not sequences:
                sequences.append([item])
                continue
            current = datetime.fromisoformat(str(item["captured_at"]))
            previous = datetime.fromisoformat(str(sequences[-1][-1]["captured_at"]))
            if (current - previous).total_seconds() > 180:
                sequences.append([item])
            else:
                sequences[-1].append(item)
        for index, sequence in enumerate(sequences, start=1):
            start = datetime.fromisoformat(str(sequence[0]["captured_at"]))
            raw_groups.append(
                {
                    "project": project,
                    "session_id": "",
                    "key": f"AUTO-{start:%Y%m%d-%H%M%S}-{index:03d}",
                    "title": f"Sekwencja rysunków · {start:%d.%m.%Y %H:%M}",
                    "completeness": "NOT_VERIFIED",
                    "items": sequence,
                    "group_method": "sekwencja czasowa; przerwa maks. 3 min",
                }
            )

    groups: list[dict[str, object]] = []
    for index, group in enumerate(
        sorted(raw_groups, key=lambda item: str(item["items"][0]["captured_at"]), reverse=True),
        start=1,
    ):
        items = list(group["items"])
        project = str(group["project"])
        times = [datetime.fromisoformat(str(item["captured_at"])) for item in items]
        midpoint = times[0] + (times[-1] - times[0]) / 2
        session_id = str(group["session_id"])
        if session_id:
            candidates = list(physical_by_session.get((project, session_id), []))
            relation_basis = "wspólna sesja fotograficzna"
        else:
            candidates = [
                item
                for item in physical_by_project[project]
                if abs((datetime.fromisoformat(str(item["captured_at"])) - midpoint).total_seconds()) <= 1800
            ]
            relation_basis = "sąsiedztwo czasowe do 30 min"
        candidates.sort(
            key=lambda item: abs(
                (datetime.fromisoformat(str(item["captured_at"])) - midpoint).total_seconds()
            )
        )
        related = candidates[:12]
        group_id = f"set-{index:03d}"
        groups.append(
            {
                "id": group_id,
                "project": project,
                "title": group["title"],
                "group_method": group["group_method"],
                "completeness": group["completeness"],
                "captured_from": min(times).isoformat(timespec="seconds"),
                "captured_to": max(times).isoformat(timespec="seconds"),
                "schematic_ids": [item["id"] for item in items],
                "related_ids": [item["id"] for item in related],
                "relation_basis": relation_basis if related else "brak kandydatów w tej sesji czasowej",
                "relation_status": "INTERPRETACJA — wymaga potwierdzenia tagiem i zatwierdzonym rysunkiem",
            }
        )

    project_payload = []
    for project_id, project_name in PROJECTS.items():
        project_records = [item for item in records if item["project"] == project_id]
        categories = Counter(str(item["category"]) for item in project_records)
        project_payload.append(
            {
                "id": project_id,
                "name": project_name,
                "photos": len(project_records),
                "schematics": sum(1 for item in project_records if item["kind"] == "schematic"),
                "other": sum(1 for item in project_records if item["kind"] == "photo"),
                "sets": sum(1 for item in groups if item["project"] == project_id),
                "categories": [
                    {
                        "id": category,
                        "label": CATEGORY_META[category][0],
                        "count": categories[category],
                    }
                    for category in CATEGORY_META
                    if categories[category]
                ],
            }
        )

    catalog: dict[str, object] = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "privacy": {
            "mode": "local-only",
            "host": "127.0.0.1",
            "excluded_restricted": excluded_restricted,
            "notice": "Zdjęcia są serwowane wyłącznie lokalnie i nie trafiają do GitHub Pages.",
        },
        "methodology": {
            "fact": "Projekt, plik, data z nazwy, kategoria, integralność i zapisany zestaw dokumentów.",
            "interpretation": "Opis kategorii oraz kandydaci powiązania schematu z elementem przez wspólną sesję lub bliskość czasu.",
            "limitation": "Identyfikację urządzenia i relację wykonawczą trzeba potwierdzić tagiem, numerem rysunku i aktualną dokumentacją.",
        },
        "summary": {
            "source_rows": source_rows,
            "visible_photos": len(records),
            "schematics": sum(1 for item in records if item["kind"] == "schematic"),
            "other": sum(1 for item in records if item["kind"] == "photo"),
            "document_sets": len(groups),
            "curated_descriptions": sum(1 for item in records if item["description_level"] == "curated"),
        },
        "projects": project_payload,
        "document_sets": groups,
        "photos": records,
    }

    for group in groups:
        for item_id in list(group["schematic_ids"]) + list(group["related_ids"]):
            if item_id not in record_by_id:
                raise RuntimeError(f"Relacja wskazuje brakujący rekord: {item_id}")
    return catalog, source_index


def validate_catalog(catalog: dict[str, object], source_index: dict[tuple[str, str], Path]) -> None:
    summary = catalog["summary"]
    photos = catalog["photos"]
    groups = catalog["document_sets"]
    if summary["source_rows"] != 1370:
        raise RuntimeError(f"Oczekiwano 1370 rekordów źródłowych, jest {summary['source_rows']}")
    if summary["visible_photos"] != 1369:
        raise RuntimeError(f"Oczekiwano 1369 bezpiecznych zdjęć, jest {summary['visible_photos']}")
    if catalog["privacy"]["excluded_restricted"] != 1:
        raise RuntimeError("Nie potwierdzono wykluczenia jednego rekordu wrażliwego")
    if len(source_index) != len(photos):
        raise RuntimeError("Niespójny indeks zdjęć źródłowych")
    if any(item["category"] == "99_Restricted_sensitive" for item in photos):
        raise RuntimeError("Materiał wrażliwy trafił do katalogu")
    if summary["curated_descriptions"] != 30:
        raise RuntimeError(f"Oczekiwano 30 opisów szczegółowych, jest {summary['curated_descriptions']}")
    if not groups or any(not group["schematic_ids"] for group in groups):
        raise RuntimeError("Brak kompletnych grup dokumentacji")
    if any(record["kind"] == "schematic" for group in groups for record in photos if record["id"] in group["related_ids"]):
        raise RuntimeError("Schemat został błędnie przypisany jako element fizyczny")

    required_files = [
        VIEWER / "index.html",
        VIEWER / "assets" / "styles.css",
        VIEWER / "assets" / "app.js",
    ]
    for path in required_files:
        if not path.is_file() or not path.read_text(encoding="utf-8").strip():
            raise RuntimeError(f"Brak pliku interfejsu: {path}")
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    for marker in ("Schematy i elementy powiązane", "Pozostałe zdjęcia", "photo-dialog"):
        if marker not in html:
            raise RuntimeError(f"Brak elementu interfejsu: {marker}")


def make_thumbnail(source: Path, target: Path) -> None:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        tools_lib = SOURCE / "tools" / "python-lib"
        if str(tools_lib) not in sys.path:
            sys.path.append(str(tools_lib))
        from PIL import Image, ImageOps

    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_mtime_ns >= source.stat().st_mtime_ns:
        return
    temporary = target.with_suffix(".tmp")
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((720, 540), Image.Resampling.LANCZOS)
        image.save(temporary, "WEBP", quality=78, method=4)
    temporary.replace(target)


def handler_factory(catalog: dict[str, object], source_index: dict[tuple[str, str], Path]):
    catalog_bytes = json.dumps(catalog, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    class ViewerHandler(BaseHTTPRequestHandler):
        server_version = "BATTBYGPhotoViewer/1.0"

        def log_message(self, fmt: str, *args: object) -> None:
            print(f"[{self.log_date_time_string()}] {fmt % args}")

        def end_headers(self) -> None:
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'",
            )
            super().end_headers()

        def send_bytes(self, payload: bytes, content_type: str, cache: str = "no-store") -> None:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", cache)
            self.end_headers()
            self.wfile.write(payload)

        def send_path(self, path: Path, content_type: str, cache: str) -> None:
            payload = path.read_bytes()
            self.send_bytes(payload, content_type, cache)

        def do_GET(self) -> None:
            request_path = unquote(urlparse(self.path).path)
            if request_path in ("/", "/index.html"):
                self.send_path(VIEWER / "index.html", "text/html; charset=utf-8", "no-store")
                return
            if request_path == "/assets/styles.css":
                self.send_path(VIEWER / "assets" / "styles.css", "text/css; charset=utf-8", "no-store")
                return
            if request_path == "/assets/app.js":
                self.send_path(VIEWER / "assets" / "app.js", "text/javascript; charset=utf-8", "no-store")
                return
            if request_path == "/data/catalog.json":
                self.send_bytes(catalog_bytes, "application/json; charset=utf-8")
                return
            if request_path.startswith("/photos/"):
                parts = request_path.split("/", 3)
                if len(parts) == 4:
                    source = source_index.get((parts[2], parts[3]))
                    if source:
                        self.send_path(source, "image/jpeg", "private, max-age=3600")
                        return
            if request_path.startswith("/thumbs/") and request_path.endswith(".webp"):
                parts = request_path.split("/", 3)
                if len(parts) == 4:
                    project = parts[2]
                    file_name = parts[3][:-5]
                    source = source_index.get((project, file_name))
                    if source:
                        target = THUMBNAILS / project / f"{file_name}.webp"
                        try:
                            make_thumbnail(source, target)
                            self.send_path(target, "image/webp", "private, max-age=86400")
                        except Exception as exc:
                            traceback.print_exc()
                            self.send_error(500, f"Błąd miniatury: {type(exc).__name__}")
                        return
            self.send_error(404, "Nie znaleziono zasobu")

    return ViewerHandler


def serve(catalog: dict[str, object], source_index: dict[tuple[str, str], Path], port: int, open_browser: bool) -> None:
    server = None
    for candidate in range(port, port + 10):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), handler_factory(catalog, source_index))
            port = candidate
            break
        except OSError:
            continue
    if server is None:
        raise RuntimeError(f"Brak wolnego portu w zakresie {port}-{port + 9}")
    url = f"http://127.0.0.1:{port}/"
    print(f"BATTBYG_PHOTO_VIEWER_READY {url}")
    print("Zatrzymanie: Ctrl+C")
    if open_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("BATTBYG_PHOTO_VIEWER_STOPPED")
    finally:
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Lokalna przeglądarka zdjęć BATTBYG")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--port", type=int, default=4180)
    args = parser.parse_args()

    catalog, source_index = build_catalog()
    validate_catalog(catalog, source_index)
    summary = catalog["summary"]
    print(
        "PHOTO_VIEWER_VALIDATION_OK "
        f"visible={summary['visible_photos']} schematics={summary['schematics']} "
        f"other={summary['other']} sets={summary['document_sets']} "
        f"curated={summary['curated_descriptions']} "
        f"restricted_excluded={catalog['privacy']['excluded_restricted']}"
    )
    if not args.validate_only:
        serve(catalog, source_index, args.port, not args.no_browser)


if __name__ == "__main__":
    main()
