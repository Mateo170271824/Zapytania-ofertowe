/* Logika przeniesiona 1:1 z makr pliku „Zapytania Lista 2026.xlsm” (moduł Generator).
   Bez interfejsu i bez bazy – te same funkcje działają w przeglądarce i w testach (Node).
   Nazwy funkcji jak w makrach, żeby łatwo porównać.

   Model danych zapytania (odpowiednik arkusza NNN-RRRR):
     { nazwa: "169-2026", kod: "HALM",                 // A1
       naglowki: { 2: {t:"salzgitter", k:"00B0F0"} },  // wiersz 1, kolumny od 2 (B); k = kolor wypełnienia
       wiersze: [ { a:"IPE 300 S355 9m- 6 szt", k:"92D050",  // kolumna A od wiersza 2; k = kolor
                    c: { 2:{v:3.85}, 4:{v:"x5", k:"..."}, 5:{f:"2,93*4,25", v:12.4525, m:"komentarz"} } } ] }
   Kolor -1 / brak = komórka niezaznaczona (biała). */

// ---------------------------------------------------------------- liczby i tekst
export function vbaTrim(s) { return String(s ?? "").replace(/^ +| +$/g, ""); }
export function wsTrim(s) { return String(s ?? "").replace(/ +/g, " ").replace(/^ | $/g, ""); }   // WorksheetFunction.Trim
export const UC = s => String(s ?? "").toUpperCase();
export const LC = s => String(s ?? "").toLowerCase();

function vbaVal(s) {
  const m = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s);
  return m ? parseFloat(m[0]) : 0;
}
// NaLiczbe: liczba z komórki („1,5”, „1 234,5”, tekst) -> {ok, w}
export function naLiczbe(v) {
  if (v === null || v === undefined || v === "") return { ok: false, w: 0 };
  if (typeof v === "number") return isFinite(v) ? { ok: true, w: v } : { ok: false, w: 0 };
  if (typeof v === "boolean") return { ok: false, w: 0 };
  let s = vbaTrim(String(v)).replace(/ /g, "").replace(/ /g, "").replace(/,/g, ".");
  if (s === "") return { ok: false, w: 0 };
  if (/[^0-9.+\-]/.test(s)) return { ok: false, w: 0 };
  return { ok: true, w: vbaVal(s) };
}
export const liczba = v => { const r = naLiczbe(v); return r.ok ? r.w : 0; };

// VBA Round = zaokrąglenie bankowe
export function vbaRound(x, d = 0) {
  const f = Math.pow(10, d), v = x * f, fl = Math.floor(v), diff = v - fl;
  let r;
  if (Math.abs(diff - 0.5) < 1e-9) r = (fl % 2 === 0) ? fl : fl + 1;
  else r = Math.round(v);
  return r / f;
}
// WorksheetFunction.RoundUp (od zera)
export function roundUp(x, d) {
  const f = Math.pow(10, d), v = Math.abs(x) * f, r = Math.ceil(v - 1e-9) / f;
  return x < 0 ? -r : r;
}
// LiczbaTekst: 12 -> "12", 42.4 -> "42,4"
export function liczbaTekst(w) {
  if (Math.abs(w - Math.round(w)) < 1e-9) return String(Math.round(w));
  return String(vbaRound(w, 4)).replace(".", ",");
}
// liczba sklejona z tekstem w Excelu (format Ogólny, przecinek)
export function ogolny(w) {
  if (typeof w !== "number") return String(w ?? "");
  return String(+w.toPrecision(15)).replace(".", ",");
}

// ---------------------------------------------------------------- ustawienia (arkusz USTAWIENIA)
export const USTAWIENIA_DOMYSLNE = {
  prog: 0, naZD: "TAK", osobno: "NIE", krok: 1, start: 2, rok: "",
  temat: "Zapytanie ofertowe {NUMER}",
  poczatek: "Dzień dobry,\nproszę o ofertę cenowo-terminową:",
  koniec: "proszę o informację ile szt znajduje się w paczce",
  doKogo: "", kodWNazwie: "NIE",
  grupy: [], slowa: [], dostawcy: [],
};
const ustTak = v => UC(vbaTrim(v)) === "TAK";
export function ustLiczba(v, domyslna) { const r = naLiczbe(v); return r.ok ? r.w : domyslna; }
export function rokNumeru(ust) {
  let r = Math.trunc(ustLiczba(ust.rok, new Date().getFullYear()));
  if (r < 2000) r = new Date().getFullYear();
  return r;
}

export function okreslGrupe(ust, nazwa) {
  const tekst = " " + UC(vbaTrim(nazwa)) + " ";
  for (const s of ust.slowa || []) {
    const slowo = UC(vbaTrim(s.slowo));
    if (slowo === "") break;                              // makro kończy na pierwszym pustym wierszu
    if (tekst.includes(slowo)) return vbaTrim(s.grupa);
  }
  return "Inne";
}
function wierszGrupy(ust, grupa) {
  for (const g of ust.grupy || []) {
    if (vbaTrim(g.grupa) === "") break;
    if (LC(vbaTrim(g.grupa)) === LC(grupa)) return g;
  }
  return null;
}
const clng = x => vbaRound(x, 0);
export const grupaKolejnosc = (ust, g) => { const w = wierszGrupy(ust, g); return w ? clng(liczba(w.kolejnosc)) : 99; };
export const grupaUwzgledniaj = (ust, g) => { const w = wierszGrupy(ust, g); return w ? UC(vbaTrim(w.uwzgl)) !== "NIE" : true; };
export const grupaMinimum = (ust, g) => { const w = wierszGrupy(ust, g); return w ? liczba(w.min) : 0; };
export const grupaGdyZero = (ust, g) => { const w = wierszGrupy(ust, g); return w ? vbaTrim(w.gdyZero) : ""; };

// ---------------------------------------------------------------- 1. eksport z Subiekta
// "Zapytania testowe BUDC.xlsx" -> "BUDC"
export function kodZNazwyPliku(sciezka) {
  let nazwa = String(sciezka).split(/[\\/]/).pop();
  const p = nazwa.lastIndexOf(".");
  if (p >= 0) nazwa = nazwa.slice(0, p);
  nazwa = nazwa.replace(/_/g, " ").replace(/ - kopia/gi, "");
  nazwa = wsTrim(nazwa);
  while (nazwa.endsWith(")") && nazwa.lastIndexOf("(") >= 0) nazwa = vbaTrim(nazwa.slice(0, nazwa.lastIndexOf("(")));
  if (nazwa === "") return "";
  const cz = nazwa.split(" ");
  for (let i = cz.length - 1; i >= 0; i--) {
    const t = vbaTrim(cz[i]);
    if (t.length >= 2 && t.length <= 20 && t === UC(t) && /[A-Z]/.test(t)) return t;
  }
  return nazwa.slice(0, 30);
}

