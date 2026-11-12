// Oferty na blachę trapezową z poczty (dane wymyślone).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../js/oferty.js";

test("wiersz blachy trapezowej: kod budowy i m²", () => {
  const a = O.wierszTrapez({ kod: "BUD-17/2026", profil: "T35", grubosc: "0,5", powloka: "RAL 7016", m2: "320" });
  assert.equal(a, "BUD-17/2026 | Blacha trapezowa T35 0,5 mm RAL 7016- 320 m2");
  assert.equal(O.kodBudowy(a), "BUD-17/2026");
  assert.equal(O.m2Wiersza(a), 320);
  assert.equal(O.m2Wiersza("X | T18- 1 250,5 m²"), 1250.5);
});

test("ceny za m² w różnych zapisach", () => {
  assert.deepEqual(O.cenyZaM2("T35 0,5 – 45,90 zł/m2 netto, T18: 39.50 PLN/m² oraz 1 234,00 zł razem").map(x => x.cena), [45.9, 39.5]);
  assert.deepEqual(O.cenyZaM2("Cena netto za m2: 41,20 zł").map(x => x.cena), [41.2]);
  assert.deepEqual(O.cenyZaM2("cena 44 zł netto/m2").map(x => x.cena), [44]);
  assert.deepEqual(O.cenyZaM2("waga 320 kg, 12 m"), []);
});

test("ceny dopasowane do budów po kodzie", () => {
  const W = [{ r: 2, a: "BUD-17/2026 | Blacha trapezowa T35 0,5 mm- 320 m2" }, { r: 3, a: "BUD-21/2026 | Blacha trapezowa T18 0,5 mm- 150 m2" }, { r: 4, a: "BUD-30/2026 | T55- 90 m2" }];
  const t = "Dzień dobry,\nw nawiązaniu do zapytania:\nBUD-21/2026 – T18 0,5 RAL 9002: 38,40 zł/m2\nBUD-17/2026 – T35 0,5 RAL 7016: 45,90 zł/m2 netto\nPozdrawiamy";
  assert.deepEqual(O.cenyDlaWierszy(t, W).map(x => [x.r, x.cena]), [[3, 38.4], [2, 45.9]]);
  // jedna budowa w zapytaniu, oferta bez kodu
  assert.deepEqual(O.cenyDlaWierszy("Oferta: 47,10 zł/m²", [W[0]]).map(x => x.cena), [47.1]);
});

test("mail .eml: nadawca, temat, treść i załącznik PDF", () => {
  const pdf = Buffer.from("%PDF-1.4 test").toString("base64");
  const eml = [
    "From: =?utf-8?Q?Biuro_Blach-Pol?= <oferty@blachpol.example>", "Subject: =?utf-8?B?" + Buffer.from("Oferta – blacha trapezowa").toString("base64") + "?=",
    'Content-Type: multipart/mixed; boundary="XX"', "", "--XX", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: quoted-printable", "",
    "BUD-17/2026: 45,90 z=C5=82/m2", "--XX", 'Content-Type: application/pdf; name="oferta.pdf"', "Content-Transfer-Encoding: base64", "", pdf, "--XX--", ""].join("\r\n");
  const o = O.czytajEml(eml);
  assert.equal(o.temat, "Oferta – blacha trapezowa");
  assert.match(o.od, /blachpol\.example/);
  assert.match(o.tekst, /45,90 zł\/m2/);
  assert.equal(o.pdfy.length, 1); assert.equal(o.pdfy[0].nazwa, "oferta.pdf");
  assert.equal(Buffer.from(o.pdfy[0].dane).toString(), "%PDF-1.4 test");
  assert.equal(O.rozpoznajDostawce(o, [{ nazwa: "Stal-Pol" }, { nazwa: "Blach-Pol", email: "" }]), "Blach-Pol");
  assert.equal(O.rozpoznajDostawce({ ...o, od: "x <a@blachpol.example>", temat: "", tekst: "" }, [{ nazwa: "BP", email: "oferty@blachpol.example" }]), "BP");
});

test("mail .eml odczytany z bajtów pliku (polskie znaki, bez nagłówka kodowania części)", () => {
  const eml = ["From: Biuro <oferty@stalpol.example>", "Subject: RE: zapytanie", "Content-Type: text/plain; charset=utf-8", "", "BUD-17/2026 – 45,90 zł/m2 netto", ""].join("\r\n");
  const o = O.czytajEml(O.binarny(new Uint8Array(Buffer.from(eml))));
  assert.match(o.tekst, /45,90 zł\/m2/);
  assert.deepEqual(O.cenyDlaWierszy(o.tekst, [{ r: 2, a: "BUD-17/2026 | T35- 320 m2" }, { r: 3, a: "BUD-21/2026 | T18- 150 m2" }]).map(x => [x.r, x.cena]), [[2, 45.9]]);
});
