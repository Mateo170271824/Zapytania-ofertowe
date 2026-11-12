/* Oferty z poczty: zapisany mail (.eml), PDF albo wklejony tekst → ceny w zapytaniu.
   Blacha trapezowa: wiersz zapytania „KOD BUDOWY | Blacha trapezowa T35 0,5 RAL 7016- 320 m2”, cena w zł/m².
   Bez zależności od przeglądarki (testy w Node). */
import * as L from "./logika.js?v=202611061834";

// ---------------------------------------------------------------- wiersz blachy trapezowej
export const SEP_KOD = " | ";
export function wierszTrapez({ kod, profil, grubosc, powloka, m2 }) {
  const opis = ["Blacha trapezowa", profil, grubosc ? (/mm$/i.test(grubosc) ? grubosc : grubosc + " mm") : "", powloka].map(x => L.vbaTrim(x || "")).filter(Boolean).join(" ");
  const il = L.naLiczbe(m2);
  return (L.vbaTrim(kod) ? L.vbaTrim(kod) + SEP_KOD : "") + opis + (il.ok && il.w > 0 ? "- " + L.ogolny(il.w) + " m2" : "");
}
// kod budowy z wiersza (tekst przed „ | ”), ilość m² z końcówki „- 320 m2”
export function kodBudowy(tekst) { const t = String(tekst || ""), p = t.indexOf(SEP_KOD); return p > 0 ? L.vbaTrim(t.slice(0, p)) : ""; }
export function m2Wiersza(tekst) {
  const m = String(tekst || "").match(/-\s*([\d\s]+(?:[.,]\d+)?)\s*m(?:2|²)(?![a-z0-9])/i);
  return m ? L.liczba(m[1].replace(/\s/g, "")) : 0;
}