// tabela = tablica wierszy (tablice wartości) pierwszego arkusza eksportu
export function wczytajEksport(tabela, nazwaPliku, ust) {
  let wN = -1;
  szukaj: for (let r = 0; r < Math.min(30, tabela.length); r++)
    for (let c = 0; c < 60; c++)
      if (LC(vbaTrim(tabela[r]?.[c] ?? "")) === "nazwa") { wN = r; break szukaj; }
  if (wN < 0) return { blad: "W pliku nie znalazłem nagłówka z kolumną „Nazwa”. Wyeksportuj z Subiekta listę pozycji razem z nagłówkami kolumn." };
  const nag = tabela[wN];
  const kol = n => { for (let c = 0; c < 100; c++) if (LC(vbaTrim(nag[c] ?? "")) === LC(n)) return c; return -1; };
  const kSym = kol("Symbol"), kNaz = kol("Nazwa"), kIl = kol("Ilość"), kStan = kol("Stan"), kZar = kol("Zarezerwowane"), kNiez = kol("Niezarezerwowane"), kZD = kol("Na ZD");
  let kJm = kol("J.m."); if (kJm < 0) kJm = kol("Jm");
  let kCZ = -1;
  for (const n of ["Cena netto (R)", "Cena netto", "Cena zakupu", "Cena zakupu netto", "Ostatnia cena zakupu", "Średnia cena zakupu", "Cena zakupu (R)"]) if (kCZ < 0) kCZ = kol(n);
  if (kNiez < 0 && kStan < 0) return { blad: "W eksporcie brakuje kolumn „Stan” / „Niezarezerwowane”. Dodaj je w widoku listy w Subiekcie i wyeksportuj ponownie." };
  const w = (row, k) => (k < 0 ? undefined : row[k]);
  const poz = [];
  for (let r = wN + 1; r < tabela.length; r++) {
    const row = tabela[r] || [];
    if (vbaTrim(row[kNaz] ?? "") === "") continue;
    const p = {
      symbol: vbaTrim(w(row, kSym) ?? ""), nazwa: wsTrim(row[kNaz]), jm: vbaTrim(w(row, kJm) ?? ""),
      ilosc: liczba(w(row, kIl)), stan: liczba(w(row, kStan)), zarez: liczba(w(row, kZar)), nazd: liczba(w(row, kZD)), cz: liczba(w(row, kCZ)),
    };
    p.niezarez = kNiez >= 0 ? liczba(row[kNiez]) : p.stan - p.zarez;
    poz.push(p);
  }
  if (!poz.length) return { blad: "Plik nie zawiera żadnych pozycji." };
  const prog = ustLiczba(ust.prog, 0), odejmujZD = ustTak(ust.naZD);
  let ileTak = 0;
  poz.forEach((p, i) => {
    p.grupa = okreslGrupe(ust, p.nazwa);
    let dost = p.niezarez; if (odejmujZD) dost += p.nazd;
    p.brak = dost < 0 ? -dost : 0;
    p.zapytac = dost <= prog && grupaUwzgledniaj(ust, p.grupa) ? "TAK" : "NIE";
    p.ilZap = "";
    if (dost <= prog) {
      const minIl = grupaMinimum(ust, p.grupa), gdyZero = grupaGdyZero(ust, p.grupa);
      if (p.brak > 0) {
        let q = (LC(p.jm) === "szt" || LC(p.jm) === "szt.") ? roundUp(p.brak, 0) : roundUp(p.brak, 1);
        if (q < minIl) q = minIl;
        p.ilZap = q;
      } else if (gdyZero !== "" && LC(gdyZero) !== "szt") p.ilZap = gdyZero;
      else if (minIl > 0) p.ilZap = minIl;
    }
    p.klucz = (p.zapytac === "TAK" ? 0 : 1) * 1e9 + grupaKolejnosc(ust, p.grupa) * 1e5 + (i + 1);
  });
  poz.sort((a, b) => a.klucz - b.klucz);
  const wiersze = poz.map(({ klucz, ...p }) => { if (p.zapytac === "TAK") ileTak++; if (kCZ < 0) delete p.cz; return p; });
  return { wiersze, kod: kodZNazwyPliku(nazwaPliku), plik: String(nazwaPliku).split(/[\\/]/).pop(), ileTak, bezCeny: kCZ < 0 };
}

// kolumna TREŚĆ W ZAPYTANIU (formuła z arkusza GENERATOR)
export function trescPozycji(p) {
  if (!p.nazwa) return "";
  const m = p.ilZap;
  if (m === "" || m === null || m === undefined) return p.nazwa;
  return p.nazwa + "- " + (typeof m === "number" ? ogolny(m) + " " + (p.jm ?? "") : m);
}
export const wartoscZakupu = p => (typeof p.ilosc === "number" && typeof p.cz === "number") ? p.ilosc * p.cz : "";

// ---------------------------------------------------------------- 2. numery zapytań
// największy „NNN-rok” spośród nazw + 1
export function nastepnyNumer(nazwy, rok) {
  let maks = 0;
  for (const n0 of nazwy) {
    const nazwa = vbaTrim(n0), sp = nazwa.indexOf(" "), pierwszy = sp >= 0 ? nazwa.slice(0, sp) : nazwa;
    const p = pierwszy.indexOf("-");
    if (p > 0 && pierwszy.slice(p + 1) === String(rok) && /^\d+$/.test(pierwszy.slice(0, p))) maks = Math.max(maks, parseInt(pierwszy.slice(0, p), 10));
  }
  return maks + 1;
}
export function wolnaNazwa(nazwy, nazwa) {
  for (const z of ["\\", "/", "?", "*", "[", "]", ":"]) nazwa = nazwa.split(z).join("-");
  const baza = vbaTrim(nazwa);
  let wynik = baza, k = 1;
  const zajete = new Set(nazwy.map(n => LC(n)));
  while (zajete.has(LC(wynik))) { k++; wynik = baza + " (" + k + ")"; }
  return wynik;
}

