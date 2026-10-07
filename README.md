# BATTBYG Project Hub

Publiczny, zanonimizowany panel wiedzy o projektach okrętowych BATTBYG.

Strona udostępnia jedną wyszukiwarkę projektów, obszarów technicznych i pojęć
EN–NO–PL. Wynik pojęcia prowadzi bezpośrednio do właściwej fiszki z tłumaczeniem,
definicją i kontekstem użycia na statku. Ma także prywatny dziennik przeglądarkowy
z rozdzieleniem faktu, interpretacji i elementu do weryfikacji oraz eksportem do
Markdown. Grafika stoczniowa w nagłówku jest wygenerowaną ilustracją kontekstową
i nie przedstawia żadnego konkretnego projektu ani materiału dowodowego BATTBYG.

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
fiszki EN/NO → PL, losowanie kolejności przy każdym wejściu, cofanie fiszki,
filtry dziedzin i odsłuch z automatycznym doborem kobiecego głosu oraz regulacją
tempa. Dostępność konkretnego głosu zależy od systemu i przeglądarki. Pełny
słownik EN–NO–PL zachowuje podstawę przypisania. Źródłem jest
`../battbygg/output/pdf/BATTBYG_learning_package/terminology_EN_NO_PL.csv`;
generator wymaga dokładnie 77 unikalnych terminów.

Każdy z 77 terminów ma polską definicję edukacyjną i praktyczny kontekst zapisany
w `knowledge/definitions_PL.csv`. Generator wymaga pełnej zgodności kluczy ze
słownikiem źródłowym. Data dodania definicji, status i źródła referencyjne są
publikowane razem z danymi. Definicje nie zastępują aktualnych instrukcji,
rysunków, procedur stoczni ani dokumentów klasyfikacyjnych.

## Dziennik i poradnik

Dziennik zapisuje maksymalnie 500 wpisów wyłącznie w `localStorage` danej
przeglądarki. Każdy wpis ma rodzaj, projekt, obszar, datę zdarzenia lub źródła
oraz niezależny czas lokalnego zapisu. Eksport Markdown pozwala utworzyć kopię
poza przeglądarką. Dane nie są synchronizowane między urządzeniami ani wysyłane
do GitHub Pages.

## Prywatny podgląd zdjęć

Uruchom `Start-BattbygPhotoViewer.ps1`. Przeglądarka lokalna rozdziela schematy
i dokumenty od pozostałych zdjęć, pokazuje kandydatów na elementy powiązane oraz
opisuje źródło, datę analizy, klasę twierdzenia i ograniczenia. Serwer nasłuchuje
wyłącznie na `127.0.0.1`; zdjęcia ani rejestry źródłowe nie trafiają do GitHub
Pages. Walidacja lokalna obejmuje wszystkie jawne rekordy i wyklucza kategorię
zastrzeżoną.

## Podgląd lokalny

```powershell
python -m http.server 4173 --directory docs
```

Otwórz `http://127.0.0.1:4173/`.

## Publikacja

Push do `main` uruchamia `.github/workflows/deploy-pages.yml`. Workflow waliduje
gotowy, bezpieczny snapshot i publikuje katalog `docs/` w GitHub Pages.
