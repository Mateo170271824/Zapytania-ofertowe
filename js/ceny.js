/* Baza cen: lista z Subiekta (cena ewidencyjna), ceny zakupu z eksportów (projekty)
   i ceny dostawców wybranych w zapytaniach (tylko kupione – zaznaczone kolorem).
   Każda cena przeliczana na zł/kg, zł/mb i zł/szt (wagi i długości jak w makrach). */
import * as L from "./logika.js?v=202611121300";

export const WYKLUCZ_NAZWA = /WYPA[ŁL]K|W[ÓO]ZE?K/;          // wypałki, wózki podwieszane
export const WYKLUCZ_RODZAJ = ["KT"];                          // kolumna B listy (KT – kooperacja)

const NAZWY_TYPOW = { PROFIL: "Profil", PROFILALU: "Profil ALU", RURA: "Rura", BRAMOWY: "Profil bramowy", IPE: "IPE", IPN: "IPN", HEA: "HEA", HEB: "HEB", HEM: "HEM",
  UPN: "UPN", UPE: "UPE", KATOWNIK: "Kątownik", KATOWNIKZG: "Kątownik Z/G", CEOWNIK: "Ceownik", PLASKOWNIK: "Płaskownik", PRET: "Pręt", PRETKW: "Pręt kwadratowy",
  PRET6K: "Pręt sześciokątny", PRETGW: "Pręt gwintowany", BLACHA: "Blacha", BLACHAOC: "Blacha OC" };
export const GRUPY_TYPOW = { PROFIL: "Profile", PROFILALU: "Profile ALU", RURA: "Rury", BRAMOWY: "Profile bramowe", IPE: "Dwuteowniki", IPN: "Dwuteowniki", HEA: "Dwuteowniki",
  HEB: "Dwuteowniki", HEM: "Dwuteowniki", UPN: "Ceowniki", UPE: "Ceowniki", CEOWNIK: "Ceowniki", KATOWNIK: "Kątowniki", KATOWNIKZG: "Kątowniki", PLASKOWNIK: "Płaskowniki",
  PRET: "Pręty", PRETKW: "Pręty", PRET6K: "Pręty", PRETGW: "Pręty gwintowane", BLACHA: "Blachy", BLACHAOC: "Blachy" };
const PRETY_ZA_KG = ["PRET", "PRETKW", "PRET6K"];

// „Blacha #1,5 2x1m” – wymiar arkusza bez „m”, żeby dało się policzyć wagę
const nazwaDoWagi = n => n.replace(/(\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?)\s*m\b/g, "$1");

export function gatunek(U) {
  const m = U.match(/\bS\s?(\d{3})(GD)?/);
  if (m) return "S" + m[1] + (m[2] || "");
  const b = U.match(/\bB500\w*/); if (b) return b[0];
  const dx = U.match(/\bDX5\dD/); if (dx) return dx[0];
  const al = U.match(/\b(6005A?|6060|6063|6082)\b/); if (al) return "AL " + al[1];
  if (/NIERDZ|INOX|304|316L?/.test(U)) return "nierdzewna";
  return "";
}
export const powloka = U => (/\bOC\b|OCYNK|Z275|\+Z\d/.test(U) ? "ocynk" : "");

// wyrób = typ + wymiar + gatunek (+ ocynk); długość nie dzieli wyrobu
export function wyrob(nazwa) {
  const U = L.UC(L.vbaTrim(nazwa));
  const typ = L.typWyrobu(U);
  if (!typ) return null;
  let wym = typ.startsWith("BLACHA") ? (L.gruboscBlachy(U) ? "#" + L.liczbaTekst(L.gruboscBlachy(U)) : "") : L.wymiarZNazwy(U, typ);
  if (!wym) return null;
  const gat = gatunek(U), pow = powloka(U);
  const opis = [NAZWY_TYPOW[typ] || typ, wym, gat, pow === "ocynk" && !typ.endsWith("OC") ? "ocynk" : ""].filter(Boolean).join(" ");
  return { typ, wym, gat, pow, klucz: [typ, wym, gat, pow].join("|"), opis, grupa: GRUPY_TYPOW[typ] || "Inne" };
}

