import * as L from "./logika.js?v=202611121300";
import { $, esc, iso, toD, fD, clone, kolLit, show, msg, okno, toast } from "./ui.js?v=202611121300";
import { C, firebase } from "./baza.js?v=202611121300";
import { zastStatus as zastS, zastDoDnia, komunikat } from "./steelflow-konto.js?v=202611121300";
import { trescPomocy, START_ZASTEPCY } from "./pomoc.js?v=202611121300";
import { eDirty, odswiezArkuszZBazy, projOpcje, renderArkusz, rysujHistorie, ustawPROJ, zapiszTeraz } from './czesci/arkusz.js?v=202611121300';
import { renderCeny } from './czesci/ceny-widok.js?v=202611121300';
import { renderDostep, renderLog } from './czesci/dziennik.js?v=202611121300';
import { genDirty, renderGenerator, ustawGenStary } from './czesci/generator.js?v=202611121300';
import { renderKoszt, renderProjekty, renderWaga, sprzatnijProjekty } from './czesci/koszt.js?v=202611121300';
import { renderLista } from './czesci/lista.js?v=202611121300';
import { renderUstawienia, ustDirty } from './czesci/ustawienia.js?v=202611121300';

/* ============================================================ konfiguracja */
export const PALETA = ["00B0F0", "FFFF00", "92D050", "FFC000", "FF99FF", "B4A7D6", "F4B084", "9BC2E6", "C9C9C9", "FF7C80"];

/* ============================================================ Firebase */
export let B;

/* ============================================================ stan */
export let me = null, isOwner = false, ownerUid = "", dostep = { zastepcy: {} }, zast = null;
export let Z = [], P = [], LOG = [], U = clone(L.USTAWIENIA_DOMYSLNE), W = { rows: [], pamiec: {} }, G = { kod: "", plik: "", ostatnie: "", wiersze: [] }, konta = [];
export let zaladowane = { z: false, p: false, u: false, w: false, g: false };
export let subs = [], started = false, user = null, metaOk = false, dostOk = false, metaSub = null, dostSub = null;
export const ustawG = v => { G = v; }, ustawW = v => { W = v; };   // dla części w js/czesci/
export const widok = { nazwa: "generator", arg: "" };
export const odpowiedzi = {};          // odpowiedzi na pytania makra (długość, grubość) w tej sesji

// zastępstwa – wspólna logika SteelFlow (js/steelflow-konto.js)
export const zastStatus = z => zastS(z);
export const doDnia = zastDoDnia;
export const zapById = id => Z.find(z => z._id === id);
export const zapByNazwa = n => Z.find(z => L.LC(z.nazwa) === L.LC(n));
export const zapytaniaPosort = () => Z.slice().sort((a, b) => (b.kolejnosc ?? 0) - (a.kolejnosc ?? 0));

