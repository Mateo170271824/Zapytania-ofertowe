/* Zamówienia po wyborze dostawcy: wybrano → zamówiono (nr, data) → dostawa w Logistyce → dostarczono.
   Dane w dokumencie zapytania: zamowienia[kolor dostawcy] = { dostawca, nr, data, dostawa, kursId, status, uwagi }.
   Dostawa trafia do kolekcji „kursy” Logistyki tak samo jak z Kooperacji (doUzup + odZakupow → „🛒 do uzupełnienia”). */
import * as L from "./logika.js?v=202611061834";

export const STATUSY = { wybrano: "wybrano", zamowiono: "zamówiono", dostawa: "dostawa w Logistyce", dostarczono: "dostarczono" };

// grupy: kolor dostawcy -> nazwa z nagłówka, pozycje zaznaczone tym kolorem, waga (kg) z „Wagi dla logistyki”
export function grupyZamowien(z, ctxWag) {
  const nagl = Object.entries(z.naglowki || {}).filter(([, h]) => L.kolor(h.k) !== -1 && L.vbaTrim(h.t || ""));
  if (!nagl.length) return [];
  let waga = null;
  try { waga = L.wagaDlaDostawcow(z, { ...ctxWag, pytaj: () => null }); } catch { waga = null; }
  return nagl.map(([c, h]) => {
    const k = L.kolor(h.k);
    const pozycje = z.wiersze.map((w, i) => ({ w, r: i + 2 })).filter(({ w }) => L.vbaTrim(w.a) && (L.kolor(w.k) === k || L.kolor(w.c?.[c]?.k) === k));
    const gw = waga && !waga.blad ? waga.dostawcy.find(d => d.c === +c) : null;
    return { kolor: k, c: +c, dostawca: L.vbaTrim(h.t), pozycje, wagaKg: gw ? gw.suma : null, bezWagi: gw ? gw.pozycje.filter(p => p.waga < 0).length : pozycje.length };
  }).filter(g => g.pozycje.length);
}
// pełna nazwa dostawcy z Ustawień (nagłówek w arkuszu bywa skrócony: „lebal” → „Lebal”)
export function pelnaNazwa(krotka, ust) {
  const n = s => L.LC(s).replace(/[\s.\-_]/g, "");
  const d = (ust.dostawcy || []).find(x => n(x.dostawca) === n(krotka)) || (ust.dostawcy || []).find(x => n(x.dostawca).startsWith(n(krotka)) || n(krotka).startsWith(n(x.dostawca)));
  return d ? L.vbaTrim(d.dostawca) : krotka.charAt(0).toUpperCase() + krotka.slice(1);
}
// „Profil 120x80x3 S355 12m- 4 szt” -> { nazwa, ilosc, jm } (jak pozycje zamówień w Logistyce)
export function pozycjaDoKursu(tekst) {
  let p = tekst.indexOf("- "); if (p < 0) p = tekst.indexOf(" -");
  const nazwa = p >= 0 ? L.vbaTrim(tekst.slice(0, p)) : L.vbaTrim(tekst);
  const il = p >= 0 ? L.pierwszaLiczba(tekst.slice(p + 2)) : { w: 0, reszta: "" };
  const jm = (il.reszta || "").split(/\s+/)[0] || (p >= 0 ? "" : "szt");
  return { nazwa, ilosc: il.w || 1, jm: jm || "szt" };
}
// Oddziały firmy, gdy Truck App nie ma własnej listy (ustawienia/publiczne.oddzialy) – jak ODDZIALY_DOM w Logistyce
export const ODDZIALY_DOM = [{ nazwa: "Nowy Ochędzyn", adres: "" }, { nazwa: "Wieruszów", adres: "" }];
// dostawca z listy Truck App (ustawienia/glowne.dostawcy: { nazwa, adres, tel, … }) – dokładnie po nazwie, potem po początku nazwy
export function dostawcaTruck(nazwa, lista) {
  const n = s => L.LC(s || "").replace(/[\s.\-_]/g, "");
  const k = n(nazwa); if (!k) return null;
  const L2 = (lista || []).filter(x => x && x.nazwa);
  return L2.find(x => n(x.nazwa) === k) || L2.find(x => n(x.nazwa).startsWith(k) || k.startsWith(n(x.nazwa))) || null;
}
// dokument kursu i kosztów w formacie Logistyki (POLA_KURSU z src/dane.js)
export function kursLogistyki({ nr, proj, kontr, transport, zal, dst, wagaT, pozycje, uwagi, kto, nazwa, miejsce = "", oddzial = "", kontakt = "" }, czas) {
  const dataS = zal || dst || "9999-12-31";
  const kurs = {
    typ: "D", rodzaj: "Dostawa – materiał", nr, proj, kontr, transport, spedytor: "", kier: "", nasz: "", kierUid: "", auto: "",
    zal: zal || "", dst: dst || "", waga: wagaT ?? null, dlugosc: null, oddzial, miejsce, kraj: "", kontakt,
    status: "Oczekuje na kierowcę", uwagi, uwagiMag: "", ladunek: null, awizo: null, zrodlo: "ZAPYTANIE", hlId: "", hlIndeks: "", hlWeek: "",
    hlTydzien: false, godz: "", dojazd: null, przew: null, oddzial2: "", waga2: null, planId: "", punkty: [], doUzup: true,
    odZakupow: { kto, nazwa, czas: Date.now() }, zalMiejsce: "", opoznienie: "", protokol: null, pozycje, kierStatus: "",
    kierStatusCzas: null, raport: null, zdjecia: [], dataS, zmieniono: czas, zmienil: kto,
  };
  const koszt = { dataS, koszt: null, waluta: "PLN", dopl: null, faktura: null, oferty: null, zapytanie: null };
  return { kurs, koszt };
}
