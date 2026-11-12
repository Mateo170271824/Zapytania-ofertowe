# Zapytania ofertowe

Aplikacja zastępująca plik „Zapytania Lista 2026.xlsm”. Logika jest przeniesiona 1:1 z makr pliku.

- **Generator** – wczytanie eksportu z Subiekta nexo, wyliczenie braków (grupy, słowa kluczowe, minimalne ilości, paczki), utworzenie zapytania NNN-RRRR i danych projektu.
- **Zapytania** – arkusz jak w Excelu: pozycje w kolumnie A, dostawcy w wierszu 1, ceny jednostkowe, działania (=2,93*4,25), komentarze, najniższa cena na zielono, najwyższa na czerwono, wybór dostawcy kolorem.
- **Mail do dostawców** – temat i treść z ustawień, dostawcy w UDW, otwarcie w programie pocztowym.
- **Waga dla logistyki** – wagi z tabeli WAGI (z Kalkulatora stali) wg dostawcy zaznaczonego kolorem.
- **Koszt projektu** – magazyn wg ceny ostatniego zakupu, zakup wg wybranego dostawcy (profile/rury za mb, reszta za kg), tylko ilość potrzebna na projekt; PDF w układzie „Wycena wewnętrzna”.
- **Ceny** – baza cen materiałów z listy „Surowiec” z Subiekta i z zakupów (zł/kg, zł/mb, zł/szt), zestawienie roczne.
- **Zamówienia** – po wyborze dostawcy: zamówiono (nr, data) → dostawa w Logistyce (trafia do biura jako „🛒 do uzupełnienia”) → dostarczono (status wraca z Logistyki).
- **Kopia zapasowa** – Ustawienia → Kopia zapasowa: Excel do przeglądania i plik .json do przywrócenia. Automat w repo Logistyka robi to samo w każdy poniedziałek (Actions → „Kopia Zapytań ofertowych”, 90 dni).
- **Zastępstwa** – właściciel nadaje dostęp na czas urlopu, każda zmiana trafia do Dziennika zmian.

## Na telefonie

| Gdzie | Jak |
|---|---|
| **Aplikacja (SteelFlow)** | **https://steel-flow.web.app/zapytania/** – w Chrome „Zainstaluj” dodaje ikonę Zapytań. Stary adres GitHub Pages tylko przekierowuje. |
| **iPhone** | https://steel-flow.web.app/zapytania/ → Udostępnij → „Do ekranu początkowego” |

APK (Capacitor, jak Kalkulator stali) otwiera aktualną stronę aplikacji, więc zmiany w Zapytaniach są od razu w telefonie – nowe APK potrzebne jest tylko przy zmianach w `android/`. Pliki (PDF, Excel, kopia) w APK zapisuje się przez okno „Udostępnij”.

Automat `android.yml` buduje APK i wystawia je w Releases (tag `android`). Podpis: sekrety repozytorium `ANDROID_KEYSTORE_BASE64` i `ANDROID_KEYSTORE_PASSWORD` – **te same wartości co w repo Kalkulator-stali** (alias klucza `kalkulator`; inny można podać w `ANDROID_KEY_ALIAS`). Bez nich APK jest budowane tylko próbnie (Actions → Artifacts).

## Pliki

| Plik | Co robi |
|---|---|
| `js/logika.js` | logika przeniesiona z makr (generator, wagi, koszt projektu) – bez interfejsu |
| `js/ceny.js` | baza cen: rozpoznanie wyrobu, przeliczenia zł/kg–mb–szt, lista z Subiekta |
| `js/zamowienia.js` | zamówienia i dostawa w formacie Logistyki |
| `js/kopia.js` | kopia zapasowa (JSON + Excel); używa jej też automat w repo Logistyka |
| `js/import-excel.js` | import starego pliku .xlsm |
| `js/pdf.js` | PDF „Wycena wewnętrzna” |
| `js/baza.js` | połączenie z Firebase |
| `js/ui.js` | formatowanie liczb i dat, okna, komunikaty, pliki |
| `js/app.js` | widoki i obsługa ekranu |
| `vendor/` | SheetJS, jsPDF, czcionka |
| `js/pomoc.js` | pomoc w aplikacji (przycisk „Pomoc”) i skrót dla zastępcy |
| `tests/` | testy obliczeń (`npm test`) i test ekranowy całej aplikacji (`tests/e2e`) |

## Praca nad aplikacją

- Testy obliczeń: `npm test` (Node 22, bez instalowania pakietów).
- Test ekranowy: `npm run test:e2e` – emulator bazy + przeglądarka przechodzą całą ścieżkę: eksport z Subiekta → zapytanie → mail → ceny i wybór dostawcy → zamówienie i dostawa w Logistyce → zapytanie na magazyn → kopia i przywrócenie → zastępstwo. Wymaga Javy oraz `npm i --no-save firebase-tools@13.29.1 firebase@10.12.2 @firebase/rules-unit-testing@3.0.4 playwright@1.63.0`.
- Automat publikacji uruchamia oba rodzaje testów przed każdą publikacją – jeśli któryś nie przejdzie, strona się nie zmienia. Dane w testach są wymyślone.
- **Reguły dostępu do bazy** są tylko w repo Logistyka (`firestore.rules`, blok „Zapytania ofertowe”), razem z testami (`tests/rules.test.mjs`). Publikuje je tamtejszy automat „Wydanie”. Test ekranowy tutaj używa uproszczonych reguł (`tests/e2e/firestore.rules`).
- Podgląd lokalnie: `python3 -m http.server` w katalogu repo; `index.html?emu` łączy z emulatorem Firebase (auth 9099, firestore 8085).
- Wersje plików (`?v=…` w importach) ustawia automat publikacji – nie trzeba ich zmieniać ręcznie.
- Repo jest publiczne: żadnych plików Excel, eksportów ani kopii z danymi firmy (blokuje je `.gitignore`).

Baza: Firebase projektu Truck App / Kooperacje (te same konta). Dane firmowe (ceny, dostawcy, projekty) są tylko w bazie – nie w tym repozytorium.
