# BATTBYG Project Hub

Publiczny, zanonimizowany panel wiedzy o projektach okrętowych BATTBYG.

## Aktualizacja danych

```powershell
powershell -ExecutionPolicy Bypass -File tools\Update-BattbygSite.ps1
```

Generator czyta lokalne rejestry z `../battbygg` i zapisuje wyłącznie agregaty
do `docs/data/site-data.json`. Zdjęcia, rysunki, PDF-y, pełne skróty SHA-256 i
materiały wrażliwe nie są publikowane.

## Podgląd lokalny

```powershell
python -m http.server 4173 --directory docs
```

Otwórz `http://127.0.0.1:4173/`.

## Publikacja

Push do `main` uruchamia `.github/workflows/deploy-pages.yml`. Workflow waliduje
gotowy, bezpieczny snapshot i publikuje katalog `docs/` w GitHub Pages.
