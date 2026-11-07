// Zamówienie profili z zapytania → Zakupy profili (dane wymyślone)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ZM from "../js/zamowienia.js";

const KLUCZE = ["50x50x2,5 / 4800", "50x50x2,5 / 6000", "60x40x3 / 6000", "80x80x4 / 12000"];

test("wymiary profilu z tekstu pozycji", () => {
  assert.deepEqual(ZM.wymiarProfilu("Profil zamknięty 50x50x2,5 S355 4800- 20 szt"), { a: 50, b: 50, g: 2.5, dl: 4800 });
  assert.deepEqual(ZM.wymiarProfilu("Kształtownik 40×60×3 6m"), { a: 60, b: 40, g: 3, dl: 6000 });
  assert.deepEqual(ZM.wymiarProfilu("50x50x2,5 / 4800"), { a: 50, b: 50, g: 2.5, dl: 4800 });
  assert.equal(ZM.wymiarProfilu("Blacha 3mm"), null);
  assert.equal(ZM.wymiarProfilu("Profil 80x80x4 S355").dl, null);
});

test("dopasowanie indeksu Zakupów", () => {
  assert.equal(ZM.dopasujIndeks("Profil 50x50x2,5 S355 4800- 20 szt", KLUCZE), "50x50x2,5 / 4800");
  assert.equal(ZM.dopasujIndeks("Profil 40x60x3 6 m", KLUCZE), "60x40x3 / 6000");
  assert.equal(ZM.dopasujIndeks("Profil 80x80x4 S355", KLUCZE), "80x80x4 / 12000");   // jedyny 80x80x4 – długość niepotrzebna
  assert.equal(ZM.dopasujIndeks("Profil 50x50x2,5 S355", KLUCZE), "");                 // dwie długości – wybierze człowiek
  assert.equal(ZM.dopasujIndeks("Profil 100x100x5 6000", KLUCZE), "");
});

test("cena za tonę", () => {
  assert.equal(ZM.cenaZaTone(3800, "t", 2, 0), 3800);
  assert.equal(ZM.cenaZaTone(3.9, "kg", 100, 100), 3900);
  assert.equal(ZM.cenaZaTone(150, "szt", 20, 750), 4000);   // 3000 zł za 0,75 t
  assert.equal(ZM.cenaZaTone(150, "szt", 20, -1), null);
  assert.equal(ZM.cenaZaTone("", "t", 1, 1), null);
});

test("dostawca z listy Zakupów i dokumenty zamówienia", () => {
  assert.equal(ZM.dostawcaZakupow("HUTA POKOJ", ["Marcegaglia", "Huta Pokój"]), "Huta Pokój");
  assert.equal(ZM.dostawcaZakupow("marcegaglia polska", ["Marcegaglia"]), "Marcegaglia");
  assert.equal(ZM.dostawcaZakupow("Nieznany", ["Marcegaglia"]), "");
  const L = ZM.zamowieniaZakupow([{ key: "50x50x2,5 / 4800", t: "12,5".replace(",", "."), price: 3800 }, { key: "", t: 1 }, { key: "60x40x3 / 6000", t: 0 }],
    { nr: "", sup: "Huta Pokój", date: "2026-11-07", zd: "ZD 5/11/2026", term: "2026-11-20", note: "z zapytania 12-2026" });
  assert.equal(L.length, 1);
  assert.deepEqual(L[0], { nr: "", sup: "Huta Pokój", date: "2026-11-07", zd: "ZD 5/11/2026", term: "2026-11-20", price: 3800, closed: false, note: "z zapytania 12-2026", key: "50x50x2,5 / 4800", t: 12.5 });
});

test("jedna lista dostawców: dopisanie do kartoteki Truck App bez nadpisywania", () => {
  const T = [{ nazwa: "HUTA POKÓJ", adres: "ul. Hallera 70", email: "", kontakt: "" }, { nazwa: "Stal-Pol", adres: "", email: "biuro@stalpol.example", kontakt: "Jan" }];
  const r = ZM.scalDostawcow(T, [{ nazwa: "Huta Pokoj", email: "oferty@huta.example", osoba: "Ewa" }, { nazwa: "Stal-Pol", email: "inny@x.example" }, { nazwa: "Nowa Hurtownia", email: "n@x.example" }, { nazwa: "" }], "zap");
  const h = r.lista.find(x => x.nazwa === "HUTA POKÓJ"), s = r.lista.find(x => x.nazwa === "Stal-Pol"), n = r.lista.find(x => x.nazwa === "Nowa Hurtownia");
  assert.equal(h.email, "oferty@huta.example"); assert.equal(h.kontakt, "Ewa"); assert.equal(h.adres, "ul. Hallera 70"); assert.equal(h.zap, true);
  assert.equal(s.email, "biuro@stalpol.example"); assert.equal(s.kontakt, "Jan");      // nie nadpisuje
  assert.deepEqual(n, { nazwa: "Nowa Hurtownia", adres: "", nip: "", tel: "", kontakt: "", email: "n@x.example", zap: true });
  assert.equal(r.lista.length, 3); assert.equal(T[0].email, "");                           // wejście bez zmian
  assert.equal(ZM.scalDostawcow(r.lista, [{ nazwa: "Stal-Pol" }], "zak").zmiany, 1);       // tylko nowa flaga (inna aplikacja)
  assert.equal(ZM.scalDostawcow(r.lista, [{ nazwa: "Huta Pokój", email: "x" }], "zap").zmiany, 0);
});

test("kod projektu do wspólnego słownika", () => {
  assert.equal(ZM.kodProjektu("  halm "), "HALM");
  assert.equal(ZM.kodProjektu("budc  2"), "BUDC 2");
});
