# BATTBYG Project Hub - instrukcje

## Cel

Repozytorium publikuje wyłącznie bezpieczne, zagregowane informacje o projektach
okrętowych BATTBYG. Dane źródłowe pozostają lokalnie w `../battbygg`.

## Aktualizacja

1. Uruchom `python tools/build_site.py`.
2. Uruchom `python tools/validate_site.py`.
3. Sprawdź stronę lokalnie na serwerze HTTP w widoku desktopowym i mobilnym.
4. Dopiero po pozytywnej kontroli wykonaj commit i push do `main`.
5. Zweryfikuj workflow GitHub Pages dla dokładnego SHA oraz odpowiedź HTTP 200.

## Granica publikacji

- Nie kopiuj zdjęć, rysunków, PDF-ów, pełnych rejestrów CSV ani pełnych SHA-256.
- Nie publikuj danych prywatnych, kwalifikacyjnych, kontaktowych ani wrażliwych.
- Nie publikuj dokładnych tras kablowych, nastaw, konfiguracji zabezpieczeń ani
  informacji mogących ułatwić dostęp do systemów jednostki.
- Kategorie `99_Restricted_sensitive` pomijaj w publicznych rozkładach.
- Wnioski oparte na zdjęciach oznaczaj jako robocze i wymagające potwierdzenia
  zatwierdzoną dokumentacją.

## Źródło prawdy

- `../battbygg/projects/*/project_register.csv` - liczniki projektów i kategorii;
- `../battbygg/UPDATE_LOG.csv` - historia aktualizacji;
- `../battbygg/PROJECT_GUIDELINES.md` - metodologia i ograniczenia.

Nie edytuj ręcznie `docs/data/site-data.json`; jest generowany ze źródeł.
