// Zapytania: 1. Generator zapytań i pozycje z listy materiałów
import * as L from "../logika.js?v=202611121300";
import * as I from "../import-excel.js?v=202611121300";
import * as OF from "../oferty.js?v=202611121300";
import { $, esc, pad, today, clone, fmt, zl, ogolnyLiczba, toast, failed, okno, pytanie, czytajPlik } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { B, G, M, P, U, Z, czysc, diffZap, go, isOwner, me, sv, ustawG, widok, wpis, zapById, zapByNazwa, zapiszDok, zapiszUst, zapytaniaPosort } from '../app.js?v=202611121300';
import { E, bezEnterZapisu, dopiszProjekt, projOpcje, rysujArkusz, ustawKomorke, zapiszTeraz, zmiana } from './arkusz.js?v=202611121300';
import { CEN, cenyZal, dopiszDoBazy, startCeny } from './ceny-widok.js?v=202611121300';
import { oknoMail } from './lista.js?v=202611121300';

/* ============================================================ 1. GENERATOR */
export let genDirty = false, genTimer = null;
export function renderGenerator() {
  const rok = L.rokNumeru(U), nast = L.nastepnyNumer(Z.map(z => z.nazwa), rok) + "-" + rok;
  const W8 = G.wiersze;
  const suma = W8.reduce((s, p) => s + (typeof L.wartoscZakupu(p) === "number" ? L.wartoscZakupu(p) : 0), 0);
  M().innerHTML = `
  <div class="panel"><div class="hd"><h2>Generator zapytań ofertowych</h2>
    <div class="toolbar">
      <label class="btn primary filebtn"><span class="nr">1</span>Wczytaj eksport<input type="file" id="gFile" accept=".xlsx,.xls,.xlsm,.csv"></label>
      <button class="btn" id="gMag">Nowe zapytanie (lista / własne pozycje)</button>
      ${G.wiersze.length ? `<button class="btn" id="gDopisz" title="Dopisz do wczytanej listy pozycje z bazy cen albo wpisane ręcznie">+ Dopisz z bazy / ręcznie</button>` : ""}
      <button class="btn primary" id="gUtworz"><span class="nr">2</span>Utwórz zapytanie</button>
      <button class="btn" id="gMail"><span class="nr">3</span>Mail do dostawców</button>
      <button class="btn" id="gWyczysc"><span class="nr">4</span>Wyczyść listę</button>
    </div></div>
    <div class="bd pola">
      <div class="pole"><span class="lbl">Kod klienta</span><input id="gKod" value="${esc(G.kod)}" list="projDL" autocomplete="off"><datalist id="projDL">${projOpcje()}</datalist></div>
      <div class="pole"><span class="lbl">Plik eksportu</span><span class="val">${esc(G.plik) || "—"}</span></div>
      <div class="pole"><span class="lbl">Następny numer</span><span class="val mono">${esc(nast)}</span></div>
      <div class="pole"><span class="lbl">Ostatnio utworzone</span><span class="val">${esc(G.ostatnie) || "—"}</span></div>
    </div>
    <div class="bd small" style="padding-top:0">Kolumny ZAPYTAĆ? (TAK/NIE) i ILOŚĆ DO ZAPYTANIA możesz zmieniać – treść przelicza się sama. Przy stanie 0 wybierz z listy paczkę albo wpisz liczbę sztuk. Reguły: zakładka Ustawienia.</div>
  </div>
  <div class="panel">
    <div class="hd"><h3>Lista pozycji ${W8.length ? `(${W8.length}, do zapytania: ${W8.filter(p => L.UC(p.zapytac) === "TAK").length})` : ""}</h3><span class="strong">RAZEM: ${zl(suma)}</span></div>
    ${W8.length ? `<div class="tablebox"><table class="t gen" style="min-width:1500px"><thead><tr>
      <th>LP</th><th>SYMBOL</th><th>NAZWA</th><th>GRUPA</th><th>J.M.</th><th class="num">ILOŚĆ W DOK.</th><th class="num">STAN</th><th class="num">ZAREZERWOWANE</th><th class="num">NIEZAREZERWOWANE</th><th class="num">NA ZD</th><th class="num">BRAK</th><th>ZAPYTAĆ?</th><th>ILOŚĆ DO ZAPYTANIA</th><th>TREŚĆ W ZAPYTANIU</th><th class="num">CENA ZAKUPU [zł/j.m.]</th><th class="num">WARTOŚĆ ZAKUPU [zł]</th></tr></thead>
      <tbody>${W8.map((p, i) => {
        const tak = L.UC(p.zapytac) === "TAK", wz = L.wartoscZakupu(p);
        return `<tr class="${tak ? "tak" : ""}" data-i="${i}"><td class="num">${i + 1}</td><td class="mono">${esc(p.symbol)}</td><td>${esc(p.nazwa)}</td><td>${esc(p.grupa)}</td><td>${esc(p.jm)}</td>
        <td class="num">${ogolnyLiczba(p.ilosc)}</td><td class="num">${ogolnyLiczba(p.stan)}</td><td class="num">${ogolnyLiczba(p.zarez)}</td><td class="num">${ogolnyLiczba(p.niezarez)}</td><td class="num">${ogolnyLiczba(p.nazd)}</td>
        <td class="num ${typeof p.brak === "number" && p.brak > 0 ? "brak" : ""}">${ogolnyLiczba(p.brak)}</td>
        <td><select data-k="zapytac"><option ${tak ? "selected" : ""}>TAK</option><option ${!tak ? "selected" : ""}>NIE</option></select></td>
        <td class="c-il ${tak && (p.ilZap === "" || p.ilZap === undefined) ? "zolty" : ""}"><input data-k="ilZap" list="paczkiList" value="${esc(typeof p.ilZap === "number" ? L.ogolny(p.ilZap) : p.ilZap ?? "")}"></td>
        <td>${esc(L.trescPozycji(p))}</td><td class="num">${p.cz !== undefined && p.cz !== "" ? zl(+p.cz) : ""}</td><td class="num">${typeof wz === "number" ? fmt(wz, 2) : ""}</td></tr>`;
      }).join("")}</tbody></table></div><datalist id="paczkiList"><option value="paczka"><option value="2 paczki"><option value="3 paczki"></datalist>`
      : `<div class="empty"><strong>Lista jest pusta</strong><span>Kliknij „1. Wczytaj eksport” i wskaż plik wyeksportowany z Subiekta nexo (z kolumnami Nazwa, Stan, Niezarezerwowane, Na ZD, Cena netto).</span></div>`}
  </div>`;
  $("gFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) wczytajEksportPlik(f); };
  $("gMag").onclick = zapytanieNaMagazyn;
  $("gDopisz") && ($("gDopisz").onclick = async () => {
    const wyb = await wybierzZListy(); if (!wyb) return;
    for (const x of wyb) G.wiersze.push({ symbol: x.symbol || "", nazwa: x.nazwa, jm: x.jm, ilosc: 0, stan: 0, zarez: 0, nazd: 0, niezarez: 0, grupa: L.okreslGrupe(U, x.nazwa), brak: 0, zapytac: "TAK", ilZap: x.ilosc, dopisane: true });
    await zapiszGenerator(G, [{ p: "dopisano do listy", a: "", b: wyb.map(x => x.nazwa).join(", ") }], "dopisanie pozycji");
    renderGenerator(); toast(`Dopisano ${wyb.length} poz. (ZAPYTAĆ? = TAK)`);
  });
  $("gUtworz").onclick = utworzZapytanie;
  $("gMail").onclick = mailOstatnie;
  $("gWyczysc").onclick = async () => { if (await pytanie("Wyczyść listę", "Wyczyścić listę pozycji i pola nad tabelą?", "Wyczyść")) zapiszGenerator({ kod: "", plik: "", ostatnie: "", wiersze: [] }, [{ p: "lista", a: G.wiersze.length + " poz.", b: "" }], "wyczyszczenie listy"); };
  $("gKod").oninput = e => { G.kod = e.target.value; genZmiana(); };
  M().querySelector("tbody")?.addEventListener("change", e => {
    const tr = e.target.closest("tr[data-i]"), k = e.target.dataset.k; if (!tr || !k) return;
    const p = G.wiersze[+tr.dataset.i];
    if (k === "zapytac") p.zapytac = e.target.value;
    if (k === "ilZap") { const v = e.target.value.trim(), n = L.naLiczbe(v); p.ilZap = v === "" ? "" : n.ok ? n.w : v; }
    genZmiana(); renderGenerator();
  });
}
export let genZmianyLog = [];
export function genZmiana() { genDirty = true; clearTimeout(genTimer); genTimer = setTimeout(() => zapiszGenerator(G, null, "edycja listy"), 900); }
export async function zapiszGenerator(nowy, zmiany, akcja) {
  clearTimeout(genTimer);
  const stary = genStary; genStary = clone(nowy);
  if (!zmiany) {
    zmiany = [];
    if ((stary?.kod ?? "") !== nowy.kod) zmiany.push({ p: "kod klienta", a: stary?.kod ?? "", b: nowy.kod });
    nowy.wiersze.forEach((p, i) => { const q = stary?.wiersze?.[i]; if (!q) return;
      if (q.zapytac !== p.zapytac) zmiany.push({ p: `ZAPYTAĆ? ${i + 1}. ${p.nazwa}`, a: q.zapytac, b: p.zapytac });
      if (sv(q.ilZap) !== sv(p.ilZap)) zmiany.push({ p: `ILOŚĆ DO ZAPYTANIA ${i + 1}. ${p.nazwa}`, a: sv(q.ilZap), b: sv(p.ilZap) }); });
    if (!zmiany.length) { genDirty = false; return; }
  }
  try { await zapiszUst("generator", nowy, "GENERATOR", zmiany, akcja); genDirty = false; ustawG(clone(nowy)); if (widok.nazwa === "generator") renderGenerator(); }
  catch (x) { failed(x); }
}
export let genStary = null;
export const ustawGenStary = v => { genStary = v; };
export async function wczytajEksportPlik(f) {
  try {
    const wb = XLSX.read(await czytajPlik(f), { type: "array" });
    const tab = I.tabelaPierwszegoArkusza(XLSX, wb);
    const w = L.wczytajEksport(tab, f.name, U);
    if (w.blad) return okno(`<h3>Nieznany format pliku</h3><p>${esc(w.blad)}</p>`);
    genStary = clone(G);
    const nowy = { kod: w.kod, plik: w.plik, ostatnie: "", wiersze: w.wiersze };
    await zapiszGenerator(nowy, [{ p: "wczytano eksport", a: "", b: `${w.plik} – ${w.wiersze.length} poz.` }], "wczytanie eksportu");
    const doBazy = await dopiszDoBazy(w.wiersze.filter(p => p.cz > 0).map(p => ({ symbol: p.symbol, nazwa: p.nazwa, cena: p.cz, jm: p.jm, zrodlo: "zakup", data: today() })));
    okno(`<h3>Eksport wczytany</h3><p>Wczytano pozycji: <b>${w.wiersze.length}</b><br>Do zapytania (brak na magazynie): <b>${w.ileTak}</b></p>
      ${doBazy ? `<p>Nowe pozycje dopisane do bazy cen: <b>${doBazy}</b> (z ceną zakupu z eksportu).</p>` : ""}
      <p>Sprawdź kolumny ZAPYTAĆ? i ILOŚĆ DO ZAPYTANIA, potem kliknij „2. Utwórz zapytanie”.</p>
      ${w.bezCeny ? `<p class="notice">Uwaga: w eksporcie nie ma kolumny z ceną zakupu – koszt projektu nie policzy materiału z magazynu (brak kolumny „Cena netto”).</p>` : ""}`);
  } catch (x) { console.error(x); okno(`<h3>Błąd</h3><p>Nie udało się wczytać pliku: ${esc(x.message || x)}</p>`); }
}
export async function utworzZapytanie() {
  await zapiszTeraz();
  if (!vbaKod()) {
    const r = await okno(`<h3>Kod klienta</h3><label>Podaj kod klienta / projektu (trafi do komórki A1 zapytania)<input name="kod" required></label>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dalej", cls: "primary" }]);
    if (r.v !== "ok") return; G.kod = r.form.kod.value.trim(); if (!G.kod) return;
  }
  const u = L.utworzZapytania(G, U, Z.map(z => z.nazwa), today());
  if (u.blad) return okno(`<h3>Brak pozycji</h3><p>${esc(u.blad)}</p>`);
  if (u.ileBezIlosci > 0 && !(await pytanie("Brak ilości", `Pozycji bez ilości: <b>${u.ileBezIlosci}</b> (zaznaczone na żółto).<br>Utworzyć zapytanie mimo to?`, "Utwórz"))) return;
  const logId = B.newId(C.log), maxK = Math.max(0, ...Z.map(z => z.kolejnosc ?? 0));
  const utworzone = u.zapytania.map(z => z.nazwa).join(", ");
  try {
    await B.tx(async t => {
      u.zapytania.forEach((z, i) => t.set(C.z, B.newId(C.z), czysc({ ...z, dataZap: today(), kolejnosc: maxK + 1 + i, wersja: 1, ostatniWpis: logId, utworzono: B.now(), utworzyl: me.uid, zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa })));
      if (isOwner) for (const p of P.filter(p => L.LC(p.id) === L.LC(u.projekt.id))) t.del(C.p, p._id);   // ten sam numer utworzony ponownie
      t.set(C.p, B.newId(C.p), czysc({ ...u.projekt, wersja: 1, ostatniWpis: logId, utworzono: B.now(), utworzyl: me.uid }));
      const ost = `${utworzone}  (${pad(new Date().getDate())}-${pad(new Date().getMonth() + 1)}-${new Date().getFullYear()} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())})`;
      t.set(C.u, "generator", czysc({ ...G, ostatnie: ost }));
      t.set(C.log, logId, wpis("zapytanie", "", utworzone, "utworzenie", [{ p: "utworzono z generatora", a: "", b: `${utworzone} – ${u.ilePozycji} poz.${G.kod ? ", " + G.kod : ""}` }]));
    });
  } catch (x) { return failed(x); }
  if (G.kod) dopiszProjekt(G.kod);
  const r = await okno(`<h3>Zapytanie gotowe</h3><p>Utworzono: <b>${esc(utworzone)}</b><br>Pozycji w zapytaniu: <b>${u.ilePozycji}</b></p><p>Przygotować maila do dostawców?<br><span class="small">(możesz to zrobić też później przyciskiem „3. Mail do dostawców”)</span></p>`,
    [{ v: "nie", t: "Nie", nv: true }, { v: "tak", t: "Tak", cls: "primary" }]);
  const pierwsze = () => zapByNazwa(u.zapytania[0].nazwa);
  if (r.v === "tak") { for (const z of u.zapytania) await czekajNa(() => zapByNazwa(z.nazwa)).then(x => x && oknoMail(x)); }
  else { const z = await czekajNa(pierwsze); if (z) go("z", z._id); }
}
export const vbaKod = () => L.vbaTrim(G.kod);
export const czekajNa = (fn, ms = 4000) => new Promise(res => { const t0 = Date.now(); const k = () => { const v = fn(); if (v || Date.now() - t0 > ms) res(v); else setTimeout(k, 100); }; k(); });
export async function mailOstatnie() {
  let lista = L.vbaTrim(G.ostatnie || ""); const p = lista.indexOf("  ("); if (p >= 0) lista = lista.slice(0, p);
  let nazwy = lista ? lista.split(", ").map(s => s.trim()).filter(Boolean) : [];
  if (!nazwy.length || !zapByNazwa(nazwy[0])) {
    const r = await okno(`<h3>Mail do dostawców</h3><label>Podaj numer zapytania (np. 150-2026)<input name="n" list="zapList" required></label><datalist id="zapList">${zapytaniaPosort().map(z => `<option value="${esc(z.nazwa)}">`).join("")}</datalist>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dalej", cls: "primary" }]);
    if (r.v !== "ok") return; nazwy = [r.form.n.value.trim()];
  }
  for (const n of nazwy) { const z = zapByNazwa(n); if (z) await oknoMail(z); else toast("Nie ma zapytania: " + n); }
}