/* ============================================================ logowanie i uprawnienia */
$("loginF").addEventListener("submit", async e => {
  e.preventDefault(); $("lgErr").hidden = true;
  try { await B.login($("lgLogin").value, $("lgPass").value); } catch (x) { $("lgErr").hidden = false; $("lgErr").textContent = komunikat(x); }
});
$("btnOut").onclick = () => B.logout();
// pełny ekran (bez paska przeglądarki); niewidoczny, gdy przeglądarka nie pozwala albo aplikacja jest zainstalowana
{
  const b = $("btnEkran"), d = document, wObrebie = () => !!(d.fullscreenElement || d.webkitFullscreenElement);
  const zainst = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;
  if (b && (d.fullscreenEnabled || d.webkitFullscreenEnabled) && !zainst) {
    b.hidden = false;
    const opis = () => { b.textContent = wObrebie() ? "⛶ Zamknij pełny ekran" : "⛶ Pełny ekran"; };
    b.onclick = async () => { try { if (wObrebie()) await (d.exitFullscreen || d.webkitExitFullscreen).call(d); else await (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement); } catch { toast("Przeglądarka nie pozwoliła na pełny ekran – spróbuj F11"); } };
    d.addEventListener("fullscreenchange", opis); d.addEventListener("webkitfullscreenchange", opis);
  }
}
$("btnPomoc").onclick = () => okno(trescPomocy(widok.nazwa, isOwner), [{ v: "ok", t: "Zamknij", cls: "primary" }], { szer: "min(720px, 96vw)" });
export function stopAll() { subs.forEach(u => { try { u(); } catch {} }); subs = []; started = false; }
export function decide() {
  if (!user || !metaOk || !dostOk) return;
  isOwner = user.uid === ownerUid;
  const z = dostep.zastepcy?.[user.uid];
  zast = !isOwner && zastStatus(z) === "aktywne" ? z : null;
  if (!isOwner && !zast) {
    stopAll();
    return msg("Brak dostępu do Zapytań ofertowych", zastStatus(z) === "zaplanowane" ? `Twój dostęp zastępczy zacznie się ${fD(iso(toD(z.od)))}.` : "Aplikacja jest prywatna. Dostęp na czas zastępstwa nadaje właściciel.");
  }
  me = { uid: user.uid, nazwa: user.nazwa || (isOwner ? "Właściciel" : z?.nazwa || "Zastępca") };
  show("app");
  $("whoName").innerHTML = `<b>${esc(me.nazwa)}</b>`;
  $("whoRole").innerHTML = isOwner ? `<span class="pill p-acc">właściciel</span>` : `<span class="pill p-warn">zastępstwo do ${fD(doDnia(zast))}</span>`;
  $("tabDostep").hidden = !isOwner;
  $("zastBanner").hidden = isOwner;
  // zastępca przy pierwszym wejściu w danym zastępstwie dostaje skrót „od czego zacząć”
  if (!isOwner) { const kl = "zap_start_" + user.uid + "_" + (toD(zast.od)?.getTime() || 0); let byl = true; try { byl = !!localStorage.getItem(kl); localStorage.setItem(kl, "1"); } catch {} if (!byl) setTimeout(() => okno(START_ZASTEPCY, [{ v: "ok", t: "Zaczynam", cls: "primary" }]), 300); }
  if (!isOwner) $("zastBanner").innerHTML = `<b>Dostęp tymczasowy do ${fD(doDnia(zast))}.</b> Każda Twoja zmiana zapisuje się w Dzienniku zmian z Twoim nazwiskiem i godziną. Nie możesz usuwać zapytań ani projektów.`;
  if (!started) { started = true; startData(); }
  render();
}
export async function boot() {
  B = await firebase();
  B.onAuth(u => {
    stopAll(); metaSub?.(); dostSub?.(); user = null; metaOk = dostOk = false;
    if (!u) return show("login");
    msg("Wczytywanie…");
    user = { uid: u.uid };
    metaSub = B.watchDoc("meta", "init", d => { ownerUid = d?.admin || ""; metaOk = true; decide(); }, x => msg("Nie udało się sprawdzić uprawnień", x?.code || String(x)));
    B.watchDoc("uzytkownicy", u.uid, d => { if (d) { user.nazwa = d.nazwa || d.login; user.login = d.login || ""; user.rola = d.rola || ""; } if (me) me.nazwa = user.nazwa || me.nazwa; decide(); }, () => {});
    dostSub = B.watchDoc(C.u, "dostep", d => { dostep = d || { zastepcy: {} }; dostOk = true; decide(); }, () => { dostep = { zastepcy: {} }; dostOk = true; decide(); });
  });
  setInterval(() => { if (user && metaOk && dostOk) decide(); }, 60000);
}
export function startData() {
  const err = x => { console.warn(x); if (String(x?.code).includes("permission")) msg("Brak dostępu do danych", "Reguły bazy nie wpuszczają tego konta. Przy pierwszym uruchomieniu trzeba wgrać reguły dla Zapytań."); };
  subs.push(B.watch(C.z, a => { Z = a; zaladowane.z = true; poZmianieDanych("z"); }, err));
  subs.push(B.watch(C.p, a => { P = a; zaladowane.p = true; poZmianieDanych("p"); }, err));
  subs.push(B.watch(C.log, a => { LOG = a; poZmianieDanych("log"); }, err));
  subs.push(B.watch("projekty", L2 => { ustawPROJ(L2); const dl = $("projDL"); if (dl) dl.innerHTML = projOpcje(); }, () => { ustawPROJ([]); }));
  subs.push(B.watchDoc(C.u, "config", d => { U = { ...clone(L.USTAWIENIA_DOMYSLNE), ...(d || {}) }; zaladowane.u = true; poZmianieDanych("u"); }, err));
  subs.push(B.watchDoc(C.u, "wagi", d => { W = d ? { rows: d.rows || [], pamiec: d.pamiec || {} } : { rows: [], pamiec: {} }; zaladowane.w = true; poZmianieDanych("w"); }, err));
  subs.push(B.watchDoc(C.u, "generator", d => { if (genDirty) return; G = d ? { kod: "", plik: "", ostatnie: "", wiersze: [], ...d } : G; ustawGenStary(clone(G)); zaladowane.g = true; poZmianieDanych("g"); }, err));
  if (isOwner) B.accounts().then(a => { konta = a; if (widok.nazwa === "dostep") render(); }).catch(x => console.warn(x));
}
export function poZmianieDanych(co) {
  const nz = LOG.filter(l => l.zast && !l.przejrzane).length;
  $("logCnt").hidden = !isOwner || !nz; $("logCnt").textContent = nz;
  $("hSub").textContent = `${Z.length} zapytań · ${P.length} projektów`;
  if (co === "z" && isOwner) sprzatnijProjekty();
  // nie przerysowuj arkusza, gdy ktoś w nim pisze
  if (widok.nazwa === "z" && co === "z") return odswiezArkuszZBazy();
  if (widok.nazwa === "z" && co === "log") return rysujHistorie();      // wpis w dzienniku po zapisie – tylko historia, bez przerysowania arkusza
  if (widok.nazwa === "z" && (eDirty || document.activeElement?.closest?.("table.ark, #cellbar"))) return;
  if (widok.nazwa === "generator" && co === "g" && genDirty) return;
  if (widok.nazwa === "ustawienia" && ["u", "w"].includes(co) && ustDirty) return;
  if (co === "c" && widok.nazwa !== "ceny") return;
  if (widok.nazwa === "ceny" && ["log", "g"].includes(co)) return;
  if (["log"].includes(co) && !["dziennik", "dostep", "z"].includes(widok.nazwa)) return;
  render();
}

