/* Zamówienia po wyborze dostawcy: wybrano → zamówiono (nr, data) → dostawa w Logistyce → dostarczono.
   Dane w dokumencie zapytania: zamowienia[kolor dostawcy] = { dostawca, nr, data, dostawa, kursId, status, uwagi }.
   Dostawa trafia do kolekcji „kursy” Logistyki tak samo jak z Kooperacji (doUzup + odZakupow → „🛒 do uzupełnienia”). */
import * as L from "./logika.js?v=202611121300";

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
// najdłuższy element [m] z nazw pozycji: „12m”, „L=4800”, profil „… 4800” (mm), blacha 1500x3000 (dłuższy bok); 0 gdy nie wiadomo
export function najdluzszyElement(teksty) {
  let max = 0;
  for (const t0 of teksty) {
    const t = pozycjaDoKursu(String(t0 || "")).nazwa;
    let d = L.dlugoscZNazwy(t);
    if (!d) { const w = wymiarProfilu(t); if (w?.dl) d = w.dl / 1000; }
    if (!d) { const a = L.wymiarArkusza(L.UC(t)); if (a) d = Math.max(...a.split("x").map(Number).filter(n => n > 0)) / 1000; }
    if (d > 0 && d <= 30) max = Math.max(max, d);
  }
  return max ? Math.round(max * 100) / 100 : 0;
}
// dokument kursu i kosztów w formacie Logistyki (POLA_KURSU z src/dane.js)
export function kursLogistyki({ nr, proj, kontr, transport, zal, dst, wagaT, dlugosc = null, pozycje, uwagi, kto, nazwa, miejsce = "", oddzial = "", kontakt = "" }, czas) {
  const dataS = zal || dst || "9999-12-31";
  const kurs = {
    typ: "D", rodzaj: "Dostawa – materiał", nr, proj, kontr, transport, spedytor: "", kier: "", nasz: "", kierUid: "", auto: "",
    zal: zal || "", dst: dst || "", waga: wagaT ?? null, dlugosc: dlugosc || null, oddzial, miejsce, kraj: "", kontakt,
    status: "Oczekuje na kierowcę", uwagi, uwagiMag: "", ladunek: null, awizo: null, zrodlo: "ZAPYTANIE", hlId: "", hlIndeks: "", hlWeek: "",
    hlTydzien: false, godz: "", dojazd: null, przew: null, oddzial2: "", waga2: null, planId: "", punkty: [], doUzup: true,
    odZakupow: { kto, nazwa, czas: Date.now() }, zalMiejsce: "", opoznienie: "", protokol: null, pozycje, kierStatus: "",
    kierStatusCzas: null, raport: null, zdjecia: [], dataS, zmieniono: czas, zmienil: kto,
  };
  const koszt = { dataS, koszt: null, waluta: "PLN", dopl: null, faktura: null, oferty: null, zapytanie: null };
  return { kurs, koszt };
}

/* ---------------------------------------------------------------- zamówienie profili → Zakupy profili (Kombajn Zakupowca, kolekcja zak_zam)
   Pozycja zapytania „Profil 50x50x2,5 S355 4800- 20 szt” → indeks Zakupów „50x50x2,5 / 4800”, tony z wagi, cena w zł/t. */