// UtworzZapytanie: z wierszy generatora -> nowe zapytania + dane projektu
export function utworzZapytania(gen, ust, istniejaceNazwy, dzis) {
  const tak = gen.wiersze.filter(p => UC(vbaTrim(p.zapytac)) === "TAK" && vbaTrim(p.nazwa) !== "");
  if (!tak.length) return { blad: "Na liście nie ma pozycji z ZAPYTAĆ? = TAK. Najpierw wczytaj eksport z Subiekta." };
  const kod = vbaTrim(gen.kod);
  const rok = rokNumeru(ust);
  let nr = nastepnyNumer(istniejaceNazwy, rok);
  const osobno = ustTak(ust.osobno);
  let krok = Math.trunc(ustLiczba(ust.krok, 2)); if (krok < 1) krok = 1;
  let start = Math.trunc(ustLiczba(ust.start, 2)); if (start < 2) start = 2;
  const tresci = tak.map(p => trescPozycji(p) || p.nazwa);
  const listaGrup = osobno ? [...new Set(tak.map(p => vbaTrim(p.grupa)))] : [""];
  const nazwy = [...istniejaceNazwy], zapytania = [], arkPoz = new Map();
  for (const g of listaGrup) {
    let nazwaArk = nr + "-" + rok;
    if (ustTak(ust.kodWNazwie)) nazwaArk += " " + kod;
    let naglowek = kod;
    if (osobno) { nazwaArk += " " + g; naglowek = kod + " - " + g; }
    nazwaArk = wolnaNazwa(nazwy, nazwaArk);
    nazwy.push(nazwaArk);
    const wiersze = [];
    let wiersz = start;
    tak.forEach((p, i) => {
      if (!osobno || vbaTrim(p.grupa) === g) {
        while (wiersze.length < wiersz - 2) wiersze.push({ a: "", c: {} });
        wiersze.push({ a: tresci[i], c: {} });
        arkPoz.set(p, { ark: nazwaArk, tresc: tresci[i] });
        wiersz += krok;
      }
    });
    zapytania.push({ nazwa: nazwaArk, numer: nr, rok, kod: naglowek, naglowki: {}, wiersze });
    nr++;
  }
  const projId = zapytania[0].nazwa;
  const pozycje = gen.wiersze.filter(p => vbaTrim(p.nazwa) !== "").map(p => {
    const a = arkPoz.get(p);
    const o = { symbol: p.symbol ?? "", nazwa: p.nazwa, jm: p.jm ?? "", ilosc: liczba(p.ilosc), niez: liczba(p.niezarez), nazd: liczba(p.nazd),
                zapytano: a ? "TAK" : "NIE", ark: a ? a.ark : "", tresc: a ? a.tresc : "" };
    if (vbaTrim(p.cz ?? "") !== "") o.cz = liczba(p.cz);
    return o;
  });
  return { zapytania, projekt: { id: projId, kod, data: dzis, pozycje }, nastepny: nr + "-" + rok,
           ileBezIlosci: tak.filter(p => vbaTrim(p.ilZap ?? "") === "").length, ilePozycji: tak.length };
}