/* ============================================================ zapis z dziennikiem */
export function wpis(typ, obiektId, obiekt, akcja, zmiany) {
  return { kiedy: B.now(), kto: me.uid, nazwa: me.nazwa, zast: !isOwner, przejrzane: isOwner, typ, obiektId, obiekt, akcja, zmiany: (zmiany || []).slice(0, 200) };
}
// usuwa pola undefined (Firestore ich nie przyjmuje), nie ruszając znaczników czasu serwera
export function czysc(o) {
  if (Array.isArray(o)) return o.map(czysc);
  if (o && typeof o === "object" && Object.getPrototypeOf(o) === Object.prototype) {
    const n = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) n[k] = czysc(v); return n;
  }
  return o;
}
export async function zapiszDok(col, id, data, { typ, etykieta, diffFn, wersja, force, akcja, baza }) {
  const rid = id || B.newId(col), logId = B.newId(C.log);
  if (navigator.onLine === false) return zapiszDokOffline(col, rid, id, data, { typ, etykieta, diffFn, akcja, baza, logId });
  let scalono = null;
  return B.tx(async t => {
    const cur = id ? await t.get(col, rid) : null;
    if (id && !cur) return { gone: true };
    if (cur && !force && (cur.wersja || 0) !== (wersja || 0)) {
      // ktoś zapisał w międzyczasie – łączymy zmiany różnych komórek; ta sama komórka = pytanie
      if (!baza) return { conflict: cur };
      const czesci = {}; for (const k of Object.keys(data)) czesci[k] = cur[k];
      const s = L.scal3(Object.fromEntries(Object.keys(data).map(k => [k, baza[k]])), czesci, data);
      if (s.konflikty.length) return { conflict: cur, konflikty: s.konflikty };
      data = s.wynik; scalono = cur.zmienilNazwa || "ktoś";
    }
    const zmiany = diffFn(cur, data);
    if (cur && !zmiany.length) return { nochange: true, id: rid, wersja: cur.wersja };
    const meta = { zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa, wersja: (cur?.wersja || 0) + 1, ostatniWpis: logId };
    if (cur) t.set(col, rid, czysc({ ...cur, ...data, ...meta }));
    else t.set(col, rid, czysc({ ...data, ...meta, utworzono: B.now(), utworzyl: me.uid }));
    t.set(C.log, logId, wpis(typ, rid, etykieta, akcja || (cur ? "zmiana" : "utworzenie"), zmiany));
    return { ok: true, id: rid, wersja: meta.wersja, scalono, dane: data };
  }).catch(x => { if (x && (x.code === "unavailable" || x.code === "deadline-exceeded")) return zapiszDokOffline(col, rid, id, data, { typ, etykieta, diffFn, akcja, baza, logId }); throw x; });
}
// Bez internetu: zapis do pamięci urządzenia (wysyła się sam po powrocie sieci) – tylko zmienione pola,
// żeby po wysłaniu nie nadpisać cudzych zmian w innych polach.
function zapiszDokOffline(col, rid, id, data, { typ, etykieta, diffFn, akcja, baza, logId }) {
  const cur = id ? (baza || (col === C.z ? zapById(id) : null)) : null;
  const zmiany = diffFn(cur, data);
  if (cur && !zmiany.length) return { nochange: true, id: rid, wersja: cur.wersja };
  const meta = { zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa, wersja: B.inc(1), ostatniWpis: logId };
  const pola = {}; for (const k of Object.keys(data)) if (!cur || JSON.stringify(cur[k] ?? null) !== JSON.stringify(data[k] ?? null)) pola[k] = data[k];
  B.batch([
    cur ? { c: col, id: rid, d: czysc({ ...pola, ...meta }), upd: true } : { c: col, id: rid, d: czysc({ ...data, ...meta, wersja: 1, utworzono: B.now(), utworzyl: me.uid }) },
    { c: C.log, id: logId, d: wpis(typ, rid, etykieta, akcja || (cur ? "zmiana" : "utworzenie"), zmiany) }
  ]).catch(x => { console.warn(x); toast("Zmiana zapisana bez internetu nie przeszła po połączeniu: " + (x?.code || x)); });
  return { ok: true, offline: true, id: rid, wersja: (cur?.wersja || 0) + 1, dane: data };
}
export async function zapiszUst(docId, data, etykieta, zmiany, akcja = "zmiana") {
  const logId = B.newId(C.log);
  await B.tx(async t => { t.set(C.u, docId, czysc(data)); t.set(C.log, logId, wpis("ustawienia", docId, etykieta, akcja, zmiany)); });
}

