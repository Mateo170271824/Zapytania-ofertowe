/* Odczyt pliku „Zapytania Lista 2026.xlsm” (SheetJS) do danych aplikacji.
   Wywołanie: czytajSkoroszyt(XLSX, wb), gdzie wb = XLSX.read(bufor, {cellStyles:true, cellFormula:true, cellComments:true}) */
import { vbaTrim, ogolny, kolor } from "./logika.js?v=202611061440";

export const ARKUSZE_SYSTEMOWE = ["GENERATOR", "USTAWIENIA", "WAGA LOGISTYKA", "WAGI", "PROJEKTY", "KOSZT PROJEKTU", "DRUK KOSZTU", "WZÓR"];

// domyślny motyw Office – gdy kolor zapisany jako „kolor motywu”
const MOTYW = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];
function zTintem(hex, tint) {
  if (!tint) return hex;
  const c = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => tint < 0 ? v * (1 + tint) : v + (255 - v) * tint);
  return c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function kolorKomorki(cell) {
  const s = cell && cell.s;
  if (!s || !s.patternType || s.patternType === "none") return -1;
  const fg = s.fgColor || {};
  let hex = null;
  if (fg.rgb) hex = String(fg.rgb).slice(-6).toUpperCase();
  else if (fg.theme !== undefined) hex = zTintem(MOTYW[fg.theme] || "FFFFFF", fg.tint || 0);
  else if (fg.indexed !== undefined && fg.indexed !== 64) hex = null;
  return kolor(hex);
}
const adr = (r, c) => XLSXref.encode_cell({ r, c });
let XLSXref;
const wart = (ws, r, c) => { const x = ws[adr(r, c)]; return x ? x.v : undefined; };
const tekst = v => (v === undefined || v === null) ? "" : typeof v === "number" ? ogolny(v) : String(v);

function zakres(ws) { return ws["!ref"] ? XLSXref.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: -1, c: -1 } }; }

export function czytajUstawienia(ws) {
  const v = a => { const x = ws[a]; return x ? x.v : ""; };
  const rokF = ws.C9 && ws.C9.f;
  const u = {
    prog: v("C3") === "" ? 0 : v("C3"), naZD: tekst(v("C4")), osobno: tekst(v("C5")), krok: v("C7") === "" ? 1 : v("C7"), start: v("C8") === "" ? 2 : v("C8"),
    rok: rokF ? "" : v("C9"), temat: tekst(v("C11")), poczatek: tekst(v("C12")), koniec: tekst(v("C13")), doKogo: tekst(v("C14")), kodWNazwie: tekst(v("C15")),
    grupy: [], slowa: [], dostawcy: [],
  };
  const R = zakres(ws).e.r;
  let koniecG = false, koniecS = false;           // grupy i słowa: jak makro – do pierwszego pustego wiersza
  for (let r = 17; r <= Math.max(R, 17); r++) {   // wiersz 18 = indeks 17
    const g = wart(ws, r, 1);
    if (g === undefined || vbaTrim(tekst(g)) === "") koniecG = true;
    if (!koniecG) u.grupy.push({ grupa: tekst(g), kolejnosc: wart(ws, r, 2) ?? "", uwzgl: tekst(wart(ws, r, 3)), min: wart(ws, r, 4) ?? "", gdyZero: tekst(wart(ws, r, 5)) });
    const s = wart(ws, r, 7);
    if (s === undefined || vbaTrim(tekst(s)) === "") koniecS = true;
    if (!koniecS) u.slowa.push({ slowo: tekst(s), grupa: tekst(wart(ws, r, 8)) });
    const d = wart(ws, r, 10), e = wart(ws, r, 11);
    if ((d !== undefined && vbaTrim(tekst(d)) !== "") || (e !== undefined && vbaTrim(tekst(e)) !== ""))
      u.dostawcy.push({ dostawca: tekst(d), email: tekst(e), wysylaj: tekst(wart(ws, r, 12)), osoba: tekst(wart(ws, r, 13)) });
  }
  return u;
}

export function czytajWagi(ws) {
  const rows = [], pamiec = {};
  const R = zakres(ws).e.r;
  for (let r = 1; r <= R; r++) {
    const t = wart(ws, r, 0);
    if (t !== undefined && tekst(t) !== "") rows.push({ t: tekst(t), w: tekst(wart(ws, r, 1)), kg: wart(ws, r, 2) ?? "", o: tekst(wart(ws, r, 3)), u: tekst(wart(ws, r, 4)) });
  }
  for (let r = 1; r <= R; r++) {           // G:H – makro czyta do pierwszego pustego
    const k = wart(ws, r, 6);
    if (k === undefined || vbaTrim(tekst(k)) === "") break;
    const h = wart(ws, r, 7);
    pamiec[tekst(k)] = h === undefined ? "" : (typeof h === "number" ? h : tekst(h));
  }
  return { rows, pamiec };
}

