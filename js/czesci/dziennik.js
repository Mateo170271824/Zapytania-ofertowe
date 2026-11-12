// Zapytania: dziennik zmian i dostęp (zastępstwa)
import { $, esc, iso, today, toD, fDT, fD, toast, failed, pytanie } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { B, LOG, M, doDnia, dostep, go, isOwner, konta, me, ownerUid, wpis, zapById, zapByNazwa, zastStatus } from '../app.js?v=202611121300';

/* ============================================================ dziennik */
export let logF = "wszystko";
export function logItem(l) {
  const zm = (l.zmiany || []).slice(0, 14).map(c => `<li><b>${esc(c.p)}</b>: ${c.a ? `<span class="del">${esc(c.a)}</span> → ` : ""}${c.b ? `<span class="ins">${esc(c.b)}</span>` : "<i>usunięto</i>"}</li>`).join("") + ((l.zmiany || []).length > 14 ? `<li>… i ${l.zmiany.length - 14} więcej</li>` : "");
  const z = l.typ === "zapytanie" ? (zapById(l.obiektId) || zapByNazwa(String(l.obiekt).split(", ")[0])) : null;
  const ob = z ? `<button class="ob" data-open="${z._id}">${esc(l.obiekt)}</button>` : `<b>${esc(l.obiekt || "")}</b>`;
  return `<div class="it ${l.zast ? "zast" : ""} ${l.zast && !l.przejrzane && isOwner ? "nowe" : ""}" data-l="${l._id}"><div class="mono small">${fDT(l.kiedy)}</div>
    <div><span class="strong">${esc(l.nazwa)}</span>${l.zast ? ' <span class="pill p-warn">zastępstwo</span>' : ""} · ${esc(l.akcja)} ${esc(l.typ === "dostep" ? "" : l.typ)} ${ob}${zm ? `<ul>${zm}</ul>` : ""}</div>
    <div>${isOwner && l.zast ? (l.przejrzane ? `<span class="small">✓ przejrzane</span> <button class="btn sm" data-seen="0" title="Cofnij">↺</button>` : `<button class="btn sm" data-seen="1">Przejrzane</button>`) : ""}</div></div>`;
}
export function renderLog() {
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
export async function seen(ids, v) { try { for (let i = 0; i < ids.length; i += 400) await B.batch(ids.slice(i, i + 400).map(id => ({ c: C.log, id, upd: true, d: { przejrzane: v, przejrzanoKiedy: B.now() } }))); } catch (x) { failed(x); } }
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]"); if (o) return go("z", o.dataset.open);
  const s = e.target.closest("[data-seen]"); if (s && isOwner) seen([s.closest("[data-l]").dataset.l], s.dataset.seen === "1");
});

/* ============================================================ dostęp (zastępstwa) */
export function renderDostep() {
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
export async function zmienDostep(fn, zmiany, kto, akcja) {
  const logId = B.newId(C.log);
  await B.tx(async t => { const cur = (await t.get(C.u, "dostep")) || { zastepcy: {} }; cur.zastepcy ||= {}; fn(cur); t.set(C.u, "dostep", cur); t.set(C.log, logId, wpis("dostep", "dostep", kto, akcja, zmiany)); });
}