// diff zapytania – adresy jak w Excelu
export const sv = v => v === undefined || v === null ? "" : typeof v === "number" ? L.ogolny(v) : String(v);
export const komTekst = c => c ? (c.f ? c.f : sv(c.v)) : "";
export function nazwaDostawcy(z, k) { if (k === -1 || !k) return ""; for (const [c, h] of Object.entries(z.naglowki || {})) if (L.kolor(h.k) === L.kolor(k)) return h.t || kolLit(+c); return "#" + k; }
export function diffZap(a, b) {
  a = a || { naglowki: {}, wiersze: [] }; const out = []; const add = (p, x, y) => out.push({ p, a: sv(x), b: sv(y) });
  if (sv(a.nazwa) !== sv(b.nazwa)) add("nazwa", a.nazwa, b.nazwa);
  if (sv(a.kod) !== sv(b.kod)) add("A1", a.kod, b.kod);
  if (sv(a.kodM) !== sv(b.kodM)) add("komentarz A1", a.kodM, b.kodM);
  const kol = new Set([...Object.keys(a.naglowki || {}), ...Object.keys(b.naglowki || {})]);
  for (const c of kol) {
    const x = a.naglowki?.[c] || {}, y = b.naglowki?.[c] || {}, adr = kolLit(+c) + "1";
    if (sv(x.t) !== sv(y.t)) add(adr, x.t, y.t);
    if (L.kolor(x.k) !== L.kolor(y.k)) add(`${adr} kolor (${y.t || x.t || ""})`, x.k ? "#" + x.k : "", y.k ? "#" + y.k : "");
    if (sv(x.m) !== sv(y.m)) add(`${adr} komentarz`, x.m, y.m);
  }
  const za = a.zamowienia || {}, zb = b.zamowienia || {};
  for (const k of new Set([...Object.keys(za), ...Object.keys(zb)])) {
    const x = za[k] || {}, y = zb[k] || {}, n = y.dostawca || x.dostawca || "#" + k;
    for (const [f, l] of [["status", "status"], ["nr", "nr zamówienia"], ["data", "data zamówienia"], ["dostawa", "planowana dostawa"], ["uwagi", "uwagi"]])
      if (sv(x[f]) !== sv(y[f])) add(`zamówienie ${n}: ${l}`, f.startsWith("da") || f === "dostawa" ? fD(x[f]) : x[f], f.startsWith("da") || f === "dostawa" ? fD(y[f]) : y[f]);
  }
  const n = Math.max(a.wiersze?.length || 0, b.wiersze.length);
  for (let i = 0; i < n; i++) {
    const x = a.wiersze?.[i] || { a: "", c: {} }, y = b.wiersze[i] || { a: "", c: {} }, r = i + 2, poz = (y.a || x.a || "").slice(0, 40);
    if (sv(x.a) !== sv(y.a)) add("A" + r, x.a, y.a);
    if (L.kolor(x.k) !== L.kolor(y.k)) add(`A${r} wybór dostawcy (${poz})`, nazwaDostawcy(a, x.k) || (x.k ? "#" + x.k : ""), nazwaDostawcy(b, y.k) || (y.k ? "#" + y.k : ""));
    if (sv(x.m) !== sv(y.m)) add(`A${r} komentarz`, x.m, y.m);
    const ks = new Set([...Object.keys(x.c || {}), ...Object.keys(y.c || {})]);
    for (const c of ks) {
      const p = x.c?.[c], q = y.c?.[c], adr = kolLit(+c) + r, dost = b.naglowki?.[c]?.t || a.naglowki?.[c]?.t || "";
      const opis = `${adr}${dost ? " " + dost : ""}${poz ? " · " + poz : ""}`;
      if (komTekst(p) !== komTekst(q)) add(opis, komTekst(p), komTekst(q));
      if (L.kolor(p?.k) !== L.kolor(q?.k)) add(`${opis} kolor`, p?.k ? "#" + p.k : "", q?.k ? "#" + q.k : "");
      if (sv(p?.m) !== sv(q?.m)) add(`${opis} komentarz`, p?.m, q?.m);
    }
  }
  return out;
}
export const POLA_PROJ = { kod: "kod klienta" };
export function diffProj(a, b) {
  a = a || { pozycje: [] }; const out = [];
  for (const [k, l] of Object.entries(POLA_PROJ)) if (sv(a[k]) !== sv(b[k])) out.push({ p: l, a: sv(a[k]), b: sv(b[k]) });
  if (JSON.stringify(a.pozycje) !== JSON.stringify(b.pozycje)) {
    out.push({ p: "pozycje projektu", a: a.pozycje?.length ? a.pozycje.length + " poz." : "", b: b.pozycje.length + " poz." });
    const opis = x => `${x.nazwa} – ${L.ogolny(L.liczba(x.ilosc))} ${x.jm || ""}${x.tresc ? " (" + x.tresc + ")" : ""}`;
    const A = (a.pozycje || []).map(opis), Bp = (b.pozycje || []).map(opis);
    A.filter(x => !Bp.includes(x)).slice(0, 20).forEach(x => out.push({ p: "pozycja projektu", a: x, b: "" }));
    Bp.filter(x => !A.includes(x)).slice(0, 20).forEach(x => out.push({ p: "pozycja projektu", a: "", b: x }));
  }
  return out;
}

