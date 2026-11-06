/* Kopia zapasowa danych Zapytań ofertowych.
   - kopiaJSON(): pełne dane do przywrócenia (zapytania, projekty, ceny, ustawienia, wagi, lista generatora)
   - kopiaExcel(): ten sam stan do przeglądania – każde zapytanie jako osobny arkusz (jak w starym pliku .xlsm)
   Moduł bez zależności – używa go aplikacja (przycisk w Ustawieniach) i cotygodniowy automat w repo Logistyka. */

export const FORMAT = "zapytania-ofertowe-kopia";
// znaczniki czasu Firestore -> tekst ISO (żeby kopia była zwykłym JSON-em)
export function bezCzasu(v) {
  if (v && typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(bezCzasu);
  if (v && typeof v === "object" && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bezCzasu(x)]));
  if (v instanceof Date) return v.toISOString();
  return v;
}
// identyfikator dokumentu osobno w „_doc” (projekty mają własne pole „id” = nazwa projektu)
const bezId = d => { const { _id, ...r } = d; return _id === undefined ? r : { _doc: _id, ...r }; };

export function kopiaJSON({ zapytania = [], projekty = [], ceny = [], ustawienia = {}, wagi = {}, generator = {}, cenyMeta = null }, kiedy = new Date()) {
  return bezCzasu({
    format: FORMAT, wersja: 1, kiedy: kiedy.toISOString(),
    liczby: { zapytania: zapytania.length, projekty: projekty.length, ceny: ceny.length, wagi: (wagi.rows || []).length },
    zapytania: zapytania.map(bezId), projekty: projekty.map(bezId), ceny: ceny.map(bezId),
    ustawienia, wagi, generator, cenyMeta,
  });
}
export function sprawdzKopie(o) {
  if (!o || o.format !== FORMAT) return "To nie jest plik kopii Zapytań ofertowych.";
  if (!Array.isArray(o.zapytania) || !Array.isArray(o.projekty)) return "Plik kopii jest niekompletny.";
  if (o.zapytania.some(z => !z || !Array.isArray(z.wiersze))) return "Plik kopii jest uszkodzony (zapytanie bez wierszy).";
  return "";
}
// dokument z kopii -> { id, d } do zapisu w Firestore
export function dokumentZKopii(o) { const { _doc, ...d } = o; return { id: _doc ? String(_doc).replace(/\//g, "-") : null, d }; }

const lit = c => { let s = ""; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const kol = k => (k && k !== -1 ? String(k).toUpperCase() : "");
function nazwaArkusza(n, zajete) {
  let b = String(n).replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "arkusz", w = b, i = 1;
  while (zajete.has(w.toLowerCase())) { i++; w = b.slice(0, 31 - String(i).length - 3) + " (" + i + ")"; }
  zajete.add(w.toLowerCase()); return w;
}
export function kopiaExcel(XLSX, k) {
  const wb = XLSX.utils.book_new(), zajete = new Set();
  const dodaj = (nazwa, aoa, szer) => { const ws = XLSX.utils.aoa_to_sheet(aoa); if (szer) ws["!cols"] = szer.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nazwaArkusza(nazwa, zajete)); };
  const u = k.ustawienia || {};
  dodaj("INFO", [["Kopia zapasowa – Zapytania ofertowe"], ["Data kopii", k.kiedy], ["Zapytań", k.zapytania.length], ["Projektów", k.projekty.length], ["Pozycji w cenach", (k.ceny || []).length],
    [], ["Do przywrócenia w aplikacji służy plik .json z tej samej kopii (Ustawienia → Kopia zapasowa → Przywróć)."]], [28, 40]);
  dodaj("USTAWIENIA", [["Ustawienie", "Wartość"], ...["prog", "naZD", "osobno", "krok", "start", "rok", "kodWNazwie", "temat", "poczatek", "koniec", "doKogo"].map(x => [x, u[x] ?? ""]),
    [], ["GRUPA", "KOLEJNOŚĆ", "UWZGLĘDNIAJ", "MIN. ILOŚĆ", "GDY BRAK = 0"], ...(u.grupy || []).map(g => [g.grupa, g.kolejnosc, g.uwzgl, g.min, g.gdyZero]),
    [], ["SŁOWO KLUCZOWE", "GRUPA"], ...(u.slowa || []).map(s => [s.slowo, s.grupa]),
    [], ["DOSTAWCA", "E-MAIL", "WYSYŁAJ?", "OSOBA"], ...(u.dostawcy || []).map(d => [d.dostawca, d.email, d.wysylaj, d.osoba])], [24, 40, 14, 12, 16]);
  dodaj("WAGI", [["TYP", "WYMIAR", "KG/MB", "OPIS", "UWAGI"], ...((k.wagi || {}).rows || []).map(r => [r.t, r.w, r.kg, r.o, r.u]),
    [], ["PACZKA / ARKUSZ", "WARTOŚĆ"], ...Object.entries((k.wagi || {}).pamiec || {})], [12, 14, 9, 30, 30]);
  dodaj("PROJEKTY", [["PROJEKT (ZAPYTANIE)", "KOD KLIENTA", "DATA", "SYMBOL", "NAZWA", "J.M.", "ILOŚĆ W DOK.", "NIEZAREZ.", "NA ZD", "CENA ZAKUPU", "ZAPYTANO", "ARKUSZ ZAPYTANIA", "TREŚĆ W ZAPYTANIU"],
    ...k.projekty.flatMap(p => (p.pozycje || []).map(x => [p.id, p.kod, p.data, x.symbol, x.nazwa, x.jm, x.ilosc, x.niez, x.nazd, x.cz ?? "", x.zapytano, x.ark, x.tresc]))], [16, 12, 11, 10, 40, 6, 10, 10, 8, 11, 9, 16, 44]);
  dodaj("CENY", [["SYMBOL", "NAZWA", "J.M. CENY", "STATUS", "DATA", "CENA"], ...(k.ceny || []).flatMap(d => (d.historia || []).map(h => [d.symbol, d.nazwa, d.jm, d.status || "", h.d, h.c]))], [10, 44, 9, 10, 11, 10]);
  dodaj("ZAMÓWIENIA", [["ZAPYTANIE", "DOSTAWCA", "STATUS", "NR ZAMÓWIENIA", "DATA", "PLANOWANA DOSTAWA", "DOSTAWA W LOGISTYCE", "UWAGI"],
    ...k.zapytania.flatMap(z => Object.values(z.zamowienia || {}).map(o => [z.nazwa, o.dostawca, o.status, o.nr, o.data, o.dostawa, o.kursId ? "tak" : "", o.uwagi]))], [16, 18, 12, 16, 11, 14, 10, 30]);
  // zapytania: najnowsze na początku, jak lista w aplikacji
  for (const z of [...k.zapytania].sort((a, b) => (b.kolejnosc ?? 0) - (a.kolejnosc ?? 0))) {
    const ostK = Math.max(2, ...Object.keys(z.naglowki || {}).map(Number), ...(z.wiersze || []).flatMap(w => Object.keys(w.c || {}).map(Number)));
    const kolory = Object.fromEntries(Object.entries(z.naglowki || {}).filter(([, h]) => kol(h.k)).map(([c, h]) => [kol(h.k), h.t || lit(+c)]));
    const aoa = [[z.kod || "", ...Array.from({ length: ostK - 1 }, (_, i) => z.naglowki?.[i + 2]?.t ?? ""), "WYBRANY DOSTAWCA"]];
    for (const w of z.wiersze || []) aoa.push([w.a || "", ...Array.from({ length: ostK - 1 }, (_, i) => { const c = w.c?.[i + 2]; return c ? (c.v ?? c.f ?? "") : ""; }), kolory[kol(w.k)] || ""]);
    dodaj(z.nazwa, aoa, [44, ...Array.from({ length: ostK - 1 }, () => 14), 18]);
  }
  return wb;
}
