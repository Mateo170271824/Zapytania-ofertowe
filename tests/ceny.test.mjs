import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/logika.js";
import * as CE from "../js/ceny.js";

const ctx = { wagi: L.slownikWag({ rows: [{ t: "PROFIL", w: "100x100x4", kg: 11.7 }] }), pamiec: {}, pytaj: () => null };

test("gatunek dzieli wyrób, długość nie", () => {
  const a = CE.wyrob("Profil 100x100x4 S235 6m"), b = CE.wyrob("Profil 100x100x4 S355 6m"), c = CE.wyrob("Profil 100x100x4 S355 12m");
  assert.notEqual(a.klucz, b.klucz);
  assert.equal(b.klucz, c.klucz);
  assert.equal(CE.gatunek("PROFIL 100X100X4 S355"), "S355");
  assert.equal(CE.powloka("BLACHA OCYNK 1MM"), "ocynk");
});

test("przeliczenie zł/kg, zł/mb, zł/szt", () => {
  const m = CE.miaryZNazwy("Profil 100x100x4 S235 6m", ctx);
  assert.equal(m.kgmb, 11.7); assert.equal(m.dl, 6);
  const r = CE.przelicz(5, "kg", m);
  assert.equal(r.zlKg, 5);
  assert.equal(Math.round(r.zlMb * 100) / 100, 58.5);
  assert.equal(Math.round(r.zlSzt * 100) / 100, 351);
});

test("pręty zawsze za kg, reszta wg Subiekta albo wagi", () => {
  assert.equal(CE.jednostkaCeny("Pręt fi 20 S235 6m", 400, ctx).jm, "kg");
  assert.equal(CE.jednostkaCeny("Profil 100x100x4 S235 6m", 351, ctx, "szt.").jm, "szt");
  assert.equal(CE.jednostkaCeny("Profil 100x100x4 S235 6m", 351, ctx).jm, "szt");   // 351 / 70,2 kg = 5 zł/kg
});

test("wykluczenia: wypałki, wózki, rodzaj KT", () => {
  assert.ok(CE.WYKLUCZ_NAZWA.test("WYPAŁKA 10MM"));
  assert.ok(CE.WYKLUCZ_NAZWA.test("WÓZEK PODWIESZANY"));
  assert.ok(CE.WYKLUCZ_RODZAJ.includes("KT"));
});

test("nowe pozycje do bazy: z eksportu i z zamówienia, bez duplikatów", () => {
  const istn = [{ _id: "T-1", nazwa: "Profil 100x100x4 S235 6m" }];
  const { dokumenty } = CE.noweDoBazy([
    { symbol: "T-1", nazwa: "Profil 100x100x4 S235 6m", cena: 351, jm: "szt", zrodlo: "zakup", data: "2026-11-07" },           // już jest
    { symbol: "T-2", nazwa: "Profil 100x100x4 S355 6m", cena: 360, jm: "szt", zrodlo: "zakup", data: "2026-11-07" },           // nowy z eksportu
    { symbol: "", nazwa: "Profil 100x100x4 S355 12m", cena: 60, jm: "szt", zrodlo: "zamowienie", data: "2026-11-07", dostawca: "Stal-Pol", zapytanie: "5-2026" },
    { symbol: "", nazwa: "Obejma rurowa 42,4", cena: 4.5, jm: "szt", zrodlo: "zamowienie", data: "2026-11-07", dostawca: "Stal-Pol" },
    { symbol: "", nazwa: "Wypałka 10mm", cena: 9, jm: "szt", zrodlo: "zamowienie", data: "2026-11-07" },                       // wykluczona
    { symbol: "", nazwa: "Obejma rurowa 42,4", cena: 4.6, jm: "szt", zrodlo: "zamowienie", data: "2026-11-07" },               // drugi raz w tej samej paczce
  ], istn, ctx);
  assert.deepEqual(dokumenty.map(x => [x.id, x.d.jm, x.d.historia[0].c]), [
    ["T-2", "szt", 360], ["N-profil-100x100x4-s355-12m", "mb", 60], ["N-obejma-rurowa-42-4", "szt", 4.5]]);
  assert.equal(dokumenty[1].d.zrodlo, "zamowienie"); assert.equal(dokumenty[1].d.historia[0].dost, "Stal-Pol");
});

test("pozycje dopisane z eksportu/zamówienia nie dublują cen w zestawieniu", () => {
  const lista = [{ symbol: "T-2", nazwa: "Profil 100x100x4 S355 6m", jm: "szt", zrodlo: "zakup", historia: [{ d: "2026-11-07", c: 360 }] }];
  assert.equal(CE.zbierzCeny({ lista }, ctx).length, 0);
  assert.equal(CE.zbierzCeny({ lista: [{ ...lista[0], zrodlo: undefined }] }, ctx).length, 1);
});
