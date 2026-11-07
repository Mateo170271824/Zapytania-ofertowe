/* Pomoc w aplikacji: opis każdej zakładki (przycisk „Pomoc” w nagłówku) i skrót dla zastępcy. */

export const POMOC = {
  generator: {
    t: "Generator – zapytanie z braków w Subiekcie",
    h: `<ol>
      <li>W Subiekcie zrób eksport braków do Excela i wybierz go przyciskiem <b>Wczytaj eksport</b>. Kod klienta bierze się z nazwy pliku (można go poprawić).</li>
      <li>Aplikacja sama ustawia <b>ZAPYTAĆ? = TAK</b> według grup i minimalnych ilości z Ustawień. Możesz to zmienić w każdym wierszu, a w kolumnie <b>ILOŚĆ DO ZAPYTANIA</b> wpisać inną ilość.</li>
      <li><b>Utwórz zapytanie</b> – powstaje arkusz NNN-RRRR z pozycjami na TAK i dane projektu (do kosztu projektu).</li>
    </ol>
    <p>Zapytanie bez Subiekta (np. na magazyn albo obejmy, wypałki): <b>Zapytania → Nowe zapytanie (lista / własne pozycje)</b> – pozycje z bazy cen albo wpisane ręcznie.</p>`,
  },
  zapytania: {
    t: "Zapytania – lista",
    h: `<ul>
      <li>Najnowsze na górze. Szukaj po numerze, kliencie, dostawcy albo nazwie pozycji; <b>Enter</b> otwiera pierwsze trafienie.</li>
      <li>Pod numerem: liczba pozycji, dostawców, wybrani dostawcy (kolor) i stan zamówień.</li>
      <li><b>Nowe zapytanie</b> – na magazyn albo dowolne pozycje bez eksportu z Subiekta.</li>
    </ul>`,
  },
  z: {
    t: "Arkusz zapytania",
    h: `<ul>
      <li>Działa jak arkusz w Excelu: pozycje w kolumnie A, dostawcy w wierszu 1, ceny w komórkach. Strzałki, Tab i Enter przechodzą po komórkach; można wpisać działanie, np. <b>=2,93*4,25</b>.</li>
      <li>Najniższa cena w wierszu jest zielona, najwyższa czerwona.</li>
      <li><b>Wybór dostawcy</b>: kliknij nazwę dostawcy i nadaj mu kolor, potem zaznacz tym kolorem pozycje (całą kolumnę A albo pojedynczą komórkę). Opcje komórki (kolor, komentarz) są na pasku nad arkuszem.</li>
      <li><b>Mail do dostawców</b> – temat i treść z Ustawień, adresy w UDW.</li>
      <li><b>Waga dla logistyki</b> – waga każdego dostawcy z tabeli WAGI. Gdy brakuje wymiaru, aplikacja pyta raz i zapamiętuje odpowiedź.</li>
      <li><b>Zamówienia</b> (pod arkuszem): po wyborze dostawcy wpisz numer ZD, potem <b>Utwórz dostawę w Logistyce</b> – biuro zobaczy ją jako „🛒 do uzupełnienia”. Status „dostarczono” wraca z Logistyki sam.</li>
      <li>Zapis jest automatyczny. Historia zmian tego zapytania jest na dole.</li>
    </ul>`,
  },
  waga: { t: "Waga dla logistyki", h: `<p>Suma wag pozycji zaznaczonych kolorem każdego dostawcy. Wagi metra bierze z tabeli <b>WAGI</b> (Ustawienia). Pozycje bez wagi są wypisane osobno – uzupełnij je w tabeli WAGI.</p>` },
  projekty: {
    t: "Projekty",
    h: `<ul>
      <li>Projekt powstaje razem z zapytaniem z Generatora (pozycje i ilości z Subiekta).</li>
      <li><b>Koszt projektu</b>: magazyn liczony po cenie ostatniego zakupu, zakup – po cenie wybranego dostawcy (profile i rury za mb, reszta za kg), tylko ilość potrzebna na projekt. Z kosztu robi się PDF „Wycena wewnętrzna”.</li>
    </ul>`,
  },
  koszt: { t: "Koszt projektu", h: `<p>Magazyn po cenie ostatniego zakupu, zakup po cenie wybranego dostawcy (profile i rury za mb, reszta za kg). Pozycje bez wybranego dostawcy są oznaczone. <b>PDF</b> drukuje „Wycenę wewnętrzną”.</p>` },
  ceny: {
    t: "Ceny materiałów",
    h: `<ul>
      <li><b>Wgraj listę</b> – lista „Surowiec” z Subiekta (Symbol, Rodzaj, Nazwa, Cena). Nowe pozycje dopisują się same, zmienione ceny trafiają do historii.</li>
      <li>Nowe pozycje dopisują się do bazy też same: z eksportu w Generatorze (z ceną zakupu) i przy zamówieniu w zapytaniu (z ceną zamówioną) – także wpisane ręcznie profile, IPE itd.</li>
      <li>Pomijane: rodzaj KT, wypałki, wózki podwieszane, powtórzone nazwy. Pręty zawsze za kg.</li>
      <li>Ceny pokazane w zł/kg, zł/mb i zł/szt. Gdy aplikacja nie jest pewna jednostki, pozycja trafia do <b>Do sprawdzenia</b> – wybierz jednostkę albo pomiń.</li>
      <li><b>Zestawienie roczne</b> – jak zmieniały się ceny w kolejnych miesiącach.</li>
    </ul>`,
  },
  ustawienia: {
    t: "Ustawienia",
    h: `<ul>
      <li><b>Grupy i słowa kluczowe</b> – do której grupy trafia pozycja z Subiekta, czy ją uwzględniać i od jakiej ilości.</li>
      <li><b>Dostawcy</b> – adresy e-mail do zapytań (WYSYŁAJ? = TAK).</li>
      <li><b>WAGI</b> – kg/mb profili, rur, kształtowników; zapamiętane odpowiedzi (paczki, arkusze).</li>
      <li><b>Kopia zapasowa</b> – Excel do przeglądania i plik do przywrócenia. Automatyczna kopia robi się co poniedziałek.</li>
      <li><b>Wygląd</b> – kolorystyka aplikacji. <b>Dziennik zmian</b> – wszystkie zmiany, także zastępców.</li>
    </ul>`,
  },
  dziennik: { t: "Dziennik zmian", h: `<p>Każda zmiana zapytań, projektów i ustawień: kto, kiedy, co było, co jest. Zmiany zastępców są wyróżnione – odhacz <b>przejrzane</b> po powrocie z urlopu. Wpisów nie da się usunąć.</p>` },
  dostep: { t: "Dostęp na zastępstwo", h: `<p>Wybierz konto biura i daty od–do. Zastępca widzi i zmienia wszystko oprócz tej zakładki; dostęp kończy się sam ostatniego dnia albo po <b>Odbierz teraz</b>. Jego zmiany zbiera Dziennik zmian.</p>` },
};