// ---------------------------------------------------------------- 3. mail
const zamien = (t, s, n) => t.replace(new RegExp(s.replace(/[{}]/g, "\\$&"), "gi"), () => n);
export const wstaw = (tekst, nazwa, numer) => zamien(zamien(tekst, "{NUMER}", numer), "{NR}", nazwa);
export function adresyDostawcow(ust) {
  return (ust.dostawcy || []).map(d => vbaTrim(String(d.email ?? "").replace(/;/g, ",")))
    .filter((a, i) => a.includes("@") && UC(vbaTrim(ust.dostawcy[i].wysylaj)) !== "NIE")
    .map(a => a.replace(/ /g, "")).join(",");
}
export function przygotujMail(z, ust) {
  const pozycje = [];
  for (const w of z.wiersze) { const t = vbaTrim(w.a); if (t !== "") pozycje.push(t); }
  if (!pozycje.length) return { blad: `Zapytanie ${z.nazwa} nie zawiera pozycji.` };
  const adresy = adresyDostawcow(ust);
  if (!adresy) return { blad: "Brak adresów e-mail dostawców. Uzupełnij tabelę DOSTAWCY w Ustawieniach (kolumna E-MAIL, WYSYŁAJ? = TAK)." };
  let numer = z.nazwa; if (numer.includes(" ")) numer = numer.slice(0, numer.indexOf(" "));
  const nazwaMail = numer.replace(/-/g, "/") + z.nazwa.slice(numer.length);
  numer = numer.replace(/-/g, "/");
  let temat = wstaw(vbaTrim(ust.temat ?? ""), nazwaMail, numer);
  if (temat === "") temat = "Zapytanie ofertowe " + nazwaMail;
  temat = temat.replace(/'/g, "").replace(/"/g, "").replace(/,/g, " ");
  const tresc = wstaw(vbaTrim(ust.poczatek ?? ""), nazwaMail, numer) + "\n\n" +
    pozycje.map((t, i) => `${i + 1}. ${t}`).join("\n") + "\n\n" + wstaw(vbaTrim(ust.koniec ?? ""), nazwaMail, numer);
  return { temat, tresc, udw: adresy, do: vbaTrim(ust.doKogo ?? "").replace(/;/g, ","), ilePozycji: pozycje.length };
}

// ---------------------------------------------------------------- 5. wagi
// wagi: { rows:[{t,w,kg}], pamiec:{klucz:wartosc} }  ->  słownik "TYP|WYMIAR" -> kg/mb
export function slownikWag(wagi) {
  const d = new Map();
  for (const r of wagi.rows || []) {
    if (vbaTrim(r.t) === "") continue;
    const k = UC(vbaTrim(r.t)) + "|" + normWymiar(String(r.w ?? ""));
    const n = naLiczbe(r.kg);
    if (n.ok && !d.has(k)) d.set(k, n.w);
  }
  return d;
}
export function normWymiar(s) {
  s = vbaTrim(s).replace(/×/g, "x").replace(/X/g, "x").replace(/\*/g, "x").replace(/ /g, "x");
  const cz = s.split("x"); let wynik = "";
  for (const c of cz) {
    if (vbaTrim(c) === "") continue;
    const n = naLiczbe(c);
    if (!n.ok) return "";
    if (wynik !== "") wynik += "x";
    wynik += liczbaTekst(n.w);
  }
  return wynik;
}
export function typWyrobu(nazwaU) {
  if (nazwaU.includes("BLACH") || nazwaU.slice(0, 3) === "BL " || nazwaU.slice(0, 3) === "BL#")
    return (` ${nazwaU} `.includes(" OC ") || nazwaU.includes("OCYNK")) ? "BLACHAOC" : "BLACHA";
  if (nazwaU.includes("GWINT")) return "PRETGW";
  if (nazwaU.includes("PROFIL") && ` ${nazwaU} `.includes(" ALU")) return "PROFILALU";
  if (nazwaU.includes("BRAMOW")) return "BRAMOWY";
  for (const t of ["IPE", "IPN", "HEA", "HEB", "HEM", "UPN", "UPE"]) if (nazwaU.includes(t)) return t;
  if (nazwaU.includes("RURA")) return "RURA";
  if (nazwaU.includes("PROFIL")) return "PROFIL";
  if (nazwaU.includes("PŁASKOWNIK") || nazwaU.includes("PLASKOWNIK")) return "PLASKOWNIK";
  if (nazwaU.includes("KĄTOWNIK") || nazwaU.includes("KATOWNIK"))
    return (nazwaU.includes("Z/G") || nazwaU.includes("GIĘT") || nazwaU.includes("GIET")) ? "KATOWNIKZG" : "KATOWNIK";
  if (nazwaU.includes("CEOWNIK")) return "CEOWNIK";
  if (nazwaU.includes("PRĘT") || nazwaU.includes("PRET")) {
    if (nazwaU.includes("KWADRAT")) return "PRETKW";
    if (nazwaU.includes("SZEŚCIO") || nazwaU.includes("SZESCIO")) return "PRET6K";
    return "PRET";
  }
  return "";
}
const tylkoCyfry = t => !/[^0-9,.]/.test(t);
export function wymiarZNazwy(nazwaU, typ) {
  nazwaU = nazwaU.replace(/×/g, "X").replace(/Ø/g, " ");
  const tokeny = wsTrim(nazwaU).split(" ");
  switch (typ) {
    case "IPE": case "IPN": case "HEA": case "HEB": case "HEM": case "UPN": case "UPE": {
      const p = nazwaU.indexOf(typ);
      let t = vbaTrim(nazwaU.slice(p + typ.length));
      if (t.includes(" ")) t = t.slice(0, t.indexOf(" "));
      return normWymiar(t);
    }
    case "PRETGW":
      for (let t of tokeny) {
        if (/^M\d/.test(t)) {
          t = t.slice(1); if (t.includes("X")) t = t.slice(0, t.indexOf("X"));
          const n = naLiczbe(t); if (n.ok) return liczbaTekst(n.w);
        }
      }
      return "";
    case "PRET": case "PRETKW": case "PRET6K":
      for (let t of tokeny) {
        if (t.slice(0, 2) === "FI") t = t.slice(2);
        if (t.slice(-2) === "MM") t = t.slice(0, -2);
        if (t !== "" && tylkoCyfry(t)) { const n = naLiczbe(t); if (n.ok) return liczbaTekst(n.w); }
      }
      return "";
    default:
      for (const t of tokeny) if (t.includes("X") && /^[0-9]/.test(t)) return normWymiar(t);
      return "";
  }
}
// długość z nazwy: „12m”, „6 m”, „L=12m”, „L-4800” -> metry (0 = brak)
export function dlugoscZNazwy(nazwa) {
  const tokeny = wsTrim(LC(nazwa)).split(" ");
  for (let i = 0; i < tokeny.length; i++) {
    const tok = tokeny[i];
    let t = tok;
    if (t === "m" && i > 0) t = tokeny[i - 1] + "m";
    if (t.slice(0, 2) === "l=" || t.slice(0, 2) === "l-") t = t.slice(2);
    if ((tok.slice(0, 2) === "l-" || tok.slice(0, 2) === "l=" || /^l\d/.test(tok)) && t.slice(-1) !== "m") {
      if (t.slice(0, 1) === "l") t = t.slice(1);
      if (t !== "" && tylkoCyfry(t)) { const n = naLiczbe(t); if (n.ok && n.w > 30 && n.w <= 30000) return n.w / 1000; }
    }
    if (/^m\d.*x\d/.test(tok)) {
      t = tok.slice(tok.indexOf("x") + 1);
      if (tylkoCyfry(t)) { const n = naLiczbe(t); if (n.ok && n.w >= 100 && n.w <= 6000) return n.w / 1000; }
    }
    if (t.slice(-1) === "m" && t.slice(-2) !== "mm" && t.length > 1) {
      t = t.slice(0, -1);
      if (tylkoCyfry(t)) { const n = naLiczbe(t); if (n.ok && n.w > 0 && n.w <= 30) return n.w; }
    }
  }
  return 0;
}
export function pierwszaLiczba(s) {
  let bufor = "", i = 0;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (/[0-9]/.test(ch) || ((ch === "," || ch === ".") && bufor !== "")) bufor += ch;
    else if (bufor !== "") break;
  }
  if (bufor === "") return { w: 0, reszta: "" };
  return { w: liczba(bufor), reszta: s.slice(i).replace(/^ +/, "") };
}

/* Kontekst liczenia wag:
     wagi   – słownik z slownikWag()
     pamiec – zapamiętane odpowiedzi (sztuki w paczce, wymiar arkusza) – jak WAGI!G:H
     pytaj(rodzaj, klucz, pytanie, domyslna) -> tekst albo null (= Anuluj w InputBox) */
function pamietana(ctx, klucz) {
  for (const [k, v] of Object.entries(ctx.pamiec)) if (LC(k) === LC(klucz)) return v;
  return "";
}
function zapamietaj(ctx, klucz, v) {
  for (const k of Object.keys(ctx.pamiec)) if (LC(k) === LC(klucz)) { ctx.pamiec[k] = v; ctx.zmienionaPamiec = true; return; }
  ctx.pamiec[klucz] = v; ctx.zmienionaPamiec = true;
}

