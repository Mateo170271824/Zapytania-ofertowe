# Zapytania ofertowe

Aplikacja zastępująca plik „Zapytania Lista 2026.xlsm”. Logika jest przeniesiona 1:1 z makr pliku.

- **Generator** – wczytanie eksportu z Subiekta nexo, wyliczenie braków (grupy, słowa kluczowe, minimalne ilości, paczki), utworzenie zapytania NNN-RRRR i danych projektu.
- **Zapytania** – arkusz jak w Excelu: pozycje w kolumnie A, dostawcy w wierszu 1, ceny jednostkowe, działania (=2,93*4,25), komentarze, najniższa cena na zielono, najwyższa na czerwono, wybór dostawcy kolorem.
- **Mail do dostawców** – temat i treść z ustawień, dostawcy w UDW, otwarcie w programie pocztowym.
- **Waga dla logistyki** – wagi z tabeli WAGI (z Kalkulatora stali) wg dostawcy zaznaczonego kolorem.
- **Koszt projektu** – magazyn wg ceny ostatniego zakupu, zakup wg wybranego dostawcy (profile/rury za mb, reszta za kg), tylko ilość potrzebna na projekt; PDF w układzie „Wycena wewnętrzna”.
- **Zastępstwa** – właściciel nadaje dostęp na czas urlopu, każda zmiana trafia do Dziennika zmian.

Pliki: `index.html`, `css/`, `js/logika.js` (logika makr), `js/import-excel.js` (import pliku .xlsm), `js/app.js` (interfejs), `js/pdf.js` (PDF), `vendor/` (SheetJS, jsPDF, czcionka), `firestore-zapytania.rules` (reguły bazy – do wgrania w repo Logistyka).

Baza: Firebase projektu Truck App / Kooperacje (te same konta). Dane firmowe (ceny, dostawcy, projekty) są tylko w bazie – nie w tym repozytorium.