export const START_ZASTEPCY = `<h3>Zastępstwo – od czego zacząć</h3>
  <ol>
    <li><b>Zapytania</b> – lista wszystkich zapytań; otwórz numer, wpisuj ceny od dostawców w kolumnach.</li>
    <li>Wybór dostawcy: kliknij nazwę dostawcy w wierszu 1, nadaj kolor, zaznacz nim pozycje.</li>
    <li>Pod arkuszem <b>Zamówienia</b>: numer ZD, potem „Utwórz dostawę w Logistyce”.</li>
    <li>Nowe zapytanie z braków: <b>Generator</b> (eksport z Subiekta). Na magazyn albo ręcznie: <b>Zapytania → Nowe zapytanie</b>.</li>
  </ol>
  <p class="small">Wszystko zapisuje się samo, a każda zmiana trafia do dziennika właściciela. Przycisk <b>Pomoc</b> u góry opisuje bieżącą zakładkę.</p>`;

export function trescPomocy(nazwa, isOwner) {
  const p = POMOC[nazwa] || POMOC.zapytania;
  const inne = Object.entries(POMOC).filter(([k]) => k !== nazwa && !["waga", "koszt", "dziennik"].includes(k) && (isOwner || k !== "dostep"));
  return `<h3>${p.t}</h3><div class="pomoc">${p.h}</div>
    <details class="pomoc-inne"><summary>Pozostałe zakładki</summary>${inne.map(([, x]) => `<h4>${x.t}</h4><div class="pomoc">${x.h}</div>`).join("")}</details>`;
}