// waga sztuki i długość (blacha: pole arkusza) z nazwy – bez pytań
export function miaryZNazwy(nazwa, ctx) {
  const o = { uwaga: "" };
  const c = { ...ctx, pamiec: { ...(ctx.pamiec || {}) }, pytaj: () => null };
  const ok = L.obliczWagePozycji(nazwaDoWagi(L.vbaTrim(nazwa)) + "- 1 szt", c, o);
  const typ = L.typWyrobu(L.UC(nazwa));
  return { kgSzt: ok ? o.waga : 0, dl: o.dl > 0 ? o.dl : 0, kgmb: o.kgmb > 0 && !typ.startsWith("BLACHA") ? o.kgmb : 0, blacha: typ.startsWith("BLACHA") };
}
// cena w jednostce jm -> {zlKg, zlMb, zlSzt}
export function przelicz(cena, jm, m) {
  jm = L.LC(jm).replace(/\.$/, "");
  const r = { zlKg: null, zlMb: null, zlSzt: null };
  if (!(cena > 0)) return r;
  if (jm === "kg") { r.zlKg = cena; if (m.kgSzt) r.zlSzt = cena * m.kgSzt; if (m.kgmb) r.zlMb = cena * m.kgmb; }
  else if (jm === "t") { r.zlKg = cena / 1000; if (m.kgSzt) r.zlSzt = r.zlKg * m.kgSzt; if (m.kgmb) r.zlMb = r.zlKg * m.kgmb; }
  else if (jm === "szt" || jm === "ark" || jm === "kpl") { r.zlSzt = cena; if (m.kgSzt) r.zlKg = cena / m.kgSzt; if (m.dl && !m.blacha) r.zlMb = cena / m.dl; }
  else if (jm === "mb" || jm === "m" || jm === "m.b") { r.zlMb = cena; if (m.kgmb) r.zlKg = cena / m.kgmb; if (m.dl && !m.blacha) r.zlSzt = cena * m.dl; }
  return r;
}
const ROZSADNE_KG = [1.5, 25];        // zł/kg dla stali – poza tym zakresem cena jest podejrzana
const rozsadne = v => v >= ROZSADNE_KG[0] && v <= ROZSADNE_KG[1];

// jednostka ceny z listy: pręty za kg, potem Subiekt (szt/kg/mb), potem z wagi
export function jednostkaCeny(nazwa, cena, ctx, jmSubiekt) {
  const U = L.UC(nazwa), typ = L.typWyrobu(U), m = miaryZNazwy(nazwa, ctx);
  if (PRETY_ZA_KG.includes(typ)) return { jm: "kg", skad: "reguła: pręty za kg", m };
  const js = L.LC(jmSubiekt || "").replace(/\.$/, "");
  if (["szt", "kg", "mb", "m"].includes(js)) return { jm: js, skad: "jednostka z Subiekta", m };
  if (m.kgSzt && rozsadne(cena / m.kgSzt)) return { jm: "szt", skad: "z wagi sztuki", m };
  if (m.kgmb && rozsadne(cena / m.kgmb)) return { jm: "mb", skad: "z wagi metra", m };
  if (rozsadne(cena) && (m.kgSzt || m.kgmb)) return { jm: "kg", skad: "z wagi (cena jak za kg)", m };
  return { jm: "", skad: m.kgSzt || m.kgmb ? "cena nie pasuje do wagi" : "brak wagi w tabeli WAGI", m };
}

/* Lista „Surowiec” z Subiekta: Symbol | Rodzaj | Nazwa | Cena ewidencyjna
   -> pozycje do bazy i lista do sprawdzenia. */
