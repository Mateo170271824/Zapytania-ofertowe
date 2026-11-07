import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ZM from "../js/zamowienia.js";
import * as KP from "../js/kopia.js";

test("pozycja zapytania -> pozycja dostawy w Logistyce", () => {
  assert.deepEqual(ZM.pozycjaDoKursu("Profil 120x80x3 S355 12m- 4 szt"), { nazwa: "Profil 120x80x3 S355 12m", ilosc: 4, jm: "szt" });
  assert.deepEqual(ZM.pozycjaDoKursu("Blacha 2mm- 1,5 t"), { nazwa: "Blacha 2mm", ilosc: 1.5, jm: "t" });
  assert.deepEqual(ZM.pozycjaDoKursu("Obejmy"), { nazwa: "Obejmy", ilosc: 1, jm: "szt" });
});

test("pełna nazwa dostawcy z Ustawień", () => {
  const ust = { dostawcy: [{ dostawca: "Stal-Pol" }, { dostawca: "Hurt Metal" }] };
  assert.equal(ZM.pelnaNazwa("stalpol", ust), "Stal-Pol");
  assert.equal(ZM.pelnaNazwa("hurt", ust), "Hurt Metal");
  assert.equal(ZM.pelnaNazwa("nowy", ust), "Nowy");
});

test("dostawa w formacie Logistyki trafia do „do uzupełnienia”", () => {
  const { kurs, koszt } = ZM.kursLogistyki({ nr: "ZD 1/2026", proj: "1-2026", kontr: "Stal-Pol", transport: "Dostawca", zal: "", dst: "2026-11-20", wagaT: 1.2, pozycje: [], uwagi: "", kto: "test", nazwa: "Test" }, "CZAS");
  assert.equal(kurs.typ, "D"); assert.equal(kurs.doUzup, true); assert.equal(kurs.zrodlo, "ZAPYTANIE");
  assert.equal(kurs.dataS, "2026-11-20"); assert.equal(koszt.dataS, "2026-11-20");
  assert.equal(kurs.odZakupow.kto, "test");
});

test("grupy zamówień wg koloru dostawcy", () => {
  const z = { naglowki: { 2: { t: "Stal-Pol", k: "FFFF00" }, 3: { t: "Inny" } },
    wiersze: [{ a: "Profil 120x80x3 S355 6m- 2 szt", k: "FFFF00", c: { 2: { v: 50 } } }, { a: "Obejma- 4 szt", c: { 2: { v: 3, k: "FFFF00" } } }, { a: "Coś- 1 szt" }] };
  const g = ZM.grupyZamowien(z, { wagi: new Map(), pamiec: {} });
  assert.equal(g.length, 1); assert.equal(g[0].dostawca, "Stal-Pol"); assert.equal(g[0].pozycje.length, 2);
});

const dane = () => ({
  zapytania: [{ _id: "abc", nazwa: "1-2026", kod: "KL", kolejnosc: 1, naglowki: { 2: { t: "Stal-Pol", k: "FFFF00" } }, wiersze: [{ a: "Profil- 2 szt", k: "FFFF00", c: { 2: { v: 50 } } }],
    zmieniono: { toDate: () => new Date("2026-01-02T10:00:00Z") } }],
  projekty: [{ _id: "p1", id: "1-2026", kod: "KL", data: "2026-01-01", pozycje: [{ symbol: "S-1", nazwa: "Profil", jm: "szt", ilosc: 2 }] }],
  ceny: [{ _id: "S-1", symbol: "S-1", nazwa: "Profil", jm: "kg", historia: [{ d: "2026-01-01", c: 5 }] }],
  ustawienia: { dostawcy: [{ dostawca: "Stal-Pol", email: "a@b.pl" }] }, wagi: { rows: [{ t: "PROFIL", w: "1x1", kg: 1 }], pamiec: {} }, generator: {},
});

test("kopia JSON: daty jako tekst, identyfikatory dokumentów zachowane", () => {
  const k = KP.kopiaJSON(dane(), new Date("2026-02-01T00:00:00Z"));
  assert.equal(KP.sprawdzKopie(k), "");
  assert.equal(k.zapytania[0].zmieniono, "2026-01-02T10:00:00.000Z");
  assert.equal(k.projekty[0].id, "1-2026");                    // nazwa projektu nie nadpisuje id dokumentu
  assert.deepEqual(KP.dokumentZKopii(k.projekty[0]).id, "p1");
  assert.equal(KP.dokumentZKopii(k.zapytania[0]).d._doc, undefined);
  assert.ok(KP.sprawdzKopie({ format: "inny" }));
  assert.ok(KP.sprawdzKopie({ format: KP.FORMAT, zapytania: [{}], projekty: [] }));
});

test("kopia Excel: arkusze jak w starym pliku + wybrany dostawca", () => {
  // ta sama biblioteka co w aplikacji (plik w stylu przeglądarki – ładowany jak skrypt na stronie)
  const kt = { console }; kt.self = kt; vm.createContext(kt);
  vm.runInContext(readFileSync(new URL("../vendor/xlsx.full.min.js", import.meta.url), "utf8"), kt);
  const XLSX = kt.XLSX;
  const wb = KP.kopiaExcel(XLSX, KP.kopiaJSON(dane()));
  assert.deepEqual([...wb.SheetNames], ["INFO", "USTAWIENIA", "WAGI", "PROJEKTY", "CENY", "ZAMÓWIENIA", "1-2026"]);
  const a = JSON.parse(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets["1-2026"], { header: 1 })));
  assert.deepEqual(a[0], ["KL", "Stal-Pol", "WYBRANY DOSTAWCA"]);
  assert.deepEqual(a[1], ["Profil- 2 szt", 50, "Stal-Pol"]);
});

test("dostawca z listy Truck App: adres po nazwie", async () => {
  const ZM = await import("../js/zamowienia.js");
  const lista = [{ nazwa: "HURT METAL", adres: "ul. Testowa 1, 00-001 Miasto", tel: "600 000 000" }, { nazwa: "Stal-Pol Wrocław", adres: "ul. Inna 2" }, { nazwa: "", adres: "x" }];
  assert.equal(ZM.dostawcaTruck("Hurt Metal", lista)?.adres, "ul. Testowa 1, 00-001 Miasto");
  assert.equal(ZM.dostawcaTruck("stal-pol", lista)?.nazwa, "Stal-Pol Wrocław");
  assert.equal(ZM.dostawcaTruck("Nieznany", lista), null);
  assert.equal(ZM.dostawcaTruck("", lista), null);
  const { kurs } = ZM.kursLogistyki({ nr: "ZD 1", proj: "", kontr: "Hurt Metal", transport: "Dostawca", zal: "2026-12-01", dst: "", wagaT: 1, pozycje: [], uwagi: "", kto: "a", nazwa: "A", miejsce: "ul. Testowa 1", oddzial: "Wieruszów", kontakt: "600" }, "T");
  assert.equal(kurs.miejsce, "ul. Testowa 1"); assert.equal(kurs.oddzial, "Wieruszów"); assert.equal(kurs.kontakt, "600");
  const { kurs: k2 } = ZM.kursLogistyki({ nr: "ZD 1", kontr: "X", pozycje: [] }, "T");
  assert.equal(k2.miejsce, ""); assert.equal(k2.oddzial, "");
});
