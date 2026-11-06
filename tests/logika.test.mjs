// Testy logiki przeniesionej z makr VBA (dane wymyślone, bez danych firmy).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/logika.js";

test("liczby jak w VBA/Excelu", () => {
  assert.equal(L.vbaRound(2.5), 2);          // zaokrąglenie bankowe
  assert.equal(L.vbaRound(3.5), 4);
  assert.equal(L.vbaRound(1.235, 2), 1.24);
  assert.equal(L.roundUp(1.201, 1), 1.3);
  assert.equal(L.roundUp(-1.21, 1), -1.3);
  assert.deepEqual(L.naLiczbe("1 234,5"), { ok: true, w: 1234.5 });
  assert.equal(L.naLiczbe("abc").ok, false);
  assert.equal(L.liczbaTekst(12), "12");
  assert.equal(L.liczbaTekst(42.4), "42,4");
  assert.equal(L.ogolny(0.1 + 0.2), "0,3");
});

test("numery i nazwy zapytań", () => {
  assert.equal(L.nastepnyNumer(["12-2026", "9-2026 MAG", "40-2025", "x-2026"], 2026), 13);
  assert.equal(L.nastepnyNumer([], 2026), 1);
  assert.equal(L.wolnaNazwa(["5-2026"], "5-2026"), "5-2026 (2)");
  assert.equal(L.wolnaNazwa([], "a/b:c"), "a-b-c");
});

test("treść pozycji w zapytaniu", () => {
  assert.equal(L.trescPozycji({ nazwa: "Profil 120x80x3 S355 12m", ilZap: 4, jm: "szt" }), "Profil 120x80x3 S355 12m- 4 szt");
  assert.equal(L.trescPozycji({ nazwa: "Obejma", ilZap: "" }), "Obejma");
  assert.equal(L.trescPozycji({ nazwa: "Blacha", ilZap: 2.5, jm: "t" }), "Blacha- 2,5 t");
});

test("waga pozycji z tabeli WAGI", () => {
  const ctx = { wagi: L.slownikWag({ rows: [{ t: "PROFIL", w: "120x80x3", kg: 8.75 }] }), pamiec: {}, pytaj: () => null };
  const o = { uwaga: "" };
  assert.ok(L.obliczWagePozycji("Profil 120x80x3 S235 6m- 10 szt", ctx, o));
  assert.equal(o.szt, 10); assert.equal(o.dl, 6); assert.equal(o.kgmb, 8.75);
  assert.equal(Math.round(o.waga * 100) / 100, 525);
});

test("kolory i skrajne ceny", () => {
  assert.equal(L.kolor("ffffff"), -1);
  assert.equal(L.kolor("ffff00"), "FFFF00");
  assert.equal(L.kolor(undefined), -1);
  const p = L.pierwszaLiczba("x 12,5 szt");
  assert.equal(p.w, 12.5); assert.equal(p.reszta, "szt");
});
