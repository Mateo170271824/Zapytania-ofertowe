import * as L from "./logika.js?v=202611061353";
import * as I from "./import-excel.js?v=202611061353";
import * as CE from "./ceny.js?v=202611061353";

/* ============================================================ konfiguracja */
const firebaseConfig = {
  apiKey: "AIzaSyB8Zi3CTsEJDqnxpt2EpmEN0JKbQZkx9Ik",
  authDomain: "logistyka-app-41d7a.firebaseapp.com",
  projectId: "logistyka-app-41d7a",
  storageBucket: "logistyka-app-41d7a.firebasestorage.app",
  messagingSenderId: "730726420764",
  appId: "1:730726420764:web:fbd4a12acd2b5ebdb52ad9"
};
const C = { z: "zap_zapytania", p: "zap_projekty", log: "zap_dziennik", u: "zap_ustawienia", c: "zap_ceny" };
const PALETA = ["00B0F0", "FFFF00", "92D050", "FFC000", "FF99FF", "B4A7D6", "F4B084", "9BC2E6", "C9C9C9", "FF7C80"];

/* ============================================================ pomocnicze */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const toD = x => !x ? null : x.toDate ? x.toDate() : new Date(x);
const fDT = x => { const d = toD(x) || new Date(); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fD = s => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const uidS = () => Math.random().toString(36).slice(2, 10);
// liczby jak w Excelu: „1 234,56” (spacja niełamliwa), zawsze z grupowaniem
export function fmt(x, d = 2, min = d) {
  if (x === null || x === undefined || x === "" || isNaN(x)) return "";
  const s = Math.abs(x).toFixed(d);
  let [c, u] = s.split(".");
  c = c.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (u !== undefined && min < d) { u = u.replace(/0+$/, ""); while (u.length < min) u += "0"; }
  return (x < 0 && +s !== 0 ? "-" : "") + c + (u ? "," + u : "");
}
const zl = x => fmt(x, 2) + " zł";
const ogolnyLiczba = x => typeof x === "number" ? fmt(x, 4, 0) : esc(x);
const kolLit = c => { let s = ""; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const hex = k => (k && k !== -1) ? "#" + k : "";
function toast(t) { document.querySelectorAll(".toast").forEach(x => x.remove()); const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 3500); }
function failed(x) { console.error(x); toast("Nie udało się zapisać: " + (x?.code || x?.message || x)); }
function show(v) { for (const id of ["v-msg", "v-login", "v-app"]) $(id).hidden = id !== "v-" + v; }
function msg(t, s = "") { $("msgT").textContent = t; $("msgS").textContent = s; show("msg"); }
// okno dialogowe: html formularza, przyciski [{v, t, cls}] -> Promise<{v, form}>
function okno(html, przyciski = [{ v: "ok", t: "OK", cls: "primary" }], opcje = {}) {
  return new Promise(res => {
    const d = $("dlg"), f = $("dlgF");
    f.innerHTML = html + `<div class="foot"><span class="grow"></span>${przyciski.map(b => `<button class="btn ${b.cls || ""}" value="${b.v}" ${b.nv ? "formnovalidate" : ""}>${esc(b.t)}</button>`).join("")}</div>`;
    d.style.width = opcje.szer || "";
    d.returnValue = "";
    d.showModal();
    opcje.poOtwarciu?.(f);
    d.addEventListener("close", () => res({ v: d.returnValue, form: f }), { once: true });
  });
}
const pytanie = async (t, b, ok = "OK") => (await okno(`<h3>${esc(t)}</h3><div class="small">${b}</div>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: ok, cls: "primary" }])).v === "ok";
async function kopiuj(t) { try { await navigator.clipboard.writeText(t); toast("Skopiowano"); } catch { toast("Zaznacz tekst i skopiuj ręcznie"); } }
function pobierzPlik(nazwa, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nazwa; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const czytajPlik = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });

/* ============================================================ Firebase */
let B;
async function firebase() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = initializeApp(firebaseConfig), auth = A.getAuth(app), db = F.getFirestore(app);
  if (new URLSearchParams(location.search).has("emu") && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); F.connectFirestoreEmulator(db, "127.0.0.1", 8085);
  }
  const normLogin = t => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "");
  const wrapT = T => ({
    get: async (c, id) => { const s = await T.get(F.doc(db, c, id)); return s.exists() ? s.data() : null; },
    set: (c, id, d) => T.set(F.doc(db, c, id), d),
    update: (c, id, d) => T.update(F.doc(db, c, id), d),
    del: (c, id) => T.delete(F.doc(db, c, id)),
  });
  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    login: (l, p) => A.signInWithEmailAndPassword(auth, normLogin(l) + "@konta." + firebaseConfig.authDomain, p),
    logout: () => A.signOut(auth),
    watch: (c, cb, err) => F.onSnapshot(c === C.log ? F.query(F.collection(db, c), F.orderBy("kiedy", "desc"), F.limit(1500)) : F.collection(db, c), s => cb(s.docs.map(d => ({ _id: d.id, ...d.data() }))), err),
    watchDoc: (c, id, cb, err) => F.onSnapshot(F.doc(db, c, id), s => cb(s.exists() ? s.data() : null), err),
    accounts: async () => (await F.getDocs(F.query(F.collection(db, "uzytkownicy"), F.where("rola", "==", "biuro")))).docs.map(d => ({ uid: d.id, ...d.data() })),
    tx: fn => F.runTransaction(db, T => fn(wrapT(T))),
    batch: async ops => { const b = F.writeBatch(db); for (const o of ops) { const r = F.doc(db, o.c, o.id); if (o.del) b.delete(r); else if (o.upd) b.update(r, o.d); else b.set(r, o.d); } await b.commit(); },
    newId: c => F.doc(F.collection(db, c)).id,
    now: () => F.serverTimestamp(),
  };
}

/* ============================================================ stan */
let me = null, isOwner = false, ownerUid = "", dostep = { zastepcy: {} }, zast = null;
let Z = [], P = [], LOG = [], U = clone(L.USTAWIENIA_DOMYSLNE), W = { rows: [], pamiec: {} }, G = { kod: "", plik: "", ostatnie: "", wiersze: [] }, konta = [];
let zaladowane = { z: false, p: false, u: false, w: false, g: false };
let subs = [], started = false, user = null, metaOk = false, dostOk = false, metaSub = null, dostSub = null;
const widok = { nazwa: "generator", arg: "" };
const odpowiedzi = {};          // odpowiedzi na pytania makra (długość, grubość) w tej sesji

function zastStatus(z) { if (!z) return "brak"; if (z.odwolano) return "odwołane"; const n = Date.now(), od = toD(z.od)?.getTime(), d = toD(z.do)?.getTime(); return n < od ? "zaplanowane" : n >= d ? "zakończone" : "aktywne"; }
const doDnia = z => iso(new Date(toD(z.do).getTime() - 864e5));
const zapById = id => Z.find(z => z._id === id);
const zapByNazwa = n => Z.find(z => L.LC(z.nazwa) === L.LC(n));
const zapytaniaPosort = () => Z.slice().sort((a, b) => (b.kolejnosc ?? 0) - (a.kolejnosc ?? 0));

/* ============================================================ logowanie i uprawnienia */
$("loginF").addEventListener("submit", async e => {
  e.preventDefault(); $("lgErr").hidden = true;
  try { await B.login($("lgLogin").value, $("lgPass").value); } catch { $("lgErr").hidden = false; $("lgErr").textContent = "Nieprawidłowy login lub hasło."; }
});
$("btnOut").onclick = () => B.logout();
function stopAll() { subs.forEach(u => { try { u(); } catch {} }); subs = []; started = false; }
function decide() {
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
  if (!isOwner) $("zastBanner").innerHTML = `<b>Dostęp tymczasowy do ${fD(doDnia(zast))}.</b> Każda Twoja zmiana zapisuje się w Dzienniku zmian z Twoim nazwiskiem i godziną. Nie możesz usuwać zapytań ani projektów.`;
  if (!started) { started = true; startData(); }
  render();
}
async function boot() {
  B = await firebase();
  B.onAuth(u => {
    stopAll(); metaSub?.(); dostSub?.(); user = null; metaOk = dostOk = false;
    if (!u) return show("login");
    msg("Wczytywanie…");
    user = { uid: u.uid };
    metaSub = B.watchDoc("meta", "init", d => { ownerUid = d?.admin || ""; metaOk = true; decide(); }, x => msg("Nie udało się sprawdzić uprawnień", x?.code || String(x)));
    B.watchDoc("uzytkownicy", u.uid, d => { if (d) { user.nazwa = d.nazwa || d.login; } if (me) me.nazwa = user.nazwa || me.nazwa; decide(); }, () => {});
    dostSub = B.watchDoc(C.u, "dostep", d => { dostep = d || { zastepcy: {} }; dostOk = true; decide(); }, () => { dostep = { zastepcy: {} }; dostOk = true; decide(); });
  });
  setInterval(() => { if (user && metaOk && dostOk) decide(); }, 60000);
}
function startData() {
  const err = x => { console.warn(x); if (String(x?.code).includes("permission")) msg("Brak dostępu do danych", "Reguły bazy nie wpuszczają tego konta. Przy pierwszym uruchomieniu trzeba wgrać reguły dla Zapytań."); };
  subs.push(B.watch(C.z, a => { Z = a; zaladowane.z = true; poZmianieDanych("z"); }, err));
  subs.push(B.watch(C.p, a => { P = a; zaladowane.p = true; poZmianieDanych("p"); }, err));
  subs.push(B.watch(C.log, a => { LOG = a; poZmianieDanych("log"); }, err));
  subs.push(B.watchDoc(C.u, "config", d => { U = { ...clone(L.USTAWIENIA_DOMYSLNE), ...(d || {}) }; zaladowane.u = true; poZmianieDanych("u"); }, err));
  subs.push(B.watchDoc(C.u, "wagi", d => { W = d ? { rows: d.rows || [], pamiec: d.pamiec || {} } : { rows: [], pamiec: {} }; zaladowane.w = true; poZmianieDanych("w"); }, err));
  subs.push(B.watchDoc(C.u, "generator", d => { if (genDirty) return; G = d ? { kod: "", plik: "", ostatnie: "", wiersze: [], ...d } : G; genStary = clone(G); zaladowane.g = true; poZmianieDanych("g"); }, err));
  if (isOwner) B.accounts().then(a => { konta = a; if (widok.nazwa === "dostep") render(); }).catch(x => console.warn(x));
}
function poZmianieDanych(co) {
  const nz = LOG.filter(l => l.zast && !l.przejrzane).length;
  $("logCnt").hidden = !isOwner || !nz; $("logCnt").textContent = nz;
  $("hSub").textContent = `${Z.length} zapytań · ${P.length} projektów`;
  if (co === "z" && isOwner) sprzatnijProjekty();
  // nie przerysowuj arkusza, gdy ktoś w nim pisze
  if (widok.nazwa === "z" && co === "z") return odswiezArkuszZBazy();
  if (widok.nazwa === "generator" && co === "g" && genDirty) return;
  if (widok.nazwa === "ustawienia" && ["u", "w"].includes(co) && ustDirty) return;
  if (co === "c" && widok.nazwa !== "ceny") return;
  if (widok.nazwa === "ceny" && ["log", "g"].includes(co)) return;
  if (["log"].includes(co) && !["dziennik", "dostep", "z"].includes(widok.nazwa)) return;
  render();
}

/* ============================================================ zapis z dziennikiem */
function wpis(typ, obiektId, obiekt, akcja, zmiany) {
  return { kiedy: B.now(), kto: me.uid, nazwa: me.nazwa, zast: !isOwner, przejrzane: isOwner, typ, obiektId, obiekt, akcja, zmiany: (zmiany || []).slice(0, 200) };
}
// usuwa pola undefined (Firestore ich nie przyjmuje), nie ruszając znaczników czasu serwera
function czysc(o) {
  if (Array.isArray(o)) return o.map(czysc);
  if (o && typeof o === "object" && Object.getPrototypeOf(o) === Object.prototype) {
    const n = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) n[k] = czysc(v); return n;
  }
  return o;
}
async function zapiszDok(col, id, data, { typ, etykieta, diffFn, wersja, force, akcja }) {
  const rid = id || B.newId(col), logId = B.newId(C.log);
  return B.tx(async t => {
    const cur = id ? await t.get(col, rid) : null;
    if (id && !cur) return { gone: true };
    if (cur && !force && (cur.wersja || 0) !== (wersja || 0)) return { conflict: cur };
    const zmiany = diffFn(cur, data);
    if (cur && !zmiany.length) return { nochange: true, id: rid, wersja: cur.wersja };
    const meta = { zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa, wersja: (cur?.wersja || 0) + 1, ostatniWpis: logId };
    if (cur) t.set(col, rid, czysc({ ...cur, ...data, ...meta }));
    else t.set(col, rid, czysc({ ...data, ...meta, utworzono: B.now(), utworzyl: me.uid }));
    t.set(C.log, logId, wpis(typ, rid, etykieta, akcja || (cur ? "zmiana" : "utworzenie"), zmiany));
    return { ok: true, id: rid, wersja: meta.wersja };
  });
}
async function zapiszUst(docId, data, etykieta, zmiany, akcja = "zmiana") {
  const logId = B.newId(C.log);
  await B.tx(async t => { t.set(C.u, docId, czysc(data)); t.set(C.log, logId, wpis("ustawienia", docId, etykieta, akcja, zmiany)); });
}

// diff zapytania – adresy jak w Excelu
const sv = v => v === undefined || v === null ? "" : typeof v === "number" ? L.ogolny(v) : String(v);
const komTekst = c => c ? (c.f ? c.f : sv(c.v)) : "";
function nazwaDostawcy(z, k) { if (k === -1 || !k) return ""; for (const [c, h] of Object.entries(z.naglowki || {})) if (L.kolor(h.k) === L.kolor(k)) return h.t || kolLit(+c); return "#" + k; }
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
const POLA_PROJ = { kod: "kod klienta" };
function diffProj(a, b) {
  a = a || { pozycje: [] }; const out = [];
  for (const [k, l] of Object.entries(POLA_PROJ)) if (sv(a[k]) !== sv(b[k])) out.push({ p: l, a: sv(a[k]), b: sv(b[k]) });
  if (JSON.stringify(a.pozycje) !== JSON.stringify(b.pozycje)) out.push({ p: "pozycje projektu", a: a.pozycje?.length ? a.pozycje.length + " poz." : "", b: b.pozycje.length + " poz." });
  return out;
}

/* ============================================================ nawigacja */
function go(nazwa, arg = "") { location.hash = arg ? `${nazwa}-${arg}` : nazwa; }
function zHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/^(z|waga|koszt)-(.+)$/);
  if (m) { widok.nazwa = m[1]; widok.arg = m[2]; } else { widok.nazwa = ["generator", "zapytania", "projekty", "ceny", "ustawienia", "dziennik", "dostep"].includes(h) ? h : "generator"; widok.arg = ""; }
}
window.addEventListener("hashchange", async () => { zapiszTeraz(); zHash(); render(); window.scrollTo(0, 0); });
$("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) go(b.dataset.v); });
function zakladka() {
  const t = { z: "zapytania", waga: "zapytania", koszt: "projekty", dziennik: "ustawienia" }[widok.nazwa] || widok.nazwa;
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === t));
}
function render() {
  if (!me) return;
  zakladka();
  $("cellbar").hidden = true;
  const v = widok.nazwa;
  if (v === "dostep" && !isOwner) return go("generator");
  ({ generator: renderGenerator, zapytania: renderLista, z: renderArkusz, waga: renderWaga, koszt: renderKoszt, projekty: renderProjekty, ceny: renderCeny, ustawienia: renderUstawienia, dziennik: renderLog, dostep: renderDostep }[v] || renderGenerator)();
}
const M = () => $("widok");

/* ============================================================ 1. GENERATOR */
let genDirty = false, genTimer = null;
function renderGenerator() {
  const rok = L.rokNumeru(U), nast = L.nastepnyNumer(Z.map(z => z.nazwa), rok) + "-" + rok;
  const W8 = G.wiersze;
  const suma = W8.reduce((s, p) => s + (typeof L.wartoscZakupu(p) === "number" ? L.wartoscZakupu(p) : 0), 0);
  M().innerHTML = `
  <div class="panel"><div class="hd"><h2>Generator zapytań ofertowych – braki magazynowe z Subiekta nexo</h2>
    <div class="toolbar">
      <label class="btn primary filebtn"><span class="nr">1</span>Wczytaj eksport<input type="file" id="gFile" accept=".xlsx,.xls,.xlsm,.csv"></label>
      <button class="btn" id="gMag">Zapytanie na magazyn</button>
      <button class="btn primary" id="gUtworz"><span class="nr">2</span>Utwórz zapytanie</button>
      <button class="btn" id="gMail"><span class="nr">3</span>Mail do dostawców</button>
      <button class="btn" id="gWyczysc"><span class="nr">4</span>Wyczyść listę</button>
    </div></div>
    <div class="bd pola">
      <div class="pole"><span class="lbl">Kod klienta</span><input id="gKod" value="${esc(G.kod)}"></div>
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
let genZmianyLog = [];
function genZmiana() { genDirty = true; clearTimeout(genTimer); genTimer = setTimeout(() => zapiszGenerator(G, null, "edycja listy"), 900); }
async function zapiszGenerator(nowy, zmiany, akcja) {
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
  try { await zapiszUst("generator", nowy, "GENERATOR", zmiany, akcja); genDirty = false; G = clone(nowy); if (widok.nazwa === "generator") renderGenerator(); }
  catch (x) { failed(x); }
}
let genStary = null;
async function wczytajEksportPlik(f) {
  try {
    const wb = XLSX.read(await czytajPlik(f), { type: "array" });
    const tab = I.tabelaPierwszegoArkusza(XLSX, wb);
    const w = L.wczytajEksport(tab, f.name, U);
    if (w.blad) return okno(`<h3>Nieznany format pliku</h3><p>${esc(w.blad)}</p>`);
    genStary = clone(G);
    const nowy = { kod: w.kod, plik: w.plik, ostatnie: "", wiersze: w.wiersze };
    await zapiszGenerator(nowy, [{ p: "wczytano eksport", a: "", b: `${w.plik} – ${w.wiersze.length} poz.` }], "wczytanie eksportu");
    okno(`<h3>Eksport wczytany</h3><p>Wczytano pozycji: <b>${w.wiersze.length}</b><br>Do zapytania (brak na magazynie): <b>${w.ileTak}</b></p>
      <p>Sprawdź kolumny ZAPYTAĆ? i ILOŚĆ DO ZAPYTANIA, potem kliknij „2. Utwórz zapytanie”.</p>
      ${w.bezCeny ? `<p class="notice">Uwaga: w eksporcie nie ma kolumny z ceną zakupu – koszt projektu nie policzy materiału z magazynu (brak kolumny „Cena netto”).</p>` : ""}`);
  } catch (x) { console.error(x); okno(`<h3>Błąd</h3><p>Nie udało się wczytać pliku: ${esc(x.message || x)}</p>`); }
}
async function utworzZapytanie() {
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
  const r = await okno(`<h3>Zapytanie gotowe</h3><p>Utworzono: <b>${esc(utworzone)}</b><br>Pozycji w zapytaniu: <b>${u.ilePozycji}</b></p><p>Przygotować maila do dostawców?<br><span class="small">(możesz to zrobić też później przyciskiem „3. Mail do dostawców”)</span></p>`,
    [{ v: "nie", t: "Nie", nv: true }, { v: "tak", t: "Tak", cls: "primary" }]);
  const pierwsze = () => zapByNazwa(u.zapytania[0].nazwa);
  if (r.v === "tak") { for (const z of u.zapytania) await czekajNa(() => zapByNazwa(z.nazwa)).then(x => x && oknoMail(x)); }
  else { const z = await czekajNa(pierwsze); if (z) go("z", z._id); }
}
const vbaKod = () => L.vbaTrim(G.kod);
const czekajNa = (fn, ms = 4000) => new Promise(res => { const t0 = Date.now(); const k = () => { const v = fn(); if (v || Date.now() - t0 > ms) res(v); else setTimeout(k, 100); }; k(); });
async function mailOstatnie() {
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
async function wybierzZListy() {
  startCeny();
  if (!(await czekajNa(() => cenyZal, 8000))) return toast("Nie udało się wczytać listy materiałów"), null;
  const lista = CEN.filter(d => d.status !== "pomin" && d.nazwa).sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl", { numeric: true }));
  if (!lista.length) { await okno(`<h3>Lista materiałów jest pusta</h3><p>Najpierw wgraj listę z Subiekta w zakładce „Ceny”.</p>`); return null; }
  const wyb = new Map();          // id -> {ilosc, jm}
  const jmDom = d => { const t = L.typWyrobu(L.UC(d.nazwa)); return ["PRET", "PRETKW", "PRET6K"].includes(t) ? "kg" : ["szt", "kg", "mb"].includes(d.jm) ? d.jm : "szt"; };
  let q = "";
  const wiersze = () => {
    const f = L.LC(q).split(/\s+/).filter(Boolean);
    const pasuje = lista.filter(d => f.every(t => L.LC(d.nazwa + " " + d.symbol).includes(t)));
    return pasuje.slice(0, 120).map(d => { const w = wyb.get(d._id), c = d.historia?.at(-1)?.c;
      return `<tr data-id="${esc(d._id)}"><td><input type="checkbox" ${w ? "checked" : ""} aria-label="wybierz"></td><td>${esc(d.nazwa)}<div class="small mono">${esc(d.symbol)}${c ? ` · ${fmt(c, 2)} zł/${esc(d.jm || "?")}` : ""}</div></td>
        <td style="width:90px"><input data-il inputmode="decimal" value="${esc(w ? L.ogolny(w.ilosc) : "")}" placeholder="ilość"></td>
        <td style="width:96px"><select data-jm>${["szt", "kg", "mb", "paczka"].map(j => `<option ${(w ? w.jm : jmDom(d)) === j ? "selected" : ""}>${j}</option>`).join("")}</select></td></tr>`; }).join("")
      + (pasuje.length > 120 ? `<tr><td colspan="4" class="small">… i ${pasuje.length - 120} więcej – zawęź wyszukiwanie</td></tr>` : "")
      + (pasuje.length ? "" : `<tr><td colspan="4" class="small">Nic nie pasuje</td></tr>`);
  };
  const r = await okno(`<h3>Dodaj z listy materiałów</h3>
    <input type="search" id="zlQ" placeholder="Szukaj: 100x100x3, IPE 300, pręt 16… (kilka słów naraz)" autofocus>
    <div class="tablebox" style="max-height:52vh;overflow:auto"><table class="t ed"><tbody id="zlRows">${wiersze()}</tbody></table></div>
    <div class="small" id="zlIle">Zaznaczono: 0</div>`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Dodaj zaznaczone", cls: "primary" }],
    { szer: "min(860px, calc(100vw - 24px))", poOtwarciu: f => {
      const ile = () => f.querySelector("#zlIle").textContent = `Zaznaczono: ${wyb.size}` + (wyb.size ? " – " + [...wyb.values()].slice(0, 4).map(w => w.nazwa).join(", ") + (wyb.size > 4 ? "…" : "") : "");
      const odczyt = tr => { const d = lista.find(x => x._id === tr.dataset.id), on = tr.querySelector('input[type="checkbox"]').checked, v = tr.querySelector("[data-il]").value.trim(), jm = tr.querySelector("[data-jm]").value;
        if (!on) { wyb.delete(d._id); return; }
        const n = L.naLiczbe(v); wyb.set(d._id, { symbol: d.symbol, nazwa: d.nazwa, jm: jm === "paczka" ? (jmDom(d)) : jm, ilosc: jm === "paczka" ? (n.ok && n.w > 1 ? `${L.ogolny(n.w)} paczki` : "paczka") : (n.ok ? n.w : ""), cz: d.historia?.at(-1)?.c, jmCeny: d.jm }); };
      f.querySelector("#zlQ").oninput = e => { q = e.target.value; f.querySelector("#zlRows").innerHTML = wiersze(); };
      f.querySelector("#zlRows").addEventListener("input", e => { const tr = e.target.closest("tr[data-id]"); if (!tr) return; if (e.target.matches("[data-il]") && e.target.value.trim()) tr.querySelector('input[type="checkbox"]').checked = true; odczyt(tr); ile(); });
      f.querySelector("#zlRows").addEventListener("change", e => { const tr = e.target.closest("tr[data-id]"); if (tr) { odczyt(tr); ile(); } });
    } });
  if (r.v !== "ok" || !wyb.size) return null;
  const bez = [...wyb.values()].filter(w => w.ilosc === "").length;
  if (bez && !(await pytanie("Brak ilości", `Pozycji bez ilości: <b>${bez}</b>. Dodać mimo to? (w generatorze będą zaznaczone na żółto)`, "Dodaj"))) return null;
  return [...wyb.values()];
}
// zapytanie na magazyn: pozycje z listy materiałów, bez generatora i bez danych projektu
async function zapytanieNaMagazyn() {
  const wyb = await wybierzZListy(); if (!wyb) return;
  const rok = L.rokNumeru(U), nr = L.nastepnyNumer(Z.map(z => z.nazwa), rok);
  const r = await okno(`<h3>Zapytanie na magazyn</h3><div class="grid2"><label>Numer<input name="n" value="${nr}-${rok}" required></label><label>Kod (komórka A1)<input name="k" value="MAG"></label></div>
    <p class="small">${wyb.length} poz.: ${esc(wyb.slice(0, 5).map(x => x.nazwa).join(", "))}${wyb.length > 5 ? "…" : ""}</p><p class="small">Zapytanie nie tworzy danych projektu – koszt projektu go nie dotyczy.</p>`,
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

/* ============================================================ 3. mail */
async function oknoMail(z) {
  const m = L.przygotujMail(z, U);
  if (m.blad) return okno(`<h3>Mail do dostawców</h3><p>${esc(m.blad)}</p>`);
  const href = `mailto:${encodeURIComponent(m.do)}?bcc=${encodeURIComponent(m.udw)}&subject=${encodeURIComponent(m.temat)}&body=${encodeURIComponent(m.tresc.replace(/\n/g, "\r\n"))}`;
  await okno(`<h3>Mail: ${esc(z.nazwa)}</h3>
    <div class="small">Dostawcy idą w UDW – nie widzą się nawzajem. Przycisk otwiera nową wiadomość w domyślnym programie pocztowym (Thunderbird, jeśli jest domyślny).</div>
    ${m.do ? `<div><span class="small">Do:</span> <span class="mono">${esc(m.do)}</span></div>` : ""}
    <div><div class="toolbar"><span class="small">UDW (${m.udw.split(",").length} adresów)</span><button type="button" class="btn sm" id="mCpA">Kopiuj adresy</button></div><div class="copybox" style="max-height:90px">${esc(m.udw)}</div></div>
    <div><span class="small">Temat:</span> <b>${esc(m.temat)}</b></div>
    <div><div class="toolbar"><span class="small">Treść (${m.ilePozycji} poz.)</span><button type="button" class="btn sm" id="mCpT">Kopiuj treść</button></div><div class="copybox">${esc(m.tresc)}</div></div>
    <a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">Otwórz wiadomość w programie pocztowym</a>`,
    [{ v: "ok", t: "Zamknij" }], { poOtwarciu: f => { f.querySelector("#mCpA").onclick = () => kopiuj(m.udw); f.querySelector("#mCpT").onclick = () => kopiuj(`Temat: ${m.temat}\n\n${m.tresc}`); } });
}

/* ============================================================ 2. lista zapytań */
let listaQ = "";
function renderLista() {
  const q = L.LC(listaQ);
  const lista = zapytaniaPosort().filter(z => !q || L.LC(z.nazwa + " " + z.kod + " " + z.wiersze.map(w => w.a).join(" ") + " " + Object.values(z.naglowki || {}).map(h => h.t).join(" ")).includes(q));
  M().innerHTML = `<div class="panel"><div class="hd"><div class="toolbar"><input id="lQ" type="search" placeholder="Przejdź do zapytania: numer, kod klienta, pozycja, dostawca…" style="width:340px" value="${esc(listaQ)}"></div>
    <div class="toolbar"><button class="btn primary" id="lMag">Zapytanie na magazyn</button><button class="btn" id="lNowe">+ Puste zapytanie (z wzoru)</button></div></div>
    <div class="lista">${lista.slice(0, 300).map(z => {
      const poz = z.wiersze.filter(w => L.vbaTrim(w.a)).length, dost = Object.values(z.naglowki || {}).filter(h => h.t).length, wyb = Object.values(z.naglowki || {}).filter(h => L.kolor(h.k) !== -1).length;
      const proj = L.projektDlaZapytania(P, z.nazwa);
      return `<div class="it" data-id="${z._id}"><div><span class="nm mono">${esc(z.nazwa)}</span>${z.kod && !L.LC(z.nazwa).includes(L.LC(z.kod)) ? ` <span class="small">|</span> <b>${esc(z.kod)}</b>` : ""}
        <div class="small">${poz} poz. · ${dost} dostawców${wyb ? ` · wybrano: ${Object.values(z.naglowki).filter(h => L.kolor(h.k) !== -1).map(h => `<span class="sw" style="background:${hex(h.k)}"></span>${esc(h.t)}`).join(" ")}` : ""}${proj ? " · projekt" : ""}</div></div>
        <span class="small">›</span></div>`;
    }).join("") || `<div class="empty"><strong>Brak zapytań</strong><span>Utwórz zapytanie w Generatorze albo zaimportuj plik Excel w Ustawieniach.</span></div>`}</div></div>`;
  $("lQ").oninput = e => { listaQ = e.target.value; const pos = e.target.selectionStart; renderLista(); $("lQ").focus(); $("lQ").setSelectionRange(pos, pos); };
  $("lQ").onkeydown = e => { if (e.key === "Enter") { const f = M().querySelector(".it"); if (f) go("z", f.dataset.id); } };
  M().querySelector(".lista").onclick = e => { const it = e.target.closest(".it"); if (it) go("z", it.dataset.id); };
  $("lNowe").onclick = noweZWzoru;
  $("lMag").onclick = zapytanieNaMagazyn;
}
async function noweZWzoru() {
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

/* ============================================================ arkusz zapytania */
let E = null, eId = null, eWersja = 0, eDirty = false, eTimer = null, eZapis = null, wybor = false, fokus = null;
function odswiezArkuszZBazy() {
  const z = zapById(widok.arg);
  if (!z) return render();
  if (z._id !== eId) return render();
  if ((z.wersja || 0) !== eWersja && !eDirty && !document.activeElement?.closest?.("table.ark")) { E = clone(z); eWersja = z.wersja || 0; rysujArkusz(); }
  else if (widok.nazwa === "z") rysujHistorie();
}
function renderArkusz() {
  const z = zapById(widok.arg);
  if (!z) { M().innerHTML = zaladowane.z ? `<div class="empty"><strong>Nie ma takiego zapytania</strong><a class="btn" href="#zapytania">Lista zapytań</a></div>` : `<div class="empty">Wczytywanie…</div>`; return; }
  if (eId !== z._id || !eDirty) { E = clone(z); eId = z._id; eWersja = z.wersja || 0; }
  const proj = L.projektDlaZapytania(P, z.nazwa);
  M().innerHTML = `
    <div class="panel"><div class="hd">
      <div class="toolbar"><a class="btn" href="#zapytania">← Lista</a><h2 class="mono" id="aNazwa">${esc(E.nazwa)}</h2>${isOwner ? `<button class="btn sm" id="aZmienNazwe">Zmień nazwę</button>` : ""}<span class="status" id="aStatus"></span></div>
      <div class="toolbar">
        <button class="btn" id="aZListy">Dodaj z listy</button>
        <button class="btn" id="aWybor">Wybór dostawcy kolorem</button>
        <button class="btn" id="aMail">Mail do dostawców</button>
        <button class="btn" id="aWaga">Waga dla logistyki</button>
        <button class="btn" id="aKoszt">Koszt projektu${proj ? "" : " (brak danych)"}</button>
        <button class="btn" id="aXls">Pobierz jako Excel</button>
        ${isOwner ? `<button class="btn danger" id="aUsun">Usuń</button>` : ""}
      </div></div>
      <div class="bd legend" id="aLegenda"></div>
      <div class="bd notice" id="aWyborInfo" hidden>Tryb wyboru: kliknij cenę dostawcy w wierszu pozycji – pozycja i nagłówek dostawcy dostaną ten sam kolor (jak zaznaczanie kolorem w Excelu). Kliknięcie pozycji w kolumnie A usuwa wybór, kliknięcie nagłówka dostawcy zmienia jego kolor. Bez tego trybu: kliknij cenę i użyj „Wybierz tego dostawcę”.</div>
    </div>
    <div id="aBox"><div class="arkuszbox" id="aGrid"></div></div>
    <div class="panel"><div class="hd"><h3>Historia zmian</h3></div><div class="log" id="aLog"></div></div>`;
  $("aWybor").onclick = () => { wybor = !wybor; $("aWybor").classList.toggle("on", wybor); $("aBox").classList.toggle("wybor", wybor); $("aWyborInfo").hidden = !wybor; $("cellbar").hidden = true; };
  $("aWybor").classList.toggle("on", wybor); $("aBox").classList.toggle("wybor", wybor); $("aWyborInfo").hidden = !wybor;
  $("aMail").onclick = async () => { await zapiszTeraz(); oknoMail(zapById(eId)); };
  $("aWaga").onclick = async () => { await zapiszTeraz(); go("waga", eId); };
  $("aKoszt").onclick = async () => { await zapiszTeraz(); kosztDlaZapytania(zapById(eId)); };
  $("aXls").onclick = () => eksportArkusza(E);
  $("aZListy").onclick = async () => {
    const wyb = await wybierzZListy(); if (!wyb) return;
    przytnij();
    for (const x of wyb) E.wiersze.push({ a: L.trescPozycji({ nazwa: x.nazwa, ilZap: x.ilosc, jm: x.jm }), c: {} });
    zmiana(); rysujArkusz(); toast(`Dodano ${wyb.length} poz.`);
  };
  $("aUsun") && ($("aUsun").onclick = usunZapytanie);
  $("aZmienNazwe") && ($("aZmienNazwe").onclick = zmienNazwe);
  rysujArkusz(); rysujHistorie();
}
function rysujHistorie() {
  const el = $("aLog"); if (!el) return;
  const l = LOG.filter(x => x.obiektId === eId || (x.typ === "zapytanie" && String(x.obiekt).split(", ").includes(E?.nazwa)));
  el.innerHTML = l.length ? l.slice(0, 60).map(logItem).join("") : `<div class="empty"><span>Brak wpisów</span></div>`;
}
function wartWyswietl(c, kol) {
  if (!c) return "";
  if (c.f && (c.v === undefined || c.v === null)) return "#BŁĄD";
  if (typeof c.v === "number") return kol >= 2 ? zl(c.v) : L.ogolny(c.v);
  if (typeof c.v === "boolean") return c.v ? "PRAWDA" : "FAŁSZ";
  return String(c.v ?? "");
}
const wartEdycja = c => !c ? "" : c.f ? c.f : typeof c.v === "number" ? L.ogolny(c.v) : String(c.v ?? "");
function rysujArkusz() {
  const g = $("aGrid"); if (!g || !E) return;
  const ostK = Math.max(L.ostKolumna(E), 4), nW = Math.max(E.wiersze.length + 3, 12);
  const naglowki = E.naglowki || {};
  // szerokość kolumny dopasowana do najdłuższego tekstu (nagłówek albo komórka), 160–320 px
  const szer = c => { let n = String(naglowki[c]?.t ?? "").length; for (const w of E.wiersze) n = Math.max(n, wartWyswietl(w.c?.[c], c).length); return szerKol(n, 160, 320); };
  const szerA = szerKol(Math.max(String(E.kod ?? "").length, ...E.wiersze.map(w => Math.max(...String(w.a ?? "").split("\n").map(l => l.length)))), innerWidth < 700 ? 200 : 300, innerWidth < 700 ? 260 : 560);
  let h = `<table class="ark"><thead><tr><th class="rn"></th><th style="position:sticky;left:34px;z-index:4;width:${szerA}px;min-width:${szerA}px">A</th>${Array.from({ length: ostK - 1 }, (_, i) => { const w = szer(i + 2); return `<th style="width:${w}px;min-width:${w}px">${kolLit(i + 2)}</th>`; }).join("")}<th></th></tr></thead><tbody>`;
  // wiersz 1: kod klienta + dostawcy
  h += `<tr class="r1"><td class="rn">1</td><td class="a" data-r="1" data-c="1">${E.kodM ? '<span class="km" title="' + esc(E.kodM) + '"></span>' : ""}<input value="${esc(E.kod)}" data-r="1" data-c="1" aria-label="A1 kod klienta"></td>`;
  for (let c = 2; c <= ostK; c++) {
    const n = naglowki[c] || {}, k = L.kolor(n.k);
    h += `<td class="c ${k !== -1 ? "kol" : ""}" data-r="1" data-c="${c}" style="${k !== -1 ? `background:${hex(k)}` : ""}">${n.m ? `<span class="km" title="${esc(n.m)}"></span>` : ""}<input class="txt" value="${esc(n.t ?? "")}" data-r="1" data-c="${c}" list="dostList" aria-label="${kolLit(c)}1 dostawca"></td>`;
  }
  h += `<td class="plus" rowspan="1"><button class="btn sm" id="aDodajKol" title="Dodaj kolumnę dostawcy">+</button></td></tr>`;
  for (let i = 0; i < nW; i++) {
    const w = E.wiersze[i] || { a: "", c: {} }, r = i + 2, kA = L.kolor(w.k);
    const skr = L.skrajneCeny(w, 30);
    h += `<tr><td class="rn">${r}</td><td class="a ${kA !== -1 ? "kol" : ""}" data-r="${r}" data-c="1" style="${kA !== -1 ? `background:${hex(kA)}` : ""}">${w.m ? `<span class="km" title="${esc(w.m)}"></span>` : ""}<textarea rows="1" data-r="${r}" data-c="1" aria-label="A${r}">${esc(w.a)}</textarea></td>`;
    for (let c = 2; c <= ostK; c++) {
      const cel = w.c?.[c], kc = L.kolor(cel?.k), cls = skr.min.has(c) ? "min" : skr.max.has(c) ? "max" : "";
      const txt = cel && typeof cel.v !== "number" && !cel.f;
      h += `<td class="c ${cls} ${kc !== -1 && !cls ? "kol" : ""}" data-r="${r}" data-c="${c}" style="${kc !== -1 && !cls ? `background:${hex(kc)}` : ""}">${cel?.m ? `<span class="km" title="${esc(cel.m)}"></span>` : ""}<input class="${txt ? "txt" : ""}" value="${esc(wartWyswietl(cel, c))}" data-r="${r}" data-c="${c}" inputmode="decimal" aria-label="${kolLit(c)}${r}"></td>`;
    }
    h += `<td></td></tr>`;
  }
  h += `</tbody></table><datalist id="dostList">${(U.dostawcy || []).map(d => `<option value="${esc(L.LC(d.dostawca))}">`).join("")}</datalist>`;
  g.innerHTML = h;
  g.style.scrollPaddingLeft = (34 + szerA) + "px"; g.style.scrollPaddingTop = "34px";   // aktywna komórka nie chowa się pod kolumną A ani nagłówkiem
  g.querySelectorAll("textarea").forEach(autoH);
  legenda();
  status();
  $("aDodajKol").onclick = () => { const c = L.ostKolumna(E) + 1; E.naglowki = E.naglowki || {}; E.naglowki[Math.max(c, 2)] = { t: "" }; zmiana(); rysujArkusz(); g.querySelector(`input[data-r="1"][data-c="${Math.max(c, 2)}"]`)?.focus(); };
}
// autodopasowanie: ok. 8,6 px na znak + marginesy
function szerKol(znakow, min, max) { return Math.min(max, Math.max(min, Math.round(znakow * 8.6 + 30))); }
// w trakcie pisania kolumna rośnie, gdy tekst się nie mieści
document.addEventListener("input", e => {
  const el = e.target.closest?.("table.ark input"); if (!el) return;
  const c = +el.dataset.c, th = el.closest("table").querySelectorAll("thead th")[c];
  if (!th || c < 2) return;
  const w = szerKol(el.value.length, 160, 320);
  if (w > th.offsetWidth) { th.style.width = w + "px"; th.style.minWidth = w + "px"; }
});
function legenda() {
  const el = $("aLegenda"); if (!el) return;
  const wyb = Object.entries(E.naglowki || {}).filter(([, h]) => L.kolor(h.k) !== -1);
  el.innerHTML = `<span><span class="sw" style="background:var(--min-bg)"></span>najniższa cena w wierszu</span><span><span class="sw" style="background:var(--max-bg)"></span>najwyższa</span>` +
    (wyb.length ? wyb.map(([c, h]) => `<span><span class="sw" style="background:${hex(h.k)}"></span>${esc(h.t || kolLit(+c))}: ${E.wiersze.filter(w => L.kolor(w.k) === L.kolor(h.k)).length} poz.</span>`).join("") : `<span>nie wybrano jeszcze dostawców</span>`);
}
function status(t) { const s = $("aStatus"); if (s) s.textContent = t ?? (eDirty ? "niezapisane…" : `zapisano · wersja ${eWersja}`); }
const autoH = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
function wiersz(r) { while (E.wiersze.length < r - 1) E.wiersze.push({ a: "", c: {} }); return E.wiersze[r - 2]; }
function przytnij() { while (E.wiersze.length && !E.wiersze.at(-1).a && !Object.keys(E.wiersze.at(-1).c || {}).length && L.kolor(E.wiersze.at(-1).k) === -1 && !E.wiersze.at(-1).m) E.wiersze.pop(); }
function ustawKomorke(r, c, tekst) {
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
function zmiana() { eDirty = true; status(); clearTimeout(eTimer); eTimer = setTimeout(zapiszArkusz, 800); }
async function zapiszArkusz() {
  clearTimeout(eTimer);
  if (!eDirty || !E) return;
  if (eZapis) return eZapis;
  przytnij();
  const dane = { nazwa: E.nazwa, kod: E.kod ?? "", kodM: E.kodM, dataZap: E.dataZap, naglowki: E.naglowki || {}, wiersze: E.wiersze, numer: E.numer ?? null, rok: E.rok ?? null, kolejnosc: E.kolejnosc ?? 0 };
  eDirty = false; status("zapisywanie…");
  eZapis = zapiszDok(C.z, eId, dane, { typ: "zapytanie", etykieta: E.nazwa, diffFn: diffZap, wersja: eWersja })
    .then(r => {
      if (r.conflict) { eDirty = true; konflikt(r.conflict); return; }
      if (r.gone) { toast("To zapytanie zostało usunięte"); return go("zapytania"); }
      eWersja = r.wersja || eWersja; status();
    }).catch(x => { eDirty = true; failed(x); status("błąd zapisu"); }).finally(() => { eZapis = null; if (eDirty && !document.querySelector(".konflikt")) zmiana(); });
  return eZapis;
}
async function zapiszTeraz() {
  if (document.activeElement && document.activeElement.closest?.("table.ark")) document.activeElement.blur();
  if (genDirty) await zapiszGenerator(G, null, "edycja listy");
  if (eDirty) await zapiszArkusz();
  if (eZapis) await eZapis;
}
async function konflikt(cur) {
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
  if (r >= 2 && c >= 2) el.value = wartEdycja(E.wiersze[r - 2]?.c?.[c]);
  if (!wybor) pokazPasek(el, r, c);
});
document.addEventListener("focusout", e => {
  const el = e.target.closest?.("table.ark input, table.ark textarea"); if (!el || !E) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  const przed = JSON.stringify(E);
  const stara = r >= 2 && c >= 2 ? wartEdycja(E.wiersze[r - 2]?.c?.[c]) : null;
  if (r >= 2 && c >= 2 && el.value === stara) { el.value = wartWyswietl(E.wiersze[r - 2]?.c?.[c], c); return; }
  ustawKomorke(r, c, el.value);
  if (JSON.stringify(E) !== przed) { zmiana(); if (r >= 2) { const pos = { r, c }; setTimeout(() => { if (!document.activeElement?.closest?.("table.ark")) rysujArkusz(); else odswiezWiersz(pos.r); }, 0); } }
  else if (r >= 2 && c >= 2) el.value = wartWyswietl(E.wiersze[r - 2]?.c?.[c], c);
  setTimeout(() => { if (!document.activeElement?.closest?.("table.ark, #cellbar")) $("cellbar").hidden = true; }, 150);
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
    if (cel2) { cel2.focus(); cel2.select?.(); } else el.blur();     // od razu – żeby nie zgubić znaków przy szybkim pisaniu
  }
});
function odswiezWiersz(r) {
  // po zmianie ceny: kolory min/max w wierszu
  const g = $("aGrid"); if (!g) return;
  const w = E.wiersze[r - 2] || { c: {} }, skr = L.skrajneCeny(w, 30);
  g.querySelectorAll(`td.c[data-r="${r}"]`).forEach(td => {
    const c = +td.dataset.c, cel = w.c?.[c], kc = L.kolor(cel?.k);
    td.classList.toggle("min", skr.min.has(c)); td.classList.toggle("max", skr.max.has(c));
    const cls = skr.min.has(c) || skr.max.has(c);
    td.classList.toggle("kol", kc !== -1 && !cls); td.style.background = kc !== -1 && !cls ? hex(kc) : "";
    const inp = td.querySelector("input"); if (inp && document.activeElement !== inp) { inp.value = wartWyswietl(cel, c); inp.classList.toggle("txt", !!cel && typeof cel.v !== "number" && !cel.f); }
  });
  legenda();
}
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
function wybierzDostawce(r, c) {
  const w = wiersz(r); if (!L.vbaTrim(w.a)) return toast("W tym wierszu nie ma pozycji");
  const n = E.naglowki?.[c];
  if (!n || !L.vbaTrim(n.t)) return toast("Kolumna nie ma nazwy dostawcy w wierszu 1");
  if (L.kolor(n.k) === -1) { const uzyte = new Set(Object.values(E.naglowki).map(h => L.kolor(h.k))); n.k = PALETA.find(p => !uzyte.has(p)) || PALETA[0]; }
  if (L.kolor(w.k) === L.kolor(n.k)) return;
  w.k = n.k;
  zmiana(); rysujArkusz();
  toast(`${L.vbaTrim(w.a).slice(0, 40)} → ${n.t}`);
}
async function paletaNaglowka(c) {
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
  } else if (r.v === "brak") {
    E.wiersze.forEach(w => { if (L.kolor(w.k) === stary) delete w.k; Object.values(w.c || {}).forEach(x => { if (L.kolor(x.k) === stary) delete x.k; }); });
    delete n.k;
  } else return;
  zmiana(); rysujArkusz();
}
// pasek przy komórce: komentarz, wiersze, kolumny
function pokazPasek(el, r, c) {
  const bar = $("cellbar"), rc = el.getBoundingClientRect();
  const btn = [`<button class="btn sm" data-a="kom">Komentarz</button>`];
  if (r >= 2 && c >= 2 && L.vbaTrim(E.wiersze[r - 2]?.a || "") && L.vbaTrim(E.naglowki?.[c]?.t || "")) btn.unshift(`<button class="btn sm primary" data-a="wybierz">Wybierz tego dostawcę</button>`);
  if (r >= 2 && c === 1 && L.kolor(E.wiersze[r - 2]?.k) !== -1) btn.unshift(`<button class="btn sm" data-a="bezWyboru">Usuń wybór dostawcy</button>`);
  if (r >= 2 && c === 1) btn.push(`<button class="btn sm" data-a="wstawW">Wstaw wiersz nad</button>`, `<button class="btn sm" data-a="usunW">Usuń wiersz</button>`);
  if (r === 1 && c >= 2) btn.push(`<button class="btn sm" data-a="wstawK">Wstaw kolumnę przed</button>`, `<button class="btn sm" data-a="usunK">Usuń kolumnę</button>`);
  if (r >= 2 && c >= 2 && L.kolor(E.wiersze[r - 2]?.c?.[c]?.k) !== -1) btn.push(`<button class="btn sm" data-a="bezKol">Usuń kolor komórki</button>`);
  bar.innerHTML = btn.join("");
  bar.hidden = false;
  const top = rc.top - bar.offsetHeight - 6;
  bar.style.top = (top < 8 ? rc.bottom + 6 : top) + "px";
  bar.style.left = Math.max(8, Math.min(rc.left, innerWidth - bar.offsetWidth - 8)) + "px";
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
async function usunZapytanie() {
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
async function zmienNazwe() {
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
function eksportArkusza(z) {
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
  XLSX.writeFile(wb, `${z.nazwa}.xlsx`);
}

/* ============================================================ pytania makra (długość, paczka, grubość, arkusz) */
// liczy fn(ctx); gdy brakuje odpowiedzi – pyta w jednym oknie i liczy ponownie
async function zPytaniami(fn) {
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
        zapiszUst("wagi", { rows: W.rows, pamiec }, "WAGI", zm).catch(failed); W = { ...W, pamiec };
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
async function renderWaga() {
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
const projById = id => P.find(p => p._id === id);
async function kosztDlaZapytania(z) {
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
let ostatniKoszt = null;
async function renderKoszt() {
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
    <div class="toolbar"><button class="btn primary" id="kPdf">Generuj do PDF</button></div></div>
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
  $("kPdf").onclick = async () => {
    try { const pdf = await import("./pdf.js?v=202611061353"); const { blob, nazwa } = await pdf.kosztPDF(ostatniKoszt); pobierzPlik(nazwa, blob); }
    catch (x) { console.error(x); toast("Nie udało się zrobić PDF: " + (x.message || x)); }
  };
}

/* ============================================================ projekty */
function renderProjekty() {
  const nazwy = Z.map(z => z.nazwa);
  const lista = P.filter(p => L.projektZywy(p, nazwy)).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.id).localeCompare(String(a.id), "pl", { numeric: true }));
  M().innerHTML = `<div class="panel"><div class="hd"><h2>Projekty (koszt materiału)</h2><span class="small">Projekt powstaje przy tworzeniu zapytania z generatora. Dla starszych zapytań: otwórz zapytanie → „Koszt projektu”.</span></div>
    <div class="tablebox"><table class="t"><thead><tr><th>PROJEKT (ZAPYTANIE)</th><th>KOD KLIENTA</th><th>DATA</th><th class="num">POZYCJI</th><th class="num">ZAPYTANO</th><th>ARKUSZE ZAPYTAŃ</th></tr></thead><tbody>
    ${lista.map(p => `<tr class="click" data-id="${p._id}"><td class="mono strong">${esc(p.id)}</td><td>${esc(p.kod)}</td><td>${fD(p.data)}</td><td class="num">${p.pozycje.length}</td><td class="num">${p.pozycje.filter(x => x.zapytano === "TAK").length}</td><td>${esc([...new Set(p.pozycje.map(x => x.ark).filter(Boolean))].join(", "))}</td></tr>`).join("")}</tbody></table></div>
    ${lista.length ? "" : `<div class="empty"><strong>Brak projektów</strong></div>`}</div>`;
  M().querySelector("tbody").onclick = e => { const tr = e.target.closest("tr[data-id]"); if (tr) go("koszt", tr.dataset.id); };
}
let sprzatanie = false;
async function sprzatnijProjekty() {
  if (sprzatanie || !zaladowane.z || !zaladowane.p) return;
  const nazwy = Z.map(z => z.nazwa), martwe = P.filter(p => !L.projektZywy(p, nazwy));
  if (!martwe.length) return;
  sprzatanie = true;
  const logId = B.newId(C.log);
  try { await B.tx(async t => { martwe.forEach(p => t.del(C.p, p._id)); t.set(C.log, logId, wpis("projekt", "", martwe.map(p => p.id).join(", "), "usunięcie", [{ p: "dane projektu bez zapytania", a: martwe.map(p => p.id).join(", "), b: "" }])); }); }
  catch (x) { console.warn(x); } finally { sprzatanie = false; }
}

/* ============================================================ ceny (baza cen kupionych) */
let CEN = [], cenyMeta = null, cenySub = false, cenyZal = false;
const cenyStan = { tab: "wyroby", q: "", grupa: "", gat: "", zr: { lista: true, zakup: true, zapytanie: true }, otwarty: "", rok: new Date().getFullYear(), qRok: "", po: "grupa", miara: "zlKg", wyb: [] };
function startCeny() {
  if (cenySub) return; cenySub = true;
  subs.push(B.watch(C.c, a => { CEN = a; cenyZal = true; poZmianieDanych("c"); }, x => console.warn(x)));
  subs.push(B.watchDoc(C.u, "ceny", d => { cenyMeta = d; poZmianieDanych("c"); }, () => {}));
}
const ctxCen = () => ({ wagi: L.slownikWag(W), pamiec: W.pamiec || {} });
const jmZnane = () => { const m = {}; for (const p of P) for (const x of p.pozycje || []) if (x.symbol && x.jm) m[x.symbol] = x.jm; for (const x of G.wiersze || []) if (x.symbol && x.jm) m[x.symbol] = x.jm; return m; };
const ZRODLA = { lista: "lista z Subiekta", zakup: "zakup (Subiekt)", zapytanie: "zapytanie" };
const zlN = v => v === null || v === undefined ? "–" : fmt(v, 2);
let cenyCache = null;
function punktyCen() {
  const klucz = `${CEN.length}|${Z.length}|${P.length}|${W.rows.length}|${CEN.reduce((s, d) => s + (d.historia?.length || 0) + (d.status || "").length + (d.jm || "").length, 0)}|${Z.reduce((s, z) => s + (z.wersja || 0), 0)}`;
  if (cenyCache?.klucz === klucz) return cenyCache.p;
  const p = CE.zbierzCeny({ lista: CEN.filter(d => d.status !== "sprawdz"), projekty: P, zapytania: Z }, ctxCen());
  cenyCache = { klucz, p }; return p;
}
function renderCeny() {
  startCeny();
  if (!cenyZal) { M().innerHTML = `<div class="empty">Wczytywanie bazy cen…</div>`; return; }
  const wszystkie = punktyCen();
  const pk = wszystkie.filter(p => cenyStan.zr[p.zrodlo]);
  const spr = CEN.filter(d => d.status === "sprawdz");
  M().innerHTML = `
  <div class="panel"><div class="hd"><div><h2>Ceny materiałów</h2><span class="small">Tylko ceny kupione: lista z Subiekta (cena ewidencyjna z ostatniej dostawy), ceny zakupu z eksportów Subiekta i dostawcy wybrani kolorem w zapytaniach. Każda cena przeliczona na zł/kg, zł/mb i zł/szt.</span></div>
    <div class="toolbar"><label class="btn primary filebtn">Wgraj listę z Subiekta<input type="file" id="cFile" accept=".xlsx,.xls,.csv"></label></div></div>
    <div class="bd small">${cenyMeta ? `Ostatnio wgrana lista: <b>${esc(cenyMeta.plik)}</b> · ${fDT(cenyMeta.kiedy)} · ${esc(cenyMeta.opis || "")}` : "Lista jeszcze nie była wgrywana."} · W bazie: <b>${new Set(wszystkie.map(p => p.wyrob)).size}</b> wyrobów, <b>${wszystkie.length}</b> cen.</div>
    <div class="bd"><div class="seg" id="cTab">${[["wyroby", "Wyroby"], ["rok", "Zestawienie roczne"], ["spr", `Do sprawdzenia (${spr.length})`]].map(([k, t]) => `<button data-t="${k}" aria-pressed="${cenyStan.tab === k}">${t}</button>`).join("")}</div>
      <span class="toolbar" style="display:inline-flex;margin-left:12px">${Object.entries(ZRODLA).map(([k, t]) => `<label class="chk small"><input type="checkbox" data-zr="${k}" ${cenyStan.zr[k] ? "checked" : ""}> ${t}</label>`).join(" ")}</span></div>
  </div>
  <div id="cWidok"></div>`;
  $("cTab").onclick = e => { const b = e.target.closest("button"); if (b) { cenyStan.tab = b.dataset.t; renderCeny(); } };
  M().querySelectorAll("[data-zr]").forEach(c => c.onchange = () => { cenyStan.zr[c.dataset.zr] = c.checked; renderCeny(); });
  $("cFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) wgrajListeCen(f); };
  if (cenyStan.tab === "wyroby") cenyWyroby(pk);
  else if (cenyStan.tab === "rok") cenyRok(pk);
  else cenySprawdz(spr);
}
function cenyWyroby(pk) {
  const S = CE.podsumowanie(pk);
  const grupy = [...new Set(S.map(s => s.grupa))].sort(), gaty = [...new Set(S.map(s => s.gat).filter(Boolean))].sort();
  const q = L.LC(cenyStan.q);
  const lista = S.filter(s => (!cenyStan.grupa || s.grupa === cenyStan.grupa) && (!cenyStan.gat || s.gat === cenyStan.gat) && (!q || L.LC(s.opis + " " + s.punkty.map(p => p.nazwa).join(" ")).includes(q.replace(/\s+/g, " "))));
  $("cWidok").innerHTML = `<div class="panel"><div class="hd"><div class="toolbar"><input type="search" id="cQ" placeholder="Szukaj: 100x100x3, IPE 300, pręt 16…" value="${esc(cenyStan.q)}" style="width:280px">
      <select id="cGr"><option value="">Wszystkie grupy</option>${grupy.map(g => `<option ${g === cenyStan.grupa ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
      <select id="cGat"><option value="">Każdy gatunek</option>${gaty.map(g => `<option ${g === cenyStan.gat ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
      <div class="toolbar"><span class="small">${lista.length} wyrobów</span><button class="btn" id="cXls">Pobierz jako Excel</button></div></div>
    <div class="tablebox"><table class="t" style="min-width:1100px"><thead><tr><th>WYRÓB</th><th>GRUPA</th><th class="num">zł/kg</th><th class="num">zł/mb</th><th class="num">zł/szt</th><th>KIEDY</th><th>SKĄD</th><th class="num">12 MIES. zł/kg</th><th class="num">ZMIANA</th><th class="num">CEN</th></tr></thead><tbody id="cRows">
    ${lista.slice(0, 400).map(s => { const o = s.ostKg || s.ost;
      return `<tr class="click" data-w="${esc(s.wyrob)}"><td class="strong">${esc(s.opis)}</td><td>${esc(s.grupa)}</td><td class="num strong">${zlN(o.zlKg)}</td><td class="num">${zlN(o.zlMb)}</td><td class="num">${zlN(o.zlSzt)}${o.zlSzt !== null && o.dl ? `<div class="small">${o.blacha ? "arkusz" : L.ogolny(o.dl) + " m"}</div>` : ""}</td>
        <td class="mono">${fD(o.data)}${o.szac ? ' <span class="small" title="data szacowana z numeru zapytania">~</span>' : ""}</td><td>${esc(ZRODLA[o.zrodlo])}${o.dostawca ? `<div class="small">${esc(o.dostawca)}</div>` : ""}</td>
        <td class="num">${s.minRok !== null ? (s.minRok === s.maxRok ? zlN(s.minRok) : zlN(s.minRok) + " – " + zlN(s.maxRok)) : "–"}</td>
        <td class="num ${s.zmiana > 0.005 ? "red" : ""}" style="${s.zmiana < -0.005 ? "color:var(--ok)" : ""}">${s.zmiana === null ? "" : (s.zmiana > 0 ? "▲ +" : s.zmiana < 0 ? "▼ " : "") + fmt(s.zmiana * 100, 1) + "%"}</td><td class="num">${s.ile}</td></tr>
        ${cenyStan.otwarty === s.wyrob ? `<tr><td colspan="10" style="background:var(--sunk)">${szczegolyWyrobu(s)}</td></tr>` : ""}`; }).join("")}
    </tbody></table></div>${lista.length ? "" : `<div class="empty"><strong>Brak cen</strong><span>Wgraj listę z Subiekta albo zaznacz kolorem dostawców w zapytaniach.</span></div>`}</div>`;
  $("cQ").oninput = e => { cenyStan.q = e.target.value; const pos = e.target.selectionStart; cenyWyroby(pk); $("cQ").focus(); $("cQ").setSelectionRange(pos, pos); };
  $("cGr").onchange = e => { cenyStan.grupa = e.target.value; cenyWyroby(pk); };
  $("cGat").onchange = e => { cenyStan.gat = e.target.value; cenyWyroby(pk); };
  $("cRows").onclick = e => { if (e.target.closest("a,button,.wyk")) return; const tr = e.target.closest("tr[data-w]"); if (!tr) return; cenyStan.otwarty = cenyStan.otwarty === tr.dataset.w ? "" : tr.dataset.w; cenyWyroby(pk); };
  $("cXls").onclick = () => {
    const rows = lista.map(s => { const o = s.ostKg || s.ost; return { "Wyrób": s.opis, "Grupa": s.grupa, "Gatunek": s.gat, "zł/kg": o.zlKg && +o.zlKg.toFixed(2), "zł/mb": o.zlMb && +o.zlMb.toFixed(2), "zł/szt": o.zlSzt && +o.zlSzt.toFixed(2), "Długość [m]": o.dl || "", "Kiedy": o.data, "Data szacunkowa": o.szac ? "tak" : "", "Skąd": ZRODLA[o.zrodlo], "Dostawca": o.dostawca, "Pozycja": o.nazwa, "Min 12 mies. zł/kg": s.minRok && +s.minRok.toFixed(2), "Max 12 mies. zł/kg": s.maxRok && +s.maxRok.toFixed(2) }; });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Ceny"); XLSX.writeFile(wb, `ceny-materialow-${today()}.xlsx`);
  };
}
function szczegolyWyrobu(s) {
  const pkt = s.punkty.filter(p => p.zlKg !== null);
  // serie: źródła/dostawcy – najwyżej 4, reszta jako „inni”
  const nazwaSerii = p => p.zrodlo === "zapytanie" ? (p.dostawca || "zapytanie") : ZRODLA[p.zrodlo];
  const liczn = new Map(); pkt.forEach(p => liczn.set(nazwaSerii(p), (liczn.get(nazwaSerii(p)) || 0) + 1));
  const top = [...liczn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const serie = new Map();
  for (const p of pkt) { const n = top.includes(nazwaSerii(p)) || liczn.size <= 4 ? nazwaSerii(p) : "inni dostawcy"; (serie.get(n) || serie.set(n, []).get(n)).push(p); }
  return `<div class="grid2" style="align-items:start"><div>${wykresCen([...serie].map(([nazwa, p]) => ({ nazwa, punkty: p.map(x => ({ d: x.data, y: x.zlKg, t: `${fD(x.data)}${x.szac ? " (szac.)" : ""} · ${nazwa} · ${fmt(x.zlKg, 2)} zł/kg · ${x.nazwa}` })) })), "zł/kg")}</div>
    <div class="tablebox" style="max-height:320px;overflow:auto"><table class="t"><thead><tr><th>KIEDY</th><th>SKĄD</th><th>POZYCJA</th><th class="num">CENA</th><th class="num">zł/kg</th><th class="num">zł/mb</th><th class="num">zł/szt</th></tr></thead><tbody>
    ${[...s.punkty].reverse().map(p => `<tr><td class="mono">${fD(p.data)}${p.szac ? "~" : ""}</td><td>${esc(ZRODLA[p.zrodlo])}${p.dostawca ? " · " + esc(p.dostawca) : ""}${p.zapytanie && p.zrodlo === "zapytanie" ? `<div class="small">${esc(p.zapytanie)}</div>` : ""}</td><td class="small">${esc(p.nazwa)}${p.symbol ? ` <span class="mono">${esc(p.symbol)}</span>` : ""}</td>
      <td class="num">${fmt(p.cena, 2)} zł/${esc(p.jm)}</td><td class="num">${zlN(p.zlKg)}</td><td class="num">${zlN(p.zlMb)}</td><td class="num">${zlN(p.zlSzt)}</td></tr>`).join("")}</tbody></table></div></div>`;
}
// wykres liniowy cen w czasie – jedna oś, kolory serii w stałej kolejności, podpowiedź po najechaniu
function wykresCen(serie, jedn, opcje = {}) {
  const wszystkie = serie.flatMap(s => s.punkty).filter(p => p.y !== null);
  if (!wszystkie.length) return `<div class="empty small">Brak danych do wykresu</div>`;
  const Wd = 560, H = 240, ml = 48, mr = 14, mt = 14, mb = 28;
  const czas = p => opcje.miesiace ? p.d : Date.parse(p.d);
  let x0 = Math.min(...wszystkie.map(czas)), x1 = Math.max(...wszystkie.map(czas));
  if (opcje.miesiace) { x0 = 0; x1 = 11; } else if (x0 === x1) { x0 -= 15 * 864e5; x1 += 15 * 864e5; }
  let y0 = Math.min(...wszystkie.map(p => p.y)), y1 = Math.max(...wszystkie.map(p => p.y));
  const pad = (y1 - y0) * 0.15 || y1 * 0.1 || 1; y0 = Math.max(0, y0 - pad); y1 = y1 + pad;
  const krok = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find(k => (y1 - y0) / k <= 5) || 1000;
  y0 = Math.floor(y0 / krok) * krok; y1 = Math.ceil(y1 / krok) * krok;
  const X = t => ml + (t - x0) / ((x1 - x0) || 1) * (Wd - ml - mr), Y = v => mt + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - mt - mb);
  let g = "";
  for (let v = y0; v <= y1 + 1e-9; v += krok) g += `<line x1="${ml}" x2="${Wd - mr}" y1="${Y(v)}" y2="${Y(v)}" class="wg"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end" class="wt">${fmt(v, krok < 1 ? 2 : 0)}</text>`;
  if (opcje.miesiace) ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].forEach((m, i) => g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="wt">${m}</text>`);
  else { const n = 4; for (let i = 0; i <= n; i++) { const t = x0 + (x1 - x0) * i / n, d = new Date(t); g += `<text x="${X(t)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === n ? "end" : "middle"}" class="wt">${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}</text>`; } }
  serie.forEach((s, i) => {
    const pts = s.punkty.filter(p => p.y !== null).sort((a, b) => czas(a) - czas(b));
    const kol = `var(--s${(i % 8) + 1})`;
    if (pts.length > 1) g += `<polyline fill="none" stroke="${kol}" stroke-width="2" stroke-linejoin="round" points="${pts.map(p => `${X(czas(p))},${Y(p.y)}`).join(" ")}"/>`;
    pts.forEach(p => g += `<circle cx="${X(czas(p))}" cy="${Y(p.y)}" r="4" fill="${kol}" stroke="var(--surface)" stroke-width="2"/><circle cx="${X(czas(p))}" cy="${Y(p.y)}" r="11" fill="transparent" class="wk-hit"><title>${esc(p.t)}</title></circle>`);
  });
  const leg = serie.length > 1 ? `<div class="legend" style="margin-top:4px">${serie.map((s, i) => `<span><span class="sw" style="background:var(--s${(i % 8) + 1})"></span>${esc(s.nazwa)}</span>`).join("")}</div>` : `<div class="small">${esc(serie[0].nazwa)}</div>`;
  return `<div class="wyk"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Ceny w ${jedn}" style="width:100%;height:auto;max-width:${Wd}px">${g}<text x="${ml}" y="10" class="wt">${jedn}</text></svg>${leg}</div>`;
}
const pad2 = n => String(n).padStart(2, "0");
function cenyRok(pk) {
  const lata = [...new Set(pk.map(p => +String(p.data).slice(0, 4)))].filter(Boolean).sort((a, b) => b - a);
  if (!lata.includes(+cenyStan.rok) && lata.length) cenyStan.rok = lata[0];
  const Zs = CE.zestawienieRoku(pk, cenyStan.rok, cenyStan.po, cenyStan.miara);
  const q = L.LC(cenyStan.qRok);
  const lista = Zs.filter(z => !q || L.LC(z.nazwa).includes(q));
  cenyStan.wyb = cenyStan.wyb.filter(n => lista.some(z => z.nazwa === n));
  const naWykres = (cenyStan.wyb.length ? lista.filter(z => cenyStan.wyb.includes(z.nazwa)) : lista.slice().sort((a, b) => b.ile - a.ile).slice(0, 4));
  const jed = cenyStan.miara === "zlKg" ? "zł/kg" : "zł/mb";
  $("cWidok").innerHTML = `<div class="panel"><div class="hd"><div class="toolbar">
      <label class="small">Rok <select id="rRok">${lata.map(r => `<option ${r === +cenyStan.rok ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <div class="seg" id="rPo"><button data-v="grupa" aria-pressed="${cenyStan.po === "grupa"}">Grupy (typ + gatunek)</button><button data-v="wyrob" aria-pressed="${cenyStan.po === "wyrob"}">Wyroby</button></div>
      <div class="seg" id="rMi"><button data-v="zlKg" aria-pressed="${cenyStan.miara === "zlKg"}">zł/kg</button><button data-v="zlMb" aria-pressed="${cenyStan.miara === "zlMb"}">zł/mb</button></div>
      <input type="search" id="rQ" placeholder="Filtruj…" value="${esc(cenyStan.qRok)}" style="width:180px"></div>
      <button class="btn" id="rXls">Pobierz jako Excel</button></div>
    <div class="bd">${wykresCen(naWykres.map(z => ({ nazwa: z.nazwa, punkty: z.mies.map((v, i) => ({ d: i, y: v, t: `${z.nazwa} · ${["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"][i]} · ${v === null ? "" : fmt(v, 2) + " " + jed}` })) })), jed, { miesiace: true })}
      <div class="small">Średnia cena w miesiącu. Na wykresie ${cenyStan.wyb.length ? "zaznaczone wiersze" : "4 pozycje z największą liczbą cen"} – zaznacz w tabeli (najwyżej 4), żeby porównać inne. Daty starych zapytań są szacowane z numeru.</div></div>
    <div class="tablebox"><table class="t" style="min-width:1200px"><thead><tr><th></th><th>${cenyStan.po === "grupa" ? "GRUPA" : "WYRÓB"}</th>${["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"].map(m => `<th class="num">${m}</th>`).join("")}<th class="num">CEN</th></tr></thead><tbody id="rRows">
    ${lista.map(z => `<tr><td><input type="checkbox" data-n="${esc(z.nazwa)}" ${cenyStan.wyb.includes(z.nazwa) ? "checked" : ""} aria-label="pokaż na wykresie"></td><td class="strong">${esc(z.nazwa)}</td>${z.mies.map(v => `<td class="num">${v === null ? "<span class='small'>–</span>" : fmt(v, 2)}</td>`).join("")}<td class="num">${z.ile}</td></tr>`).join("")}
    </tbody></table></div>${lista.length ? "" : `<div class="empty">Brak cen w ${cenyStan.rok}</div>`}</div>`;
  $("rRok").onchange = e => { cenyStan.rok = +e.target.value; cenyRok(pk); };
  $("rPo").onclick = e => { const b = e.target.closest("button"); if (b) { cenyStan.po = b.dataset.v; cenyStan.wyb = []; cenyRok(pk); } };
  $("rMi").onclick = e => { const b = e.target.closest("button"); if (b) { cenyStan.miara = b.dataset.v; cenyRok(pk); } };
  $("rQ").oninput = e => { cenyStan.qRok = e.target.value; const pos = e.target.selectionStart; cenyRok(pk); $("rQ").focus(); $("rQ").setSelectionRange(pos, pos); };
  $("rRows").onchange = e => { const n = e.target.dataset.n; if (n === undefined) return; if (e.target.checked) { if (cenyStan.wyb.length >= 4) { e.target.checked = false; return toast("Na wykresie najwyżej 4 pozycje"); } cenyStan.wyb.push(n); } else cenyStan.wyb = cenyStan.wyb.filter(x => x !== n); cenyRok(pk); };
  $("rXls").onclick = () => {
    const M12 = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    const rows = lista.map(z => { const o = { [cenyStan.po === "grupa" ? "Grupa" : "Wyrób"]: z.nazwa }; z.mies.forEach((v, i) => o[M12[i]] = v === null ? "" : +v.toFixed(2)); o["Cen"] = z.ile; return o; });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `${cenyStan.rok} ${jed.replace("/", " na ")}`); XLSX.writeFile(wb, `zestawienie-cen-${cenyStan.rok}.xlsx`);
  };
}
function cenySprawdz(spr) {
  $("cWidok").innerHTML = `<div class="panel"><div class="hd"><h3>Do sprawdzenia</h3><span class="small">Te pozycje nie wchodzą do zestawień, dopóki nie wskażesz, za co jest cena – albo ich nie pominiesz.</span></div>
    <div class="tablebox"><table class="t" style="min-width:900px"><thead><tr><th>SYMBOL</th><th>NAZWA</th><th class="num">CENA</th><th>POWÓD</th><th>CENA JEST ZA</th></tr></thead><tbody id="sRows">
    ${spr.map(d => `<tr data-id="${esc(d._id)}"><td class="mono">${esc(d.symbol)}</td><td>${esc(d.nazwa)}</td><td class="num">${fmt(d.historia?.at(-1)?.c, 2)}</td><td class="small">${esc(d.powod || d.skad || "")}</td>
      <td class="toolbar">${["kg", "szt", "mb"].map(j => `<button class="btn sm" data-jm="${j}">${j}</button>`).join("")}<button class="btn sm" data-jm="pomin">Pomiń</button></td></tr>`).join("")}
    </tbody></table></div>${spr.length ? "" : `<div class="empty"><strong>Nic do sprawdzenia</strong></div>`}</div>`;
  $("sRows").onclick = async e => {
    const b = e.target.closest("[data-jm]"); if (!b) return;
    const d = CEN.find(x => x._id === b.closest("tr").dataset.id), j = b.dataset.jm;
    const nowy = j === "pomin" ? { ...d, status: "pomin" } : { ...d, jm: j, skad: "ustawione ręcznie", jmRecznie: true, status: "" };
    delete nowy._id;
    if (j !== "pomin" && !CE.wyrob(d.nazwa)) return toast("Tej pozycji nie da się rozpoznać (typ i wymiar) – zostanie tylko pominięta");
    try { await zapiszUst("ceny", cenyMeta || {}, "ceny", [{ p: `${d.symbol} ${d.nazwa}`, a: "do sprawdzenia", b: j === "pomin" ? "pominięta" : "cena za " + j }]); await B.batch([{ c: C.c, id: d._id, d: czysc(nowy) }]); }
    catch (x) { failed(x); }
  };
}
async function wgrajListeCen(f) {
  let r;
  try {
    const wb = XLSX.read(await czytajPlik(f), { type: "array" });
    r = CE.czytajListe(I.tabelaPierwszegoArkusza(XLSX, wb), ctxCen(), jmZnane());
  } catch (x) { return okno(`<h3>Lista cen</h3><p>Nie udało się odczytać pliku: ${esc(x.message || x)}</p>`); }
  if (r.blad) return okno(`<h3>Lista cen</h3><p>${esc(r.blad)}</p>`);
  const dzis = today(), stare = new Map(CEN.map(d => [d._id, d]));
  const docId = s => String(s || "").replace(/\//g, "-").trim();
  const ops = []; let nowe = 0, zmiany = 0, bez = 0;
  for (const p of r.pozycje) {
    const id = docId(p.symbol) || "N-" + L.LC(p.nazwa).replace(/[^a-z0-9]+/g, "-").slice(0, 80);
    const st = stare.get(id), sprawdz = r.doSprawdzenia.includes(p);
    if (!st) { nowe++; ops.push({ c: C.c, id, d: czysc({ symbol: p.symbol, nazwa: p.nazwa, jm: p.jm, skad: p.skad, powod: p.powod, status: sprawdz ? "sprawdz" : "", historia: [{ d: dzis, c: p.cena }] }) }); continue; }
    const ost = st.historia?.at(-1);
    const zmCeny = !ost || ost.c !== p.cena;
    const jm = st.jmRecznie ? st.jm : p.jm;
    const status = st.status === "pomin" ? "pomin" : st.jmRecznie ? "" : sprawdz ? "sprawdz" : "";
    if (!zmCeny && st.nazwa === p.nazwa && st.jm === jm && (st.status || "") === status) { bez++; continue; }
    if (zmCeny) zmiany++;
    const h = [...(st.historia || [])]; if (zmCeny) { if (ost && ost.d === dzis) h[h.length - 1] = { d: dzis, c: p.cena }; else h.push({ d: dzis, c: p.cena }); }
    const { _id, ...reszta } = st;
    ops.push({ c: C.c, id, d: czysc({ ...reszta, nazwa: p.nazwa, jm, skad: st.jmRecznie ? st.skad : p.skad, powod: p.powod, status, historia: h }) });
  }
  // pozycje wcześniej zapisane, a teraz wykluczone (KT, wypałki, wózki) – wyłączone z zestawień
  let wylaczone = 0;
  for (const sym of r.wykluczoneSymbole) { const id = docId(sym), st = stare.get(id); if (st && st.status !== "pomin") { const { _id, ...reszta } = st; ops.push({ c: C.c, id, d: czysc({ ...reszta, status: "pomin", powod: "wykluczone (KT / wypałki / wózki)" }) }); wylaczone++; } }
  const opis = `${r.pozycje.length} poz. (nowe ${nowe}, zmiany cen ${zmiany}, bez zmian ${bez}${wylaczone ? `, wyłączone ${wylaczone}` : ""}); pominięte: wypałki/wózki ${r.pominiete.wypalki}, KT ${r.pominiete.kt}, duplikaty ${r.pominiete.duplikaty}, cena 0 ${r.pominiete.zero}; do sprawdzenia ${r.doSprawdzenia.length}`;
  const o = await okno(`<h3>Lista cen: ${esc(f.name)}</h3><ul>
    <li>Pozycji w pliku: <b>${r.wszystkich}</b></li><li>Pominięte: wypałki i wózki ${r.pominiete.wypalki}, oznaczenie KT ${r.pominiete.kt}, duplikaty nazw ${r.pominiete.duplikaty}, cena 0: ${r.pominiete.zero}</li>
    <li>Nowe w bazie: <b>${nowe}</b>, zmienione ceny: <b>${zmiany}</b>, bez zmian: ${bez}${wylaczone ? `, wyłączone z bazy (KT, wypałki, wózki): <b>${wylaczone}</b>` : ""}</li><li>Do sprawdzenia (jednostka niepewna, zaślepka albo nierozpoznany wyrób): <b>${r.doSprawdzenia.length}</b></li></ul>
    <p class="small">Cena dostaje dzisiejszą datę. Przy kolejnym wgraniu dopisze się tylko tam, gdzie się zmieniła.</p>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Zapisz w bazie", cls: "primary" }]);
  if (o.v !== "ok") return;
  try {
    for (let i = 0; i < ops.length; i += 450) await B.batch(ops.slice(i, i + 450));
    await zapiszUst("ceny", { plik: f.name, kiedy: new Date(), opis }, "lista cen", [{ p: "wgrano listę cen", a: "", b: `${f.name}: ${opis}` }], "wgranie listy");
    toast("Zapisano ceny");
  } catch (x) { failed(x); }
}

/* ============================================================ ustawienia */
let ustDirty = false, UE = null, WE = null, wagiQ = "";
function renderUstawienia() {
  if (!ustDirty) { UE = clone(U); WE = clone(W); }
  const pole = (k, l, opis, typ = "text") => `<label>${l}<input data-u="${k}" value="${esc(UE[k] ?? "")}" ${typ === "tn" ? 'list="tnList"' : ""}><span class="small">${opis}</span></label>`;
  const wagiF = WE.rows.map((r, i) => [r, i]).filter(([r]) => !wagiQ || L.LC(`${r.t} ${r.w} ${r.o} ${r.u}`).includes(L.LC(wagiQ)));
  M().innerHTML = `
  <div class="panel"><div class="hd"><div><h3>Dziennik zmian</h3><span class="small">Kto, kiedy i co zmienił – także zmiany zastępcy w czasie urlopu.${isOwner && LOG.some(l => l.zast && !l.przejrzane) ? ` <b class="red">${LOG.filter(l => l.zast && !l.przejrzane).length} zmian zastępcy do przejrzenia.</b>` : ""}</span></div><a class="btn" href="#dziennik">Otwórz dziennik zmian</a></div></div>
  <div class="panel"><div class="hd"><h2>Ustawienia generatora</h2><div class="toolbar"><span class="status" id="uStatus">${ustDirty ? "niezapisane zmiany" : ""}</span><button class="btn primary" id="uZapisz" ${ustDirty ? "" : "disabled"}>Zapisz ustawienia</button></div></div>
    <div class="bd grid3">
      ${pole("prog", "Brak, gdy Niezarezerwowane ≤", "Pozycja trafia do zapytania, gdy wolny stan jest równy lub mniejszy od tej liczby.")}
      ${pole("naZD", "Doliczaj ilości „Na ZD”", "TAK = to, co już zamówione u dostawcy (ZD), pomniejsza brak.", "tn")}
      ${pole("osobno", "Osobne zapytanie dla każdej grupy", "NIE = jedno zapytanie ze wszystkim. TAK = osobne zapytanie na profile, dwuteowniki itd.", "tn")}
      ${pole("krok", "Co ile wierszy kolejna pozycja", "1 = pozycje jedna pod drugą. 2 = z pustym wierszem na miasto/uwagi.")}
      ${pole("start", "Pierwszy wiersz pozycji", "W A1 zawsze trafia kod klienta.")}
      ${pole("rok", "Rok w numerze zapytania", "Puste = bieżący rok. Numer = największy „NNN-rok” + 1.")}
      ${pole("kodWNazwie", "Kod klienta w nazwie zapytania", "NIE = „151-2026” (kod tylko w A1). TAK = „151-2026 ANGA”.", "tn")}
      ${pole("temat", "Temat maila", "{NR} = 150/2026 BUDC, {NUMER} = 150/2026 (bez kodu klienta).")}
      ${pole("doKogo", "Adres w polu „Do” (opcjonalnie)", "Np. własny adres. Dostawcy zawsze idą w UDW – nie widzą się nawzajem.")}
      <label class="full">Treść maila – początek<textarea data-u="poczatek" rows="2">${esc(UE.poczatek)}</textarea></label>
      <label class="full">Treść maila – zakończenie<textarea data-u="koniec" rows="2">${esc(UE.koniec)}</textarea><span class="small">Prośba o niezmienianie tematu ułatwi później zaciąganie cen z odpowiedzi.</span></label>
    </div><datalist id="tnList"><option value="TAK"><option value="NIE"></datalist></div>
  <div class="grid2">
    ${tabelaEd("grupy", "Grupy towarowe", [["grupa", "GRUPA"], ["kolejnosc", "KOLEJNOŚĆ"], ["uwzgl", "UWZGLĘDNIAJ", "tn"], ["min", "MIN. ILOŚĆ"], ["gdyZero", "GDY BRAK = 0 WPISZ", "pk"]])}
    ${tabelaEd("slowa", "Słowa kluczowe (sprawdzane od góry – pierwsze trafienie wygrywa)", [["slowo", "SŁOWO KLUCZOWE"], ["grupa", "GRUPA", "gr"]])}
  </div>
  ${tabelaEd("dostawcy", "Dostawcy (mail w UDW)", [["dostawca", "DOSTAWCA"], ["email", "E-MAIL"], ["wysylaj", "WYSYŁAJ?", "tn"], ["osoba", "OSOBA KONTAKTOWA"]])}
  <div class="panel"><div class="hd"><h3>Jak to działa</h3></div><div class="bd small">
    • Grupa: nazwa towaru jest sprawdzana ze słowami kluczowymi od góry – pierwsze trafienie wygrywa („GWINT” jest przed „PRĘT”, więc pręt gwintowany idzie do elementów złącznych).<br>
    • Brak = −(Niezarezerwowane + Na ZD). Ilość = brak w górę, nie mniej niż MIN. ILOŚĆ.<br>
    • Wolny stan = 0: „paczka” wpisze paczkę, „szt” wpisze MIN. ILOŚĆ (0 = do uzupełnienia na żółto).<br>
    • UWZGLĘDNIAJ = NIE: pozycja jest na liście z ZAPYTAĆ? = NIE (można ręcznie zmienić).<br>
    • Mail: pozycje z kolumny A zapytania, dostawcy z WYSYŁAJ? = TAK w UDW.<br>
    • Grupy i słowa kluczowe czytane są do pierwszego pustego wiersza – nie zostawiaj pustych wierszy w środku.</div></div>
  <div class="panel"><div class="hd"><h3>Tabela wag (WAGI) – ${WE.rows.length} pozycji</h3><div class="toolbar"><input type="search" id="wQ" placeholder="Szukaj: HEA, 100x100…" value="${esc(wagiQ)}" style="width:200px"><button class="btn" id="wDodaj">+ Wiersz</button></div></div>
    <div class="bd small">TYP: PROFIL, RURA, IPE, HEA, HEB, HEM, UPN, CEOWNIK, KATOWNIK, KATOWNIKZG, PLASKOWNIK, PRET, PRETKW, PRET6K, BRAMOWY, PROFILALU, PRETGW, BLACHA i BLACHAOC (grubość w mm, waga w kg/m²). WYMIAR: liczby rozdzielone „x”, przecinek dziesiętny (np. 42,4x2). Dla dwuteowników sam numer (IPE 160 → 160).</div>
    <div class="tablebox" style="max-height:420px;overflow:auto"><table class="t ed" id="wTab"><thead><tr><th>TYP</th><th>WYMIAR</th><th>KG/MB</th><th>OPIS</th><th>UWAGI</th><th></th></tr></thead><tbody>
      ${wagiF.slice(0, 200).map(([r, i]) => `<tr data-i="${i}"><td><input data-w="t" value="${esc(r.t)}"></td><td><input data-w="w" value="${esc(r.w)}"></td><td><input data-w="kg" value="${esc(typeof r.kg === "number" ? L.ogolny(r.kg) : r.kg)}" inputmode="decimal"></td><td><input data-w="o" value="${esc(r.o)}"></td><td><input data-w="u" value="${esc(r.u)}"></td><td><button class="btn sm" data-wdel="${i}">✕</button></td></tr>`).join("")}
    </tbody></table>${wagiF.length > 200 ? `<div class="bd small">Pokazano 200 z ${wagiF.length} – zawęź wyszukiwanie.</div>` : ""}</div></div>
  <div class="panel"><div class="hd"><h3>Zapamiętane odpowiedzi (sztuki w paczce, wymiary arkuszy)</h3></div>
    <div class="tablebox"><table class="t ed"><thead><tr><th>PACZKA / ARKUSZ (typ|wymiar|dł.)</th><th>WARTOŚĆ</th><th></th></tr></thead><tbody id="pamTab">
    ${Object.entries(WE.pamiec).map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td><input data-pam="${esc(k)}" value="${esc(typeof v === "number" ? L.ogolny(v) : v)}"></td><td><button class="btn sm" data-pamdel="${esc(k)}">✕</button></td></tr>`).join("")}</tbody></table></div></div>
  ${isOwner ? `<div class="panel"><div class="hd"><h3>Import z pliku Excel</h3></div><div class="bd"><div class="drop"><b>Wgraj „Zapytania Lista 2026.xlsm”</b><span>Przeniesie wszystkie zapytania (ceny, kolory wyboru, komentarze), projekty, tabelę wag, zapamiętane paczki, listę generatora i ustawienia. Plik jest czytany w przeglądarce – nie trafia nigdzie poza bazę aplikacji.</span>
    <label class="btn primary filebtn">Wybierz plik<input type="file" id="impFile" accept=".xlsm,.xlsx"></label></div></div></div>` : ""}`;
  M().querySelectorAll("[data-u]").forEach(el => el.oninput = () => { UE[el.dataset.u] = el.value; ustZm(); });
  M().querySelectorAll("table[data-tab]").forEach(tb => {
    const k = tb.dataset.tab;
    tb.oninput = e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; UE[k][+tr.dataset.i][e.target.dataset.f] = e.target.value; ustZm(); };
    tb.onclick = e => { const b = e.target.closest("[data-akc]"); if (!b) return; const i = +b.closest("tr").dataset.i, a = b.dataset.akc, T = UE[k];
      if (a === "del") T.splice(i, 1); if (a === "up" && i > 0) [T[i - 1], T[i]] = [T[i], T[i - 1]]; if (a === "down" && i < T.length - 1) [T[i + 1], T[i]] = [T[i], T[i + 1]];
      ustZm(); renderUstawienia(); };
  });
  M().querySelectorAll("[data-dodaj]").forEach(b => b.onclick = () => { UE[b.dataset.dodaj].push({}); ustZm(); renderUstawienia(); });
  $("wQ").oninput = e => { wagiQ = e.target.value; const pos = e.target.selectionStart; renderUstawienia(); $("wQ").focus(); $("wQ").setSelectionRange(pos, pos); };
  $("wDodaj").onclick = () => { WE.rows.unshift({ t: "", w: "", kg: "", o: "", u: "" }); wagiQ = ""; ustZm(); renderUstawienia(); };
  $("wTab").oninput = e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; const f = e.target.dataset.w, v = e.target.value; WE.rows[+tr.dataset.i][f] = f === "kg" ? (L.naLiczbe(v).ok && v.trim() ? L.naLiczbe(v).w : v) : v; ustZm(); };
  $("wTab").onclick = e => { const b = e.target.closest("[data-wdel]"); if (!b) return; WE.rows.splice(+b.dataset.wdel, 1); ustZm(); renderUstawienia(); };
  $("pamTab").oninput = e => { const k = e.target.dataset.pam; if (k === undefined) return; const v = e.target.value; WE.pamiec[k] = L.naLiczbe(v).ok && /^[\d,.\s]+$/.test(v) ? L.naLiczbe(v).w : v; ustZm(); };
  $("pamTab").onclick = e => { const b = e.target.closest("[data-pamdel]"); if (!b) return; delete WE.pamiec[b.dataset.pamdel]; ustZm(); renderUstawienia(); };
  $("uZapisz").onclick = zapiszUstawienia;
  $("impFile") && ($("impFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importExcel(f); });
}
function tabelaEd(k, tytul, kol) {
  const opt = { tn: '<datalist id="tnL2"><option value="TAK"><option value="NIE"></datalist>', pk: "", gr: "" };
  return `<div class="panel"><div class="hd"><h3>${tytul}</h3><button class="btn sm" data-dodaj="${k}">+ Wiersz</button></div>
    <div class="tablebox"><table class="t ed" data-tab="${k}"><thead><tr>${kol.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
    ${(UE[k] || []).map((r, i) => `<tr data-i="${i}">${kol.map(([f, , t]) => `<td><input data-f="${f}" value="${esc(r[f] ?? "")}" ${t === "tn" ? 'list="tnL2"' : t === "pk" ? 'list="pkL"' : t === "gr" ? 'list="grL"' : ""}></td>`).join("")}
      <td class="num"><button class="btn sm" data-akc="up" title="W górę">↑</button> <button class="btn sm" data-akc="down" title="W dół">↓</button> <button class="btn sm" data-akc="del" title="Usuń">✕</button></td></tr>`).join("")}
    </tbody></table></div>${opt.tn}<datalist id="pkL"><option value="paczka"><option value="szt"></datalist><datalist id="grL">${(UE.grupy || []).map(g => `<option value="${esc(g.grupa)}">`).join("")}</datalist></div>`;
}
function ustZm() { ustDirty = true; const b = $("uZapisz"); if (b) b.disabled = false; const s = $("uStatus"); if (s) s.textContent = "niezapisane zmiany"; }
async function zapiszUstawienia() {
  const zm = [];
  for (const k of Object.keys(L.USTAWIENIA_DOMYSLNE)) {
    if (Array.isArray(UE[k])) { if (JSON.stringify(UE[k]) !== JSON.stringify(U[k])) zm.push({ p: k, a: (U[k] || []).length + " wierszy", b: UE[k].length + " wierszy" }); }
    else if (sv(UE[k]) !== sv(U[k])) zm.push({ p: k, a: sv(U[k]), b: sv(UE[k]) });
  }
  const zmW = [];
  if (JSON.stringify(WE.rows) !== JSON.stringify(W.rows)) zmW.push({ p: "tabela wag", a: W.rows.length + " poz.", b: WE.rows.length + " poz." });
  if (JSON.stringify(WE.pamiec) !== JSON.stringify(W.pamiec)) zmW.push({ p: "zapamiętane paczki/arkusze", a: Object.keys(W.pamiec).length + "", b: Object.keys(WE.pamiec).length + "" });
  try {
    if (zm.length) await zapiszUst("config", UE, "USTAWIENIA", zm);
    if (zmW.length) await zapiszUst("wagi", WE, "WAGI", zmW);
    ustDirty = false; toast("Zapisano ustawienia"); renderUstawienia();
  } catch (x) { failed(x); }
}
async function importExcel(f) {
  let D;
  try {
    const wb = XLSX.read(await czytajPlik(f), { type: "array", cellStyles: true, cellFormula: true, cellComments: true });
    D = I.czytajSkoroszyt(XLSX, wb);
  } catch (x) { return okno(`<h3>Import</h3><p>Nie udało się odczytać pliku: ${esc(x.message || x)}</p>`); }
  if (D.blad) return okno(`<h3>Import</h3><p>${esc(D.blad)}</p>`);
  const r = await okno(`<h3>Import z ${esc(f.name)}</h3><ul>
    <li>Zapytań: <b>${D.zapytania.length}</b> (z kolorami wyboru: ${D.zapytania.filter(z => Object.values(z.naglowki).some(h => L.kolor(h.k) !== -1)).length})</li>
    <li>Projektów: <b>${D.projekty.length}</b></li><li>Wag: <b>${D.wagi.rows.length}</b>, zapamiętanych paczek/arkuszy: ${Object.keys(D.wagi.pamiec).length}</li>
    <li>Grup: ${D.ustawienia.grupy.length}, słów kluczowych: ${D.ustawienia.slowa.length}, dostawców: ${D.ustawienia.dostawcy.length}</li><li>Lista generatora: ${D.generator.wiersze.length} poz.</li></ul>
    ${Z.length || P.length ? `<p class="notice bad">W aplikacji są już dane (${Z.length} zapytań, ${P.length} projektów). Import je <b>zastąpi</b>. Wpis o imporcie zostanie w dzienniku.</p>` : ""}`,
    [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Importuj", cls: "primary" }]);
  if (r.v !== "ok") return;
  toast("Importuję…");
  try {
    const ops = [];
    if (Z.length || P.length) {
      const logDel = B.newId(C.log);
      Z.forEach(z => ops.push({ c: C.z, id: z._id, del: true })); P.forEach(p => ops.push({ c: C.p, id: p._id, del: true }));
      ops.push({ c: C.log, id: logDel, d: wpis("import", "", f.name, "usunięcie", [{ p: "przed importem usunięto", a: `${Z.length} zapytań, ${P.length} projektów`, b: "" }]) });
      for (let i = 0; i < ops.length; i += 450) await B.batch(ops.slice(i, i + 450));
      ops.length = 0;
    }
    const logId = B.newId(C.log), meta = { wersja: 1, ostatniWpis: logId, utworzono: B.now(), utworzyl: me.uid, zmieniono: B.now(), zmienil: me.uid, zmienilNazwa: me.nazwa };
    D.zapytania.forEach(z => ops.push({ c: C.z, id: B.newId(C.z), d: czysc({ ...z, ...meta }) }));
    D.projekty.forEach(p => ops.push({ c: C.p, id: B.newId(C.p), d: czysc({ ...p, ...meta }) }));
    ops.push({ c: C.u, id: "config", d: czysc(D.ustawienia) }, { c: C.u, id: "wagi", d: czysc(D.wagi) }, { c: C.u, id: "generator", d: czysc(D.generator) });
    ops.push({ c: C.log, id: logId, d: wpis("import", "", f.name, "import", [{ p: "zaimportowano z Excela", a: "", b: `${D.zapytania.length} zapytań, ${D.projekty.length} projektów, ${D.wagi.rows.length} wag` }]) });
    // jeden wpis w dzienniku dla wszystkich – musi być w tej samej paczce co dokumenty
    if (ops.length > 490) {
      const docs = ops.filter(o => o.c === C.z || o.c === C.p), reszta = ops.filter(o => !(o.c === C.z || o.c === C.p));
      for (let i = 0; i < docs.length; i += 400) {
        const lid = B.newId(C.log), part = docs.slice(i, i + 400).map(o => ({ ...o, d: { ...o.d, ostatniWpis: lid } }));
        await B.batch([...part, { c: C.log, id: lid, d: wpis("import", "", f.name, "import", [{ p: "zaimportowano z Excela (część)", a: "", b: `${part.length} dokumentów` }]) }]);
      }
      await B.batch(reszta);
    } else await B.batch(ops);
    ustDirty = false; toast("Zaimportowano"); go("zapytania");
  } catch (x) { failed(x); }
}

/* ============================================================ dziennik */
let logF = "wszystko";
function logItem(l) {
  const zm = (l.zmiany || []).slice(0, 14).map(c => `<li><b>${esc(c.p)}</b>: ${c.a ? `<span class="del">${esc(c.a)}</span> → ` : ""}${c.b ? `<span class="ins">${esc(c.b)}</span>` : "<i>usunięto</i>"}</li>`).join("") + ((l.zmiany || []).length > 14 ? `<li>… i ${l.zmiany.length - 14} więcej</li>` : "");
  const z = l.typ === "zapytanie" ? (zapById(l.obiektId) || zapByNazwa(String(l.obiekt).split(", ")[0])) : null;
  const ob = z ? `<button class="ob" data-open="${z._id}">${esc(l.obiekt)}</button>` : `<b>${esc(l.obiekt || "")}</b>`;
  return `<div class="it ${l.zast ? "zast" : ""} ${l.zast && !l.przejrzane && isOwner ? "nowe" : ""}" data-l="${l._id}"><div class="mono small">${fDT(l.kiedy)}</div>
    <div><span class="strong">${esc(l.nazwa)}</span>${l.zast ? ' <span class="pill p-warn">zastępstwo</span>' : ""} · ${esc(l.akcja)} ${esc(l.typ === "dostep" ? "" : l.typ)} ${ob}${zm ? `<ul>${zm}</ul>` : ""}</div>
    <div>${isOwner && l.zast ? (l.przejrzane ? `<span class="small">✓ przejrzane</span> <button class="btn sm" data-seen="0" title="Cofnij">↺</button>` : `<button class="btn sm" data-seen="1">Przejrzane</button>`) : ""}</div></div>`;
}
function renderLog() {
  const os = [...new Map(LOG.map(l => [l.kto, l.nazwa])).entries()];
  const k = renderLog.kto || "";
  const L2 = LOG.filter(l => (logF !== "zast" || l.zast) && (logF !== "nowe" || (l.zast && !l.przejrzane)) && (!k || l.kto === k)).slice(0, 400);
  M().innerHTML = `<div class="toolbar"><a class="btn" href="#ustawienia">← Ustawienia</a><h2>Dziennik zmian</h2></div><div class="panel"><div class="hd"><div class="toolbar"><div class="seg" id="lSeg">${["wszystko", "zast", "nowe"].map(f => `<button data-f="${f}" aria-pressed="${logF === f}">${{ wszystko: "Wszystko", zast: "Zastępstwa", nowe: "Nieprzejrzane" }[f]}</button>`).join("")}</div>
    <select id="lKto"><option value="">Każda osoba</option>${os.map(([u, n]) => `<option value="${u}" ${u === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
    ${isOwner && L2.some(l => l.zast && !l.przejrzane) ? `<button class="btn" id="lAll">Oznacz widoczne jako przejrzane</button>` : ""}</div>
    <div class="log">${L2.map(logItem).join("") || `<div class="empty">${logF === "nowe" ? "<strong>Wszystko przejrzane</strong>" : "Brak wpisów"}</div>`}</div></div>`;
  $("lSeg").onclick = e => { const b = e.target.closest("button"); if (b) { logF = b.dataset.f; renderLog(); } };
  $("lKto").onchange = e => { renderLog.kto = e.target.value; renderLog(); };
  $("lAll") && ($("lAll").onclick = async () => { const ids = L2.filter(l => l.zast && !l.przejrzane).map(l => l._id); if (await pytanie("Oznaczyć jako przejrzane?", `${ids.length} wpisów zastępcy.`)) seen(ids, true); });
}
async function seen(ids, v) { try { for (let i = 0; i < ids.length; i += 400) await B.batch(ids.slice(i, i + 400).map(id => ({ c: C.log, id, upd: true, d: { przejrzane: v, przejrzanoKiedy: B.now() } }))); } catch (x) { failed(x); } }
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]"); if (o) return go("z", o.dataset.open);
  const s = e.target.closest("[data-seen]"); if (s && isOwner) seen([s.closest("[data-l]").dataset.l], s.dataset.seen === "1");
});

/* ============================================================ dostęp (zastępstwa) */
function renderDostep() {
  const L3 = Object.entries(dostep.zastepcy || {}).map(([u, z]) => ({ u, ...z })).sort((a, b) => toD(b.od) - toD(a.od));
  M().innerHTML = `<div class="panel"><div class="hd"><h2>Nadaj dostęp tymczasowy (zastępstwo)</h2></div>
    <form class="bd grid3" id="gF"><label>Konto<select id="gKto" required><option value="">Wybierz osobę…</option>${konta.filter(k => k.uid !== ownerUid && k.aktywny !== false).map(k => `<option value="${k.uid}">${esc(k.nazwa || k.login)} (${esc(k.login || "")})</option>`).join("")}</select></label>
      <label>Od dnia<input id="gOd" type="date" required value="${today()}"></label><label>Do dnia (włącznie)<input id="gDo" type="date" required></label>
      <label class="full">Powód / notatka<input id="gNota" placeholder="np. urlop 10–21.11"></label>
      <div class="full foot"><span class="small grow">Dostęp włącza się i wyłącza sam, w podanych dniach. Każda zmiana zastępcy trafia do Dziennika zmian z oznaczeniem „zastępstwo” – po powrocie przejrzysz je i odhaczysz. Zastępca nie może usuwać zapytań ani projektów ani nadawać dostępu.</span><button class="btn primary" type="submit">Nadaj dostęp</button></div></form></div>
    <div class="panel"><div class="hd"><h2>Zastępstwa</h2></div><div class="tablebox"><table class="t" style="min-width:760px"><thead><tr><th>Osoba</th><th>Okres</th><th>Status</th><th>Notatka</th><th class="num">Zmian</th><th></th></tr></thead><tbody id="gRows">
    ${L3.map(z => { const st = zastStatus(z), n = LOG.filter(l => l.kto === z.u && l.zast).length, nz = LOG.filter(l => l.kto === z.u && l.zast && !l.przejrzane).length;
      return `<tr data-g="${z.u}"><td><b>${esc(z.nazwa)}</b><div class="small">nadano ${fDT(z.nadano)}</div></td><td class="mono">${fD(iso(toD(z.od)))} – ${fD(doDnia(z))}</td><td><span class="pill ${{ aktywne: "p-ok", zaplanowane: "p-acc" }[st] || "p-idle"}">${st}</span></td><td class="small">${esc(z.nota || "")}</td>
        <td class="num">${n}${nz ? ` <span class="pill p-warn">${nz} do przejrzenia</span>` : ""}</td><td class="num">${["aktywne", "zaplanowane"].includes(st) ? `<button class="btn sm danger" data-gx>Odbierz teraz</button>` : `<button class="btn sm" data-grm>Usuń z listy</button>`}</td></tr>`; }).join("")}
    </tbody></table></div>${L3.length ? "" : `<div class="empty"><strong>Nikt poza Tobą nie ma dostępu</strong><span>Nadaj dostęp na czas urlopu – wygaśnie sam.</span></div>`}</div>`;
  $("gF").onsubmit = async e => {
    e.preventDefault();
    const u = $("gKto").value, k = konta.find(x => x.uid === u), od = $("gOd").value, dd = $("gDo").value;
    if (!u || !od || !dd) return; if (dd < od) return toast("Data „do” jest przed „od”");
    const doD = new Date(dd + "T00:00"); doD.setDate(doD.getDate() + 1);
    const z = { nazwa: k?.nazwa || k?.login || "?", login: k?.login || "", od: new Date(od + "T00:00"), do: doD, nota: $("gNota").value.trim(), nadano: new Date(), nadal: me.uid };
    try { await zmienDostep(t => { t.zastepcy[u] = z; }, [{ p: "nadano dostęp", a: "", b: `${z.nazwa}: ${fD(od)} – ${fD(dd)}${z.nota ? ` (${z.nota})` : ""}` }], z.nazwa, "nadanie dostępu"); toast(`${z.nazwa} ma dostęp od ${fD(od)} do ${fD(dd)}`); }
    catch (x) { failed(x); }
  };
  $("gRows").onclick = async e => {
    const tr = e.target.closest("tr[data-g]"); if (!tr) return; const u = tr.dataset.g, z = dostep.zastepcy[u];
    if (e.target.closest("[data-gx]") && await pytanie("Odebrać dostęp teraz?", esc(z.nazwa), "Odbierz")) zmienDostep(t => { t.zastepcy[u].odwolano = new Date(); }, [{ p: "odebrano dostęp", a: z.nazwa, b: "" }], z.nazwa, "odebranie dostępu").catch(failed);
    if (e.target.closest("[data-grm]")) zmienDostep(t => { delete t.zastepcy[u]; }, [], z.nazwa, "usunięcie z listy").catch(failed);
  };
}
async function zmienDostep(fn, zmiany, kto, akcja) {
  const logId = B.newId(C.log);
  await B.tx(async t => { const cur = (await t.get(C.u, "dostep")) || { zastepcy: {} }; cur.zastepcy ||= {}; fn(cur); t.set(C.u, "dostep", cur); t.set(C.log, logId, wpis("dostep", "dostep", kto, akcja, zmiany)); });
}

window.addEventListener("beforeunload", e => { if (eDirty || genDirty || ustDirty) { e.preventDefault(); e.returnValue = ""; } });
zHash();
boot().catch(x => msg("Nie udało się uruchomić aplikacji", String(x?.message || x)));
