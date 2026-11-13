/* Drobne narzędzia interfejsu: formatowanie liczb i dat, okna dialogowe, komunikaty, pliki. */
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const pad = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const toD = x => !x ? null : x.toDate ? x.toDate() : new Date(x);
export const fDT = x => { const d = toD(x) || new Date(); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fD = s => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
export const clone = o => JSON.parse(JSON.stringify(o ?? null));
export const uidS = () => Math.random().toString(36).slice(2, 10);
// liczby jak w Excelu: „1 234,56” (spacja niełamliwa), zawsze z grupowaniem
export function fmt(x, d = 2, min = d) {
  if (x === null || x === undefined || x === "" || isNaN(x)) return "";
  const s = Math.abs(x).toFixed(d);
  let [c, u] = s.split(".");
  c = c.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (u !== undefined && min < d) { u = u.replace(/0+$/, ""); while (u.length < min) u += "0"; }
  return (x < 0 && +s !== 0 ? "-" : "") + c + (u ? "," + u : "");
}
export const zl = x => fmt(x, 2) + " zł";
export const ogolnyLiczba = x => typeof x === "number" ? fmt(x, 4, 0) : esc(x);
export const kolLit = c => { let s = ""; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const hex = k => (k && k !== -1) ? "#" + k : "";
export function toast(t) { document.querySelectorAll(".toast").forEach(x => x.remove()); const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 3500); }
export function failed(x) { console.error(x); toast("Nie udało się zapisać: " + (x?.code || x?.message || x)); }
export function show(v) { for (const id of ["v-msg", "v-login", "v-app"]) $(id).hidden = id !== "v-" + v; document.dispatchEvent(new Event("zap-gotowa")); }
export function msg(t, s = "") { $("msgT").textContent = t; $("msgS").textContent = s; show("msg"); }
// okno dialogowe: html formularza, przyciski [{v, t, cls}] -> Promise<{v, form}>
export function okno(html, przyciski = [{ v: "ok", t: "OK", cls: "primary" }], opcje = {}) {
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
export const pytanie = async (t, b, ok = "OK") => (await okno(`<h3>${esc(t)}</h3><div class="small">${b}</div>`, [{ v: "cancel", t: "Anuluj", nv: true }, { v: "ok", t: ok, cls: "primary" }])).v === "ok";
export async function kopiuj(t) { try { await navigator.clipboard.writeText(t); toast("Skopiowano"); } catch { toast("Zaznacz tekst i skopiuj ręcznie"); } }
// aplikacja Android (Capacitor): pliki idą przez okno „Udostępnij” (zapis w Pobranych, Dysk, mail…)
export const natywna = () => !!globalThis.Capacitor?.isNativePlatform?.();
const base64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function udostepnij(nazwa, blob) {
  const { Filesystem, Share } = globalThis.Capacitor.Plugins;
  const plik = await Filesystem.writeFile({ path: nazwa, data: await base64(blob), directory: "CACHE" });
  await Share.share({ title: nazwa, files: [plik.uri], dialogTitle: "Zapisz lub wyślij plik" });
}
export function zapiszXlsx(wb, nazwa) {
  if (!natywna() && !telefon()) return globalThis.XLSX.writeFile(wb, nazwa);
  pobierzPlik(nazwa, new Blob([globalThis.XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
// telefon / tablet (dotyk) – pobieranie przez link bywa tam zawodne, lepsze jest okno „Udostępnij”
export const telefon = () => matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;
function pobierzLinkiem(nazwa, blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nazwa; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 120000);      // telefon potrzebuje chwili, zanim zacznie pobierać
}
async function udostepnijWebem(nazwa, blob) {
  const plik = new File([blob], nazwa, { type: blob.type || "application/octet-stream" });
  if (!navigator.canShare?.({ files: [plik] })) return false;
  await navigator.share({ files: [plik], title: nazwa });
  return true;
}
export async function pobierzPlik(nazwa, blob) {
  if (natywna()) return udostepnij(nazwa, blob).catch(e => { if (!/cancel/i.test(e?.message || "")) toast("Nie udało się zapisać pliku: " + (e?.message || e)); });
  if (!telefon()) return pobierzLinkiem(nazwa, blob);
  try { if (await udostepnijWebem(nazwa, blob)) return; }
  catch (e) {
    if (e?.name === "AbortError") return;                                       // anulowane w oknie Udostępnij
    if (e?.name === "NotAllowedError") {                                        // za długo od kliknięcia – potrzebne nowe kliknięcie
      const r = await okno(`<h3>Plik gotowy</h3><p><b>${esc(nazwa)}</b></p><p class="small">Zapisz w telefonie albo wyślij (mail, WhatsApp, Dysk…).</p>`,
        [{ v: "cancel", t: "Zamknij", nv: true }, { v: "pobierz", t: "Pobierz" }, { v: "ok", t: "Zapisz / udostępnij", cls: "primary" }]);
      if (r.v === "ok") { try { if (await udostepnijWebem(nazwa, blob)) return; } catch (x) { if (x?.name === "AbortError") return; } }
      if (r.v === "cancel") return;
    }
  }
  pobierzLinkiem(nazwa, blob);
}
export const czytajPlik = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });

