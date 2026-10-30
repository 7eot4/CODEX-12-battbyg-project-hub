# BATTBYG Project Hub

Osobisty warsztat nauki zawodowej w środowisku stoczniowym BATTBYG.

Strona łączy samodzielnie redagowany słownik EN–NO–PL, autorskie definicje,
fiszki, prywatny dziennik przeglądarkowy i prosty poradnik pracy inżynierskiej.
Wpisy słownikowe, objaśnienia oraz konteksty nauki są dodawane ręcznie.
Datowany dziennik rozwoju pokazuje kolejne etapy budowy warsztatu od pierwszej
wersji przez fiszki i definicje po pełny interfejs PL/EN.

Grafika w nagłówku jest wygenerowaną ilustracją i nie przedstawia konkretnego
projektu. Publiczna strona nie zawiera dokumentacji klienta, danych prywatnych,
rysunków ani materiałów źródłowych z realizowanych projektów.

Interfejs działa po polsku i angielsku. Wybór `PL / EN` jest zapamiętywany
lokalnie pod kluczem `battbyg-ui-language-v1`. Definicje i kontekst praktyczny
pozostają po polsku, ponieważ są częścią materiału EN/NO → PL.

## Aktualizacja danych

```powershell
powershell -ExecutionPolicy Bypass -File tools\Update-BattbygSite.ps1
```

Generator łączy ręcznie określone konteksty jednostek, bazowy słownik oraz
autorskie definicje i zapisuje publiczny model do `docs/data/site-data.json`.
Model publiczny nie zawiera liczników ani metadanych materiałów źródłowych.

## Nauka języków technicznych

Materiał obejmuje fiszki EN/NO → PL, losowanie kolejności przy każdym wejściu,
cofanie fiszki, filtry dziedzin, kobiecy głos lektora i regulację tempa.
Dostępność konkretnego głosu zależy od systemu i przeglądarki.

Każdy z 77 terminów ma polską definicję edukacyjną, praktyczny kontekst, datę
opracowania i źródła referencyjne. Definicje nie zastępują aktualnych instrukcji,
rysunków, procedur stoczni ani dokumentów klasyfikacyjnych.

## Dziennik i poradnik

Dziennik zapisuje maksymalnie 500 wpisów wyłącznie w `localStorage` danej
przeglądarki. Każdy wpis ma rodzaj, kontekst jednostki, obszar, datę zdarzenia lub
źródła oraz niezależny czas lokalnego zapisu. Dane nie są wysyłane do GitHub Pages.

## Podgląd lokalny

```powershell
python -m http.server 4173 --directory docs
```

Otwórz `http://127.0.0.1:4173/`.

## Publikacja

Push do `main` uruchamia `.github/workflows/deploy-pages.yml`. Workflow waliduje
bezpieczny snapshot i publikuje katalog `docs/` w GitHub Pages.