const dataTekst = v => {
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  return tekst(v);
};
export function czytajProjekty(ws) {
  const mapa = new Map();
  const R = zakres(ws).e.r;
  for (let r = 1; r <= R; r++) {
    const id = wart(ws, r, 0);
    if (id === undefined || vbaTrim(tekst(id)) === "") continue;
    const k = tekst(id);
    if (!mapa.has(k)) mapa.set(k, { id: k, kod: tekst(wart(ws, r, 1)), data: dataTekst(wart(ws, r, 2)), pozycje: [] });
    const p = { symbol: tekst(wart(ws, r, 3)), nazwa: tekst(wart(ws, r, 4)), jm: tekst(wart(ws, r, 5)), ilosc: wart(ws, r, 6) ?? 0,
                niez: wart(ws, r, 7) ?? 0, nazd: wart(ws, r, 8) ?? 0, zapytano: tekst(wart(ws, r, 10)), ark: tekst(wart(ws, r, 11)), tresc: tekst(wart(ws, r, 12)) };
    const cz = wart(ws, r, 9);
    if (cz !== undefined && tekst(cz) !== "") p.cz = cz;
    mapa.get(k).pozycje.push(p);
  }
  return [...mapa.values()];
}

export function czytajGenerator(ws) {
  const v = a => (ws[a] ? ws[a].v : "");
  const g = { kod: tekst(v("N2")), plik: tekst(v("N3")), ostatnie: tekst(v("N5")), wiersze: [] };
  const R = zakres(ws).e.r;
  for (let r = 7; r <= R; r++) {
    const naz = wart(ws, r, 2);
    if (naz === undefined || tekst(naz) === "") continue;
    const n = c => wart(ws, r, c);
    const p = { symbol: tekst(n(1)), nazwa: tekst(naz), grupa: tekst(n(3)), jm: tekst(n(4)), ilosc: n(5) ?? 0, stan: n(6) ?? 0, zarez: n(7) ?? 0,
                niezarez: n(8) ?? 0, nazd: n(9) ?? 0, brak: n(10) ?? 0, zapytac: tekst(n(11)), ilZap: n(12) ?? "" };
    if (n(14) !== undefined && n(14) !== "") p.cz = n(14);
    g.wiersze.push(p);
  }
  return g;
}

function komentarz(cell) {
  if (!cell || !cell.c || !cell.c.length) return "";
  return cell.c.map(x => String(x.t || "").replace(/\r/g, "")).join("\n").trim();
}
function komorka(cell) {
  const o = {};
  if (cell.v !== undefined && cell.v !== null && cell.v !== "") o.v = cell.v;
  if (cell.f) o.f = "=" + String(cell.f).replace(/(\d)\.(\d)/g, "$1,$2");
  const k = kolorKomorki(cell); if (k !== -1) o.k = k;
  const m = komentarz(cell); if (m) o.m = m;
  return o;
}
export function czytajZapytanie(ws, nazwa, kolejnosc) {
  const rg = zakres(ws);
  const z = { nazwa, kolejnosc, kod: tekst(wart(ws, 0, 0)), naglowki: {}, wiersze: [] };
  const m = nazwa.match(/^(\d+)-(\d{4})(\s|$)/);
  if (m) { z.numer = +m[1]; z.rok = +m[2]; }
  const a1 = ws[adr(0, 0)]; const ma1 = komentarz(a1); if (ma1) z.kodM = ma1;
  for (let c = 1; c <= rg.e.c; c++) {
    const cell = ws[adr(0, c)];
    if (!cell) continue;
    const t = tekst(cell.v), k = kolorKomorki(cell), mm = komentarz(cell);
    if (t !== "" || k !== -1 || mm) z.naglowki[c + 1] = { t, ...(k !== -1 ? { k } : {}), ...(mm ? { m: mm } : {}) };
  }
  for (let r = 1; r <= rg.e.r; r++) {
    const ca = ws[adr(r, 0)];
    const w = { a: ca ? tekst(ca.v) : "", c: {} };
    if (ca) { const k = kolorKomorki(ca); if (k !== -1) w.k = k; const mm = komentarz(ca); if (mm) w.m = mm; }
    for (let c = 1; c <= rg.e.c; c++) {
      const cell = ws[adr(r, c)];
      if (!cell) continue;
      const o = komorka(cell);
      if (Object.keys(o).length) w.c[c + 1] = o;
    }
    z.wiersze.push(w);
  }
  while (z.wiersze.length && z.wiersze.at(-1).a === "" && !Object.keys(z.wiersze.at(-1).c).length && z.wiersze.at(-1).k === undefined && !z.wiersze.at(-1).m) z.wiersze.pop();
  return z;
}

export function czytajSkoroszyt(XLSX, wb) {
  XLSXref = XLSX.utils;
  const brak = ["GENERATOR", "USTAWIENIA", "WAGI"].filter(n => !wb.Sheets[n]);
  if (brak.length) return { blad: "To nie jest plik zapytań – brakuje arkuszy: " + brak.join(", ") };
  const wynik = {
    ustawienia: czytajUstawienia(wb.Sheets.USTAWIENIA),
    wagi: czytajWagi(wb.Sheets.WAGI),
    projekty: wb.Sheets.PROJEKTY ? czytajProjekty(wb.Sheets.PROJEKTY) : [],
    generator: czytajGenerator(wb.Sheets.GENERATOR),
    zapytania: [],
  };
  wb.SheetNames.forEach((n, i) => {
    if (ARKUSZE_SYSTEMOWE.includes(n)) return;
    const st = (wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets[i]) || {};
    if (st.Hidden) return;
    wynik.zapytania.push(czytajZapytanie(wb.Sheets[n], n, i));
  });
  return wynik;
}

// tabela pierwszego arkusza (eksport z Subiekta)
export function tabelaPierwszegoArkusza(XLSX, wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: undefined, blankrows: true });
}