export function czytajListe(tabela, ctx, jmZnane = {}) {
  let wN = -1;
  for (let r = 0; r < Math.min(20, tabela.length) && wN < 0; r++) if ((tabela[r] || []).some(v => L.LC(L.vbaTrim(v ?? "")) === "nazwa")) wN = r;
  if (wN < 0) return { blad: "W pliku nie znalazłem nagłówka z kolumną „Nazwa”." };
  const nag = tabela[wN].map(v => L.LC(L.vbaTrim(v ?? "")));
  const k = n => nag.findIndex(x => x === n);
  const kSym = k("symbol"), kRodz = k("rodzaj"), kNaz = k("nazwa");
  let kCena = nag.findIndex(x => x.startsWith("cena") && !x.includes("symbol"));
  const kJm = [k("j.m."), k("jm")].find(i => i >= 0) ?? -1;
  if (kCena < 0) return { blad: "W pliku nie ma kolumny z ceną (np. „Cena ewidencyjna”)." };
  const surowe = [];
  for (let r = wN + 1; r < tabela.length; r++) {
    const row = tabela[r] || [], nazwa = L.wsTrim(String(row[kNaz] ?? ""));
    if (!nazwa) continue;
    surowe.push({ symbol: L.vbaTrim(String(row[kSym] ?? "")), rodzaj: L.UC(L.vbaTrim(String(row[kRodz] ?? ""))), nazwa, cena: L.liczba(row[kCena]), jm: kJm >= 0 ? L.vbaTrim(String(row[kJm] ?? "")) : "" });
  }
  const pominiete = { kt: 0, wypalki: 0, duplikaty: 0, zero: 0 };
  const wykluczoneSymbole = [];
  let lista = surowe.filter(p => { if (WYKLUCZ_RODZAJ.includes(p.rodzaj)) { pominiete.kt++; wykluczoneSymbole.push(p.symbol); return false; } if (WYKLUCZ_NAZWA.test(L.UC(p.nazwa))) { pominiete.wypalki++; wykluczoneSymbole.push(p.symbol); return false; } return true; });
  // duplikaty po nazwie: zostaje pozycja z ceną > 0, a z kilku – o nowszym (wyższym) symbolu
  const wg = new Map();
  for (const p of lista) {
    const key = L.LC(p.nazwa), q = wg.get(key);
    if (!q) { wg.set(key, p); continue; }
    pominiete.duplikaty++;
    const lepszy = (p.cena > 0) !== (q.cena > 0) ? (p.cena > 0 ? p : q) : (String(p.symbol).localeCompare(String(q.symbol), "pl", { numeric: true }) > 0 ? p : q);
    wg.set(key, lepszy);
  }
  lista = [...wg.values()];
  // zaślepki: ta sama kwota (>25 zł) przy co najmniej 3 różnych wyrobach
  const wyrobyCeny = new Map();
  for (const p of lista) { if (!(p.cena > 25)) continue; const w = wyrob(p.nazwa); const s = wyrobyCeny.get(p.cena) || new Set(); s.add(w ? w.klucz : p.nazwa); wyrobyCeny.set(p.cena, s); }
  const pozycje = [], doSprawdzenia = [];
  for (const p of lista) {
    if (!(p.cena > 0)) { pominiete.zero++; continue; }
    const w = wyrob(p.nazwa);
    const zasl = p.cena > 25 && (wyrobyCeny.get(p.cena)?.size || 0) >= 3;
    const j = jednostkaCeny(p.nazwa, p.cena, ctx, p.jm || jmZnane[p.symbol]);
    const poz = { symbol: p.symbol, nazwa: p.nazwa, cena: p.cena, jm: zasl ? "" : j.jm, skad: zasl ? `ta sama kwota przy ${wyrobyCeny.get(p.cena).size} różnych wyrobach – pewnie cena wpisana na próbę` : j.skad, wyrob: w ? w.klucz : "" };
    if (!poz.jm || !w) { poz.powod = !w ? "nie rozpoznano wyrobu (typ i wymiar)" : poz.skad; doSprawdzenia.push(poz); }
    pozycje.push(poz);
  }
  return { pozycje, doSprawdzenia, pominiete, wykluczoneSymbole, wszystkich: surowe.length };
}

// ---------------------------------------------------------------- daty zapytań
// zapytania z importu nie mają daty: data z projektu (dokładna), a dla reszty szacunek z numeru
export function datyZapytan(zapytania, projekty) {
  const znane = new Map();           // "rok|numer" -> data ISO
  for (const p of projekty) {
    const m = String(p.id).match(/^(\d+)-(\d{4})/);
    if (m && /^\d{4}-\d{2}-\d{2}$/.test(p.data || "")) znane.set(m[2] + "|" + +m[1], p.data);
  }
  for (const z of zapytania) if (z.dataZap && z.numer && z.rok) znane.set(z.rok + "|" + z.numer, z.dataZap);
  const wynik = new Map();
  for (const z of zapytania) {
    if (z.dataZap) { wynik.set(z.nazwa, { data: z.dataZap, szac: false }); continue; }
    if (!z.numer || !z.rok) { wynik.set(z.nazwa, null); continue; }
    const k = z.rok + "|" + z.numer;
    if (znane.has(k)) { wynik.set(z.nazwa, { data: znane.get(k), szac: false }); continue; }
    const pkt = [[0, `${z.rok}-01-01`], ...[...znane].filter(([kk]) => kk.startsWith(z.rok + "|")).map(([kk, d]) => [+kk.split("|")[1], d])].sort((a, b) => a[0] - b[0]);
    let a = pkt[0], b = null;
    for (const p of pkt) { if (p[0] <= z.numer) a = p; else { b = p; break; } }
    let t;
    if (!b) t = Date.parse(a[1]);
    else t = Date.parse(a[1]) + (Date.parse(b[1]) - Date.parse(a[1])) * (z.numer - a[0]) / (b[0] - a[0]);
    wynik.set(z.nazwa, { data: new Date(t).toISOString().slice(0, 10), szac: true });
  }
  return wynik;
}