// ObliczWagePozycji – „Profil 120x80x3 S235 6m- 10 szt”. o = {szt, dl, kgmb, waga, uwaga} (ByRef jak w makrze)
export function obliczWagePozycji(tekst, ctx, o) {
  o.szt = 0; o.dl = 0; o.kgmb = 0; o.waga = 0;
  let dlSep = 2, p = tekst.indexOf("- ");
  if (p < 0) p = tekst.indexOf(" -");
  if (p < 0) { p = tekst.lastIndexOf("-"); dlSep = 1; }
  let nazwa, ilosc;
  if (p >= 0) {
    nazwa = vbaTrim(tekst.slice(0, p)); ilosc = vbaTrim(tekst.slice(p + dlSep));
    if (ilosc.slice(0, 1) === "-") ilosc = vbaTrim(ilosc.slice(1));
  } else { nazwa = tekst; ilosc = ""; }
  const nazwaU = UC(nazwa);
  const typ = typWyrobu(nazwaU);
  const wym = typ !== "" ? wymiarZNazwy(nazwaU, typ) : "";
  const klucz = typ + "|" + wym;
  if (typ !== "" && wym !== "" && ctx.wagi.has(klucz)) o.kgmb = ctx.wagi.get(klucz);
  o.dl = dlugoscZNazwy(nazwa);
  const pl = pierwszaLiczba(ilosc), reszta = LC(pl.reszta);
  if (pl.w > 0 && reszta.slice(0, 2) === "kg") { o.waga = pl.w; o.uwaga = "ilość podana w kg"; return true; }
  if (LC(ilosc).includes("paczk") && (pl.w === 0 || reszta.slice(0, 5) === "paczk")) {
    const paczki = pl.w === 0 ? 1 : pl.w;
    const kp = klucz + "|" + liczbaTekst(o.dl);
    const pam = liczba(pamietana(ctx, kp));
    const odp = ctx.pytaj("paczka", kp, `Ile sztuk jest w paczce?\n${nazwa}\n(zamówienie: ${ilosc})`, pam > 0 ? liczbaTekst(pam) : "");
    const n = naLiczbe(odp);
    if (n.ok && n.w > 0) {
      o.szt = paczki * n.w; zapamietaj(ctx, kp, n.w);
      o.uwaga = `${liczbaTekst(paczki)} x paczka po ${liczbaTekst(n.w)} szt`;
    } else { o.uwaga = "nie podano sztuk w paczce"; return false; }
  } else o.szt = pl.w;
  if (o.szt <= 0) { o.uwaga = "brak ilości w pozycji"; return false; }
  if (typ.slice(0, 6) === "BLACHA") return wagaBlachy(nazwa, nazwaU, typ, ctx, o);
  if (o.dl <= 0 && typ === "PRETGW") o.dl = 1;
  if (o.dl <= 0) {
    const odp = ctx.pytaj("dlugosc", "DL|" + nazwa, `Brak długości w nazwie. Podaj długość sztuki w metrach:\n${nazwa}`, "");
    const n = naLiczbe(odp);
    if (!n.ok || n.w <= 0) { o.dl = n.ok ? n.w : 0; o.uwaga = "brak długości"; return false; }
    o.dl = n.w;
  }
  if (o.kgmb <= 0) {
    o.uwaga = typ === "" ? "nie rozpoznano rodzaju wyrobu" : wym === "" ? "nie rozpoznano wymiaru" : `brak w tabeli WAGI: ${typ} ${wym}`;
    return false;
  }
  o.waga = o.szt * o.dl * o.kgmb;
  return true;
}
// blachy: o.dl = pole arkusza [m2], o.kgmb = kg/m2
function wagaBlachy(nazwa, nazwaU, typ, ctx, o) {
  let grub = gruboscBlachy(nazwaU);
  if (grub <= 0) {
    const n = naLiczbe(ctx.pytaj("grubosc", "GR|" + nazwa, `Podaj grubość blachy [mm]:\n${nazwa}`, ""));
    if (!n.ok || n.w <= 0) { o.uwaga = "brak grubości blachy"; return false; }
    grub = n.w;
  }
  o.kgmb = 0;
  const klucz = typ + "|" + liczbaTekst(grub);
  if (ctx.wagi.has(klucz)) o.kgmb = ctx.wagi.get(klucz);
  if (o.kgmb <= 0 && ctx.wagi.has("BLACHA|" + liczbaTekst(grub))) o.kgmb = ctx.wagi.get("BLACHA|" + liczbaTekst(grub));
  if (o.kgmb <= 0) { o.kgmb = grub * 7.85; o.uwaga = `grubości ${liczbaTekst(grub)} mm brak w WAGI - liczone 7,85 kg/m2 na 1 mm; `; }
  let wym = wymiarArkusza(nazwaU);
  if (wym === "") {
    const odp = ctx.pytaj("arkusz", "ARKUSZ|" + klucz, `Podaj wymiar arkusza (np. 1500x3000 albo 3x1,5):\n${nazwa}`, pamietana(ctx, "ARKUSZ|" + klucz));
    wym = LC(vbaTrim(odp ?? ""));
    if (poleArkusza(wym) <= 0) { o.uwaga = (o.uwaga ?? "") + "brak wymiaru arkusza"; return false; }
    zapamietaj(ctx, "ARKUSZ|" + klucz, wym);
  }
  o.dl = poleArkusza(wym);
  o.waga = o.szt * o.dl * o.kgmb;
  o.uwaga = (o.uwaga ?? "") + `blacha ${liczbaTekst(grub)} mm, arkusz ${wym} = ${liczbaTekst(vbaRound(o.dl, 3))} m2 x ${liczbaTekst(o.kgmb)} kg/m2`;
  return true;
}
export function gruboscBlachy(nazwaU) {
  const p = nazwaU.indexOf("#");
  if (p >= 0) return pierwszaLiczba(nazwaU.slice(p + 1, p + 9)).w;
  const tokeny = wsTrim(nazwaU).split(" ");
  for (let i = 1; i < tokeny.length; i++) {
    let t = tokeny[i];
    if (t.slice(0, 3) === "GR.") t = t.slice(3);
    if (t.slice(0, 2) === "GR") t = t.slice(2);
    if (t.slice(-2) === "MM") t = t.slice(0, -2);
    if (t !== "" && tylkoCyfry(t)) { const n = naLiczbe(t); if (n.ok && n.w > 0 && n.w <= 200) return n.w; }
  }
  for (const tok of tokeny) {
    const t = tok.replace(/×/g, "X");
    if (/^[0-9].*X.*X/.test(t)) {
      const cz = t.split("X");
      if (cz.length === 3) {
        let g = 0;
        let n = naLiczbe(cz[0]); if (n.ok) g = n.w;
        n = naLiczbe(cz[1]); if (n.ok && n.w < g) g = n.w;
        n = naLiczbe(cz[2]); if (n.ok && n.w < g) g = n.w;
        return g;
      }
    }
  }
  return 0;
}
export function wymiarArkusza(nazwaU) {
  for (const t of wsTrim(nazwaU.replace(/×/g, "X")).split(" "))
    if (t.includes("X") && /^[0-9]/.test(t) && poleArkusza(t) > 0) return LC(t);
  return "";
}
export function poleArkusza(s) {
  s = UC(vbaTrim(s).replace(/×/g, "X").replace(/ /g, ""));
  if (s === "") return 0;
  const v = [];
  for (const c of s.split("X")) {
    if (c === "") continue;
    const n = naLiczbe(c); if (!n.ok) return 0;
    if (v.length >= 3) return 0;
    v.push(n.w);
  }
  if (v.length < 2) return 0;
  let a = v[0], b = v[1];
  if (v.length === 3) {
    if (v[0] <= v[1] && v[0] <= v[2]) { a = v[1]; b = v[2]; }
    else if (v[1] <= v[0] && v[1] <= v[2]) { a = v[0]; b = v[2]; }
    else { a = v[0]; b = v[1]; }
  }
  if (a > 50) a /= 1000;
  if (b > 50) b /= 1000;
  if (a <= 0 || b <= 0) return 0;
  return a * b;
}

