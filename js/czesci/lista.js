// Zapytania: 3. mail i 2. lista zapytań
import * as L from "../logika.js?v=202611121300";
import { $, esc, today, hex, failed, okno, kopiuj, natywna } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { M, P, U, Z, diffZap, go, zapiszDok, zapytaniaPosort } from '../app.js?v=202611121300';
import { kursySub } from './arkusz.js?v=202611121300';
import { zapytanieNaMagazyn, zapytanieTrapez } from './generator.js?v=202611121300';

/* ============================================================ 3. mail */
export async function oknoMail(z) {
  const m = L.przygotujMail(z, U);
  if (m.blad) return okno(`<h3>Mail do dostawców</h3><p>${esc(m.blad)}</p>`);
  if (z.typ === "trapez") m.tresc += "\n\nProszę o cenę netto za m² dla każdej budowy – z kodem budowy przy cenie.";
  const href = `mailto:${encodeURIComponent(m.do)}?bcc=${encodeURIComponent(m.udw)}&subject=${encodeURIComponent(m.temat)}&body=${encodeURIComponent(m.tresc.replace(/\n/g, "\r\n"))}`;
  await okno(`<h3>Mail: ${esc(z.nazwa)}</h3>
    <div class="small">Dostawcy idą w UDW – nie widzą się nawzajem. Przycisk otwiera nową wiadomość w domyślnym programie pocztowym (Thunderbird, jeśli jest domyślny).</div>
    ${m.do ? `<div><span class="small">Do:</span> <span class="mono">${esc(m.do)}</span></div>` : ""}
    <div><div class="toolbar"><span class="small">UDW (${m.udw.split(",").length} adresów)</span><button type="button" class="btn sm" id="mCpA">Kopiuj adresy</button></div><div class="copybox" style="max-height:90px">${esc(m.udw)}</div></div>
    <div><span class="small">Temat:</span> <b>${esc(m.temat)}</b></div>
    <div><div class="toolbar"><span class="small">Treść (${m.ilePozycji} poz.)</span><button type="button" class="btn sm" id="mCpT">Kopiuj treść</button></div><div class="copybox">${esc(m.tresc)}</div></div>
    <a class="btn primary" href="${esc(href)}" ${natywna() ? "" : 'target="_blank" rel="noopener"'}>Otwórz wiadomość w programie pocztowym</a>`,
    [{ v: "ok", t: "Zamknij" }], { poOtwarciu: f => { f.querySelector("#mCpA").onclick = () => kopiuj(m.udw); f.querySelector("#mCpT").onclick = () => kopiuj(`Temat: ${m.temat}\n\n${m.tresc}`); } });
}

/* ============================================================ 2. lista zapytań */
export let listaQ = "";
// znaczek na liście: ile zamówień złożono / ile dostawców wybrano
export function stanZamowien(z, wyb) {
  const o = Object.values(z.zamowienia || {}); if (!wyb || !o.length) return "";
  const dostarczono = o.filter(x => x.status === "dostarczono" || kursySub.get(x.kursId)?.dane?.status === "Dostarczone").length, zam = o.filter(x => x.status === "zamowiono" || x.status === "dostarczono" || x.kursId).length;
  const [k, t] = dostarczono >= wyb ? ["p-ok", "dostarczono"] : zam >= wyb ? ["p-acc", "zamówiono"] : ["p-warn", `zamówiono ${zam}/${wyb}`];
  return ` · <span class="pill ${k}">${t}</span>`;
}
export function renderLista() {
  const q = L.LC(listaQ);
  const lista = zapytaniaPosort().filter(z => !q || L.LC(z.nazwa + " " + z.kod + " " + z.wiersze.map(w => w.a).join(" ") + " " + Object.values(z.naglowki || {}).map(h => h.t).join(" ")).includes(q));
  M().innerHTML = `<div class="panel"><div class="hd"><div class="toolbar"><input id="lQ" type="search" placeholder="Przejdź do zapytania: numer, kod klienta, pozycja, dostawca…" style="width:340px" value="${esc(listaQ)}"></div>
    <div class="toolbar"><button class="btn primary" id="lMag">Nowe zapytanie (lista / własne pozycje)</button><button class="btn" id="lTrapez">Blacha trapezowa (budowy, cena za m²)</button><button class="btn" id="lNowe">+ Puste zapytanie (z wzoru)</button></div></div>
    <div class="lista">${lista.slice(0, 300).map(z => {
      const poz = z.wiersze.filter(w => L.vbaTrim(w.a)).length, dost = Object.values(z.naglowki || {}).filter(h => h.t).length, wyb = Object.values(z.naglowki || {}).filter(h => L.kolor(h.k) !== -1).length;
      const proj = L.projektDlaZapytania(P, z.nazwa);
      return `<div class="it" data-id="${z._id}"><div><span class="nm mono">${esc(z.nazwa)}</span>${z.kod && !L.LC(z.nazwa).includes(L.LC(z.kod)) ? ` <span class="small">|</span> <b>${esc(z.kod)}</b>` : ""}
        <div class="small">${poz} poz. · ${dost} dostawców${wyb ? ` · wybrano: ${Object.values(z.naglowki).filter(h => L.kolor(h.k) !== -1).map(h => `<span class="sw" style="background:${hex(h.k)}"></span>${esc(h.t)}`).join(" ")}` : ""}${proj ? " · projekt" : ""}${stanZamowien(z, wyb)}</div></div>
        <span class="small">›</span></div>`;
    }).join("") || `<div class="empty"><strong>Brak zapytań</strong><span>Utwórz zapytanie w Generatorze albo zaimportuj plik Excel w Ustawieniach.</span></div>`}</div></div>`;
  $("lQ").oninput = e => { listaQ = e.target.value; const pos = e.target.selectionStart; renderLista(); $("lQ").focus(); $("lQ").setSelectionRange(pos, pos); };
  $("lQ").onkeydown = e => { if (e.key === "Enter") { const f = M().querySelector(".it"); if (f) go("z", f.dataset.id); } };
  M().querySelector(".lista").onclick = e => { const it = e.target.closest(".it"); if (it) go("z", it.dataset.id); };
  $("lNowe").onclick = noweZWzoru;
  $("lMag").onclick = zapytanieNaMagazyn;
  $("lTrapez").onclick = zapytanieTrapez;
}
export async function noweZWzoru() {
  const rok = L.rokNumeru(U), nr = L.nastepnyNumer(Z.map(z => z.nazwa), rok);
  const r = await okno(`<h3>Nowe zapytanie</h3><div class="grid2"><label>Nazwa (numer)<input name="n" value="${nr}-${rok}" required></label><label>Kod klienta (A1)<input name="k"></label></div>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Utwórz", cls: "primary" }]);
  if (r.v !== "ok") return;
  const nazwa = L.wolnaNazwa(Z.map(z => z.nazwa), r.form.n.value.trim() || `${nr}-${rok}`);
  const m = nazwa.match(/^(\d+)-(\d{4})/);
  try {
    const w = await zapiszDok(C.z, null, { nazwa, kod: r.form.k.value.trim(), numer: m ? +m[1] : null, rok: m ? +m[2] : null, naglowki: {}, wiersze: [], dataZap: today(), kolejnosc: Math.max(0, ...Z.map(z => z.kolejnosc ?? 0)) + 1 },
      { typ: "zapytanie", etykieta: nazwa, diffFn: diffZap });
    go("z", w.id);
  } catch (x) { failed(x); }
}