const liczba = s => Number(String(s).replace(",", "."));
// wymiary profilu z tekstu: { a, b, g, dl } (dl w mm albo null)
export function wymiarProfilu(tekst) {
  const t = String(tekst || "").replace(/×/g, "x");
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const [a, b] = [liczba(m[1]), liczba(m[2])].sort((x, y) => y - x), g = liczba(m[3]);
  const reszta = t.slice(m.index + m[0].length);
  let dl = null;
  const mm = reszta.match(/(?:^|[^\d,.])(\d{4,5})(?:\s*mm)?(?![\d,.])/);
  const mt = reszta.match(/(\d+(?:[.,]\d+)?)\s*m(?![a-ząćęłńóśźż])/i);
  if (mm) dl = +mm[1]; else if (mt && liczba(mt[1]) >= 1 && liczba(mt[1]) <= 18) dl = Math.round(liczba(mt[1]) * 1000);
  return { a, b, g, dl };
}
// indeks z listy Zakupów (cfg.skus[].key) – jednoznaczne dopasowanie wymiarów i długości, inaczej ""
export function dopasujIndeks(tekst, klucze) {
  const p = wymiarProfilu(tekst); if (!p) return "";
  const pasuje = (klucze || []).filter(k => { const s = wymiarProfilu(k); return s && s.a === p.a && s.b === p.b && s.g === p.g && (p.dl == null || s.dl === p.dl); });
  return pasuje.length === 1 ? pasuje[0] : "";
}
// cena w zł/t z ceny dostawcy za jednostkę pozycji (t, kg, szt, mb…) i wagi pozycji w kg
export function cenaZaTone(cena, jm, ilosc, wagaKg) {
  const c = Number(cena), j = String(jm || "").toLowerCase().replace(".", "");
  if (!(c > 0)) return null;
  if (j === "t" || j === "ton") return Math.round(c * 100) / 100;
  if (j === "kg") return Math.round(c * 1000 * 100) / 100;
  if (Number(ilosc) > 0 && Number(wagaKg) > 0) return Math.round(c * Number(ilosc) / (Number(wagaKg) / 1000) * 100) / 100;
  return null;
}
// dostawca z listy Zakupów (cfg.suppliers) po nazwie (bez wielkości liter, spacji, polskich znaków)
export function dostawcaZakupow(nazwa, lista) {
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]/g, "");
  const k = n(nazwa); if (!k) return "";
  return (lista || []).find(x => n(x) === k) || (lista || []).find(x => n(x).startsWith(k) || k.startsWith(n(x))) || "";
}
// dokumenty zak_zam (format Zakupów profili: { nr, sup, date, zd, term, price, closed, note, key, t })
export function zamowieniaZakupow(wiersze, H) {
  return wiersze.filter(w => w.key && Number(w.t) > 0).map(w => ({ nr: H.nr || "", sup: H.sup, date: H.date || "", zd: H.zd || "", term: H.term || "",
    price: Number(w.price) > 0 ? Number(w.price) : 0, closed: false, note: H.note || "", key: w.key, t: Math.round(Number(w.t) * 1000) / 1000 }));
}

/* ---------------------------------------------------------------- jedna lista dostawców (kartoteka w Truck App: ustawienia/glowne.dostawcy)
   Dostawcy z Zapytań dopisują się do kartoteki; istniejącym uzupełniamy tylko puste pola (e-mail, osoba). Niczego nie usuwamy ani nie nadpisujemy. */
const nNazwa = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]/g, "");
// wpisy: [{ nazwa, email, osoba }]; flaga – skąd dostawca (np. "zap"); zwraca { lista, zmiany }
export function scalDostawcow(lista, wpisy, flaga) {
  const L = (lista || []).map(x => ({ ...x })); let zmiany = 0;
  for (const w of wpisy || []) {
    const nazwa = String(w.nazwa || "").trim(); if (!nazwa) continue;
    const x = L.find(q => nNazwa(q.nazwa) === nNazwa(nazwa));
    if (x) {
      if (w.email && !x.email) { x.email = w.email; zmiany++; }
      if (w.osoba && !x.kontakt) { x.kontakt = w.osoba; zmiany++; }
      if (flaga && !x[flaga]) { x[flaga] = true; zmiany++; }
    } else { L.push({ nazwa, adres: "", nip: "", tel: "", kontakt: w.osoba || "", email: w.email || "", ...(flaga ? { [flaga]: true } : {}) }); zmiany++; }
  }
  if (zmiany) L.sort((a, b) => String(a.nazwa).localeCompare(String(b.nazwa), "pl"));
  return { lista: L, zmiany };
}

// kod projektu do wspólnego słownika (projekty): wielkie litery, pojedyncze spacje
export const kodProjektu = s => String(s || "").trim().toUpperCase().replace(/\s+/g, " ");