/* ============================================================ pozycje z listy materiałów (zakładka Ceny) */
// okno wyboru: szukaj, zaznacz, wpisz ilość i jednostkę -> [{symbol, nazwa, jm, ilosc}]
export async function wybierzZListy() {
  startCeny();
  if (!(await czekajNa(() => cenyZal, 8000))) return toast("Nie udało się wczytać listy materiałów"), null;
  const lista = CEN.filter(d => d.status !== "pomin" && d.nazwa).sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl", { numeric: true }));
  const JEDN = ["szt", "kg", "mb", "kpl", "m²", "t", "paczka"];
  const wlasne = [];               // pozycje wpisane ręcznie: {nazwa, ilosc, jm}
  const wyb = new Map();          // id -> {ilosc, jm}
  const jmDom = d => { const t = L.typWyrobu(L.UC(d.nazwa)); return ["PRET", "PRETKW", "PRET6K"].includes(t) ? "kg" : ["szt", "kg", "mb"].includes(d.jm) ? d.jm : "szt"; };
  let q = "";
  const wiersze = () => {
    const f = L.LC(q).split(/\s+/).filter(Boolean);
    const pasuje = lista.filter(d => f.every(t => L.LC(d.nazwa + " " + d.symbol).includes(t)));
    return pasuje.slice(0, 120).map(d => { const w = wyb.get(d._id), c = d.historia?.at(-1)?.c;
      return `<tr data-id="${esc(d._id)}"><td><input type="checkbox" ${w ? "checked" : ""} aria-label="wybierz"></td><td>${esc(d.nazwa)}<div class="small mono">${esc(d.symbol)}${c ? ` · ${fmt(c, 2)} zł/${esc(d.jm || "?")}` : ""}${d.zrodlo === "zamowienie" ? " · z zamówienia" : d.zrodlo === "zakup" ? " · z eksportu" : ""}</div></td>
        <td style="width:90px"><input data-il inputmode="decimal" value="${esc(w ? L.ogolny(w.ilosc) : "")}" placeholder="ilość"></td>
        <td style="width:96px"><select data-jm>${JEDN.map(j => `<option ${(w ? w.jm : jmDom(d)) === j ? "selected" : ""}>${j}</option>`).join("")}</select></td></tr>`; }).join("")
      + (pasuje.length > 120 ? `<tr><td colspan="4" class="small">… i ${pasuje.length - 120} więcej – zawęź wyszukiwanie</td></tr>` : "")
      + (pasuje.length ? "" : `<tr><td colspan="4" class="small">Nic nie pasuje</td></tr>`);
  };
  const r = await okno(`<h3>Pozycje do zapytania</h3>
    <div class="panel"><div class="bd" style="display:grid;gap:8px"><b>Własna pozycja</b> <span class="small">– wpisz cokolwiek: wypałki, obejmy, śruby, usługę…</span>
      <div class="toolbar"><input id="wlN" placeholder="np. Obejma rurowa 42,4 ocynk" style="flex:1 1 260px"><input id="wlI" inputmode="decimal" placeholder="ilość" style="width:90px">
      <select id="wlJ">${JEDN.map(j => `<option>${j}</option>`).join("")}</select><button type="button" class="btn" id="wlDodaj">Dodaj</button></div>
      <div id="wlLista" class="small"></div></div></div>
    ${lista.length ? `<b>Z listy materiałów</b>` : `<p class="small">Lista materiałów z Subiekta jest pusta (zakładka „Ceny”) – możesz dodawać tylko własne pozycje.</p>`}
    <input type="search" id="zlQ" placeholder="Szukaj: 100x100x3, IPE 300, pręt 16… (kilka słów naraz)" ${lista.length ? "" : "hidden"}>
    <div class="tablebox" style="max-height:52vh;overflow:auto"><table class="t ed"><tbody id="zlRows">${wiersze()}</tbody></table></div>
    <div class="small" id="zlIle">Zaznaczono: 0</div>`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dodaj zaznaczone", cls: "primary" }],
    { szer: "min(860px, calc(100vw - 24px))", poOtwarciu: f => {
      const ile = () => { const w = [...wlasne, ...wyb.values()]; f.querySelector("#zlIle").textContent = `Zaznaczono: ${w.length}` + (w.length ? " – " + w.slice(0, 4).map(x => x.nazwa).join(", ") + (w.length > 4 ? "…" : "") : ""); };
      const rysujWl = () => { f.querySelector("#wlLista").innerHTML = wlasne.map((x, i) => `<div>• ${esc(L.trescPozycji({ nazwa: x.nazwa, ilZap: x.ilosc, jm: x.jm }))} <button type="button" class="btn sm" data-wdel="${i}">✕</button></div>`).join(""); ile(); };
      const dodajWl = () => { const n = f.querySelector("#wlN").value.trim(); if (!n) return f.querySelector("#wlN").focus(); const v = f.querySelector("#wlI").value.trim(), j = f.querySelector("#wlJ").value, num = L.naLiczbe(v);
        wlasne.push({ symbol: "", nazwa: n, jm: j === "paczka" ? "szt" : j, ilosc: j === "paczka" ? (num.ok && num.w > 1 ? `${L.ogolny(num.w)} paczki` : "paczka") : (num.ok ? num.w : ""), wlasna: true });
        f.querySelector("#wlN").value = ""; f.querySelector("#wlI").value = ""; f.querySelector("#wlN").focus(); rysujWl(); };
      f.querySelector("#wlDodaj").onclick = dodajWl;
      f.querySelector("#wlN").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); f.querySelector("#wlI").focus(); } };
      f.querySelector("#wlI").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); dodajWl(); } };
      f.querySelector("#wlLista").onclick = e => { const b = e.target.closest("[data-wdel]"); if (b) { wlasne.splice(+b.dataset.wdel, 1); rysujWl(); } };
      setTimeout(() => f.querySelector(lista.length ? "#zlQ" : "#wlN").focus(), 50);
      const odczyt = tr => { const d = lista.find(x => x._id === tr.dataset.id), on = tr.querySelector('input[type="checkbox"]').checked, v = tr.querySelector("[data-il]").value.trim(), jm = tr.querySelector("[data-jm]").value;
        if (!on) { wyb.delete(d._id); return; }
        const n = L.naLiczbe(v); wyb.set(d._id, { symbol: d.symbol, nazwa: d.nazwa, jm: jm === "paczka" ? (jmDom(d)) : jm, ilosc: jm === "paczka" ? (n.ok && n.w > 1 ? `${L.ogolny(n.w)} paczki` : "paczka") : (n.ok ? n.w : ""), cz: d.historia?.at(-1)?.c, jmCeny: d.jm }); };
      f.querySelector("#zlQ").oninput = e => { q = e.target.value; f.querySelector("#zlRows").innerHTML = wiersze(); };
      f.querySelector("#zlRows").addEventListener("input", e => { const tr = e.target.closest("tr[data-id]"); if (!tr) return; if (e.target.matches("[data-il]") && e.target.value.trim()) tr.querySelector('input[type="checkbox"]').checked = true; odczyt(tr); ile(); });
      f.querySelector("#zlRows").addEventListener("change", e => { const tr = e.target.closest("tr[data-id]"); if (tr) { odczyt(tr); ile(); } });
    } });
  // wpisana, ale niedodana własna pozycja – też ją bierzemy
  const nN = r.form.querySelector("#wlN")?.value.trim();
  if (r.v === "ok" && nN) { const v = r.form.querySelector("#wlI").value.trim(), j = r.form.querySelector("#wlJ").value, num = L.naLiczbe(v); wlasne.push({ symbol: "", nazwa: nN, jm: j === "paczka" ? "szt" : j, ilosc: j === "paczka" ? "paczka" : (num.ok ? num.w : ""), wlasna: true }); }
  const wynik = [...wlasne, ...wyb.values()];
  if (r.v !== "ok" || !wynik.length) return null;
  const bez = wynik.filter(w => w.ilosc === "").length;
  if (bez && !(await pytanie("Brak ilości", `Pozycji bez ilości: <b>${bez}</b>. Dodać mimo to?`, "Dodaj"))) return null;
  return wynik;
}
// zapytanie na magazyn: pozycje z listy materiałów, bez generatora i bez danych projektu
// ---------- zapytanie na blachę trapezową: wiersz = budowa (kod budowy | profil, grubość, powłoka – m²), cena w zł/m²
export async function zapytanieTrapez() {
  const rok = L.rokNumeru(U), nr = L.nastepnyNumer(Z.map(z => z.nazwa), rok);
  const PROFILE = ["T7", "T14", "T18", "T20", "T35", "T45", "T50", "T55", "T85", "T130", "T135", "T150"];
  const wiersz = () => `<tr><td><input data-f="kod" placeholder="np. BUD-17/2026"></td><td style="width:90px"><input data-f="profil" list="trProfile" placeholder="T35"></td>
    <td style="width:80px"><input data-f="grubosc" inputmode="decimal" placeholder="0,5"></td><td><input data-f="powloka" placeholder="RAL 7016 poliester"></td><td style="width:90px"><input data-f="m2" inputmode="decimal" placeholder="m²"></td></tr>`;
  const r = await okno(`<h3>Zapytanie – blacha trapezowa</h3>
    <div class="grid2"><label>Numer<input name="n" value="${nr}-${rok}" required></label><label>Kod (komórka A1)<input name="k" value="TRAPEZ"></label></div>
    <p class="small">Jeden wiersz = jedna budowa. Dostawcy dostaną listę z kodami budów i prośbą o cenę za m² – odpowiedź (mail albo PDF) wczytasz w zapytaniu przyciskiem „Wczytaj ofertę”.</p>
    <div class="tablebox"><table class="t ed"><thead><tr><th>Kod budowy</th><th>Profil</th><th>Grubość [mm]</th><th>Powłoka / kolor</th><th>Ilość [m²]</th></tr></thead><tbody id="trRows">${wiersz()}${wiersz()}${wiersz()}</tbody></table></div>
    <datalist id="trProfile">${PROFILE.map(x => `<option value="${x}">`).join("")}</datalist>
    <button type="button" class="btn sm" id="trDodaj" style="margin-top:6px">+ Wiersz</button>`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Utwórz zapytanie", cls: "primary" }],
    { szer: "min(900px, calc(100vw - 24px))", poOtwarciu: f => { bezEnterZapisu(f); f.querySelector("#trDodaj").onclick = () => f.querySelector("#trRows").insertAdjacentHTML("beforeend", wiersz()); } });
  if (r.v !== "ok") return;
  const pozycje = [...r.form.querySelectorAll("#trRows tr")].map(tr => Object.fromEntries([...tr.querySelectorAll("[data-f]")].map(i => [i.dataset.f, i.value.trim()])))
    .filter(x => x.kod || x.profil || x.m2).map(OF.wierszTrapez);
  if (!pozycje.length) return toast("Wpisz przynajmniej jedną budowę");
  const nazwa = L.wolnaNazwa(Z.map(z => z.nazwa), r.form.n.value.trim() || `${nr}-${rok}`), kod = r.form.k.value.trim(), m = nazwa.match(/^(\d+)-(\d{4})/);
  try {
    const z = await zapiszDok(C.z, null, { nazwa, kod, typ: "trapez", numer: m ? +m[1] : null, rok: m ? +m[2] : null, naglowki: {}, wiersze: pozycje.map(a => ({ a, c: {} })), dataZap: today(), magazyn: true, kolejnosc: Math.max(0, ...Z.map(z => z.kolejnosc ?? 0)) + 1 },
      { typ: "zapytanie", etykieta: nazwa, diffFn: diffZap });
    const o = await okno(`<h3>Zapytanie gotowe</h3><p>Utworzono: <b>${esc(nazwa)}</b> – ${pozycje.length} budów.</p><p>Przygotować maila do dostawców?</p>`, [{ v: "nie", t: "Nie", nv: true }, { v: "tak", t: "Tak", cls: "primary" }]);
    const zz = await czekajNa(() => zapById(z.id));
    if (o.v === "tak" && zz) await oknoMail(zz);
    go("z", z.id);
  } catch (x) { failed(x); }
}
// ---------- wczytanie oferty: mail .eml, PDF albo wklejony tekst → ceny w kolumnie dostawcy
export let pdfjsGotowy = null;
export async function tekstPdf(dane) {
  pdfjsGotowy ||= new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/pdfjs/pdf.min.js"; sc.onload = () => { globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js"; res(globalThis.pdfjsLib); }; sc.onerror = rej; document.head.append(sc); });
  const lib = await pdfjsGotowy, doc = await lib.getDocument({ data: dane }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); out.push(c.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("")); }
  return out.join("\n");
}
export async function wczytajOferte() {
  const r = await okno(`<h3>Wczytaj ofertę – ${esc(E.nazwa)}</h3>
    <p class="small">Zapisany mail (.eml – w Thunderbirdzie: Zapisz jako… / przeciągnij na pulpit), PDF z oferty albo wklejony tekst maila. Aplikacja znajdzie dostawcę, kody budów i ceny za m² – przed wpisaniem pokaże podgląd.</p>
    <label class="btn filebtn">Wybierz plik (.eml, .pdf, .txt)<input type="file" name="plik" accept=".eml,.pdf,.txt,message/rfc822,application/pdf,text/plain"></label>
    <label class="full">albo wklej treść<textarea name="tekst" rows="6" placeholder="Wklej treść maila z ofertą"></textarea></label>`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dalej", cls: "primary" }], { poOtwarciu: bezEnterZapisu });
  if (r.v !== "ok") return;
  const f = r.form.plik.files?.[0];
  let oferta = { od: "", temat: "", tekst: r.form.tekst.value || "", pdfy: [] };
  try {
    if (f && /\.eml$/i.test(f.name)) oferta = OF.czytajEml(OF.binarny(new Uint8Array(await czytajPlik(f))));
    else if (f && /\.pdf$/i.test(f.name)) oferta.pdfy = [{ nazwa: f.name, dane: new Uint8Array(await czytajPlik(f)) }];
    else if (f) oferta.tekst = new TextDecoder().decode(await czytajPlik(f));
    for (const p of oferta.pdfy) oferta.tekst += "\n" + await tekstPdf(p.dane);
  } catch (x) { return okno(`<h3>Wczytaj ofertę</h3><p>Nie udało się odczytać pliku: ${esc(x.message || x)}</p>`); }
  const wiersze = E.wiersze.map((w, i) => ({ r: i + 2, a: L.vbaTrim(w.a) })).filter(w => w.a);
  const kand = [...Object.values(E.naglowki || {}).map(h => ({ nazwa: L.vbaTrim(h.t || "") })), ...(U.dostawcy || []).map(d => ({ nazwa: L.vbaTrim(d.dostawca || ""), email: d.email }))];
  const dost = OF.rozpoznajDostawce(oferta, kand), ceny = OF.cenyDlaWierszy(oferta.tekst, wiersze);
  const cenaW = new Map(ceny.map(c => [c.r, c]));
  const r2 = await okno(`<h3>Oferta ${oferta.temat ? "– " + esc(oferta.temat) : ""}</h3>
    ${oferta.od ? `<p class="small">Od: ${esc(oferta.od)}${oferta.pdfy.length ? " · załączniki PDF: " + oferta.pdfy.length : ""}</p>` : ""}
    <label>Dostawca (kolumna)<input name="dost" value="${esc(dost)}" list="ofDost" required placeholder="nazwa dostawcy"></label><datalist id="ofDost">${[...new Set(kand.map(k => k.nazwa).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="small">Znalezione ceny: <b>${ceny.length}</b> z ${wiersze.length} wierszy. Popraw albo wpisz brakujące – puste pola nie zmienią arkusza.</p>
    <div class="tablebox" style="max-height:48vh;overflow:auto"><table class="t ed"><thead><tr><th>Pozycja / budowa</th><th>Cena${E.typ === "trapez" ? " [zł/m²]" : ""}</th><th>Fragment oferty</th></tr></thead><tbody>
    ${wiersze.map(w => { const c = cenaW.get(w.r); return `<tr><td>${esc(w.a)}</td><td style="width:110px"><input data-r="${w.r}" inputmode="decimal" value="${c ? esc(L.ogolny(c.cena)) : ""}"></td><td class="small">${c ? esc(c.fragment) : "–"}</td></tr>`; }).join("")}</tbody></table></div>
    ${!ceny.length && oferta.tekst.trim() ? `<details><summary class="small">Tekst oferty (nie znalazłem cen za m²)</summary><pre class="small" style="white-space:pre-wrap;max-height:200px;overflow:auto">${esc(oferta.tekst.slice(0, 4000))}</pre></details>` : ""}`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Wpisz ceny do zapytania", cls: "primary" }], { szer: "min(1000px, calc(100vw - 24px))", poOtwarciu: bezEnterZapisu });
  if (r2.v !== "ok") return;
  const nazwaD = r2.form.dost.value.trim(); if (!nazwaD) return;
  E.naglowki = E.naglowki || {};
  let c = Object.entries(E.naglowki).find(([, h]) => L.LC(L.vbaTrim(h.t || "")) === L.LC(nazwaD))?.[0];
  if (!c) { c = Math.max(1, L.ostKolumna(E)) + 1; for (let k = 2; k <= L.ostKolumna(E); k++) if (!L.vbaTrim(E.naglowki[k]?.t || "")) { c = k; break; } E.naglowki[c] = { ...(E.naglowki[c] || {}), t: nazwaD }; }
  let ile = 0;
  r2.form.querySelectorAll("input[data-r]").forEach(i => { const v = i.value.trim(); if (!v) return; ustawKomorke(+i.dataset.r, +c, v); ile++; });
  zmiana(); rysujArkusz(); toast(`Wpisano ${ile} cen – ${nazwaD}`);
}
export async function zapytanieNaMagazyn() {
  const wyb = await wybierzZListy(); if (!wyb) return;
  const rok = L.rokNumeru(U), nr = L.nastepnyNumer(Z.map(z => z.nazwa), rok);
  const r = await okno(`<h3>Nowe zapytanie</h3><div class="grid2"><label>Numer<input name="n" value="${nr}-${rok}" required></label><label>Kod (komórka A1)<input name="k" value="MAG"></label></div>
    <p class="small">${wyb.length} poz.: ${esc(wyb.slice(0, 5).map(x => x.nazwa).join(", "))}${wyb.length > 5 ? "…" : ""}</p><p class="small">Np. na magazyn albo na drobne zakupy. Zapytanie nie tworzy danych projektu – koszt projektu go nie dotyczy.</p>`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Utwórz zapytanie", cls: "primary" }]);
  if (r.v !== "ok") return;
  let nazwa = r.form.n.value.trim() || `${nr}-${rok}`;
  const kod = r.form.k.value.trim();
  if (L.UC(L.vbaTrim(U.kodWNazwie)) === "TAK" && kod && !nazwa.includes(" ")) nazwa += " " + kod;   // jak „kod klienta w nazwie” w Ustawieniach
  nazwa = L.wolnaNazwa(Z.map(z => z.nazwa), nazwa);
  let krok = Math.trunc(L.ustLiczba(U.krok, 2)); if (krok < 1) krok = 1;
  let start = Math.trunc(L.ustLiczba(U.start, 2)); if (start < 2) start = 2;
  const wiersze = []; let w = start;
  for (const x of wyb) { while (wiersze.length < w - 2) wiersze.push({ a: "", c: {} }); wiersze.push({ a: L.trescPozycji({ nazwa: x.nazwa, ilZap: x.ilosc, jm: x.jm }), c: {} }); w += krok; }
  const m = nazwa.match(/^(\d+)-(\d{4})/);
  try {
    const z = await zapiszDok(C.z, null, { nazwa, kod, numer: m ? +m[1] : null, rok: m ? +m[2] : null, naglowki: {}, wiersze, dataZap: today(), magazyn: true, kolejnosc: Math.max(0, ...Z.map(z => z.kolejnosc ?? 0)) + 1 },
      { typ: "zapytanie", etykieta: nazwa, diffFn: diffZap });
    const o = await okno(`<h3>Zapytanie gotowe</h3><p>Utworzono: <b>${esc(nazwa)}</b> – ${wyb.length} poz.</p><p>Przygotować maila do dostawców?</p>`, [{ v: "nie", t: "Nie", nv: true }, { v: "tak", t: "Tak", cls: "primary" }]);
    const zz = await czekajNa(() => zapById(z.id));
    if (o.v === "tak" && zz) await oknoMail(zz);
    go("z", z.id);
  } catch (x) { failed(x); }
}
