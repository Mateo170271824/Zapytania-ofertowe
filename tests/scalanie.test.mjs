// Łączenie zmian w zapytaniu (trzy wersje: baza / ich / moje) – do poziomu komórki arkusza.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scal3 } from "../js/logika.js";

const baza = () => ({ nazwa: "Zap 1", naglowki: { 3: { t: "Huta A" } }, wiersze: [{ a: "IPE 200", c: { 2: "10" } }, { a: "HEB 100", c: { 2: "5" } }] });
test("różne komórki – łączy się samo", () => {
  const b = baza(), ich = baza(), moje = baza();
  ich.wiersze[0].c[3] = "4,20";      // ktoś wpisał cenę
  moje.wiersze[1].c[2] = "7";        // ja zmieniłem ilość
  const s = scal3(b, ich, moje);
  assert.deepEqual(s.konflikty, []);
  assert.equal(s.wynik.wiersze[0].c[3], "4,20");
  assert.equal(s.wynik.wiersze[1].c[2], "7");
});
test("ta sama komórka różnie – konflikt ze ścieżką komórki", () => {
  const b = baza(), ich = baza(), moje = baza();
  ich.wiersze[1].c[2] = "6"; moje.wiersze[1].c[2] = "8";
  assert.deepEqual(scal3(b, ich, moje).konflikty, ["wiersze.1.c.2"]);
});
test("nagłówek i nazwa po różnych stronach – łączy się", () => {
  const b = baza(), ich = baza(), moje = baza();
  ich.naglowki[3].t = "Huta B"; moje.nazwa = "Zap 1 – pilne";
  const s = scal3(b, ich, moje);
  assert.deepEqual(s.konflikty, []); assert.equal(s.wynik.naglowki[3].t, "Huta B"); assert.equal(s.wynik.nazwa, "Zap 1 – pilne");
});
test("dodane wiersze po obu stronach – konflikt listy wierszy", () => {
  const b = baza(), ich = baza(), moje = baza();
  ich.wiersze.push({ a: "Rura", c: {} }); moje.wiersze.push({ a: "Blacha", c: {} });
  assert.deepEqual(scal3(b, ich, moje).konflikty, ["wiersze"]);
});
test("wiersz dodany tylko po jednej stronie – bez konfliktu", () => {
  const b = baza(), ich = baza(), moje = baza();
  moje.wiersze.push({ a: "Blacha", c: {} });
  const s = scal3(b, ich, moje);
  assert.deepEqual(s.konflikty, []); assert.equal(s.wynik.wiersze.length, 3);
});