// ---------------------------------------------------------------- arkusz zapytania: kolory i ceny
export const kolor = k => (k === undefined || k === null || k === "" || k === -1 || UC(k) === "FFFFFF") ? -1 : UC(k);
export function wartoscKomorki(c) { return c ? c.v : undefined; }
export function ostKolumna(z) {
  let m = 2;
  for (const k of Object.keys(z.naglowki || {})) m = Math.max(m, +k);
  for (const w of z.wiersze) for (const k of Object.keys(w.c || {})) m = Math.max(m, +k);
  return m;
}
const naglowek = (z, c) => z.naglowki?.[c] || {};

// 5. Waga dla logistyki – PoliczWage
export function wagaDlaDostawcow(z, ctx) {
  const ostKol = ostKolumna(z), kolNagl = {}, nazwaDost = { 0: "BEZ DOSTAWCY (pozycja nie zaznaczona kolorem)" };
  let ileDost = 0;
  for (let c = 2; c <= ostKol; c++) {
    kolNagl[c] = -1;
    if (vbaTrim(naglowek(z, c).t ?? "") !== "") { kolNagl[c] = kolor(naglowek(z, c).k); if (kolNagl[c] !== -1) ileDost++; }
    nazwaDost[c] = vbaTrim(naglowek(z, c).t ?? "");
  }
  if (!ileDost) return { blad: `W zapytaniu ${z.nazwa} żaden dostawca w nagłówku nie jest zaznaczony kolorem. Zaznacz dostawcę i jego pozycje.` };
  const poz = [], suma = {}; let sumaWszystko = 0, bezWagi = 0;
  z.wiersze.forEach((w, idx) => {
    const tekst = vbaTrim(w.a); if (tekst === "") return;
    const p = { tekst, wiersz: idx + 2, uwagi: "" };
    let dost = 0;
    const kol = kolor(w.k);
    if (kol !== -1) {
      for (let c = 2; c <= ostKol; c++) if (kolNagl[c] === kol) { dost = c; break; }
      if (!dost) p.uwagi = "kolor pozycji nie pasuje do żadnego dostawcy";
    } else {
      for (let c = 2; c <= ostKol; c++) if (kolNagl[c] !== -1 && kolor(w.c?.[c]?.k) === kolNagl[c]) { dost = c; break; }
    }
    p.dost = dost; p.kolor = dost ? kolNagl[dost] : -1;
    const o = { uwaga: "" };
    if (obliczWagePozycji(tekst, ctx, o)) {
      Object.assign(p, { szt: o.szt, dl: o.dl, kgmb: o.kgmb, waga: o.waga });
      suma[dost] = (suma[dost] || 0) + o.waga;
      if (dost) sumaWszystko += o.waga;
    } else {
      Object.assign(p, { szt: o.szt, dl: o.dl, kgmb: o.kgmb, waga: -1 });
      if (dost) bezWagi++;
    }
    if (o.uwaga) p.uwagi = (p.uwagi ? p.uwagi + "; " : "") + o.uwaga;
    poz.push(p);
  });
  if (!poz.length) return { blad: `Zapytanie ${z.nazwa} nie ma pozycji.` };
  const kolejnosc = [];
  for (let c = 2; c <= ostKol; c++) if (poz.some(p => p.dost === c)) kolejnosc.push(c);
  if (poz.some(p => p.dost === 0)) kolejnosc.push(0);
  return {
    zapytanie: z.nazwa, sumaWszystko, bezWagi,
    dostawcy: kolejnosc.map(c => ({ c, nazwa: nazwaDost[c], kolor: c ? kolNagl[c] : -1, suma: suma[c] || 0,
      pozycje: poz.filter(p => p.dost === c) })),
  };
}

