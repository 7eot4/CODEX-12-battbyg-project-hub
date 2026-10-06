# BATTBYG Project Hub

Publiczny, zanonimizowany panel wiedzy o projektach okrętowych BATTBYG.

## Aktualizacja danych

```powershell
powershell -ExecutionPolicy Bypass -File tools\Update-BattbygSite.ps1
```

Generator czyta lokalne rejestry z `../battbygg` i zapisuje wyłącznie agregaty
do `docs/data/site-data.json`. Zdjęcia, rysunki, PDF-y, pełne skróty SHA-256 i
materiały wrażliwe nie są publikowane.

## Nauka języków technicznych

Każdy projekt ma własny zestaw terminów angielskich i norweskich, przypisany na
podstawie kategorii obecnych w zweryfikowanym rejestrze zdjęć. Materiał obejmuje
fiszki EN/NO → PL, filtry dziedzin, odsłuch dostępny w obsługiwanych
przeglądarkach oraz pełny słownik EN–NO–PL z podstawą przypisania. Źródłem jest
`../battbygg/output/pdf/BATTBYG_learning_package/terminology_EN_NO_PL.csv`;
generator wymaga dokładnie 77 unikalnych terminów.

## Podgląd lokalny

```powershell
python -m http.server 4173 --directory docs
```

Otwórz `http://127.0.0.1:4173/`.

## Publikacja

Push do `main` uruchamia `.github/workflows/deploy-pages.yml`. Workflow waliduje
gotowy, bezpieczny snapshot i publikuje katalog `docs/` w GitHub Pages.
