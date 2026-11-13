// Zapytania: pytania makra, 5. waga dla logistyki, 6. koszt projektu, projekty
import * as L from "../logika.js?v=202611121300";
import * as I from "../import-excel.js?v=202611121300";
import * as ZM from "../zamowienia.js?v=202611121300";
import { $, esc, today, fDT, fD, clone, fmt, zl, hex, toast, failed, okno, pobierzPlik, czytajPlik } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { B, M, P, U, W, Z, czysc, diffProj, go, odpowiedzi, render, sv, ustawW, widok, wpis, zaladowane, zapById, zapByNazwa, zapiszDok, zapiszUst } from '../app.js?v=202611121300';
import { E, bezEnterZapisu } from './arkusz.js?v=202611121300';
import { czekajNa } from './generator.js?v=202611121300';

/* ============================================================ pytania makra (długość, paczka, grubość, arkusz) */
// liczy fn(ctx); gdy brakuje odpowiedzi – pyta w jednym oknie i liczy ponownie
export async function zPytaniami(fn) {
  for (let proba = 0; proba < 4; proba++) {
    const brak = [];
    const pamiec = clone(W.pamiec || {});
    const ctx = { wagi: L.slownikWag(W), pamiec, pytaj: (rodzaj, klucz, tresc, dom) => {
      if (rodzaj === "paczka" || rodzaj === "arkusz") { if (klucz in odpowiedzi) return odpowiedzi[klucz]; }
      else if (klucz in odpowiedzi) return odpowiedzi[klucz];
      if (!brak.some(b => b.klucz === klucz)) brak.push({ rodzaj, klucz, tresc, dom }); return null; } };
    const wynik = fn(ctx);
    if (!brak.length) {
      if (ctx.zmienionaPamiec && JSON.stringify(pamiec) !== JSON.stringify(W.pamiec || {})) {
        const zm = Object.entries(pamiec).filter(([k, v]) => sv(W.pamiec?.[k]) !== sv(v)).map(([k, v]) => ({ p: "zapamiętano " + k, a: sv(W.pamiec?.[k]), b: sv(v) }));
        zapiszUst("wagi", { rows: W.rows, pamiec }, "WAGI", zm).catch(failed); ustawW({ ...W, pamiec });
      }
      return wynik;
    }
    const r = await okno(`<h3>Potrzebne dane do wyliczenia</h3><p class="small">Tak jak makro – zapyta o to, czego nie da się odczytać z nazwy. Sztuki w paczce i wymiary arkuszy zostaną zapamiętane. Puste pole = pozycja bez wagi (jak „Anuluj” w Excelu).</p>
      ${brak.map((b, i) => `<label>${esc(b.tresc).replace(/\n/g, "<br>")}<input name="q${i}" value="${esc(b.dom ?? "")}" ${b.rodzaj === "arkusz" ? "" : 'inputmode="decimal"'}></label>`).join("")}`,
      [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Licz", cls: "primary" }]);
    brak.forEach((b, i) => { odpowiedzi[b.klucz] = r.v === "ok" ? r.form["q" + i].value.trim() : ""; });
  }
  return null;
}

/* ============================================================ 5. waga dla logistyki */
export async function renderWaga() {
  const z = zapById(widok.arg);
  if (!z) { M().innerHTML = `<div class="empty">${zaladowane.z ? "Nie ma takiego zapytania" : "Wczytywanie…"}</div>`; return; }
  M().innerHTML = `<div class="empty">Liczenie…</div>`;
  const w = await zPytaniami(ctx => L.wagaDlaDostawcow(z, ctx));
  if (!w) return;
  if (w.blad) { M().innerHTML = `<div class="panel"><div class="hd"><div class="toolbar"><a class="btn" href="#z-${z._id}">← ${esc(z.nazwa)}</a><h2>Waga dla logistyki</h2></div></div><div class="bd"><p class="notice">${esc(w.blad)}</p><p class="small">W zapytaniu włącz „Wybór dostawcy kolorem” i kliknij ceny wybranych dostawców.</p></div></div>`; return; }
  const sumaRaport = w.dostawcy.filter(d => d.c > 0);
  M().innerHTML = `<div class="panel"><div class="hd"><div class="toolbar"><a class="btn" href="#z-${z._id}">← ${esc(z.nazwa)}</a><h2>Waga dla logistyki</h2></div><span class="small">Zapytanie: ${esc(z.nazwa)} | ${fDT(new Date())}</span></div>
    <div class="bd tablebox"><table class="t" style="max-width:620px"><thead><tr><th>DOSTAWCA</th><th class="num">WAGA [kg]</th><th class="num">WAGA [t]</th></tr></thead><tbody>
      ${sumaRaport.map(d => `<tr><td style="background:${hex(d.kolor)};color:#111">${esc(d.nazwa)}</td><td class="num">${fmt(L.vbaRound(d.suma, 1), 1)}</td><td class="num">${fmt(L.vbaRound(d.suma / 1000, 3), 3)}</td></tr>`).join("")}
      <tr class="suma"><td>RAZEM</td><td class="num">${fmt(L.vbaRound(w.sumaWszystko, 1), 1)}</td><td class="num">${fmt(L.vbaRound(w.sumaWszystko / 1000, 3), 3)}</td></tr></tbody></table>
      ${w.bezWagi ? `<p class="red strong">Uwaga: ${w.bezWagi} poz. bez policzonej wagi – nie ma ich w sumie (patrz UWAGI niżej).</p>` : ""}</div></div>
    ${w.dostawcy.map(d => `<div class="panel"><div class="hd" style="background:${hex(d.kolor)};color:${d.c ? "#111" : "inherit"};border-radius:8px 8px 0 0"><h3>${esc(d.nazwa)}</h3></div>
      <div class="tablebox"><table class="t" style="min-width:820px"><thead><tr><th>LP</th><th>POZYCJA</th><th class="num">SZT</th><th class="num">DŁ. [m] / m2</th><th class="num">kg/mb / kg/m2</th><th class="num">WAGA [kg]</th><th>UWAGI</th></tr></thead><tbody>
      ${d.pozycje.map((p, i) => `<tr><td class="num">${i + 1}</td><td>${esc(p.tekst)}</td><td class="num">${p.szt > 0 ? L.ogolny(p.szt) : ""}</td><td class="num">${p.dl > 0 ? L.ogolny(p.dl) : ""}</td><td class="num">${p.kgmb > 0 ? L.ogolny(p.kgmb) : ""}</td>
        <td class="num ${p.waga < 0 ? "red" : ""}">${p.waga >= 0 ? fmt(L.vbaRound(p.waga, 1), 1) : "?"}</td><td class="${p.waga < 0 ? "red" : ""}">${esc(p.uwagi)}</td></tr>`).join("")}
      <tr class="suma"><td></td><td>${d.c ? "RAZEM " + esc(d.nazwa) : "RAZEM bez dostawcy (nie liczone w sumie)"}</td><td></td><td></td><td></td><td class="num">${fmt(L.vbaRound(d.suma, 1), 1)}</td><td></td></tr></tbody></table></div></div>`).join("")}`;
}

/* ============================================================ 6. koszt projektu */
export const projById = id => P.find(p => p._id === id);
export async function kosztDlaZapytania(z) {
  const p = L.projektDlaZapytania(P, z.nazwa);
  if (p) return go("koszt", p._id);
  const r = await okno(`<h3>Koszt projektu</h3><p>Zapytanie <b>${esc(z.nazwa)}</b> nie ma zapisanych danych projektu (powstało przed wersją z kosztem projektu albo ręcznie).</p><p>Wskaż eksport z Subiekta dla tego projektu, a dane zapiszą się na stałe.</p>
    <label class="btn filebtn">Wybierz plik eksportu<input type="file" name="plik" accept=".xlsx,.xls,.xlsm,.csv"></label>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Wczytaj", cls: "primary" }]);
  const f = r.form.plik?.files?.[0];
  if (r.v !== "ok" || !f) return;
  try {
    const wb = XLSX.read(await czytajPlik(f), { type: "array" });
    const w = L.wczytajEksport(I.tabelaPierwszegoArkusza(XLSX, wb), f.name, U);
    if (w.blad) return okno(`<h3>Koszt projektu</h3><p>${esc(w.blad)}</p>`);
    const pozycje = w.wiersze.map(p => ({ symbol: p.symbol, nazwa: p.nazwa, jm: p.jm, ilosc: p.ilosc, niez: p.niezarez, nazd: p.nazd, ...(w.bezCeny ? {} : { cz: p.cz }), zapytano: "?", ark: z.nazwa, tresc: "" }));
    const rr = await zapiszDok(C.p, null, { id: z.nazwa, kod: L.vbaTrim(z.kod), data: today(), pozycje }, { typ: "projekt", etykieta: z.nazwa, diffFn: diffProj });
    if (w.bezCeny) toast("Uwaga: w eksporcie nie ma kolumny „Cena netto” – materiał z magazynu wyjdzie bez ceny.");
    await czekajNa(() => projById(rr.id)); go("koszt", rr.id);
  } catch (x) { failed(x); }
}
// ---------- edycja projektu: pozycje liczone do kosztu (np. IPE 330 3×10 m → 1×10 m + 2×12 m)
// pozycja projektu z wiersza zapytania: całość do zakupu (niez = −ilość), cena z zapytania
export function pozycjaProjektu(tresc, x = {}) {
  const pk = ZM.pozycjaDoKursu(tresc), il = typeof x.ilosc === "number" ? x.ilosc : pk.ilosc;
  return { symbol: x.symbol || "", nazwa: x.nazwa || pk.nazwa, jm: x.jm || pk.jm, ilosc: il, niez: -il, nazd: 0, zapytano: "TAK", ark: E?.nazwa || "", tresc, dodana: true };
}
export async function zapiszProjekt(pr, pozycje, akcja) {
  try {
    const { _id, ...d } = pr;
    const r = await zapiszDok(C.p, _id, { ...d, pozycje: pozycje.map(czysc) }, { typ: "projekt", etykieta: pr.id, diffFn: diffProj, wersja: pr.wersja || 0, akcja });
    if (r?.conflict) return toast("Ktoś zmienił projekt w międzyczasie – otwórz go ponownie");
    toast("Zapisano projekt " + pr.id);
  } catch (x) { failed(x); }
}
export async function edytujProjekt(pr, nazwaZap) {
  const zap = zapByNazwa(nazwaZap || pr.id) || Z.find(z => pr.pozycje.some(x => L.LC(x.ark) === L.LC(z.nazwa)));
  const wierszeZ = (zap?.wiersze || []).map(w => L.vbaTrim(w.a)).filter(Boolean);
  const poz = clone(pr.pozycje);
  const zMag = x => Math.min(Math.max(L.liczba(x.ilosc) + L.liczba(x.niez), 0), L.liczba(x.ilosc));
  const opcjeW = sel => `<option value="">– bez wiersza (cena zakupu z Subiekta) –</option>` + wierszeZ.map(t => `<option ${L.LC(t) === L.LC(sel || "") ? "selected" : ""}>${esc(t)}</option>`).join("")
    + (sel && !wierszeZ.some(t => L.LC(t) === L.LC(sel)) ? `<option selected value="${esc(sel)}">${esc(sel)} (nie ma już w zapytaniu)</option>` : "");
  const wiersz = (x, i) => `<tr data-i="${i}"><td><input data-f="nazwa" value="${esc(x.nazwa)}"></td><td style="width:60px"><input data-f="jm" value="${esc(x.jm || "")}"></td>
    <td style="width:80px"><input data-f="ilosc" inputmode="decimal" value="${esc(L.ogolny(L.liczba(x.ilosc)))}"></td><td style="width:80px"><input data-f="zmag" inputmode="decimal" value="${esc(L.ogolny(zMag(x)))}" title="ile z tej ilości bierzemy z magazynu"></td>
    <td><select data-f="tresc">${opcjeW(x.tresc)}</select></td><td style="width:40px"><button type="button" class="btn sm" data-del="${i}" title="Usuń z projektu">✕</button></td></tr>`;
  const r = await okno(`<h3>Projekt ${esc(pr.id)} – pozycje do kosztu</h3>
    <p class="small">Zmień ilości albo podepnij pozycję pod inny wiersz zapytania (np. zamiast 3 × IPE 330 10 m: 1 × 10 m i nowa pozycja 2 × 12 m). „Z magazynu” – część brana z magazynu wg ceny ostatniego zakupu, reszta wg ceny wybranego dostawcy.</p>
    <div class="tablebox" style="max-height:52vh;overflow:auto"><table class="t ed"><thead><tr><th>Pozycja</th><th>J.m.</th><th>Ilość</th><th>Z magazynu</th><th>Wiersz zapytania ${zap ? esc(zap.nazwa) : ""}</th><th></th></tr></thead><tbody id="pjRows">${poz.map(wiersz).join("")}</tbody></table></div>
    ${wierszeZ.length ? `<div class="toolbar" style="margin-top:8px"><select id="pjNowy" style="flex:1 1 300px"><option value="">Dodaj pozycję z wiersza zapytania…</option>${wierszeZ.map(t => `<option>${esc(t)}</option>`).join("")}</select><button type="button" class="btn" id="pjDodaj">+ Dodaj do projektu</button></div>` : ""}`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Zapisz projekt", cls: "primary" }],
    { szer: "min(1000px, calc(100vw - 24px))", poOtwarciu: f => {
      bezEnterZapisu(f);
      const odczyt = () => f.querySelectorAll("#pjRows tr[data-i]").forEach(tr => { const x = poz[+tr.dataset.i]; if (!x) return; const v = n => tr.querySelector(`[data-f="${n}"]`).value;
        x.nazwa = v("nazwa").trim(); x.jm = v("jm").trim(); const il = L.naLiczbe(v("ilosc")), zm = L.naLiczbe(v("zmag"));
        x.ilosc = il.ok ? il.w : 0; x.niez = (zm.ok ? Math.min(zm.w, x.ilosc) : 0) - x.ilosc; x.tresc = v("tresc"); x.ark = x.tresc ? (zap?.nazwa || x.ark) : x.ark; });
      const rysuj = () => { f.querySelector("#pjRows").innerHTML = poz.map((x, i) => x ? wiersz(x, i) : "").join(""); };
      f.querySelector("#pjRows").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (b) { odczyt(); poz[+b.dataset.del] = null; rysuj(); } });
      f.querySelector("#pjDodaj")?.addEventListener("click", () => { const t = f.querySelector("#pjNowy").value; if (!t) return; odczyt(); poz.push(pozycjaProjektu(t)); poz.at(-1).ark = zap?.nazwa || ""; rysuj(); f.querySelector("#pjNowy").value = ""; });
      f.addEventListener("submit", odczyt, true); f._odczyt = odczyt;
    } });
  if (r.v !== "ok") return;
  r.form._odczyt?.();
  await zapiszProjekt(pr, poz.filter(Boolean), "edycja pozycji projektu");
  if (widok.nazwa === "koszt") render();
}
export let ostatniKoszt = null;
export async function renderKoszt() {
  const p = projById(widok.arg);
  if (!p) { M().innerHTML = `<div class="empty">${zaladowane.p ? "Nie ma takiego projektu" : "Wczytywanie…"}</div>`; return; }
  M().innerHTML = `<div class="empty">Liczenie…</div>`;
  const k = await zPytaniami(ctx => L.policzKoszt(p, Z, ctx));
  if (!k) return;
  ostatniKoszt = { k, p, kiedy: new Date() };
  const R2 = x => L.vbaRound(x, 2), R1 = x => L.vbaRound(x, 1);
  const z = zapByNazwa(p.id);
  M().innerHTML = `
  <div class="panel"><div class="hd"><div class="toolbar">${z ? `<a class="btn" href="#z-${z._id}">← ${esc(z.nazwa)}</a>` : `<a class="btn" href="#projekty">← Projekty</a>`}<h2>Koszt materiału projektu</h2></div>
    <div class="toolbar"><button class="btn" id="kEdytuj">Edytuj projekt</button><button class="btn primary" id="kPdf">Generuj do PDF</button></div></div>
    <div class="bd small">Projekt / zapytanie: <b>${esc(p.id)}</b> | Klient: <b>${esc(p.kod)}</b> | ${fDT(new Date())}</div></div>
  <div class="kpis"><div class="kpi"><span class="lbl">Klient</span><span class="val">${esc(p.kod || "–")}</span></div><div class="kpi"><span class="lbl">Pozycji</span><span class="val">${k.pozycje.length}</span></div>
    <div class="kpi"><span class="lbl">Waga całości</span><span class="val">${fmt(R1(k.sumWaga), 1)} kg</span></div><div class="kpi"><span class="lbl">Koszt razem</span><span class="val">${zl(R2(k.sumMag + k.sumZak))}</span></div></div>
  <div class="grid2">
    <div class="panel"><div class="tablebox"><table class="t"><thead><tr><th>SKŁADNIK</th><th class="num">KOSZT NETTO [zł]</th></tr></thead><tbody>
      <tr><td>Materiał z magazynu (cena ostatniego zakupu)</td><td class="num">${fmt(R2(k.sumMag))}</td></tr>
      <tr><td>Materiał do zakupu (ceny z zapytania)</td><td class="num">${fmt(R2(k.sumZak))}</td></tr>
      ${k.dostawcy.map(d => `<tr class="small"><td>&nbsp;&nbsp;&nbsp;&nbsp;w tym: ${esc(d.d)}</td><td class="num">${fmt(R2(d.s))}</td></tr>`).join("")}
      <tr class="suma"><td>RAZEM MATERIAŁ</td><td class="num">${fmt(R2(k.sumMag + k.sumZak))}</td></tr></tbody></table></div>
      ${k.ileBrak ? `<div class="bd red strong">Uwaga: ${k.ileBrak} poz. bez pełnej ceny - nie ma ich (w całości) w sumie. Patrz UWAGI.</div>` : ""}</div>
    <div class="panel"><div class="tablebox"><table class="t"><thead><tr><th>WAGA</th><th class="num">[kg]</th><th class="num">[t]</th></tr></thead><tbody>
      <tr class="suma"><td>WAGA CAŁOŚCI (materiał na projekt)</td><td class="num">${fmt(R1(k.sumWaga), 1)}</td><td class="num">${fmt(L.vbaRound(k.sumWaga / 1000, 3), 3)}</td></tr>
      <tr class="small"><td>&nbsp;&nbsp;&nbsp;&nbsp;w tym z magazynu</td><td class="num">${fmt(R1(k.sumWaga - k.sumWagaZak), 1)}</td><td class="num">${fmt(L.vbaRound((k.sumWaga - k.sumWagaZak) / 1000, 3), 3)}</td></tr>
      <tr class="small"><td>&nbsp;&nbsp;&nbsp;&nbsp;w tym do zakupu</td><td class="num">${fmt(R1(k.sumWagaZak), 1)}</td><td class="num">${fmt(L.vbaRound(k.sumWagaZak / 1000, 3), 3)}</td></tr></tbody></table></div>
      ${k.ileBezWagi ? `<div class="bd red strong">Uwaga: ${k.ileBezWagi} poz. bez wagi - nie ma ich w sumie wagi. Patrz UWAGI.</div>` : ""}</div>
  </div>
  <div class="panel"><div class="tablebox"><table class="t" style="min-width:1700px"><thead><tr><th>LP</th><th>NAZWA</th><th>J.M.</th><th class="num">ILOŚĆ NA PROJEKT</th><th class="num">Z MAGAZYNU</th><th class="num">CENA ZAKUPU [zł/j.m.]</th><th class="num">KOSZT MAG. [zł]</th><th class="num">DO ZAKUPU</th><th>DOSTAWCA</th><th class="num">CENA DOST.</th><th>JEDN. CENY</th><th class="num">ILOŚĆ [mb / kg]</th><th class="num">KOSZT ZAKUPU [zł]</th><th class="num">RAZEM [zł]</th><th class="num">WAGA [kg]</th><th>UWAGI</th></tr></thead><tbody>
    ${k.pozycje.map((x, i) => `<tr><td class="num">${i + 1}</td><td>${esc(x.nazwa)}</td><td>${esc(x.jm)}</td><td class="num">${L.ogolny(x.ilosc)}</td><td class="num">${L.ogolny(x.zMag)}</td><td class="num">${x.cz > 0 ? zl(x.cz) : ""}</td><td class="num">${x.kosztMag > 0 ? fmt(R2(x.kosztMag)) : ""}</td>
      <td class="num">${L.ogolny(x.doZak)}</td><td>${esc(x.dost)}</td><td class="num">${x.cena > 0 ? L.ogolny(x.cena) : ""}</td><td>${esc(x.jedn)}</td><td class="num">${x.ilRozl > 0 ? L.ogolny(R2(x.ilRozl)) : ""}</td><td class="num">${x.kosztZak > 0 ? fmt(R2(x.kosztZak)) : ""}</td>
      <td class="num ${x.brakCeny ? "red" : ""}">${fmt(R2(x.kosztMag + x.kosztZak))}</td><td class="num ${x.waga < 0 && x.ilosc > 0 ? "red" : ""}">${x.waga >= 0 ? fmt(R1(x.waga), 1) : x.ilosc > 0 ? "?" : ""}</td><td class="${x.brakCeny ? "red" : ""}">${esc(x.uwagi)}</td></tr>`).join("")}
    <tr class="suma"><td></td><td>RAZEM</td><td></td><td></td><td></td><td></td><td class="num">${fmt(R2(k.sumMag))}</td><td></td><td></td><td></td><td></td><td></td><td class="num">${fmt(R2(k.sumZak))}</td><td class="num">${fmt(R2(k.sumMag + k.sumZak))}</td><td class="num">${fmt(R1(k.sumWaga), 1)}</td><td></td></tr></tbody></table></div></div>
  <details class="panel"><summary class="bd strong" style="cursor:pointer">Dane projektu z Subiekta (arkusz PROJEKTY) – ${p.pozycje.length} poz., zapisane ${fD(p.data)}</summary>
    <div class="tablebox"><table class="t" style="min-width:1300px"><thead><tr><th>PROJEKT</th><th>KOD KLIENTA</th><th>DATA</th><th>SYMBOL</th><th>NAZWA</th><th>J.M.</th><th class="num">ILOŚĆ W DOK.</th><th class="num">NIEZAREZ.</th><th class="num">NA ZD</th><th class="num">CENA ZAKUPU</th><th>ZAPYTANO</th><th>ARKUSZ ZAPYTANIA</th><th>TREŚĆ W ZAPYTANIU</th></tr></thead><tbody>
    ${p.pozycje.map(x => `<tr><td>${esc(p.id)}</td><td>${esc(p.kod)}</td><td>${fD(p.data)}</td><td class="mono">${esc(x.symbol)}</td><td>${esc(x.nazwa)}</td><td>${esc(x.jm)}</td><td class="num">${L.ogolny(x.ilosc)}</td><td class="num">${L.ogolny(x.niez)}</td><td class="num">${L.ogolny(x.nazd)}</td><td class="num">${x.cz !== undefined ? L.ogolny(x.cz) : ""}</td><td>${esc(x.zapytano)}</td><td>${esc(x.ark)}</td><td>${esc(x.tresc)}</td></tr>`).join("")}</tbody></table></div></details>`;
  $("kEdytuj").onclick = () => edytujProjekt(p);
  $("kPdf").onclick = async () => {
    try { const pdf = await import("../pdf.js?v=202611121300"); const { blob, nazwa } = await pdf.kosztPDF(ostatniKoszt); pobierzPlik(nazwa, blob); }
    catch (x) { console.error(x); toast("Nie udało się zrobić PDF: " + (x.message || x)); }
  };
}

/* ============================================================ projekty */
export function renderProjekty() {
  const nazwy = Z.map(z => z.nazwa);
  const lista = P.filter(p => L.projektZywy(p, nazwy)).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.id).localeCompare(String(a.id), "pl", { numeric: true }));
  M().innerHTML = `<div class="panel"><div class="hd"><h2>Projekty (koszt materiału)</h2><span class="small">Projekt powstaje przy tworzeniu zapytania z generatora. Dla starszych zapytań: otwórz zapytanie → „Koszt projektu”.</span></div>
    <div class="tablebox"><table class="t"><thead><tr><th>PROJEKT (ZAPYTANIE)</th><th>KOD KLIENTA</th><th>DATA</th><th class="num">POZYCJI</th><th class="num">ZAPYTANO</th><th>ARKUSZE ZAPYTAŃ</th></tr></thead><tbody>
    ${lista.map(p => `<tr class="click" data-id="${p._id}"><td class="mono strong">${esc(p.id)}</td><td>${esc(p.kod)}</td><td>${fD(p.data)}</td><td class="num">${p.pozycje.length}</td><td class="num">${p.pozycje.filter(x => x.zapytano === "TAK").length}</td><td>${esc([...new Set(p.pozycje.map(x => x.ark).filter(Boolean))].join(", "))}</td></tr>`).join("")}</tbody></table></div>
    ${lista.length ? "" : `<div class="empty"><strong>Brak projektów</strong></div>`}</div>`;
  M().querySelector("tbody").onclick = e => { const tr = e.target.closest("tr[data-id]"); if (tr) go("koszt", tr.dataset.id); };
}
export let sprzatanie = false;
export async function sprzatnijProjekty() {
  if (sprzatanie || !zaladowane.z || !zaladowane.p) return;
  const nazwy = Z.map(z => z.nazwa), martwe = P.filter(p => !L.projektZywy(p, nazwy));
  if (!martwe.length) return;
  sprzatanie = true;
  const logId = B.newId(C.log);
  try { await B.tx(async t => { martwe.forEach(p => t.del(C.p, p._id)); t.set(C.log, logId, wpis("projekt", "", martwe.map(p => p.id).join(", "), "usunięcie", [{ p: "dane projektu bez zapytania", a: martwe.map(p => p.id).join(", "), b: "" }])); }); }
  catch (x) { console.warn(x); } finally { sprzatanie = false; }
}