// ---------------------------------------------------------------- 6. koszt projektu
export function kluczPozycji(tekst) {
  let p = tekst.indexOf("- "); if (p < 0) p = tekst.indexOf(" -");
  const nazwa = p >= 0 ? vbaTrim(tekst.slice(0, p)) : vbaTrim(tekst);
  const nazwaU = UC(nazwa);
  let typ = typWyrobu(nazwaU);
  const wym = wymiarZNazwy(nazwaU, typ === "" ? "PROFIL" : typ);
  if (wym === "") return "";
  if (typ === "PROFIL" || typ === "") typ = "?";
  return typ + "|" + wym + "|" + liczbaTekst(dlugoscZNazwy(nazwa));
}
export const cenaZaMb = typ => ["PROFIL", "PROFILALU", "RURA", "BRAMOWY"].includes(typ);
function iloscZZapytania(tekst, ctx) {
  if (vbaTrim(tekst) === "" || !tekst.includes("-")) return { ok: false, mb: 0, kg: 0 };
  const o = { uwaga: "" };
  if (!obliczWagePozycji(tekst, ctx, o)) return { ok: false, mb: 0, kg: 0 };
  let kg = o.waga, mb = o.szt * o.dl;
  if (mb <= 0 && o.kgmb > 0 && kg > 0) mb = kg / o.kgmb;
  if (kg <= 0 && o.kgmb > 0 && mb > 0) kg = mb * o.kgmb;
  return { ok: mb > 0 || kg > 0, mb, kg };
}
// CenaZZapytania: s = stan liczenia (zajęte wiersze), wynik {cena, dostawca, uwaga, tekst}
function cenaZZapytania(zapytania, ark, tresc, nazwa, s) {
  const r0 = { cena: 0, dostawca: "", uwaga: "", tekst: "" };
  const z = zapytania.get(LC(ark));
  if (!z) return { ...r0, uwaga: "brak arkusza " + ark };
  const kluczN = kluczPozycji(nazwa);
  const kluczBezDl = kluczN ? kluczN.slice(0, kluczN.lastIndexOf("|")) : "";
  const zaj = r => s.zajete.has(LC(ark) + "#" + r);
  let wiersz = 0, wiersz2 = 0, wiersz3 = 0;
  const W = z.wiersze, txt = i => vbaTrim(W[i].a);
  for (let i = 0; i < W.length; i++) {
    const t = txt(i);
    if (t !== "" && tresc !== "" && !zaj(i + 2) && LC(t) === LC(tresc)) { wiersz = i + 2; break; }
  }
  if (!wiersz) {
    for (let i = 0; i < W.length; i++) {
      const t = txt(i);
      if (t === "" || zaj(i + 2)) continue;
      if ((tresc !== "" && LC(t.slice(0, tresc.length)) === LC(tresc)) ||
          LC(t.slice(0, nazwa.length + 1)) === LC(nazwa + "-") || LC(t.slice(0, nazwa.length + 1)) === LC(nazwa + " ")) { wiersz = i + 2; break; }
      if (kluczN !== "" && (!wiersz2 || !wiersz3)) {
        const kt = kluczPozycji(t);
        if (!wiersz2 && kt === kluczN) wiersz2 = i + 2;
        if (!wiersz3 && kt !== "" && kt.slice(0, kt.lastIndexOf("|")) === kluczBezDl) wiersz3 = i + 2;
      }
    }
  }
  if (!wiersz) wiersz = wiersz2;
  if (!wiersz) wiersz = wiersz3;
  if (!wiersz) return { ...r0, uwaga: "nie znaleziono pozycji w " + ark };
  s.zajete.add(LC(ark) + "#" + wiersz);
  const w = W[wiersz - 2], tekst = vbaTrim(w.a), ostKol = ostKolumna(z);
  const kolA = kolor(w.k);
  for (let c = 2; c <= ostKol; c++) {
    const kolH = kolor(naglowek(z, c).k);
    if (kolH === -1) continue;
    if (kolA === kolH || kolor(w.c?.[c]?.k) === kolH) {
      const n = naLiczbe(w.c?.[c]?.v);
      const dost = vbaTrim(naglowek(z, c).t ?? "");
      if (n.ok && n.w > 0) return { cena: n.w, dostawca: dost, uwaga: "", tekst };
      if (kolA === kolH) return { cena: 0, dostawca: dost, uwaga: `zaznaczony dostawca ${dost} nie ma ceny w wierszu ${wiersz}`, tekst };
    }
  }
  let minV = 0, minC = 0;
  for (let c = 2; c <= ostKol; c++) {
    const n = naLiczbe(w.c?.[c]?.v);
    if (n.ok && n.w > 0 && (minV === 0 || n.w < minV)) { minV = n.w; minC = c; }
  }
  if (minV > 0) return { cena: minV, dostawca: vbaTrim(naglowek(z, minC).t ?? ""), uwaga: "nie zaznaczono dostawcy - wzięta najniższa cena", tekst };
  return { cena: 0, dostawca: "", uwaga: "brak ceny w zapytaniu " + ark, tekst };
}

