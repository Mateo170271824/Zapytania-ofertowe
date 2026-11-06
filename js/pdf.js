/* PDF kosztu projektu – układ jak „Wycena wewnętrzna” (makro KosztDoPDF):
   A4 poziomo, logo Skavska, „Dokument wewnętrzny”, tytuł KOSZT PROJEKTU, wskaźniki, sekcje z tabelami, stopka „Strona X/N”. */
import { PDF_FONT_R, PDF_FONT_B } from "../vendor/pdf-czcionki.js";
import { vbaRound } from "./logika.js?v=202611061440";

const NAVY = [18, 69, 125], SZARY = [100, 113, 120], TEKST = [33, 37, 41], CZERW = [192, 57, 43], CZARNY = [20, 24, 28];
const NAGL_BG = [227, 232, 242], ZEBRA = [247, 250, 250], SUMA_BG = [242, 245, 247], LINIA = [209, 217, 219];

const ladujSkrypt = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Nie wczytano " + src)); document.head.append(s); });
let gotowe = null;
function biblioteki() {
  if (!gotowe) gotowe = (window.jspdf ? Promise.resolve() : ladujSkrypt("vendor/jspdf.umd.min.js"))
    .then(() => window.jspdf.jsPDF.API.autoTable ? null : ladujSkrypt("vendor/jspdf.plugin.autotable.min.js"));
  return gotowe;
}
async function logo() {
  try { const r = await fetch("img/logo-skavska.png"); const b = await r.blob(); return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); }
  catch { return null; }
}
// liczby jak w druku: całe bez przecinka („1”, „78”), ułamki „5,5”
function liczbaDruk(x, fmt) {
  if (x === "" || x === null || x === undefined) return "–";
  if (x === "?") return "?";
  if (typeof x !== "number") return String(x);
  const grup = (v, d) => { let [c, u] = Math.abs(v).toFixed(d).split("."); c = c.replace(/\B(?=(\d{3})+(?!\d))/g, " "); return (v < 0 ? "-" : "") + c + (u ? "," + u : ""); };
  switch (fmt) {
    case "zl": return grup(x, 2) + " zł";
    case "proc": return (x * 100).toFixed(1).replace(".", ",") + "%";
    case "kg": case "n1": return grup(x, 1);
    case "t": return grup(x, 3);
    case "n2": return grup(x, 2);
    default: {
      if (x === Math.trunc(x)) return grup(x, 0);
      let s = grup(x, 2); return s.replace(/,?0+$/, "");
    }
  }
}

export async function kosztPDF({ k, p, kiedy }) {
  await biblioteki();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("dv.ttf", PDF_FONT_R); doc.addFont("dv.ttf", "DV", "normal");
  doc.addFileToVFS("dvb.ttf", PDF_FONT_B); doc.addFont("dvb.ttf", "DV", "bold");
  const W = 297, ML = 13, MR = 13, szer = W - ML - MR;
  const pad2 = n => String(n).padStart(2, "0");
  const dataD = `${pad2(kiedy.getDate())}.${pad2(kiedy.getMonth() + 1)}.${kiedy.getFullYear()}`;
  const nr = p.id, kl = p.kod || "";
  const razem = vbaRound(k.sumMag + k.sumZak, 2), wagaC = vbaRound(k.sumWaga, 1);
  const kolor = (c) => doc.setTextColor(...c);

  // ---------- nagłówek strony
  let y = 12;
  const lg = await logo();
  let lewo = ML;
  if (lg) { doc.addImage(lg, "PNG", ML, y - 2, 17.6, 13.4); lewo = ML + 17.6 + 3; }
  doc.setFont("DV", "bold"); doc.setFontSize(12); kolor(CZARNY); doc.text("Skavska Hale sp Z O.O.", lewo, y + 3);
  doc.setFont("DV", "normal"); doc.setFontSize(9); kolor(CZERW); doc.text("Dokument wewnętrzny – nie przekazywać klientowi!", lewo, y + 8);
  doc.setFont("DV", "bold"); doc.setFontSize(20); kolor(NAVY); doc.text("KOSZT PROJEKTU", W - MR, y + 3, { align: "right" });
  doc.setFont("DV", "normal"); doc.setFontSize(9); kolor(SZARY); doc.text("Data: " + dataD, W - MR, y + 8.5, { align: "right" });
  y += 13; doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(ML, y, W - MR, y);

  // ---------- tytuł + wskaźniki
  y += 9;
  doc.setFont("DV", "bold"); doc.setFontSize(16); kolor(CZARNY); doc.text("Zapytanie " + nr, ML, y + 2);
  const kpi = [["Klient", kl || "–"], ["Pozycji", String(k.pozycje.length)], ["Waga całości", liczbaDruk(wagaC, "kg") + " kg"], ["Koszt razem", liczbaDruk(razem, "zl")]];
  let x = W - MR;
  for (let i = kpi.length - 1; i >= 0; i--) {
    const [e, v] = kpi[i];
    doc.setFont("DV", "bold"); doc.setFontSize(12); const wv = doc.getTextWidth(v);
    doc.setFont("DV", "normal"); doc.setFontSize(8); const we = doc.getTextWidth(e);
    const w = Math.max(wv, we, 22);
    kolor(SZARY); doc.text(e, x, y - 3.5, { align: "right" });
    doc.setFont("DV", "bold"); doc.setFontSize(12); kolor(CZARNY); doc.text(v, x, y + 2, { align: "right" });
    x -= w + 8;
  }
  y += 6;

  const sekcja = t => { if (y > 180) { doc.addPage(); y = 15; } y += 5; doc.setFont("DV", "bold"); doc.setFontSize(9); kolor(NAVY); doc.text(t.toUpperCase(), ML, y); y += 2.5; };
  const notatka = (t, ostrz) => {
    doc.setFont("DV", ostrz ? "bold" : "normal"); doc.setFontSize(8); kolor(ostrz ? CZERW : SZARY);
    const linie = doc.splitTextToSize(t, szer); if (y + linie.length * 3.6 > 195) { doc.addPage(); y = 15; }
    doc.text(linie, ML, y + 3.5); y += linie.length * 3.6 + 1.5;
  };
  const tabela = (head, body, opcje) => {
    doc.autoTable({
      startY: y, margin: { left: ML, right: MR, top: 14, bottom: 16 }, head: [head], body, theme: "plain",
      styles: { font: "DV", fontSize: opcje.mala ? 7.5 : 9, textColor: TEKST, cellPadding: { top: 1.6, bottom: 1.6, left: 1.6, right: 1.6 }, valign: "middle", overflow: "linebreak", lineColor: LINIA },
      headStyles: { font: "DV", fontStyle: "bold", fillColor: NAGL_BG, textColor: NAVY, fontSize: opcje.mala ? 7 : 8.5 },
      columnStyles: opcje.kolumny, tableWidth: opcje.szer || szer,
      didParseCell: d => {
        if (d.section !== "body") return;
        const meta = opcje.meta?.[d.row.index] || {};
        if (meta.suma) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = SUMA_BG; }
        else if (d.row.index % 2 === 1) d.cell.styles.fillColor = ZEBRA;
        if (meta.pod) d.cell.styles.textColor = SZARY;
        if (d.cell.raw === "?") d.cell.styles.textColor = CZERW;
        if (meta.brak && d.column.index === 13) d.cell.styles.textColor = CZERW;
      },
      didDrawCell: d => { if (d.section === "body") { doc.setDrawColor(...LINIA); doc.setLineWidth(0.2); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height); } },
      willDrawPage: d => { if (d.pageNumber > 1) y = 14; },
    });
    y = doc.lastAutoTable.finalY + 2;
  };

  // ---------- podsumowanie kosztów
  sekcja("Podsumowanie kosztów");
  const sumy = [["Materiał z magazynu (cena ostatniego zakupu)", vbaRound(k.sumMag, 2)], ["Materiał do zakupu (ceny z zapytania)", vbaRound(k.sumZak, 2)],
    ...k.dostawcy.map(d => ["      w tym: " + d.d, vbaRound(d.s, 2), true])];
  const rowsS = sumy.map(([t, v]) => [t, liczbaDruk(v, "zl"), razem > 0 ? liczbaDruk(v / razem, "proc") : "–"]);
  rowsS.push(["Koszt razem", liczbaDruk(razem, "zl"), liczbaDruk(1, "proc")]);
  tabela(["Pozycja", "Kwota netto", "Udział w koszcie"], rowsS, { szer: szer * 0.62, kolumny: { 1: { halign: "right" }, 2: { halign: "right" } }, meta: [...sumy.map(s => ({ pod: !!s[2] })), { suma: true }] });
  notatka("Materiał z magazynu wg ceny ostatniego zakupu (Subiekt). Materiał do zakupu wg ceny dostawcy zaznaczonego kolorem w zapytaniu.", false);
  if (k.ileBrak) notatka(`${k.ileBrak} poz. bez pełnej ceny - nie ma ich (w całości) w sumie. Patrz UWAGI.`, true);

  // ---------- waga
  sekcja("Waga materiału");
  const wg = [["Waga całości (materiał na projekt)", vbaRound(k.sumWaga, 1)], ["     w tym z magazynu", vbaRound(k.sumWaga - k.sumWagaZak, 1)], ["     w tym do zakupu", vbaRound(k.sumWagaZak, 1)]];
  tabela(["Pozycja", "Waga [kg]", "Waga [t]"], wg.map(([t, v]) => [t.trim() === t ? t : "      " + t.trim(), liczbaDruk(v, "kg"), liczbaDruk(vbaRound(v / 1000, 3), "t")]),
    { szer: szer * 0.62, kolumny: { 1: { halign: "right" }, 2: { halign: "right" } }, meta: [{ suma: true }, { pod: true }, { pod: true }] });
  if (k.ileBezWagi) notatka(`${k.ileBezWagi} poz. bez wagi - nie ma ich w sumie wagi. Patrz UWAGI.`, true);

  // ---------- pozycje
  sekcja("Pozycje materiałowe");
  const R2 = v => vbaRound(v, 2);
  const rows = k.pozycje.map((x, i) => [String(i + 1), x.nazwa, x.jm, liczbaDruk(x.ilosc, "n"), liczbaDruk(x.zMag, "n"), x.cz > 0 ? liczbaDruk(x.cz, "n2") : "–",
    x.kosztMag > 0 ? liczbaDruk(R2(x.kosztMag), "zl") : "–", liczbaDruk(x.doZak, "n"), x.dost || "", x.cena > 0 ? liczbaDruk(x.cena, "n2") : "–", x.jedn || "–",
    x.ilRozl > 0 ? liczbaDruk(R2(x.ilRozl), "n") : "–", x.kosztZak > 0 ? liczbaDruk(R2(x.kosztZak), "zl") : "–", liczbaDruk(R2(x.kosztMag + x.kosztZak), "zl"),
    x.waga >= 0 ? liczbaDruk(vbaRound(x.waga, 1), "n1") : (x.ilosc > 0 ? "?" : "–")]);
  rows.push(["", "Razem", "", "", "", "", liczbaDruk(R2(k.sumMag), "zl"), "", "", "", "", "", liczbaDruk(R2(k.sumZak), "zl"), liczbaDruk(razem, "zl"), liczbaDruk(vbaRound(k.sumWaga, 1), "n1")]);
  const szerK = [4.5, 34, 5.5, 9, 9, 10, 12, 9, 14, 9, 6, 9, 12, 12, 9], sk = szerK.reduce((a, b) => a + b, 0);
  const kol = {}; szerK.forEach((w, i) => { kol[i] = { cellWidth: szer * w / sk, halign: [0, 2, 10].includes(i) ? "center" : [1, 8].includes(i) ? "left" : "right" }; });
  tabela(["LP", "Pozycja", "J.m.", "Ilość na projekt", "Z magazynu", "Cena zakupu", "Koszt mag.", "Do zakupu", "Dostawca", "Cena dost.", "Jedn. ceny", "Ilość [mb/kg]", "Koszt zakupu", "Razem", "Waga [kg]"],
    rows, { mala: true, kolumny: kol, meta: [...k.pozycje.map(x => ({ brak: x.brakCeny })), { suma: true }] });

  // ---------- uwagi
  const uw = k.pozycje.map((x, i) => x.uwagi ? `LP ${i + 1} (${x.nazwa}): ${x.uwagi}` : "").filter(Boolean);
  if (uw.length) { sekcja("Uwagi do pozycji"); uw.forEach(t => notatka(t, false)); }

  // ---------- stopka
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont("DV", "normal"); doc.setFontSize(8); kolor(SZARY);
    doc.text(`Koszt projektu · ${nr}${kl ? " · " + kl : ""} · ${dataD}`, ML, 210 - 8);
    doc.text(`Strona ${i}/${n}`, W - MR, 210 - 8, { align: "right" });
  }
  const bez = s => s.replace(/[\\/:*?"<>|]/g, "-");
  const nazwa = bez(`Koszt_projektu_${nr}${kl ? "_" + kl : ""}_${kiedy.getFullYear()}-${pad2(kiedy.getMonth() + 1)}-${pad2(kiedy.getDate())}`).replace(/ /g, "_") + ".pdf";
  return { blob: doc.output("blob"), nazwa };
}