// ---------------------------------------------------------------- zebranie wszystkich punktów cen
/* punkt: { wyrob, opis, grupa, nazwa, data, szac, zrodlo: "lista"|"zakup"|"zapytanie", dostawca, cena, jm, zlKg, zlMb, zlSzt, dl, symbol, zapytanie } */
export function zbierzCeny({ lista = [], projekty = [], zapytania = [] }, ctx) {
  const punkty = [];
  const dodaj = (nazwa, cena, jm, info) => {
    const w = wyrob(nazwa); if (!w || !(cena > 0) || !jm) return;
    if (WYKLUCZ_NAZWA.test(L.UC(nazwa))) return;
    const m = miaryZNazwy(nazwa, ctx);
    let r = przelicz(cena, jm, m);
    // w zapytaniach cena profili bywa wpisana za kg zamiast za mb (i odwrotnie) – sprawdzam po wadze
    if (info.zrodlo === "zapytanie" && r.zlKg !== null && !rozsadne(r.zlKg)) {
      const inna = jm === "mb" ? "kg" : "mb", r2 = przelicz(cena, inna, m);
      if (r2.zlKg !== null && rozsadne(r2.zlKg)) { r = r2; jm = inna; }
    }
    if (r.zlKg !== null && !rozsadne(r.zlKg)) return;     // np. zaślepki albo pomyłki
    punkty.push({ wyrob: w.klucz, opis: w.opis, grupa: w.grupa, typ: w.typ, gat: w.gat, nazwa, cena, jm, ...r, dl: m.dl, blacha: m.blacha, ...info });
  };
  // 1) lista z Subiekta (zap_ceny): historia cen ewidencyjnych
  //    (pozycje dopisane z eksportu albo z zamówienia mają już swoje ceny w punktach 2 i 3 – bez dublowania)
  for (const d of lista) {
    if (d.status === "pomin" || d.zrodlo) continue;
    for (const h of d.historia || []) dodaj(d.nazwa, h.c, d.jm, { zrodlo: "lista", data: h.d, szac: false, symbol: d.symbol, dostawca: "" });
  }
  // 2) eksporty z Subiekta zapisane w projektach: cena ostatniego zakupu (Cena netto) z jednostką
  for (const p of projekty) for (const x of p.pozycje || []) {
    if (x.cz === undefined || x.cz === "" || !(+x.cz > 0)) continue;
    dodaj(x.nazwa, +x.cz, x.jm, { zrodlo: "zakup", data: p.data, szac: false, symbol: x.symbol, dostawca: "", zapytanie: p.id });
  }
  // 3) zapytania: tylko pozycje z wybranym dostawcą (kolor) – cena za mb (profile, rury, bramowe) albo za kg
  const daty = datyZapytan(zapytania, projekty);
  for (const z of zapytania) {
    const dz = daty.get(z.nazwa); if (!dz) continue;
    for (const w of z.wiersze || []) {
      const t = L.vbaTrim(w.a); if (!t) continue;
      const kolA = L.kolor(w.k);
      for (const [c, h] of Object.entries(z.naglowki || {})) {
        const kh = L.kolor(h.k); if (kh === -1) continue;
        if (kolA !== kh && L.kolor(w.c?.[c]?.k) !== kh) continue;
        const n = L.naLiczbe(w.c?.[c]?.v); if (!n.ok || n.w <= 0) continue;
        let p = t.indexOf("- "); if (p < 0) p = t.indexOf(" -");
        const nazwa = p >= 0 ? L.vbaTrim(t.slice(0, p)) : t;
        const typ = L.typWyrobu(L.UC(nazwa));
        dodaj(nazwa, n.w, L.cenaZaMb(typ) ? "mb" : "kg", { zrodlo: "zapytanie", data: dz.data, szac: dz.szac, dostawca: L.vbaTrim(h.t), zapytanie: z.nazwa });
        break;
      }
    }
  }
  punkty.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return punkty;
}