/* ============================================================ nawigacja */
export function go(nazwa, arg = "") { location.hash = arg ? `${nazwa}-${arg}` : nazwa; }
export function zHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/^(z|waga|koszt)-(.+)$/);
  if (m) { widok.nazwa = m[1]; widok.arg = m[2]; } else { widok.nazwa = ["generator", "zapytania", "projekty", "ceny", "ustawienia", "dziennik", "dostep"].includes(h) ? h : "generator"; widok.arg = ""; }
}
window.addEventListener("hashchange", async () => { zapiszTeraz(); zHash(); render(); window.scrollTo(0, 0); });
$("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) go(b.dataset.v); });
export function zakladka() {
  const t = { z: "zapytania", waga: "zapytania", koszt: "projekty", dziennik: "ustawienia" }[widok.nazwa] || widok.nazwa;
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === t));
}
export function render() {
  if (!me) return;
  zakladka();
  document.body.append($("cellbar"));     // pasek opcji komórki wraca na miejsce przed przerysowaniem widoku
  $("cellbar").hidden = true;
  const v = widok.nazwa;
  if (v === "dostep" && !isOwner) return go("generator");
  ({ generator: renderGenerator, zapytania: renderLista, z: renderArkusz, waga: renderWaga, koszt: renderKoszt, projekty: renderProjekty, ceny: renderCeny, ustawienia: renderUstawienia, dziennik: renderLog, dostep: renderDostep }[v] || renderGenerator)();
}
export const M = () => $("widok");

/* ============================================================ start */
window.addEventListener("beforeunload", e => { if (eDirty || genDirty || ustDirty) { e.preventDefault(); e.returnValue = ""; } });
zHash();
boot().catch(x => msg("Nie udało się uruchomić aplikacji", String(x?.message || x)));