// ---------------------------------------------------------------- mail .eml
function qp(s) { return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); }
function naUtf8(bin) { try { return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0) & 255)); } catch { try { return new TextDecoder("iso-8859-2").decode(Uint8Array.from(bin, c => c.charCodeAt(0) & 255)); } catch { return bin; } } }
const b64 = s => { try { return atob(s.replace(/\s+/g, "")); } catch { return ""; } };
// nagłówki zakodowane =?utf-8?B?…?= / =?utf-8?Q?…?=
export function dekodujNaglowek(h) {
  return String(h || "").replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, en, t) => naUtf8(en.toUpperCase() === "B" ? b64(t) : qp(t.replace(/_/g, " ")))).replace(/\s+/g, " ").trim();
}
const bezHtml = h => h.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/p>|<\/tr>|<\/div>/gi, "\n").replace(/<\/td>/gi, " \t ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
function czesci(tresc, typNad) {
  const m = /boundary="?([^";\r\n]+)"?/i.exec(typNad || "");
  if (!m) return [{ naglowki: typNad || "", cialo: tresc }];
  return tresc.split("--" + m[1]).slice(1).filter(x => !x.startsWith("--")).map(cz => {
    const i = cz.search(/\r?\n\r?\n/); return i < 0 ? null : { naglowki: cz.slice(0, i), cialo: cz.slice(i).replace(/^\r?\n\r?\n/, "") };
  }).filter(Boolean);
}
const nag = (h, n) => { const m = new RegExp("^" + n + ":\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)", "im").exec(h); return m ? m[1].replace(/\r?\n[ \t]/g, " ") : ""; };
// bajty pliku → tekst „bajt = znak” (bez dekodowania – mail sam mówi, jakie ma kodowanie)
export function binarny(u8) { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return s; }
// .eml → { od, temat, tekst, pdfy: [{ nazwa, dane: Uint8Array }] }
export function czytajEml(surowy) {
  const i = surowy.search(/\r?\n\r?\n/), H = surowy.slice(0, i), B = surowy.slice(i).replace(/^\r?\n\r?\n/, "");
  const wynik = { od: dekodujNaglowek(nag(H, "From")), temat: dekodujNaglowek(nag(H, "Subject")), tekst: "", pdfy: [] };
  const teksty = [], html = [];
  const przejdz = (naglowki, cialo) => {
    const typ = nag(naglowki, "Content-Type"), kod = nag(naglowki, "Content-Transfer-Encoding").toLowerCase();
    if (/multipart\//i.test(typ)) { for (const c of czesci(cialo, typ)) przejdz(c.naglowki, c.cialo); return; }
    const nazwa = dekodujNaglowek((/name\*?="?([^";\r\n]+)"?/i.exec(nag(naglowki, "Content-Disposition") + ";" + typ) || [])[1] || "");
    const surowe = kod === "base64" ? b64(cialo) : kod === "quoted-printable" ? qp(cialo) : cialo;
    if (/application\/pdf/i.test(typ) || /\.pdf$/i.test(nazwa)) wynik.pdfy.push({ nazwa: nazwa || "oferta.pdf", dane: Uint8Array.from(surowe, c => c.charCodeAt(0) & 255) });
    else if (/text\/html/i.test(typ)) html.push(bezHtml(naUtf8(surowe)));
    else if (/text\/plain/i.test(typ) || !typ) teksty.push(naUtf8(surowe));
  };
  przejdz(H, B);
  wynik.tekst = (teksty.length ? teksty : html).join("\n");
  return wynik;
}

// ---------------------------------------------------------------- ceny w tekście
const LICZBA = String.raw`(\d{1,3}(?:[  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const ZA_M2 = String.raw`(?:zł|zl|pln)?\s*(?:netto\s*)?(?:\/|za\s*|na\s*)\s*(?:1\s*)?m(?:2|²|\^2|kw)`;
const naL = s => L.liczba(String(s).replace(/[  ]/g, "").replace(",", "."));
// ceny „za m²” w kolejności występowania: 45,90 zł/m2 · 45.9 PLN/m² · cena za m2: 45,90 zł
export function cenyZaM2(tekst) {
  const t = String(tekst || ""), out = [];
  const re1 = new RegExp(LICZBA + String.raw`\s*` + ZA_M2, "gi");
  for (let m; (m = re1.exec(t));) out.push({ cena: naL(m[1]), poz: m.index });
  const re2 = new RegExp(String.raw`(?:cen[ay]?|netto)[^\n\d]{0,25}m(?:2|²)[^\n\d]{0,12}` + LICZBA, "gi");
  for (let m; (m = re2.exec(t));) out.push({ cena: naL(m[1]), poz: m.index });
  return out.filter(x => x.cena > 0 && x.cena < 1000).sort((a, b) => a.poz - b.poz);
}
const norm = s => L.LC(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[\s.\-_/]+/g, "");
// dostawca oferty: nazwa z nagłówka zapytania / Ustawień w tekście, potem domena adresu nadawcy
export function rozpoznajDostawce(oferta, kandydaci) {
  const t = norm(oferta.temat + " " + oferta.od + " " + oferta.tekst.slice(0, 3000));
  const K = [...new Map(kandydaci.filter(k => k?.nazwa).map(k => [norm(k.nazwa), k])).values()];
  const poNazwie = K.filter(k => norm(k.nazwa).length >= 3 && t.includes(norm(k.nazwa))).sort((a, b) => norm(b.nazwa).length - norm(a.nazwa).length)[0];
  if (poNazwie) return poNazwie.nazwa;
  const dom = (/@([\w.-]+)/.exec(oferta.od) || [])[1];
  const zDom = dom && K.find(k => (k.email || "").toLowerCase().split(/[,;\s]+/).some(e => e.endsWith("@" + dom.toLowerCase())));
  return zDom ? zDom.nazwa : "";
}
/* ceny dla wierszy zapytania: po kodzie budowy (blacha trapezowa), a gdy oferta dotyczy jednej budowy – pierwsza cena za m².
   wiersze: [{ r, a }] → [{ r, kod, cena, fragment }] */
export function cenyDlaWierszy(tekst, wiersze) {
  const t = String(tekst || ""), T = L.LC(t), wynik = [];
  const zKodem = wiersze.map(w => ({ ...w, kod: kodBudowy(w.a) })).filter(w => w.kod);
  const pozycje = zKodem.map(w => ({ w, i: T.indexOf(L.LC(w.kod)) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i);
  pozycje.forEach((x, n) => {
    const kon = n + 1 < pozycje.length ? pozycje[n + 1].i : Math.min(t.length, x.i + 600);
    const okno = t.slice(x.i, kon), c = cenyZaM2(okno)[0];
    if (c) wynik.push({ r: x.w.r, kod: x.w.kod, cena: c.cena, fragment: okno.slice(Math.max(0, c.poz - 60), c.poz + 40).replace(/\s+/g, " ").trim() });
  });
  if (!wynik.length && wiersze.length === 1) {
    const c = cenyZaM2(t)[0];
    if (c) wynik.push({ r: wiersze[0].r, kod: kodBudowy(wiersze[0].a), cena: c.cena, fragment: t.slice(Math.max(0, c.poz - 60), c.poz + 40).replace(/\s+/g, " ").trim() });
  }
  return wynik;
}
