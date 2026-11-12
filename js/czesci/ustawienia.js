// Zapytania: ustawienia
import * as L from "../logika.js?v=202611121300";
import * as I from "../import-excel.js?v=202611121300";
import * as KP from "../kopia.js?v=202611121300";
import * as ZM from "../zamowienia.js?v=202611121300";
import { $, esc, today, fDT, clone, toast, failed, okno, pobierzPlik, czytajPlik, zapiszXlsx, natywna } from "../ui.js?v=202611121300";
import { C } from "../baza.js?v=202611121300";

import { B, G, LOG, M, P, U, W, Z, czysc, go, isOwner, me, sv, wpis, zapiszUst } from '../app.js?v=202611121300';
import { CEN, cenyMeta, cenyZal, startCeny } from './ceny-widok.js?v=202611121300';
import { czekajNa } from './generator.js?v=202611121300';

/* ============================================================ ustawienia */
export let ustDirty = false, UE = null, WE = null, wagiQ = "";
export let truckDost = null;   // kartoteka dostawców Truck App (podpowiedzi w Ustawieniach)
export function renderUstawienia() {
  if (!ustDirty) { UE = clone(U); WE = clone(W); }
  const pole = (k, l, opis, typ = "text") => `<label>${l}<input data-u="${k}" value="${esc(UE[k] ?? "")}" ${typ === "tn" ? 'list="tnList"' : ""}><span class="small">${opis}</span></label>`;
  const wagiF = WE.rows.map((r, i) => [r, i]).filter(([r]) => !wagiQ || L.LC(`${r.t} ${r.w} ${r.o} ${r.u}`).includes(L.LC(wagiQ)));
  M().innerHTML = `
  ${natywna() ? "" : `<div class="panel"><div class="hd"><div><h3>Aplikacja na telefon i komputer</h3><span class="small">Dwie wersje do wyboru – obie otwierają zawsze aktualne Zapytania, nie trzeba ich aktualizować.</span></div></div>
    <div class="bd"><div class="toolbar"><button class="btn primary" id="pwaInst" ${globalThis.zapInstalacja ? "" : "hidden"}>Zainstaluj z przeglądarki</button>
      <a class="btn" href="https://github.com/Mateo170271824/Zapytania-ofertowe/releases/download/android/Zapytania-ofertowe.apk">Pobierz APK (Android)</a></div>
      <ul class="small" style="margin:8px 0 0;padding-left:18px">
        <li><b>Z przeglądarki (jak Kooperacje)</b>: Chrome → menu ⋮ → „Zainstaluj aplikację” (albo „Dodaj do ekranu głównego”). Na komputerze: ikona instalacji na końcu paska adresu. iPhone: Safari → Udostępnij → „Do ekranu początkowego”.</li>
        <li><b>APK (jak Kalkulator stali)</b>: pobierz plik na telefonie i otwórz – Android zapyta o zgodę na instalację z tego źródła. Pliki (PDF, Excel) zapisujesz przez okno „Udostępnij”.</li>
      </ul></div></div>`}
  <div class="panel"><div class="hd"><div><h3>Wygląd</h3><span class="small">Kolorystyka aplikacji na tym urządzeniu. Ciemny tryb dopasowuje się do ustawień systemu.</span></div></div>
    <div class="bd motywy" id="uMotyw">${MOTYWY.map(([k, n, th, ak]) => `<button class="motyw" data-m="${k}" aria-pressed="${motyw() === k}"><span class="prev"><span style="background:${th}"></span><span style="background:${ak}"></span><span style="background:#c6efce"></span></span><b>${n}</b></button>`).join("")}</div></div>
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
  ${isOwner ? `<div class="panel"><div class="hd"><div><h3>Kopia zapasowa</h3><span class="small">Automatycznie co tydzień (poniedziałek rano) robi się kopia w repozytorium Logistyka – Actions → „Kopia Zapytań ofertowych”, trzymana 90 dni. Tu możesz pobrać kopię w każdej chwili.</span></div></div>
    <div class="bd toolbar"><button class="btn" id="kpXls">Pobierz kopię (Excel – do przeglądania)</button><button class="btn" id="kpJson">Pobierz kopię (plik do przywrócenia)</button>
      <label class="btn danger filebtn">Przywróć z kopii<input type="file" id="kpPrzywroc" accept=".json,application/json"></label></div></div>` : ""}
  ${isOwner ? `<div class="panel"><div class="hd"><h3>Import z pliku Excel</h3></div><div class="bd"><div class="drop"><b>Wgraj „Zapytania Lista 2026.xlsm”</b><span>Przeniesie wszystkie zapytania (ceny, kolory wyboru, komentarze), projekty, tabelę wag, zapamiętane paczki, listę generatora i ustawienia. Plik jest czytany w przeglądarce – nie trafia nigdzie poza bazę aplikacji.</span>
    <label class="btn primary filebtn">Wybierz plik<input type="file" id="impFile" accept=".xlsm,.xlsx"></label></div></div></div>` : ""}`;
  M().querySelectorAll("[data-u]").forEach(el => el.oninput = () => { UE[el.dataset.u] = el.value; ustZm(); });
  // podpowiedzi z kartoteki dostawców Truck App: nazwa z listy uzupełnia pusty e-mail i osobę
  const tbD = M().querySelector('table[data-tab="dostawcy"]');
  if (tbD) {
    const dolacz = () => { tbD.querySelectorAll('input[data-f="dostawca"]').forEach(i => i.setAttribute("list", "truckDost"));
      if (!$("truckDost")) tbD.insertAdjacentHTML("afterend", `<datalist id="truckDost">${(truckDost || []).map(x => `<option value="${esc(x.nazwa)}">${esc(x.email || x.adres || "")}</option>`).join("")}</datalist>`); };
    if (truckDost) dolacz(); else B.get("ustawienia", "glowne").then(d => { truckDost = d?.dostawcy || []; dolacz(); }).catch(() => { truckDost = []; });
    tbD.addEventListener("change", e => { if (e.target.dataset.f !== "dostawca") return; const tr = e.target.closest("tr[data-i]"); const x = ZM.dostawcaTruck(e.target.value, truckDost || []); if (!tr || !x) return;
      const w = UE.dostawcy[+tr.dataset.i]; let zm = false;
      if (!w.email && x.email) { w.email = x.email; tr.querySelector('input[data-f="email"]').value = x.email; zm = true; }
      if (!w.osoba && x.kontakt && !/\d{3}/.test(x.kontakt)) { w.osoba = x.kontakt; tr.querySelector('input[data-f="osoba"]').value = x.kontakt; zm = true; }
      if (zm) { ustZm(); toast("Uzupełniono z kartoteki dostawców Truck App"); } });
  }
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
  const pwa = $("pwaInst");
  if (pwa) { document.addEventListener("zap-instalacja", () => { pwa.hidden = false; }, { once: true });
    pwa.onclick = async () => { const e = globalThis.zapInstalacja; if (!e) return; e.prompt(); const r = await e.userChoice; globalThis.zapInstalacja = null; pwa.hidden = true; if (r.outcome === "accepted") toast("Zainstalowano – ikona jest na ekranie głównym"); }; }
  $("kpXls") && ($("kpXls").onclick = () => pobierzKopie("xlsx"));
  $("kpJson") && ($("kpJson").onclick = () => pobierzKopie("json"));
  $("kpPrzywroc") && ($("kpPrzywroc").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) przywrocKopie(f); });
  $("impFile") && ($("impFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importExcel(f); });
}
export const MOTYWY = [["granat", "Granat (obecny)", "#366092", "#366092"], ["grafit", "Grafit – neutralny", "#3d434a", "#3d434a"], ["pomarancz", "Grafit z pomarańczem", "#33383d", "#c2410c"], ["zielen", "Zieleń stalowa", "#2e3b36", "#2f6b4f"]];
export function motyw() { try { return localStorage.getItem("zap_motyw") || "granat"; } catch { return "granat"; } }
export function ustawMotyw(m) {
  try { localStorage.setItem("zap_motyw", m); } catch {}
  if (m === "granat") delete document.documentElement.dataset.motyw; else document.documentElement.dataset.motyw = m;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", (MOTYWY.find(x => x[0] === m) || MOTYWY[0])[2]);
}
document.addEventListener("click", e => { const b = e.target.closest("#uMotyw [data-m]"); if (!b) return; ustawMotyw(b.dataset.m); document.querySelectorAll("#uMotyw [data-m]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
export function tabelaEd(k, tytul, kol) {
  const opt = { tn: '<datalist id="tnL2"><option value="TAK"><option value="NIE"></datalist>', pk: "", gr: "" };
  return `<div class="panel"><div class="hd"><h3>${tytul}</h3><button class="btn sm" data-dodaj="${k}">+ Wiersz</button></div>
    <div class="tablebox"><table class="t ed" data-tab="${k}"><thead><tr>${kol.map(c => `<th>${c[1]}</th>`).join("")}<th></th></tr></thead><tbody>
    ${(UE[k] || []).map((r, i) => `<tr data-i="${i}">${kol.map(([f, , t]) => `<td><input data-f="${f}" value="${esc(r[f] ?? "")}" ${t === "tn" ? 'list="tnL2"' : t === "pk" ? 'list="pkL"' : t === "gr" ? 'list="grL"' : ""}></td>`).join("")}
      <td class="num"><button class="btn sm" data-akc="up" title="W górę">↑</button> <button class="btn sm" data-akc="down" title="W dół">↓</button> <button class="btn sm" data-akc="del" title="Usuń">✕</button></td></tr>`).join("")}
    </tbody></table></div>${opt.tn}<datalist id="pkL"><option value="paczka"><option value="szt"></datalist><datalist id="grL">${(UE.grupy || []).map(g => `<option value="${esc(g.grupa)}">`).join("")}</datalist></div>`;
}
export function ustZm() { ustDirty = true; const b = $("uZapisz"); if (b) b.disabled = false; const s = $("uStatus"); if (s) s.textContent = "niezapisane zmiany"; }
export async function zapiszUstawienia() {
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
    // jedna lista dostawców: nowi dostawcy i brakujące e-maile trafiają do kartoteki w Truck App
    let wTruck = 0;
    if (zm.some(z => z.p === "dostawcy")) {
      try { wTruck = await B.zmienDostawcowTruck(l => ZM.scalDostawcow(l, (UE.dostawcy || []).map(d => ({ nazwa: L.vbaTrim(d.dostawca || ""), email: L.vbaTrim(d.email || ""), osoba: L.vbaTrim(d.osoba || "") })), "zap")); }
      catch (x) { console.warn(x); wTruck = -1; }
    }
    if (zmW.length) await zapiszUst("wagi", WE, "WAGI", zmW);
    ustDirty = false; toast("Zapisano ustawienia" + (wTruck > 0 ? " – dostawcy także w kartotece Truck App" : wTruck < 0 ? " (kartoteka Truck App bez zmian – brak dostępu)" : "")); renderUstawienia();
  } catch (x) { failed(x); }
}
// ---------- kopia zapasowa
export async function biezacaKopia() {
  startCeny(); await czekajNa(() => cenyZal, 8000);
  return KP.kopiaJSON({ zapytania: Z, projekty: P, ceny: CEN, ustawienia: U, wagi: W, generator: G, cenyMeta });
}
export async function pobierzKopie(rodzaj) {
  const k = await biezacaKopia(), d = today();
  if (rodzaj === "json") pobierzPlik(`zapytania-kopia-${d}.json`, new Blob([JSON.stringify(k)], { type: "application/json" }));
  else zapiszXlsx(KP.kopiaExcel(XLSX, k), `zapytania-kopia-${d}.xlsx`);
  toast("Pobrano kopię");
}
export async function przywrocKopie(f) {
  let k;
  try { k = JSON.parse(new TextDecoder().decode(await czytajPlik(f))); } catch { return okno(`<h3>Przywracanie</h3><p>To nie jest poprawny plik kopii (.json).</p>`); }
  const bl = KP.sprawdzKopie(k); if (bl) return okno(`<h3>Przywracanie</h3><p>${esc(bl)}</p>`);
  const r = await okno(`<h3>Przywrócić kopię z ${fDT(k.kiedy)}?</h3><ul><li>Zapytań: <b>${k.zapytania.length}</b>, projektów: <b>${k.projekty.length}</b>, pozycji w cenach: <b>${(k.ceny || []).length}</b></li></ul>
    <p class="notice bad">Obecne zapytania, projekty, ceny, ustawienia i wagi zostaną <b>zastąpione</b> stanem z kopii. Dziennik zmian i zastępstwa zostają bez zmian. Wpis o przywróceniu trafi do dziennika.</p>
    <p class="small">Dla pewności najpierw pobierz kopię obecnego stanu.</p>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: "Przywróć", cls: "danger" }]);
  if (r.v !== "ok") return;
  toast("Przywracam…");
  try {
    startCeny(); await czekajNa(() => cenyZal, 8000);
    const del = [...Z.map(z => ({ c: C.z, id: z._id, del: true })), ...P.map(p => ({ c: C.p, id: p._id, del: true })), ...CEN.map(d => ({ c: C.c, id: d._id, del: true }))];
    for (let i = 0; i < del.length; i += 450) await B.batch(del.slice(i, i + 450));
    const zKopii = c => o => { const { id, d } = KP.dokumentZKopii(o); return { c, id: id || B.newId(c), d: czysc(d) }; };
    const docs = [...k.zapytania.map(zKopii(C.z)), ...k.projekty.map(zKopii(C.p))];
    // zapytania i projekty muszą mieć wpis w dzienniku w tej samej paczce
    for (let i = 0; i < docs.length; i += 400) {
      const lid = B.newId(C.log), part = docs.slice(i, i + 400).map(o => ({ ...o, d: { ...o.d, ostatniWpis: lid, wersja: (o.d.wersja || 0) + 1 } }));
      await B.batch([...part, { c: C.log, id: lid, d: wpis("import", "", f.name, "przywrócenie", [{ p: "przywrócono z kopii", a: "", b: `${fDT(k.kiedy)} – ${part.length} dokumentów` }]) }]);
    }
    const ceny = (k.ceny || []).map(zKopii(C.c));
    for (let i = 0; i < ceny.length; i += 450) await B.batch(ceny.slice(i, i + 450));
    const ust = [{ c: C.u, id: "config", d: czysc(k.ustawienia || {}) }, { c: C.u, id: "wagi", d: czysc(k.wagi || { rows: [], pamiec: {} }) }, { c: C.u, id: "generator", d: czysc(k.generator || {}) }];
    if (k.cenyMeta) ust.push({ c: C.u, id: "ceny", d: czysc(k.cenyMeta) });
    await B.batch(ust);
    ustDirty = false; toast("Przywrócono kopię"); go("zapytania");
  } catch (x) { failed(x); }
}
export async function importExcel(f) {
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
