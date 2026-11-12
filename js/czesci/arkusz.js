// Zapytania: arkusz zapytania (pozycje, oferty, porównanie, zamówienia)
import * as L from "../logika.js?v=202611121300";
import * as OF from "../oferty.js?v=202611121300";
import * as ZM from "../zamowienia.js?v=202611121300";
import { $, esc, today, fDT, fD, clone, fmt, zl, kolLit, hex, toast, failed, okno, pytanie, zapiszXlsx } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { B, G, LOG, M, P, PALETA, U, W, Z, zapytaniaPosort, czysc, diffZap, go, isOwner, me, render, user, widok, wpis, zaladowane, zapById, zapByNazwa, zapiszDok } from '../app.js?v=202611121300';
import { dopiszDoBazy } from './ceny-widok.js?v=202611121300';
import { logItem } from './dziennik.js?v=202611121300';
import { genDirty, wczytajOferte, wybierzZListy, zapiszGenerator } from './generator.js?v=202611121300';
import { edytujProjekt, kosztDlaZapytania, pozycjaProjektu, zapiszProjekt } from './koszt.js?v=202611121300';
import { oknoMail } from './lista.js?v=202611121300';

/* ============================================================ arkusz zapytania */
export let E = null, eId = null, eWersja = 0, eDirty = false, eTimer = null, eZapis = null, wybor = false, fokus = null;
export function odswiezArkuszZBazy() {
  const z = zapById(widok.arg);
  if (!z) return render();
  if (z._id !== eId) return render();
  if ((z.wersja || 0) !== eWersja && !eDirty && !document.activeElement?.closest?.("table.ark")) { E = clone(z); eWersja = z.wersja || 0; rysujArkusz(); }
  else if (widok.nazwa === "z") rysujHistorie();
}
export function renderArkusz() {
  const z = zapById(widok.arg);
  if (!z) { M().innerHTML = zaladowane.z ? `<div class="empty"><strong>Nie ma takiego zapytania</strong><a class="btn" href="#zapytania">Lista zapytań</a></div>` : `<div class="empty">Wczytywanie…</div>`; return; }
  if (eId !== z._id || !eDirty) { E = clone(z); eId = z._id; eWersja = z.wersja || 0; }
  dodWiersze = 0;
  const proj = L.projektDlaZapytania(P, z.nazwa);
  M().innerHTML = `
    <div class="panel"><div class="hd">
      <div class="toolbar"><a class="btn" href="#zapytania">← Lista</a>${(() => { const L2 = zapytaniaPosort(), i = L2.findIndex(x => x._id === z._id), st = L2[i + 1], nw = L2[i - 1];
        return `<button class="btn nawZ" id="aPoprz" ${st ? `data-id="${st._id}" title="Starsze: ${esc(st.nazwa)} (Alt+←)"` : "disabled"} aria-label="Poprzednie zapytanie">‹</button><h2 class="mono" id="aNazwa">${esc(E.nazwa)}</h2><button class="btn nawZ" id="aNast" ${nw ? `data-id="${nw._id}" title="Nowsze: ${esc(nw.nazwa)} (Alt+→)"` : "disabled"} aria-label="Następne zapytanie">›</button>`; })()}${isOwner ? `<button class="btn sm" id="aZmienNazwe">Zmień nazwę</button>` : ""}<span class="status" id="aStatus"></span></div>
      <div class="toolbar">
        <button class="btn" id="aZListy">Dodaj z listy</button>
        <button class="btn" id="aWybor">Wybór dostawcy kolorem</button>
        <button class="btn" id="aMail">Mail do dostawców</button>
        <button class="btn" id="aWaga">Waga dla logistyki</button>
        <button class="btn" id="aKoszt">Koszt projektu${proj ? "" : " (brak danych)"}</button>
        <button class="btn" id="aXls">Pobierz jako Excel</button>
        <button class="btn" id="aOferta" title="Mail (.eml), PDF albo tekst oferty – ceny wpiszą się w kolumnę dostawcy">Wczytaj ofertę</button>
        <button class="btn" id="aKom" title="Pokaż treść komentarzy w komórkach">Pokaż komentarze</button>
        ${proj ? `<button class="btn" id="aProj" title="Pozycje liczone do kosztu projektu">Edytuj projekt</button>` : ""}
        ${isOwner ? `<button class="btn danger" id="aUsun">Usuń</button>` : ""}
      </div></div>
      <div class="bd legend" id="aLegenda"></div>
      <div class="bd pasek" id="aPasek"><span class="small" id="aPasekInfo">Kliknij komórkę – tu pojawią się opcje (wybór dostawcy, komentarz, wiersze, kolumny).</span></div>
      <div class="bd notice" id="aWyborInfo" hidden>Tryb wyboru: kliknij cenę dostawcy w wierszu pozycji – pozycja i nagłówek dostawcy dostaną ten sam kolor (jak zaznaczanie kolorem w Excelu). Kliknięcie pozycji w kolumnie A usuwa wybór, kliknięcie nagłówka dostawcy zmienia jego kolor. Bez tego trybu: kliknij cenę i użyj „Wybierz tego dostawcę”.</div>
    </div>
    <div id="aBox"><div class="arkuszbox" id="aGrid"></div></div>
    <div class="panel" id="aZam"></div>
    <div class="panel hist" id="aHist"><div class="hd" id="aHistHd" role="button" tabindex="0" aria-expanded="false" title="Pokaż / zwiń historię zmian"><h3><span class="strz">▸</span> Historia zmian <span class="small" id="aHistIle"></span></h3></div><div class="log" id="aLog"></div></div>`;
  $("aWybor").onclick = () => { wybor = !wybor; $("aWybor").classList.toggle("on", wybor); $("aBox").classList.toggle("wybor", wybor); $("aWyborInfo").hidden = !wybor; $("cellbar").hidden = true; };
  $("aWybor").classList.toggle("on", wybor); $("aBox").classList.toggle("wybor", wybor); $("aWyborInfo").hidden = !wybor;
  $("aMail").onclick = async () => { await zapiszTeraz(); oknoMail(zapById(eId)); };
  $("aWaga").onclick = async () => { await zapiszTeraz(); go("waga", eId); };
  $("aKoszt").onclick = async () => { await zapiszTeraz(); kosztDlaZapytania(zapById(eId)); };
  $("aXls").onclick = () => eksportArkusza(E);
  $("aOferta").onclick = wczytajOferte;
  const skocz = b => { if (b?.dataset.id) zapiszTeraz().then(() => go("z", b.dataset.id)); };
  $("aPoprz").onclick = e => skocz(e.currentTarget); $("aNast").onclick = e => skocz(e.currentTarget);
  // historia zmian zwijana (domyślnie zwinięta, pamiętane na tym urządzeniu)
  const histOn = v => { $("aHist").classList.toggle("otw", v); $("aHistHd").setAttribute("aria-expanded", v); try { localStorage.setItem("zap_hist", v ? "1" : ""); } catch {} };
  let h0 = false; try { h0 = !!localStorage.getItem("zap_hist"); } catch {}
  histOn(h0); $("aHistHd").onclick = () => histOn(!$("aHist").classList.contains("otw"));
  $("aHistHd").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); histOn(!$("aHist").classList.contains("otw")); } };
  $("aProj") && ($("aProj").onclick = async () => { await zapiszTeraz(); const pr = L.projektDlaZapytania(P, E.nazwa); if (pr) edytujProjekt(pr, E.nazwa); });
  const komOn = v => { $("aBox").classList.toggle("komentarze", v); $("aKom").classList.toggle("on", v); $("aKom").textContent = v ? "Ukryj komentarze" : "Pokaż komentarze"; try { localStorage.setItem("zap_kom", v ? "1" : ""); } catch {} };
  let kom0 = false; try { kom0 = !!localStorage.getItem("zap_kom"); } catch {}
  komOn(kom0); $("aKom").onclick = () => komOn(!$("aBox").classList.contains("komentarze"));
  $("aZListy").onclick = async () => {
    const wyb = await wybierzZListy(); if (!wyb) return;
    const pr = L.projektDlaZapytania(P, E.nazwa);
    let doProj = false;
    if (pr) {
      const r = await okno(`<h3>Dodane pozycje (${wyb.length})</h3><p>Zapytanie ma projekt <b>${esc(pr.id)}</b>. Czy te pozycje liczyć do kosztu projektu?</p>
        <ul class="small">${wyb.slice(0, 8).map(x => `<li>${esc(L.trescPozycji({ nazwa: x.nazwa, ilZap: x.ilosc, jm: x.jm }))}</li>`).join("")}${wyb.length > 8 ? "<li>…</li>" : ""}</ul>`,
        [{ v: "cancel", t: "Anuluj", nv: true }, { v: "mag", t: "Na magazyn" }, { v: "proj", t: "Do projektu", cls: "primary" }]);
      if (r.v !== "mag" && r.v !== "proj") return;
      doProj = r.v === "proj";
    }
    przytnij();
    const nowe = wyb.map(x => L.trescPozycji({ nazwa: x.nazwa, ilZap: x.ilosc, jm: x.jm }));
    for (const a of nowe) E.wiersze.push({ a, c: {} });
    zmiana(); rysujArkusz(); toast(`Dodano ${wyb.length} poz.${pr ? (doProj ? " do projektu" : " na magazyn") : ""}`);
    if (doProj) { await zapiszTeraz(); await zapiszProjekt(pr, [...pr.pozycje, ...wyb.map((x, i) => pozycjaProjektu(nowe[i], x))], "dodanie pozycji z zapytania"); }
  };
  $("aUsun") && ($("aUsun").onclick = usunZapytanie);
  $("aZmienNazwe") && ($("aZmienNazwe").onclick = zmienNazwe);
  $("aPasek").append($("cellbar"));
  rysujArkusz(); rysujHistorie();
}
export function rysujHistorie() {
  const el = $("aLog"); if (!el) return;
  const l = LOG.filter(x => x.obiektId === eId || (x.typ === "zapytanie" && String(x.obiekt).split(", ").includes(E?.nazwa)));
  el.innerHTML = l.length ? l.slice(0, 60).map(logItem).join("") : `<div class="empty"><span>Brak wpisów</span></div>`;
  if ($("aHistIle")) $("aHistIle").textContent = l.length ? `(${l.length}${l.length > 60 ? ", ostatnie 60" : ""})` : "";
}
export function wartWyswietl(c, kol) {
  if (!c) return "";
  if (c.f && (c.v === undefined || c.v === null)) return "#BŁĄD";
  if (typeof c.v === "number") return kol >= 2 ? zl(c.v) : L.ogolny(c.v);
  if (typeof c.v === "boolean") return c.v ? "PRAWDA" : "FAŁSZ";
  return String(c.v ?? "");
}
export const wartEdycja = c => !c ? "" : c.f ? c.f : typeof c.v === "number" ? L.ogolny(c.v) : String(c.v ?? "");
// pod nazwą dostawcy: ile pozycji wybrano i stan zamówienia (zamówiono / dostawa w Logistyce / dostarczono)
// w oknach zamówienia Enter nie zatwierdza (w polach jednowierszowych nic nie robi, w uwagach – nowa linia); zapis tylko przyciskiem
export function bezEnterZapisu(f) { f.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault(); }); }
export function stanDostawcy(c, n) {
  if (!L.vbaTrim(n.t || "")) return "";
  const k = L.kolor(n.k), btn = `<button type="button" class="kolBtn" data-kol="${c}" title="Kolor dostawcy – wybierz albo usuń" aria-label="kolor dostawcy" style="${k !== -1 ? `--k:${hex(k)}` : ""}"></button>`;
  let suma = "";
  if (E.typ === "trapez") { let s = 0; for (const w of E.wiersze) { const n = L.naLiczbe(w.c?.[c]?.v), m2 = OF.m2Wiersza(w.a); if (n.ok && m2) s += n.w * m2; } if (s) suma = `<span title="suma: cena za m² × m²">Σ ${fmt(s, 0)} zł</span>`; }
  if (k === -1) return `<div class="zst">${btn}<span>bez koloru</span>${suma}</div>`;
  const ile = E.wiersze.filter(w => L.vbaTrim(w.a) && (L.kolor(w.k) === k || L.kolor(w.c?.[c]?.k) === k)).length;
  const z = (E.zamowienia || {})[k] || {}, kurs = z.kursId ? kursySub.get(z.kursId)?.dane : null;
  const [kl, t] = (kurs?.status === "Dostarczone" || z.status === "dostarczono") ? ["p-ok", "dostarczono"] : z.kursId ? ["p-acc", "w Logistyce"] : z.status === "zamowiono" ? ["p-warn", z.nr ? "zam. " + z.nr : "zamówiono"] : ["p-idle", "nie zamówiono"];
  const zamowione = !!(z.kursId || z.status);
  const usun = zamowione ? "" : `<button type="button" class="bezKol" data-bezkol="${c}" title="Usuń kolor tego dostawcy (nic nie zamówiono)" aria-label="usuń kolor">✕</button>`;
  return `<div class="zst">${btn}<span>${ile} poz.</span>${suma}<span class="pill ${kl}">${esc(t)}</span>${usun}</div>`;
}
export const km = t => `<span class="km" title="${esc(t)}"></span><span class="kmT">${esc(t)}</span>`;
export let dodWiersze = 0;          // puste wiersze dołożone Enterem / strzałką na końcu arkusza
export function rysujArkusz() {
  const g = $("aGrid"); if (!g || !E) return;
  const ostK = Math.max(L.ostKolumna(E), 4), nW = Math.max(E.wiersze.length + 3, 6) + dodWiersze;
  const naglowki = E.naglowki || {};
  // które wiersze liczą się do kosztu projektu (treść podpięta w pozycji projektu)
  const prA = L.projektDlaZapytania(P, E.nazwa), doProj = new Set((prA?.pozycje || []).filter(x => L.LC(x.ark || "") === L.LC(E.nazwa)).map(x => L.LC(L.vbaTrim(x.tresc || ""))).filter(Boolean));
  // szerokość kolumny dopasowana do najdłuższego tekstu (nagłówek albo komórka), 160–320 px
  const tel = innerWidth < 700;      // na telefonie wąska kolumna A (zawija tekst), żeby było widać ceny
  const szer = c => { let n = String(naglowki[c]?.t ?? "").length; for (const w of E.wiersze) n = Math.max(n, wartWyswietl(w.c?.[c], c).length); return tel ? szerKol(n * 0.85, 96, 170) : szerKol(n, 160, 320); };
  const szerA = tel ? Math.round(Math.min(150, Math.max(118, innerWidth * 0.36))) : szerKol(Math.max(String(E.kod ?? "").length, ...E.wiersze.map(w => Math.max(...String(w.a ?? "").split("\n").map(l => l.length)))), 300, 560);
  let h = `<table class="ark ark2"><thead><tr><th class="rn"></th><th style="position:sticky;left:${tel ? 26 : 34}px;z-index:4;width:${szerA}px;min-width:${szerA}px">A</th>${Array.from({ length: ostK - 1 }, (_, i) => { const w = szer(i + 2); return `<th style="width:${w}px;min-width:${w}px" title="kolumna ${kolLit(i + 2)}">${kolLit(i + 2)}</th>`; }).join("")}<th></th></tr></thead><tbody>`;
  // wiersz 1: kod klienta + dostawcy
  h += `<tr class="r1"><td class="rn" title="wiersz 1"></td><td class="a" data-r="1" data-c="1">${E.kodM ? km(E.kodM) : ""}<input value="${esc(E.kod)}" data-r="1" data-c="1" aria-label="A1 kod klienta"></td>`;
  for (let c = 2; c <= ostK; c++) {
    const n = naglowki[c] || {}, k = L.kolor(n.k);
    h += `<td class="c dost ${k !== -1 ? "kol" : ""}" data-r="1" data-c="${c}" style="${k !== -1 ? `--k:${hex(k)}` : ""}">${n.m ? km(n.m) : ""}<input class="txt" value="${esc(n.t ?? "")}" data-r="1" data-c="${c}" list="dostList" aria-label="${kolLit(c)}1 dostawca" placeholder="dostawca">${stanDostawcy(c, n)}</td>`;
  }
  h += `<td class="plus" rowspan="1"><button class="btn sm" id="aDodajKol" title="Dodaj kolumnę dostawcy">+</button></td></tr>`;
  for (let i = 0; i < nW; i++) {
    const w = E.wiersze[i] || { a: "", c: {} }, r = i + 2, kA = L.kolor(w.k);
    const skr = L.skrajneCeny(w, 30);
    h += `<tr><td class="rn" title="wiersz ${r}">${L.vbaTrim(w.a) ? r - 1 : ""}${prA && L.vbaTrim(w.a) ? (doProj.has(L.LC(L.vbaTrim(w.a))) ? `<span class="tagP" title="liczone do kosztu projektu ${esc(prA.id)}">P</span>` : `<span class="tagM" title="nie w projekcie (magazyn)">M</span>`) : ""}</td><td class="a ${kA !== -1 ? "kol" : ""}" data-r="${r}" data-c="1" style="${kA !== -1 ? `--k:${hex(kA)}` : ""}">${w.m ? km(w.m) : ""}<textarea rows="1" data-r="${r}" data-c="1" aria-label="A${r}">${esc(w.a)}</textarea></td>`;
    for (let c = 2; c <= ostK; c++) {
      const cel = w.c?.[c], kc = L.kolor(cel?.k), cls = skr.min.has(c) ? "min" : skr.max.has(c) ? "max" : "";
      const kw = kc !== -1 ? kc : (kA !== -1 && L.kolor(naglowki[c]?.k) === kA ? kA : -1);     // cena wybranego dostawcy w tym wierszu
      const txt = cel && typeof cel.v !== "number" && !cel.f;
      h += `<td class="c ${cls} ${kc !== -1 && !cls ? "kol" : ""} ${kw !== -1 ? "wyb" : ""}" data-r="${r}" data-c="${c}" style="${kw !== -1 ? `--k:${hex(kw)}` : ""}">${cel?.m ? km(cel.m) : ""}<input class="${txt ? "txt" : ""}" value="${esc(wartWyswietl(cel, c))}" data-r="${r}" data-c="${c}" inputmode="decimal" aria-label="${kolLit(c)}${r}"></td>`;
    }
    h += `<td></td></tr>`;
  }
  h += `</tbody></table><datalist id="dostList">${(U.dostawcy || []).map(d => `<option value="${esc(L.LC(d.dostawca))}">`).join("")}</datalist>`;
  g.innerHTML = h;
  g.style.scrollPaddingLeft = ((innerWidth < 700 ? 26 : 34) + (g.querySelector("thead th:nth-child(2)")?.offsetWidth || 0)) + "px"; g.style.scrollPaddingTop = "34px";   // aktywna komórka nie chowa się pod kolumną A ani nagłówkiem
  g.querySelectorAll("textarea").forEach(autoH);
  legenda();
  rysujZamowienia();
  status();
  $("aDodajKol").onclick = () => { const c = L.ostKolumna(E) + 1; E.naglowki = E.naglowki || {}; E.naglowki[Math.max(c, 2)] = { t: "" }; zmiana(); rysujArkusz(); g.querySelector(`input[data-r="1"][data-c="${Math.max(c, 2)}"]`)?.focus(); };
}
// autodopasowanie: ok. 8,6 px na znak + marginesy
export function szerKol(znakow, min, max) { return Math.min(max, Math.max(min, Math.round(znakow * 8.6 + 30))); }
// w trakcie pisania kolumna rośnie, gdy tekst się nie mieści
document.addEventListener("input", e => {
  const el = e.target.closest?.("table.ark input"); if (!el) return;
  const c = +el.dataset.c, th = el.closest("table").querySelectorAll("thead th")[c];
  if (!th || c < 2) return;
  const w = innerWidth < 700 ? szerKol(el.value.length * 0.85, 96, 170) : szerKol(el.value.length, 160, 320);
  if (w > th.offsetWidth) { th.style.width = w + "px"; th.style.minWidth = w + "px"; }
});
/* ---------- zamówienia: wybrano → zamówiono → dostawa w Logistyce → dostarczono */
export const kursySub = new Map();      // kursId -> {unsub, dane}
export function obserwujKurs(id) {
  if (!id || kursySub.has(id)) return;
  const o = { dane: null, unsub: null };
  kursySub.set(id, o);
  o.unsub = B.watchDoc("kursy", id, d => { o.dane = d; if (widok.nazwa === "z") rysujZamowienia(); }, () => { o.dane = { brakDostepu: true }; });
}
export function rysujZamowienia() {
  odswiezNaglowki();
  const el = $("aZam"); if (!el || !E) return;
  const grupy = ZM.grupyZamowien(E, { wagi: L.slownikWag(W), pamiec: W.pamiec || {} });
  if (!grupy.length) { el.innerHTML = `<div class="hd"><h3>Zamówienia</h3><span class="small">Pojawią się tu, gdy wybierzesz dostawców kolorem.</span></div>`; return; }
  const Z_ = E.zamowienia || {};
  el.innerHTML = `<div class="hd"><h3>Zamówienia</h3><span class="small">Wybrany dostawca → zamówienie → dostawa w Logistyce (biuro uzupełnia transport i awizo) → dostarczono.</span></div>
    <div class="bd" style="display:grid;gap:10px">${grupy.map(g => {
      const z = Z_[g.kolor] || {}, kurs = z.kursId ? kursySub.get(z.kursId)?.dane : null;
      if (z.kursId) obserwujKurs(z.kursId);
      const dost = kurs && !kurs.brakDostepu && kurs.status === "Dostarczone";
      const st = dost || z.status === "dostarczono" ? ["p-ok", "dostarczono"] : z.kursId ? ["p-acc", "dostawa w Logistyce"] : z.status === "zamowiono" ? ["p-warn", "zamówiono"] : ["p-idle", "wybrano – nie zamówiono"];
      const t = g.wagaKg != null ? L.vbaRound(g.wagaKg / 1000, 3) : null;
      return `<div class="sup-z" data-k="${g.kolor}" style="border-left:6px solid #${g.kolor}"><div class="toolbar" style="justify-content:space-between">
          <div><b>${esc(ZM.pelnaNazwa(g.dostawca, U))}</b> <span class="pill ${st[0]}">${st[1]}</span>
            <div class="small">${g.pozycje.length} poz.${t != null ? ` · ok. ${fmt(t, 3)} t` : ""}${g.bezWagi ? ` (${g.bezWagi} bez wagi)` : ""}${z.nr ? ` · zam. <b>${esc(z.nr)}</b>` : ""}${z.zak ? ` · <span class="pill p-ok" title="Dopisane do Zakupów profili">w Zakupach profili: ${z.zak.n} poz.</span>` : ""}${z.data ? ` z ${fD(z.data)}` : ""}${z.dostawa ? ` · dostawa ${fD(z.dostawa)}` : ""}${kurs && !kurs.brakDostepu ? ` · Logistyka: ${esc(kurs.status || "")}${kurs.zal ? `, załadunek ${fD(kurs.zal)}` : ""}${kurs.dst ? `, dostawa ${fD(kurs.dst)}` : ""}` : ""}</div></div>
          <div class="toolbar">
            <button class="btn sm ${z.status ? "" : "primary"}" data-za="zam">${z.status ? "Popraw zamówienie" : "Zamówiono"}</button>
            ${z.status && !z.kursId ? `<button class="btn sm primary" data-za="kurs">Utwórz dostawę w Logistyce</button>` : ""}
            ${z.status && !z.zak ? `<button class="btn sm" data-za="zak" title="Pozycje profili z tego zamówienia dopisane do zamówień w Zakupach profili (Kombajn Zakupowca)">Do Zakupów profili</button>` : ""}
            ${z.status && !dost && z.status !== "dostarczono" ? `<button class="btn sm" data-za="dost">Dostarczono</button>` : ""}
            ${z.status ? `<button class="btn sm ghost" data-za="cofnij" title="Wyczyść status zamówienia">✕</button>` : ""}
          </div></div>
        <div class="small" style="margin-top:4px">${g.pozycje.map(p => esc(p.w.a)).join(" · ")}</div></div>`;
    }).join("")}</div>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("#aZam [data-za]"); if (!b || !E) return;
  const k = b.closest("[data-k]").dataset.k, a = b.dataset.za;
  const grupy = ZM.grupyZamowien(E, { wagi: L.slownikWag(W), pamiec: W.pamiec || {} }), g = grupy.find(x => x.kolor === k); if (!g) return;
  E.zamowienia = E.zamowienia || {};
  const z = E.zamowienia[k] || { dostawca: ZM.pelnaNazwa(g.dostawca, U) };
  if (a === "zam") {
    const r = await okno(`<h3>Zamówienie: ${esc(z.dostawca)}</h3><div class="grid3"><label>Nr zamówienia (np. ZD)<input name="nr" value="${esc(z.nr || "")}"></label><label>Data zamówienia<input name="data" type="date" value="${esc(z.data || today())}"></label><label>Planowana dostawa<input name="dostawa" type="date" value="${esc(z.dostawa || "")}"></label><label class="full">Uwagi / opis zamówienia<textarea name="uwagi" rows="4" placeholder="Enter – nowa linia">${esc(z.uwagi || "")}</textarea></label></div>
      <p class="small">Zamówienie zapisuje się przyciskiem „Zapisz”.</p>`,
      [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Zapisz", cls: "primary" }], { poOtwarciu: bezEnterZapisu });
    if (r.v !== "ok") return;
    Object.assign(z, { nr: r.form.nr.value.trim(), data: r.form.data.value, dostawa: r.form.dostawa.value, uwagi: r.form.uwagi.value.trim(), status: z.status === "dostarczono" ? "dostarczono" : "zamowiono" });
    E.zamowienia[k] = z; zmiana(); rysujZamowienia();
    // pozycje zamówione u tego dostawcy, których nie ma w bazie cen – dopisują się z ceną z zamówienia (bez blachy trapezowej – cena za m² budowy)
    const doBazy = E.typ === "trapez" ? 0 : await dopiszDoBazy(g.pozycje.map(({ w }) => { const pk = ZM.pozycjaDoKursu(w.a), n = L.naLiczbe(w.c?.[g.c]?.v);
      return { symbol: "", nazwa: pk.nazwa, cena: n.ok ? n.w : 0, jm: pk.jm, zrodlo: "zamowienie", data: z.data || today(), dostawca: z.dostawca, zapytanie: E.nazwa }; }));
    if (doBazy) toast(`Dopisano do bazy cen: ${doBazy} poz.`);
    return;
  }
  if (a === "dost") { z.status = "dostarczono"; E.zamowienia[k] = z; zmiana(); rysujZamowienia(); return; }
  if (a === "cofnij") { if (!(await pytanie("Wyczyścić zamówienie?", `${esc(z.dostawca)}${z.kursId ? "<br>Dostawa w Logistyce zostaje – usuń ją tam, jeśli trzeba." : ""}`, "Wyczyść"))) return; delete E.zamowienia[k]; zmiana(); rysujZamowienia(); return; }
  if (a === "zak") {
    // Zakupy profili (Kombajn Zakupowca): indeksy profili i dostawcy z zak_cfg/main; dostęp ma właściciel i zastępca Zakupów
    let cfg = null; try { cfg = await B.get("zak_cfg", "main"); } catch (x) { cfg = null; }
    if (!cfg || !(cfg.skus || []).length) { okno(`<h3>Brak dostępu do Zakupów profili</h3><p>Nie mogę odczytać listy indeksów profili z Kombajnu Zakupowca. Zamówienia dopisuje tam właściciel albo zastępca Zakupów.</p>`); return; }
    const klucze = cfg.skus.map(s => s.key), dostZ = cfg.suppliers || [];
    let wg = null; try { wg = L.wagaDlaDostawcow(E, { wagi: L.slownikWag(W), pamiec: W.pamiec || {}, pytaj: () => null }); } catch { wg = null; }
    const wagaPoz = r => { const d = wg && !wg.blad ? wg.dostawcy.find(x => x.c === g.c) : null; const p = d ? d.pozycje.find(x => x.wiersz === r) : null; return p && p.waga > 0 ? p.waga : -1; };
    const W2 = g.pozycje.map(({ w, r }) => { const pk = ZM.pozycjaDoKursu(w.a), kg = wagaPoz(r), cena = L.naLiczbe(w.c?.[g.c]?.v);
      return { tekst: w.a, key: ZM.dopasujIndeks(w.a, klucze), t: kg > 0 ? L.vbaRound(kg / 1000, 3) : "", price: cena.ok ? ZM.cenaZaTone(cena.w, pk.jm, pk.ilosc, kg) : null }; });
    const supDom = ZM.dostawcaZakupow(z.dostawca, dostZ);
    const opcje = k => `<option value="">— nie dopisuj —</option>` + klucze.map(x => `<option ${x === k ? "selected" : ""}>${esc(x)}</option>`).join("");
    const r = await okno(`<h3>Do Zakupów profili: ${esc(z.dostawca)}</h3>
      <p class="small">Pozycje profili trafią do zamówień w Zakupach profili (Kombajn Zakupowca) – jak przy ręcznym dodaniu zamówienia. Indeks, tony i cenę możesz poprawić; pozycje bez indeksu się pomija.</p>
      <div class="grid3"><label>Dostawca w Zakupach<select name="sup">${(supDom ? [] : [`<option value="">— wybierz —</option>`]).concat(dostZ.map(x => `<option ${x === supDom ? "selected" : ""}>${esc(x)}</option>`)).join("")}</select></label>
      <label>Nr ZD<input name="zd" value="${esc(z.nr || "")}"></label><label>Nr zamówienia dostawcy<input name="nr" placeholder="opcjonalnie"></label>
      <label>Data zamówienia<input name="date" type="date" value="${esc(z.data || today())}"></label><label>Termin dostawy<input name="term" type="date" value="${esc(z.dostawa || "")}"></label></div>
      <div class="tw"><table class="t"><thead><tr><th>Pozycja z zapytania</th><th>Indeks w Zakupach</th><th>Tony</th><th>Cena zł/t</th></tr></thead><tbody>
      ${W2.map((x, i) => `<tr><td class="small">${esc(x.tekst)}</td><td><select name="key${i}">${opcje(x.key)}</select></td><td><input name="t${i}" inputmode="decimal" value="${x.t === "" ? "" : L.ogolny(x.t)}" style="width:80px"></td><td><input name="c${i}" inputmode="decimal" value="${x.price == null ? "" : L.ogolny(x.price)}" style="width:90px"></td></tr>`).join("")}
      </tbody></table></div>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dopisz do Zakupów", cls: "primary" }], { szer: "min(900px, 96vw)" });
    if (r.v !== "ok") return;
    const f = r.form, H = { sup: f.sup.value, zd: f.zd.value.trim(), nr: f.nr.value.trim(), date: f.date.value, term: f.term.value, note: `z zapytania ${E.nazwa}` };
    if (!H.sup) { toast("Wybierz dostawcę z listy Zakupów profili"); return; }
    const docs = ZM.zamowieniaZakupow(W2.map((x, i) => { const t = L.naLiczbe(f["t" + i].value), c = L.naLiczbe(f["c" + i].value); return { key: f["key" + i].value, t: t.ok ? t.w : 0, price: c.ok ? c.w : 0 }; }), H);
    if (!docs.length) { toast("Żadna pozycja nie ma indeksu i ton – nic nie dopisano"); return; }
    await zapiszTeraz();
    const ids = docs.map(() => B.newId("zak_zam")), logId = B.newId(C.log);
    try {
      await B.tx(async t => {
        const cur = await t.get(C.z, eId); if (!cur) throw new Error("zapytanie zniknęło");
        const zam = { ...(cur.zamowienia || {}) }; zam[k] = { ...(zam[k] || z), zak: { ids, n: docs.length, czas: Date.now() } };
        docs.forEach((d, i) => t.set("zak_zam", ids[i], d));
        t.set(C.z, eId, czysc({ ...cur, zamowienia: zam, wersja: (cur.wersja || 0) + 1, ostatniWpis: logId, zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa }));
        t.set(C.log, logId, wpis("zapytanie", eId, E.nazwa, "zmiana", [{ p: `Zakupy profili (${z.dostawca})`, a: "", b: `${docs.length} poz. · ${L.ogolny(docs.reduce((a, d) => a + d.t, 0))} t` }]));
      });
      E.zamowienia = E.zamowienia || {}; E.zamowienia[k] = { ...z, zak: { ids, n: docs.length, czas: Date.now() } }; eWersja += 1;
      toast(`Dopisano do Zakupów profili: ${docs.length} poz.`); rysujZamowienia();
    } catch (x) { if (String(x?.code).includes("permission")) okno(`<h3>Brak uprawnień</h3><p>Zamówienia w Zakupach profili dopisuje właściciel albo zastępca Kombajnu Zakupowca.</p>`); else failed(x); }
    return;
  }
  if (a === "kurs") {
    const wT = g.wagaKg != null ? L.vbaRound(g.wagaKg / 1000, 3) : "";
    // adres dostawcy i oddziały z Truck App (ta sama baza; konto biura może je czytać)
    const [ustT, pubT] = await Promise.all([B.get("ustawienia", "glowne").catch(() => null), B.get("ustawienia", "publiczne").catch(() => null)]);
    const listaT = ustT?.dostawcy || [], dT = ZM.dostawcaTruck(z.dostawca, listaT);
    const oddz = pubT?.oddzialy?.length ? pubT.oddzialy : ZM.ODDZIALY_DOM;
    let oddzOst = ""; try { oddzOst = localStorage.getItem("zap_oddzial") || ""; } catch {}
    if (!oddz.some(o => o.nazwa === oddzOst)) oddzOst = oddz[0].nazwa;
    const r = await okno(`<h3>Dostawa w Logistyce: ${esc(z.dostawca)}</h3>
      <p class="small">Powstanie dostawa oznaczona „🛒 do uzupełnienia” – biuro w Logistyce uzupełni transport i awizo, jak przy dostawach z Kooperacji.</p>
      <div class="grid3"><label>Dostawca<input name="kontr" value="${esc(z.dostawca)}" required></label><label>Nr (zamówienia)<input name="nr" value="${esc(z.nr || E.nazwa)}" required></label><label>Projekt / kod<input name="proj" value="${esc(E.kod || "")}"></label>
      <label>Transport<select name="tr"><option value="Dostawca">transport dostawcy</option><option value="Spedycja">spedycja</option><option value="Skavska">nasz transport</option></select></label>
      <label>Załadunek (data)<input name="zal" type="date" value="${esc(z.dostawa || "")}"></label><label>Waga [t]<input name="waga" inputmode="decimal" value="${wT === "" ? "" : L.ogolny(wT)}"></label><label>Najdłuższy element [m]<input name="dl" inputmode="decimal" value="${(dlE => dlE ? L.ogolny(dlE) : "")(ZM.najdluzszyElement(g.pozycje.map(p => p.w.a)))}" placeholder="np. 12"></label>
      <label class="full">Adres załadunku (u dostawcy)<input name="miejsce" value="${esc(dT?.adres || "")}" placeholder="ulica, kod, miasto" list="zapAdresy" autocomplete="off"><datalist id="zapAdresy">${listaT.filter(x => x.adres).map(x => `<option value="${esc(x.adres)}">${esc(x.nazwa)}</option>`).join("")}</datalist></label>
      <label>Dostawa do oddziału<select name="oddzial">${oddz.map(o => `<option ${o.nazwa === oddzOst ? "selected" : ""}>${esc(o.nazwa)}</option>`).join("")}</select></label>
      <div class="small full" style="align-self:end">${dT?.adres ? `Adres z listy dostawców Truck App (${esc(dT.nazwa)}).` : "Tego dostawcy nie ma z adresem na liście Truck App – wpisz adres albo zostaw puste (uzupełni biuro)."}</div>
      <label class="full">Uwagi<textarea name="uwagi" rows="3">${esc(`Zapytanie ${E.nazwa}${z.uwagi ? " · " + z.uwagi : ""}`)}</textarea></label></div>
      <div class="small">Pozycje (${g.pozycje.length}): ${esc(g.pozycje.map(p => p.w.a).join(" · "))}</div>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Utwórz dostawę", cls: "primary" }], { poOtwarciu: bezEnterZapisu });
    if (r.v !== "ok") return;
    await zapiszTeraz();
    const f = r.form, wg = L.naLiczbe(f.waga.value);
    const { kurs, koszt } = ZM.kursLogistyki({ nr: f.nr.value.trim(), proj: f.proj.value.trim(), kontr: f.kontr.value.trim(), transport: f.tr.value, zal: f.zal.value, dst: "", wagaT: wg.ok ? wg.w : null, dlugosc: (n => n.ok && n.w > 0 ? n.w : null)(L.naLiczbe(f.dl.value)),
      pozycje: g.pozycje.map(p => ZM.pozycjaDoKursu(p.w.a)), uwagi: f.uwagi.value.trim(), kto: user.login || me.nazwa, nazwa: me.nazwa,
      miejsce: f.miejsce.value.trim(), oddzial: f.oddzial.value, kontakt: dT?.tel || "" }, B.now());
    try { localStorage.setItem("zap_oddzial", f.oddzial.value); } catch {}
    const kursId = B.newId("kursy"), logId = B.newId(C.log);
    try {
      await B.tx(async t => {
        const cur = await t.get(C.z, eId); if (!cur) throw new Error("zapytanie zniknęło");
        const zam = { ...(cur.zamowienia || {}) }; zam[k] = { ...(zam[k] || z), kursId, status: zam[k]?.status || "zamowiono", dostawca: z.dostawca };
        t.set("kursy", kursId, kurs); t.set("koszty", kursId, koszt);
        t.set(C.z, eId, czysc({ ...cur, zamowienia: zam, wersja: (cur.wersja || 0) + 1, ostatniWpis: logId, zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa }));
        t.set(C.log, logId, wpis("zapytanie", eId, E.nazwa, "zmiana", [{ p: `dostawa w Logistyce (${z.dostawca})`, a: "", b: `${kurs.nr} · ${g.pozycje.length} poz.${kurs.waga ? ` · ${L.ogolny(kurs.waga)} t` : ""}` }]));
      });
      E.zamowienia = E.zamowienia || {}; E.zamowienia[k] = { ...z, kursId, status: z.status || "zamowiono" }; eWersja += 1;
      toast("Dostawa jest w Logistyce – biuro uzupełni transport i awizo"); rysujZamowienia();
    } catch (x) { if (String(x?.code).includes("permission")) okno(`<h3>Brak uprawnień</h3><p>Dostawy w Logistyce może tworzyć tylko konto biura. To konto nie ma tej roli.</p>`); else failed(x); }
  }
});
export function odswiezNaglowki() {
  $("aGrid")?.querySelectorAll("td.dost").forEach(td => { const c = +td.dataset.c, n = (E.naglowki || {})[c] || {}; td.querySelector(".zst")?.remove(); td.insertAdjacentHTML("beforeend", stanDostawcy(c, n)); });
}
export function legenda() {
  odswiezNaglowki();
  const el = $("aLegenda"); if (!el) return;
  const wyb = Object.entries(E.naglowki || {}).filter(([, h]) => L.kolor(h.k) !== -1);
  el.innerHTML = `<span><span class="sw" style="background:var(--min-bg)"></span>najniższa cena w wierszu</span><span><span class="sw" style="background:var(--max-bg)"></span>najwyższa</span>` +
    (wyb.length ? wyb.map(([c, h]) => `<span><span class="sw" style="background:${hex(h.k)}"></span>${esc(h.t || kolLit(+c))}: ${E.wiersze.filter(w => L.kolor(w.k) === L.kolor(h.k)).length} poz.</span>`).join("") : `<span>nie wybrano jeszcze dostawców</span>`);
}
export function status(t) { const s = $("aStatus"); if (s) s.textContent = t ?? (eDirty ? "niezapisane…" : `zapisano · wersja ${eWersja}`); }
export const autoH = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
export function wiersz(r) { while (E.wiersze.length < r - 1) E.wiersze.push({ a: "", c: {} }); return E.wiersze[r - 2]; }
export function przytnij() { while (E.wiersze.length && !E.wiersze.at(-1).a && !Object.keys(E.wiersze.at(-1).c || {}).length && L.kolor(E.wiersze.at(-1).k) === -1 && !E.wiersze.at(-1).m) E.wiersze.pop(); }
export function ustawKomorke(r, c, tekst) {
  tekst = String(tekst);
  if (r === 1 && c === 1) { E.kod = tekst.trim(); return; }
  if (r === 1) { E.naglowki = E.naglowki || {}; const n = E.naglowki[c] || {}; n.t = tekst.trim(); if (!n.t && L.kolor(n.k) === -1 && !n.m) delete E.naglowki[c]; else E.naglowki[c] = n; return; }
  const w = wiersz(r);
  if (c === 1) { w.a = tekst.replace(/\s+$/, ""); return; }
  w.c = w.c || {};
  const cel = w.c[c] || {};
  delete cel.v; delete cel.f;
  const t = tekst.trim();
  if (t.startsWith("=")) { cel.f = t; const v = L.policzFormule(t); if (v !== null) cel.v = v; }
  else if (t !== "") { const n = L.naLiczbe(t.replace(/\s*zł$/i, "")); cel.v = n.ok && /^[\s\d.,+\-]+$/.test(t.replace(/\s*zł$/i, "")) ? n.w : t; }
  if (cel.v === undefined && !cel.f && L.kolor(cel.k) === -1 && !cel.m) delete w.c[c]; else w.c[c] = cel;
}
export function zmiana() { eDirty = true; status(); clearTimeout(eTimer); eTimer = setTimeout(zapiszArkusz, 800); }
// wspólny słownik projektów (kolekcja projekty – Truck App, Kooperacje, Zapytania, Kombajn): podpowiedzi i dopisywanie nowych kodów
export let PROJ = [];
export const ustawPROJ = v => { PROJ = v; };
export const projOpcje = () => PROJ.map(p => `<option value="${esc(p.kod)}">${esc([p.nazwa, p.klient].filter(Boolean).join(" · "))}</option>`).join("");
export function dopiszProjekt(kod) {
  const k = ZM.kodProjektu(kod);
  if (!k || k.length > 40 || k.includes("/") || PROJ.some(p => p.kod === k)) return;
  PROJ.push({ kod: k });
  B.batch([{ c: "projekty", id: k, d: { kod: k, zrodla: { zap: true }, utworzono: B.now(), utworzyl: user.login || me.nazwa || "" }, merge: true }]).catch(x => console.warn(x));
}
export async function zapiszArkusz() {
  clearTimeout(eTimer);
  if (!eDirty || !E) return;
  if (eZapis) return eZapis;
  przytnij();
  const dane = { nazwa: E.nazwa, kod: E.kod ?? "", kodM: E.kodM, dataZap: E.dataZap, zamowienia: E.zamowienia || {}, naglowki: E.naglowki || {}, wiersze: E.wiersze, numer: E.numer ?? null, rok: E.rok ?? null, kolejnosc: E.kolejnosc ?? 0 };
  eDirty = false; status("zapisywanie…");
  eZapis = zapiszDok(C.z, eId, dane, { typ: "zapytanie", etykieta: E.nazwa, diffFn: diffZap, wersja: eWersja })
    .then(r => {
      if (r.conflict) { eDirty = true; konflikt(r.conflict); return; }
      if (r.gone) { toast("To zapytanie zostało usunięte"); return go("zapytania"); }
      eWersja = r.wersja || eWersja; status(); if (dane.kod) dopiszProjekt(dane.kod);
    }).catch(x => { eDirty = true; failed(x); status("błąd zapisu"); }).finally(() => { eZapis = null; if (eDirty && !document.querySelector(".konflikt")) zmiana(); });
  return eZapis;
}
export async function zapiszTeraz() {
  if (document.activeElement && document.activeElement.closest?.("table.ark")) document.activeElement.blur();
  if (genDirty) await zapiszGenerator(G, null, "edycja listy");
  if (eDirty) await zapiszArkusz();
  if (eZapis) await eZapis;
}
export async function konflikt(cur) {
  const r = await okno(`<h3 class="konflikt">Ktoś zmienił to zapytanie w międzyczasie</h3><p>${esc(cur.zmienilNazwa || "")} · ${fDT(cur.zmieniono)}</p><p>Możesz wczytać jego wersję (Twoje ostatnie zmiany przepadną) albo zapisać swoją wersję na wierzch.</p>`,
    [{ v: "wczytaj", t: "Wczytaj jego wersję" }, { v: "nadpisz", t: "Zapisz moją wersję", cls: "danger" }]);
  if (r.v === "nadpisz") { eWersja = cur.wersja; eDirty = true; zapiszArkusz(); }
  else { const z = zapById(eId); E = clone(z); eWersja = z.wersja || 0; eDirty = false; rysujArkusz(); }
}
// zdarzenia arkusza
document.addEventListener("focusin", e => {
  const el = e.target.closest?.("table.ark input, table.ark textarea"); if (!el) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  fokus = { r, c };
  if (r >= 2 && c >= 2) { el.value = wartEdycja(E.wiersze[r - 2]?.c?.[c]); el.select(); if (Date.now() - ostatniDotyk < 800) setTimeout(() => { if (document.activeElement === el && !el.dataset.edycja && el.selectionStart === el.selectionEnd) el.select(); }, 60); }   // jak w Excelu: wpisanie zastępuje wartość
  if (!wybor) pokazPasek(el, r, c);
});
// myszką: pojedyncze kliknięcie zaznacza całą cenę (wpisanie zastępuje), podwójne – edycja istniejącej wartości
export let ostatniDotyk = 0;
document.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch") ostatniDotyk = Date.now();
  if (e.pointerType !== "mouse" || wybor) return;
  const el = e.target.closest?.("table.ark td.c input"); if (!el || +el.dataset.r < 2 || document.activeElement === el) return;
  e.preventDefault(); el.focus();
});
document.addEventListener("dblclick", e => {
  const el = e.target.closest?.("table.ark td.c input"); if (!el || +el.dataset.r < 2) return;
  el.dataset.edycja = "1"; const n = el.value.length; el.setSelectionRange(n, n);
});
document.addEventListener("focusout", e => { const el = e.target.closest?.("table.ark td.c input"); if (el) delete el.dataset.edycja; }, true);
document.addEventListener("focusout", e => {
  const el = e.target.closest?.("table.ark input, table.ark textarea"); if (!el || !E) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  const przed = JSON.stringify(E);
  const stara = r >= 2 && c >= 2 ? wartEdycja(E.wiersze[r - 2]?.c?.[c]) : null;
  if (r >= 2 && c >= 2 && el.value === stara) { el.value = wartWyswietl(E.wiersze[r - 2]?.c?.[c], c); return; }
  ustawKomorke(r, c, el.value);
  if (JSON.stringify(E) !== przed) { zmiana(); if (r >= 2) { const pos = { r, c }; setTimeout(() => { if (!document.activeElement?.closest?.("table.ark")) rysujArkusz(); else odswiezWiersz(pos.r); }, 0); } }
  else if (r >= 2 && c >= 2) el.value = wartWyswietl(E.wiersze[r - 2]?.c?.[c], c);
  setTimeout(() => { if (!document.activeElement?.closest?.("table.ark, #cellbar")) { $("cellbar").hidden = true; if ($("aPasekInfo")) $("aPasekInfo").hidden = false; } }, 150);
});
document.addEventListener("input", e => { if (e.target.matches?.("table.ark textarea")) autoH(e.target); });
document.addEventListener("keydown", e => {
  const el = e.target.closest?.("table.ark input, table.ark textarea"); if (!el) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  let cel = null;
  if (e.key === "Enter" && !(el.tagName === "TEXTAREA" && e.altKey)) { e.preventDefault(); cel = [r + (e.shiftKey ? -1 : 1), c]; }
  else if (e.key === "Enter" && el.tagName === "TEXTAREA" && e.altKey) { e.preventDefault(); const p = el.selectionStart; el.value = el.value.slice(0, p) + "\n" + el.value.slice(el.selectionEnd); el.selectionStart = el.selectionEnd = p + 1; autoH(el); return; }
  else if (e.key === "ArrowDown" && el.tagName === "INPUT") cel = [r + 1, c];
  else if (e.key === "ArrowUp" && el.tagName === "INPUT") cel = [r - 1, c];
  else if (e.key === "Tab") { e.preventDefault(); cel = [r, c + (e.shiftKey ? -1 : 1)]; }
  else if (e.key === "Escape") { const w = r >= 2 ? E.wiersze[r - 2] : null; el.value = r === 1 ? (c === 1 ? E.kod : E.naglowki?.[c]?.t ?? "") : c === 1 ? w?.a ?? "" : wartEdycja(w?.c?.[c]); el.blur(); return; }
  if (cel) {
    e.preventDefault();
    const cel2 = $("aGrid")?.querySelector(`[data-r="${cel[0]}"][data-c="${cel[1]}"]:is(input,textarea)`);
    if (cel2) { cel2.focus(); cel2.select?.(); }     // od razu – żeby nie zgubić znaków przy szybkim pisaniu
    else if (cel[0] > r && cel[0] >= 2) {
      // koniec narysowanych wierszy: jak w Excelu – arkusz rośnie, kursor idzie niżej
      el.blur(); dodWiersze += 5; rysujArkusz();
      const n = $("aGrid")?.querySelector(`[data-r="${cel[0]}"][data-c="${cel[1]}"]:is(input,textarea)`); if (n) { n.focus(); n.select?.(); }
    } else el.blur();
  }
});
export function odswiezWiersz(r) {
  // po zmianie ceny: kolory min/max w wierszu
  const g = $("aGrid"); if (!g) return;
  const w = E.wiersze[r - 2] || { c: {} }, skr = L.skrajneCeny(w, 30);
  g.querySelectorAll(`td.c[data-r="${r}"]`).forEach(td => {
    const c = +td.dataset.c, cel = w.c?.[c], kc = L.kolor(cel?.k);
    td.classList.toggle("min", skr.min.has(c)); td.classList.toggle("max", skr.max.has(c));
    const cls = skr.min.has(c) || skr.max.has(c);
    const kA = L.kolor(w.k), kw = kc !== -1 ? kc : (kA !== -1 && L.kolor(E.naglowki?.[c]?.k) === kA ? kA : -1);
    td.classList.toggle("kol", kc !== -1 && !cls); td.classList.toggle("wyb", kw !== -1); td.style.setProperty("--k", kw !== -1 ? hex(kw) : "");
    const inp = td.querySelector("input"); if (inp && document.activeElement !== inp) { inp.value = wartWyswietl(cel, c); inp.classList.toggle("txt", !!cel && typeof cel.v !== "number" && !cel.f); }
  });
  legenda();
}
// Alt+← / Alt+→ – poprzednie / następne zapytanie
document.addEventListener("keydown", e => { if (!e.altKey || widok.nazwa !== "z" || !["ArrowLeft", "ArrowRight"].includes(e.key)) return; const b = $(e.key === "ArrowLeft" ? "aPoprz" : "aNast"); if (b && !b.disabled) { e.preventDefault(); b.click(); } });
// zdjęcie koloru dostawcy z nagłówka i ze wszystkich jego pozycji
function zdejmijKolor(n) {
  const stary = L.kolor(n.k); if (stary === -1) return;
  E.wiersze.forEach(w => { if (L.kolor(w.k) === stary) delete w.k; Object.values(w.c || {}).forEach(x => { if (L.kolor(x.k) === stary) delete x.k; }); });
  delete n.k;
}
// „✕” przy niezamówionym dostawcy – szybkie usunięcie koloru
document.addEventListener("click", e => { const b = e.target.closest?.("#aGrid [data-bezkol]"); if (!b || !E) return; e.preventDefault(); e.stopPropagation();
  const n = E.naglowki?.[+b.dataset.bezkol]; if (!n) return; zdejmijKolor(n); zmiana(); rysujArkusz(); toast(`Usunięto kolor: ${L.vbaTrim(n.t || "")}`); }, true);
// przycisk koloru w nagłówku dostawcy (zawsze, bez trybu wyboru)
document.addEventListener("click", e => { const b = e.target.closest?.("#aGrid [data-kol]"); if (b && E) { e.preventDefault(); e.stopPropagation(); paletaNaglowka(+b.dataset.kol); } }, true);
// tryb wyboru dostawcy – kliknięcia
document.addEventListener("click", e => {
  if (!wybor || !E) return;
  const td = e.target.closest?.("table.ark td[data-r]"); if (!td || !td.closest("#aBox")) return;
  const r = +td.dataset.r, c = +td.dataset.c;
  if (r === 1 && c >= 2) return paletaNaglowka(c);
  if (r >= 2 && c === 1) { const w = E.wiersze[r - 2]; if (w && L.kolor(w.k) !== -1) { delete w.k; zmiana(); rysujArkusz(); } return; }
  if (r >= 2 && c >= 2) wybierzDostawce(r, c);
});
// pozycja w wierszu r idzie do dostawcy z kolumny c (kolor nagłówka = kolor pozycji, jak w Excelu).
// Ponowne / podwójne kliknięcie nie zdejmuje wyboru – zdejmuje go kliknięcie pozycji w kolumnie A.
export function wybierzDostawce(r, c) {
  const w = wiersz(r); if (!L.vbaTrim(w.a)) return toast("W tym wierszu nie ma pozycji");
  const n = E.naglowki?.[c];
  if (!n || !L.vbaTrim(n.t)) return toast("Kolumna nie ma nazwy dostawcy w wierszu 1");
  if (L.kolor(n.k) === -1) { const uzyte = new Set(Object.values(E.naglowki).map(h => L.kolor(h.k))); n.k = PALETA.find(p => !uzyte.has(p)) || PALETA[0]; }
  if (L.kolor(w.k) === L.kolor(n.k)) return;
  w.k = n.k;
  zmiana(); rysujArkusz();
  toast(`${L.vbaTrim(w.a).slice(0, 40)} → ${n.t}`);
}
export async function paletaNaglowka(c) {
  const n = E.naglowki?.[c]; if (!n || !L.vbaTrim(n.t)) return toast("Najpierw wpisz nazwę dostawcy w wierszu 1");
  const r = await okno(`<h3>Kolor dostawcy: ${esc(n.t)}</h3><div class="paleta">${PALETA.map(p => `<button type="button" data-p="${p}" style="background:#${p}" title="#${p}"></button>`).join("")}</div>
    <p class="small">Pozycje zaznaczone starym kolorem dostaną nowy. „Bez koloru” zdejmuje wybór tego dostawcy ze wszystkich pozycji.</p>`,
    [{ v: "brak", t: "Bez koloru", nv: true }, { v: "cancel", t: "Anuluj", nv: true }],
    { poOtwarciu: f => f.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { f.dataset.wyb = b.dataset.p; $("dlg").close("kolor"); }) });
  const stary = L.kolor(n.k);
  if (r.v === "kolor") {
    const nowy = r.form.dataset.wyb;
    E.wiersze.forEach(w => { if (stary !== -1 && L.kolor(w.k) === stary) w.k = nowy; Object.values(w.c || {}).forEach(x => { if (stary !== -1 && L.kolor(x.k) === stary) x.k = nowy; }); });
    n.k = nowy;
  } else if (r.v === "brak") zdejmijKolor(n);
  else return;
  zmiana(); rysujArkusz();
}
// pasek przy komórce: komentarz, wiersze, kolumny
export function pokazPasek(el, r, c) {
  const bar = $("cellbar"), rc = el.getBoundingClientRect();
  const btn = [`<button class="btn sm" data-a="kom">Komentarz</button>`];
  if (r >= 2 && c >= 2 && L.vbaTrim(E.wiersze[r - 2]?.a || "") && L.vbaTrim(E.naglowki?.[c]?.t || "")) btn.unshift(`<button class="btn sm primary" data-a="wybierz">Wybierz tego dostawcę</button>`);
  if (r >= 2 && c === 1 && L.kolor(E.wiersze[r - 2]?.k) !== -1) btn.unshift(`<button class="btn sm" data-a="bezWyboru">Usuń wybór dostawcy</button>`);
  if (r >= 2 && c === 1) btn.push(`<button class="btn sm" data-a="wstawW">Wstaw wiersz nad</button>`, `<button class="btn sm" data-a="usunW">Usuń wiersz</button>`);
  if (r === 1 && c >= 2) btn.push(`<button class="btn sm" data-a="wstawK">Wstaw kolumnę przed</button>`, `<button class="btn sm" data-a="usunK">Usuń kolumnę</button>`);
  if (r >= 2 && c >= 2 && L.kolor(E.wiersze[r - 2]?.c?.[c]?.k) !== -1) btn.push(`<button class="btn sm" data-a="bezKol">Usuń kolor komórki</button>`);
  const opis = r === 1 ? (c === 1 ? "kod klienta" : "dostawca") : c === 1 ? L.vbaTrim(E.wiersze[r - 2]?.a || "").slice(0, 50) : [E.naglowki?.[c]?.t, L.vbaTrim(E.wiersze[r - 2]?.a || "").slice(0, 40)].filter(Boolean).join(" · ");
  bar.innerHTML = `<span class="mono strong">${kolLit(c)}${r}</span><span class="small">${esc(opis)}</span>` + btn.join("");
  bar.hidden = false;
  if ($("aPasekInfo")) $("aPasekInfo").hidden = true;
  bar.dataset.r = r; bar.dataset.c = c;
}
$("cellbar").addEventListener("mousedown", e => e.preventDefault());
$("cellbar").addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const bar = $("cellbar"), r = +bar.dataset.r, c = +bar.dataset.c, a = b.dataset.a;
  bar.hidden = true;
  document.activeElement?.blur();
  if (a === "kom") {
    const cel = r === 1 && c === 1 ? { m: E.kodM } : r === 1 ? E.naglowki?.[c] || {} : c === 1 ? E.wiersze[r - 2] || {} : E.wiersze[r - 2]?.c?.[c] || {};
    const o = await okno(`<h3>Komentarz ${kolLit(c)}${r}</h3><textarea name="m" rows="4">${esc(cel.m || "")}</textarea>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Zapisz", cls: "primary" }]);
    if (o.v !== "ok") return;
    const m = o.form.m.value.trim();
    if (r === 1 && c === 1) E.kodM = m || undefined;
    else if (r === 1) { E.naglowki = E.naglowki || {}; E.naglowki[c] = { ...(E.naglowki[c] || { t: "" }), m }; if (!m) delete E.naglowki[c].m; }
    else if (c === 1) { const w = wiersz(r); if (m) w.m = m; else delete w.m; }
    else { const w = wiersz(r); w.c = w.c || {}; w.c[c] = { ...(w.c[c] || {}), m }; if (!m) { delete w.c[c].m; if (!Object.keys(w.c[c]).length) delete w.c[c]; } }
  }
  if (a === "wybierz") return wybierzDostawce(r, c);
  if (a === "bezWyboru") { const w = E.wiersze[r - 2]; if (w) delete w.k; }
  if (a === "wstawW") E.wiersze.splice(r - 2, 0, { a: "", c: {} });
  if (a === "usunW") { if (!(await pytanie("Usunąć wiersz?", `Wiersz ${r}: ${esc(E.wiersze[r - 2]?.a || "(pusty)")}`, "Usuń"))) return; E.wiersze.splice(r - 2, 1); }
  if (a === "wstawK" || a === "usunK") {
    if (a === "usunK" && !(await pytanie("Usunąć kolumnę?", `Kolumna ${kolLit(c)} (${esc(E.naglowki?.[c]?.t || "")}) razem z cenami.`, "Usuń"))) return;
    const przes = obj => { const n = {}; for (const [k, v] of Object.entries(obj || {})) { const kk = +k; if (a === "wstawK") n[kk >= c ? kk + 1 : kk] = v; else if (kk !== c) n[kk > c ? kk - 1 : kk] = v; } return n; };
    E.naglowki = przes(E.naglowki); E.wiersze.forEach(w => w.c = przes(w.c));
  }
  if (a === "bezKol") { const x = E.wiersze[r - 2]?.c?.[c]; if (x) { delete x.k; if (!Object.keys(x).length) delete E.wiersze[r - 2].c[c]; } }
  zmiana(); rysujArkusz();
});
export async function usunZapytanie() {
  if (!isOwner) return;
  const z = zapById(eId);
  if (!(await pytanie("Usunąć zapytanie?", `<b>${esc(z.nazwa)}</b>${z.kod ? " – " + esc(z.kod) : ""}. Dane jego projektu też zostaną usunięte. Wpis zostanie w dzienniku.`, "Usuń"))) return;
  const logId = B.newId(C.log), nazwyPo = Z.filter(x => x._id !== z._id).map(x => x.nazwa);
  try {
    await B.tx(async t => {
      t.del(C.z, z._id);
      for (const p of P) if (!L.projektZywy(p, nazwyPo)) t.del(C.p, p._id);
      t.set(C.log, logId, wpis("zapytanie", z._id, z.nazwa, "usunięcie", [{ p: "usunięto zapytanie", a: `${z.nazwa} – ${z.wiersze.filter(w => w.a).length} poz.`, b: "" }]));
    });
    eDirty = false; E = null; eId = null; toast("Usunięto"); go("zapytania");
  } catch (x) { failed(x); }
}
export async function zmienNazwe() {
  const z = zapById(eId);
  const r = await okno(`<h3>Zmień nazwę zapytania</h3><label>Nazwa<input name="n" value="${esc(z.nazwa)}" required></label><p class="small">Dane projektu dalej będą przypisane do tego zapytania.</p>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Zmień", cls: "primary" }]);
  if (r.v !== "ok") return;
  const nowa = r.form.n.value.trim().replace(/[\\/?*[\]:]/g, "-");
  if (!nowa || nowa === z.nazwa) return;
  if (zapByNazwa(nowa)) return toast("Jest już zapytanie o tej nazwie");
  await zapiszTeraz();
  const logId = B.newId(C.log);
  try {
    await B.tx(async t => {
      const m = nowa.match(/^(\d+)-(\d{4})(\s|$)/);
      t.update(C.z, z._id, { nazwa: nowa, numer: m ? +m[1] : null, rok: m ? +m[2] : null, ostatniWpis: logId, wersja: (z.wersja || 0) + 1, zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa });
      for (const p of P) {
        if (L.LC(p.id) !== L.LC(z.nazwa) && !p.pozycje.some(x => L.LC(x.ark) === L.LC(z.nazwa))) continue;
        t.update(C.p, p._id, { id: L.LC(p.id) === L.LC(z.nazwa) ? nowa : p.id, pozycje: p.pozycje.map(x => L.LC(x.ark) === L.LC(z.nazwa) ? { ...x, ark: nowa } : x), ostatniWpis: logId, wersja: (p.wersja || 0) + 1 });
      }
      t.set(C.log, logId, wpis("zapytanie", z._id, nowa, "zmiana", [{ p: "nazwa", a: z.nazwa, b: nowa }]));
    });
    E.nazwa = nowa; eWersja = (z.wersja || 0) + 1; $("aNazwa").textContent = nowa;
  } catch (x) { failed(x); }
}
// pobranie zapytania jako arkusz Excela (jak arkusz NNN-RRRR)
export function eksportArkusza(z) {
  const ws = {}, ostK = L.ostKolumna(z);
  const set = (r, c, cel) => { if (cel) ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })] = cel; };
  set(1, 1, { t: "s", v: z.kod || "" });
  for (const [c, h] of Object.entries(z.naglowki || {})) set(1, +c, { t: "s", v: h.t || "" });
  z.wiersze.forEach((w, i) => {
    if (w.a) set(i + 2, 1, { t: "s", v: w.a });
    for (const [c, x] of Object.entries(w.c || {})) {
      if (x.v === undefined && !x.f) continue;
      set(i + 2, +c, typeof x.v === "number" ? { t: "n", v: x.v, z: '#,##0.00 "zł"', ...(x.f ? { f: x.f.slice(1).replace(/(\d),(\d)/g, "$1.$2") } : {}) } : { t: "s", v: String(x.v ?? "") });
    }
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(z.wiersze.length, 1), c: ostK - 1 } });
  ws["!cols"] = [{ wch: 44 }, ...Array.from({ length: ostK - 1 }, () => ({ wch: 16 }))];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, z.nazwa.slice(0, 31));
  zapiszXlsx(wb, `${z.nazwa}.xlsx`);
}
