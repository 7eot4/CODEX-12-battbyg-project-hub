# BATTBYG Project Hub - instrukcje

## Cel

Repozytorium publikuje osobisty warsztat nauki zawodowej: ręcznie redagowany
słownik, definicje, fiszki i lokalny dziennik. Dane źródłowe pozostają poza stroną.

## Aktualizacja

1. Uruchom `python tools/build_site.py`.
2. Uruchom `python tools/validate_site.py`.
3. Sprawdź stronę lokalnie na serwerze HTTP w widoku desktopowym i mobilnym.
4. Dopiero po pozytywnej kontroli wykonaj commit i push do `main`.
5. Zweryfikuj workflow GitHub Pages dla dokładnego SHA oraz odpowiedź HTTP 200.

## Granica publikacji

- Nie kopiuj dokumentacji klienta, materiałów źródłowych, pełnych rejestrów ani SHA-256.
- Nie publikuj danych prywatnych, kwalifikacyjnych, kontaktowych ani wrażliwych.
- Nie publikuj dokładnych tras kablowych, nastaw, konfiguracji zabezpieczeń ani
  informacji mogących ułatwić dostęp do systemów jednostki.
- Publiczny model nie może zawierać liczników ani metadanych materiałów źródłowych.
- Wnioski techniczne oznaczaj jako edukacyjne i wymagające potwierdzenia
  zatwierdzoną dokumentacją projektu.

## Źródło prawdy

- `tools/build_site.py` - ręcznie określone konteksty jednostek i obszary nauki;
- `../battbygg/output/pdf/BATTBYG_learning_package/terminology_EN_NO_PL.csv` -
  bazowy słownik EN–NO–PL;
- `knowledge/definitions_PL.csv` - autorskie definicje i kontekst praktyczny.

Nie edytuj ręcznie `docs/data/site-data.json`; jest generowany ze źródeł.