// PoliczKoszt + ZapiszRaportKosztu (liczby, bez formatowania)
export function policzKoszt(projekt, zapytaniaLista, ctx) {
  const zapytania = new Map(zapytaniaLista.map(z => [LC(z.nazwa), z]));
  const s = { zajete: new Set() };
  const P = [];
  for (const r of projekt.pozycje) {
    const nazwa = vbaTrim(r.nazwa), jm = LC(vbaTrim(r.jm)), ilosc = liczba(r.ilosc), niez = liczba(r.niez), cz = liczba(r.cz);
    const ark = vbaTrim(r.ark ?? ""), tresc = vbaTrim(r.tresc ?? "");
    const p = { nazwa, jm, ilosc, cz, kosztMag: 0, dost: "", cena: 0, jedn: "", ilRozl: 0, kosztZak: 0, brakCeny: false, waga: -1, wagaZak: 0 };
    let uw = "";
    // waga całej ilości na projekt
    const ow = { uwaga: "" }; let okW = false, wWaga = 0;
    if (ilosc > 0) {
      if (jm === "kg") { wWaga = ilosc; okW = true; }
      else if (jm === "m" || jm === "mb" || jm === "m.b.") {
        okW = obliczWagePozycji(nazwa + "- 1 szt", ctx, ow);
        if (okW && ow.kgmb > 0) wWaga = ilosc * ow.kgmb; else okW = false;
      } else { okW = obliczWagePozycji(nazwa + "- " + liczbaTekst(ilosc) + " szt", ctx, ow); wWaga = ow.waga; }
    }
    p.waga = okW ? wWaga : -1;
    // podział: z magazynu / do zakupu
    let zMag = ilosc + niez; if (zMag < 0) zMag = 0; if (zMag > ilosc) zMag = ilosc;
    const doZak = ilosc - zMag;
    p.zMag = zMag; p.doZak = doZak;
    if (zMag > 0) {
      if (cz > 0) p.kosztMag = zMag * cz;
      else { p.brakCeny = true; uw = "brak ceny ostatniego zakupu (Cena netto) w eksporcie"; }
    }
    if (doZak > 0) {
      const typ = typWyrobu(UC(nazwa)), naMb = cenaZaMb(typ);
      p.jedn = naMb ? "zł/mb" : "zł/kg";
      let cena = 0, dost = "", tekstZ = "";
      const o2 = { uwaga: "" };
      if (ark !== "") { const c = cenaZZapytania(zapytania, ark, tresc, nazwa, s); cena = c.cena; dost = c.dostawca; o2.uwaga = c.uwaga; tekstZ = c.tekst; }
      if (cena <= 0 && cz > 0 && (ark === "" || o2.uwaga.includes("nie znaleziono pozycji"))) {
        p.cena = cz; p.jedn = "zł/" + jm; p.ilRozl = doZak; p.kosztZak = doZak * cz; p.dost = "(cena zakupu)";
        o2.uwaga = ark === "" ? "nie było w zapytaniu - liczone wg ceny zakupu z Subiekta" : `nie znaleziono w ${ark} - liczone wg ceny zakupu z Subiekta`;
      } else if (cena > 0) {
        p.cena = cena; p.dost = dost;
        let ok = true, mb = 0, kg = 0;
        const uwC = o2.uwaga;
        const iz = iloscZZapytania(tekstZ, ctx);
        if (jm === "kg") {
          kg = doZak;
          if (naMb) { ok = obliczWagePozycji(nazwa + "- 1 szt", ctx, o2); if (ok && o2.kgmb > 0) mb = kg / o2.kgmb; else ok = false; }
        } else if (jm === "m" || jm === "mb" || jm === "m.b.") {
          mb = doZak;
          if (!naMb) { ok = obliczWagePozycji(nazwa + "- 1 szt", ctx, o2); if (ok && o2.kgmb > 0) kg = mb * o2.kgmb; else ok = false; }
        } else {
          ok = obliczWagePozycji(nazwa + "- " + liczbaTekst(doZak) + " szt", ctx, o2);
          mb = doZak * o2.dl; kg = o2.waga;
          if (naMb && o2.dl <= 0) ok = false;
        }
        if (!ok && iz.ok) {
          mb = iz.mb; kg = iz.kg;
          ok = (naMb && mb > 0) || (!naMb && kg > 0);
          if (ok) o2.uwaga = (uwC ? uwC + "; " : "") + "ilość wg zapytania: " + tekstZ;
        } else if (ok && iz.ok) {
          const iP = naMb ? mb : kg, iZ = naMb ? iz.mb : iz.kg, jed = naMb ? " mb" : " kg";
          if (iZ > iP * 1.005 + 0.01) o2.uwaga = (o2.uwaga ? o2.uwaga + "; " : "") + `zamówiono ${liczbaTekst(vbaRound(iZ, 1))}${jed}, nadwyżka ${liczbaTekst(vbaRound(iZ - iP, 1))}${jed} poza kosztem projektu`;
          else if (iZ < iP * 0.995 - 0.01) o2.uwaga = (o2.uwaga ? o2.uwaga + "; " : "") + `w zapytaniu tylko ${liczbaTekst(vbaRound(iZ, 1))}${jed} (potrzeba ${liczbaTekst(vbaRound(iP, 1))}${jed})`;
        }
        if (ok) { p.ilRozl = naMb ? mb : kg; p.kosztZak = p.ilRozl * cena; }
        else { p.brakCeny = true; if (!o2.uwaga) o2.uwaga = "nie da się przeliczyć na " + (naMb ? "mb" : "kg"); }
      } else {
        p.brakCeny = true; p.jedn = "";
        if (!o2.uwaga) o2.uwaga = ark === "" ? "nie było w zapytaniu i brak ceny zakupu w Subiekcie" : "brak ceny";
      }
      if (o2.uwaga) uw = (uw ? uw + "; " : "") + o2.uwaga;
    }
    if (p.waga >= 0 && ilosc > 0) p.wagaZak = p.waga * doZak / ilosc;
    if (p.waga < 0 && ilosc > 0) uw = (uw ? uw + "; " : "") + "brak wagi" + (ow.uwaga ? ` (${ow.uwaga})` : "");
    p.uwagi = uw;
    P.push(p);
  }
  // podsumowanie (ZapiszRaportKosztu)
  let sumMag = 0, sumZak = 0, ileBrak = 0, sumWaga = 0, sumWagaZak = 0, ileBezWagi = 0;
  const dostL = [];
  for (const p of P) {
    sumMag += p.kosztMag; sumZak += p.kosztZak;
    if (p.brakCeny) ileBrak++;
    if (p.waga >= 0) { sumWaga += p.waga; sumWagaZak += p.wagaZak; } else if (p.ilosc > 0) ileBezWagi++;
    if (p.kosztZak > 0) { const d = dostL.find(x => x.d === p.dost); if (d) d.s += p.kosztZak; else dostL.push({ d: p.dost, s: p.kosztZak }); }
  }
  return { projId: projekt.id, kod: projekt.kod, pozycje: P, sumMag, sumZak, dostawcy: dostL, ileBrak, sumWaga, sumWagaZak, ileBezWagi };
}

// projekt „żyje”, gdy istnieje zapytanie o jego nazwie albo zapytanie zapisane przy którejś pozycji (PosprzatajProjekty)
export function projektZywy(projekt, nazwyZapytan) {
  const n = new Set(nazwyZapytan.map(LC));
  return n.has(LC(projekt.id)) || projekt.pozycje.some(p => vbaTrim(p.ark ?? "") !== "" && n.has(LC(vbaTrim(p.ark))));
}
// projekt dla zapytania (KosztProjektu: kolumna A albo L arkusza PROJEKTY)
export function projektDlaZapytania(projekty, nazwa) {
  return projekty.find(p => LC(p.id) === LC(nazwa) || p.pozycje.some(x => LC(x.ark ?? "") === LC(nazwa))) || null;
}

// ---------------------------------------------------------------- kolory cen (najniższa zielona, najwyższa czerwona)
export function skrajneCeny(w, ostKol = 30) {
  const ceny = [];
  for (const [k, c] of Object.entries(w.c || {})) { const kk = +k; if (kk >= 2 && kk <= ostKol && typeof c.v === "number") ceny.push([kk, c.v]); }
  if (!ceny.length) return { min: new Set(), max: new Set() };
  const mn = Math.min(...ceny.map(x => x[1])), mx = Math.max(...ceny.map(x => x[1]));
  return { min: new Set(ceny.filter(x => x[1] === mn).map(x => x[0])), max: new Set(ceny.filter(x => x[1] === mx && mx !== mn).map(x => x[0])) };
}

// prosta formuła w komórce ceny: „=2,93*4,25”
export function policzFormule(f) {
  const s = String(f).replace(/^=/, "").replace(/,/g, ".").replace(/\s/g, "");
  if (!/^[0-9.+\-*/()]+$/.test(s)) return null;
  try { const v = Function(`"use strict";return (${s});`)(); return typeof v === "number" && isFinite(v) ? v : null; } catch { return null; }
}