// podsumowanie wyrobu: ostatnia cena, min/max w 12 miesiącach, zmiana do poprzedniej
export function podsumowanie(punkty, dzis = new Date().toISOString().slice(0, 10)) {
  const rokTemu = new Date(Date.parse(dzis) - 365 * 864e5).toISOString().slice(0, 10);
  const wg = new Map();
  for (const p of punkty) { const a = wg.get(p.wyrob) || []; a.push(p); wg.set(p.wyrob, a); }
  return [...wg.values()].map(a => {
    const ost = a[a.length - 1];
    const zKg = a.filter(p => p.zlKg !== null);
    const ostKg = zKg[zKg.length - 1];
    const poprz = [...zKg].reverse().find(p => p !== ostKg && p.zlKg !== ostKg?.zlKg);
    const rok = zKg.filter(p => p.data >= rokTemu).map(p => p.zlKg);
    return { wyrob: ost.wyrob, opis: ost.opis, grupa: ost.grupa, typ: ost.typ, gat: ost.gat, ost, ostKg, ile: a.length,
             minRok: rok.length ? Math.min(...rok) : null, maxRok: rok.length ? Math.max(...rok) : null,
             zmiana: ostKg && poprz ? (ostKg.zlKg - poprz.zlKg) / poprz.zlKg : null, punkty: a };
  }).sort((a, b) => a.opis.localeCompare(b.opis, "pl", { numeric: true }));
}

// zestawienie miesięczne: średnia zł/kg (albo zł/mb) na wyrób/grupę w danym roku
export function zestawienieRoku(punkty, rok, po = "wyrob", miara = "zlKg") {
  const wg = new Map();
  for (const p of punkty) {
    if (!String(p.data).startsWith(String(rok)) || p[miara] === null) continue;
    const k = po === "grupa" ? `${p.grupa}${p.gat ? " " + p.gat : ""}` : p.opis;
    const m = +String(p.data).slice(5, 7) - 1;
    const r = wg.get(k) || { nazwa: k, mies: Array.from({ length: 12 }, () => []) };
    r.mies[m].push(p[miara]); wg.set(k, r);
  }
  return [...wg.values()].map(r => ({ nazwa: r.nazwa, mies: r.mies.map(a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), ile: r.mies.reduce((s, a) => s + a.length, 0) }))
    .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl", { numeric: true }));
}

// ---------------------------------------------------------------- nowe pozycje do bazy (bez listy z Subiekta)
/* pozycje: [{ symbol, nazwa, cena, jm, zrodlo: "zakup" | "zamowienie", data, dostawca, zapytanie }]
   istniejace: dokumenty zap_ceny ({_id, nazwa}) -> { dokumenty: [{id, d}], pominiete } – tylko pozycje, których w bazie jeszcze nie ma */
export const idPozycji = (symbol, nazwa) => String(symbol || "").replace(/\//g, "-").trim() || "N-" + L.LC(nazwa).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
export function noweDoBazy(pozycje, istniejace, ctx) {
  const ids = new Set(istniejace.map(d => d._id)), nazwy = new Set(istniejace.map(d => L.LC(L.vbaTrim(d.nazwa || ""))));
  const dokumenty = []; let pominiete = 0;
  for (const p of pozycje) {
    const nazwa = L.wsTrim(p.nazwa || ""), id = idPozycji(p.symbol, nazwa), cena = +p.cena;
    if (!nazwa || !(cena > 0) || WYKLUCZ_NAZWA.test(L.UC(nazwa))) { pominiete++; continue; }
    if (ids.has(id) || nazwy.has(L.LC(nazwa))) continue;
    let jm, status = "";
    if (p.zrodlo === "zakup") { jm = jednostkaCeny(nazwa, cena, ctx, p.jm).jm; if (!jm) { jm = L.LC(p.jm || "").replace(/\.$/, "") || "szt"; status = "sprawdz"; } }
    else {
      const typ = L.typWyrobu(L.UC(nazwa));
      if (!typ || !wyrob(nazwa)) jm = L.LC(p.jm || "") || "szt";               // obejmy, śruby… – cena za jednostkę z zapytania
      else {
        jm = L.cenaZaMb(typ) ? "mb" : "kg";
        const m = miaryZNazwy(nazwa, ctx), r = przelicz(cena, jm, m);
        if (r.zlKg !== null && !rozsadne(r.zlKg)) { const inna = jm === "mb" ? "kg" : "mb", r2 = przelicz(cena, inna, m); if (r2.zlKg !== null && rozsadne(r2.zlKg)) jm = inna; else status = "sprawdz"; }
      }
    }
    const skad = p.zrodlo === "zakup" ? "eksport z Subiekta (cena zakupu)" : `zamówienie ${p.zapytanie || ""} – ${p.dostawca || ""}`.trim();
    ids.add(id); nazwy.add(L.LC(nazwa));
    dokumenty.push({ id, d: { symbol: p.symbol || "", nazwa, jm, skad, zrodlo: p.zrodlo, status, historia: [{ d: p.data, c: cena, ...(p.dostawca ? { dost: p.dostawca } : {}) }] } });
  }
  return { dokumenty, pominiete };
}
