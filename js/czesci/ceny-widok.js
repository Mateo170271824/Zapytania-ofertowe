// Zapytania: baza cen kupionych (widok)
import * as L from "../logika.js?v=202611121300";
import * as I from "../import-excel.js?v=202611121300";
import { $, esc, today, fDT, fD, fmt, toast, failed, okno, czytajPlik, zapiszXlsx } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import * as CE from "../ceny.js?v=202611121300";
import { B, G, M, P, W, Z, czysc, poZmianieDanych, subs, zapiszUst } from '../app.js?v=202611121300';
import { czekajNa } from './generator.js?v=202611121300';

/* ============================================================ ceny (baza cen kupionych) */
export let CEN = [], cenyMeta = null, cenySub = false, cenyZal = false;
export const cenyStan = { tab: "wyroby", q: "", grupa: "", gat: "", zr: { lista: true, zakup: true, zapytanie: true }, otwarty: "", rok: new Date().getFullYear(), qRok: "", po: "grupa", miara: "zlKg", wyb: [] };
export function startCeny() {
  if (cenySub) return; cenySub = true;
  subs.push(B.watch(C.c, a => { CEN = a; cenyZal = true; poZmianieDanych("c"); }, x => console.warn(x)));
  subs.push(B.watchDoc(C.u, "ceny", d => { cenyMeta = d; poZmianieDanych("c"); }, () => {}));
}
export const ctxCen = () => ({ wagi: L.slownikWag(W), pamiec: W.pamiec || {} });
export const jmZnane = () => { const m = {}; for (const p of P) for (const x of p.pozycje || []) if (x.symbol && x.jm) m[x.symbol] = x.jm; for (const x of G.wiersze || []) if (x.symbol && x.jm) m[x.symbol] = x.jm; return m; };
export const ZRODLA = { lista: "lista z Subiekta", zakup: "zakup (Subiekt)", zapytanie: "zapytanie" };
export const zlN = v => v === null || v === undefined ? "–" : fmt(v, 2);
export let cenyCache = null;
export function punktyCen() {
  const klucz = `${CEN.length}|${Z.length}|${P.length}|${W.rows.length}|${CEN.reduce((s, d) => s + (d.historia?.length || 0) + (d.status || "").length + (d.jm || "").length, 0)}|${Z.reduce((s, z) => s + (z.wersja || 0), 0)}`;
  if (cenyCache?.klucz === klucz) return cenyCache.p;
  const p = CE.zbierzCeny({ lista: CEN.filter(d => d.status !== "sprawdz"), projekty: P, zapytania: Z }, ctxCen());
  cenyCache = { klucz, p }; return p;
}
export function renderCeny() {
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
export function cenyWyroby(pk) {
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
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Ceny"); zapiszXlsx(wb, `ceny-materialow-${today()}.xlsx`);
  };
}
export function szczegolyWyrobu(s) {
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
export function wykresCen(serie, jedn, opcje = {}) {
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
export const pad2 = n => String(n).padStart(2, "0");
export function cenyRok(pk) {
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
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `${cenyStan.rok} ${jed.replace("/", " na ")}`); zapiszXlsx(wb, `zestawienie-cen-${cenyStan.rok}.xlsx`);
  };
}
export function cenySprawdz(spr) {
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
// nowe pozycje (eksport z Subiekta, zamówienie) do bazy cen – tylko te, których jeszcze nie ma; zwraca liczbę dopisanych
export async function dopiszDoBazy(pozycje) {
  if (!pozycje.length) return 0;
  try {
    startCeny(); if (!(await czekajNa(() => cenyZal, 8000))) return 0;
    const { dokumenty } = CE.noweDoBazy(pozycje, CEN, ctxCen());
    for (let i = 0; i < dokumenty.length; i += 450) await B.batch(dokumenty.slice(i, i + 450).map(x => ({ c: C.c, id: x.id, d: czysc(x.d) })));
    return dokumenty.length;
  } catch (x) { console.warn(x); return 0; }
}
export async function wgrajListeCen(f) {
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
    const { _id, zrodlo, ...reszta } = st;
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
