// Test ekranowy całej aplikacji na emulatorze Firebase i wymyślonych danych.
// Uruchomienie: npm run test:e2e (wymaga Javy; instaluje firebase-tools, playwright).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "firebase/firestore";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const TU = dirname(fileURLToPath(import.meta.url)), REPO = join(TU, "..", "..");
const ADRES = process.env.ADRES || "http://localhost:8766/index.html?emu";
const PID = "logistyka-app-41d7a", DOM = "@konta." + PID + ".firebaseapp.com";
const TMP = mkdtempSync(join(tmpdir(), "zap-e2e-"));
const kt = { console }; kt.self = kt; vm.createContext(kt);
vm.runInContext(readFileSync(join(REPO, "vendor/xlsx.full.min.js"), "utf8"), kt);
const XLSX = kt.XLSX;

const env = await initializeTestEnvironment({ projectId: PID, firestore: { rules: readFileSync(join(TU, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8085 } });
const baza = fn => env.withSecurityRulesDisabled(c => fn(c.firestore()));
const ile = async kol => { let n = 0; await baza(async db => { n = (await getDocs(collection(db, kol))).size; }); return n; };
async function konto(login) {
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: login + DOM, password: "haslo123", returnSecureToken: true }) });
  return (await r.json()).localId;
}
const U = { wlasciciel: await konto("wlasciciel"), zastepca: await konto("zastepca") };
await baza(async db => {
  await setDoc(doc(db, "meta/init"), { admin: U.wlasciciel });
  await setDoc(doc(db, "uzytkownicy/" + U.wlasciciel), { login: "wlasciciel", nazwa: "Jan Testowy", rola: "biuro", aktywny: true });
  await setDoc(doc(db, "uzytkownicy/" + U.zastepca), { login: "zastepca", nazwa: "Ewa Zastępcza", rola: "biuro", aktywny: true });
  await setDoc(doc(db, "zap_ustawienia/config"), {
    prog: 0, naZD: "TAK", osobno: "NIE", krok: 1, start: 2, rok: "", kodWNazwie: "NIE",
    temat: "Zapytanie ofertowe {NUMER}", poczatek: "Dzień dobry,\nproszę o ofertę:", koniec: "Pozdrawiam", doKogo: "",
    grupy: [{ grupa: "PROFILE", kolejnosc: 1, uwzgl: "TAK", min: 0, gdyZero: "" }, { grupa: "INNE", kolejnosc: 2, uwzgl: "TAK", min: 0, gdyZero: "" }],
    slowa: [{ slowo: "PROFIL", grupa: "PROFILE" }],
    dostawcy: [{ dostawca: "Stal-Pol", email: "oferty@stalpol.example", wysylaj: "TAK", osoba: "" }, { dostawca: "Hurt Metal", email: "biuro@hurtmetal.example", wysylaj: "TAK", osoba: "" }],
  });
  // Truck App: lista dostawców z adresami i oddziały (adres trafia do dostawy w Logistyce)
  await setDoc(doc(db, "ustawienia/glowne"), { dostawcy: [{ nazwa: "HURT METAL", adres: "ul. Hutnicza 9, 00-009 Testowo", tel: "600 000 009" }] });
  await setDoc(doc(db, "ustawienia/publiczne"), { oddzialy: [{ nazwa: "Oddział A", adres: "" }, { nazwa: "Oddział B", adres: "" }] });
  // Zakupy profili (Kombajn Zakupowca): indeksy profili i dostawcy
  await setDoc(doc(db, "zak_cfg/main"), { skus: [{ key: "120x80x3 / 6000" }, { key: "120x80x3 / 12000" }, { key: "60x60x4 / 6000" }], suppliers: ["Stal-Pol", "Hurt Metal"] });
  await setDoc(doc(db, "zap_ustawienia/wagi"), { rows: [{ t: "PROFIL", w: "120x80x3", kg: 8.75, o: "", u: "" }], pamiec: {} });
});
// eksport braków z Subiekta (wymyślony)
const plikEksportu = join(TMP, "Braki TESTKL.xlsx");
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Symbol", "Nazwa", "J.m.", "Stan", "Niezarezerwowane", "Na ZD", "Cena netto"],
    ["T-001", "Profil 120x80x3 S355 6m", "szt", 2, -4, 0, 300],
    ["T-002", "Blacha 3mm S235 1500x3000", "szt", 8, 5, 0, 420],
    ["T-003", "Obejma rurowa 42,4", "szt", 0, -10, 0, 4.5],
  ]), "Arkusz1");
  writeFileSync(plikEksportu, Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" })));
}

const FB = join(REPO, "node_modules/firebase/");
const b = await chromium.launch();
const bledy = [], wyniki = [];
const ok = (n, v, extra = "") => wyniki.push((v ? "OK    " : "BŁĄD  ") + n + (extra ? "  → " + extra : ""));
async function strona(szer = 1366) {
  const ctx = await b.newContext({ viewport: { width: szer, height: 900 }, acceptDownloads: true });
  if (existsSync(FB + "firebase-app.js")) await ctx.route(/gstatic\.com\/firebasejs\/10\.12\.2\/(.*)$/, r => r.fulfill({ path: FB + r.request().url().split("/").pop(), contentType: "application/javascript" }));
  const p = await ctx.newPage();
  p.on("pageerror", e => bledy.push("PAGEERR " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/fonts|TUNNEL|ERR_|favicon/.test(m.text())) bledy.push("CONSOLE " + m.text()); });
  await p.goto(ADRES);
  return p;
}
const W = ms => new Promise(r => setTimeout(r, ms));
async function zaloguj(p, l) { await p.waitForSelector("#v-login:not([hidden])"); await p.fill("#lgLogin", l); await p.fill("#lgPass", "haslo123"); await p.click("#loginF button"); await p.waitForSelector("#v-app:not([hidden])", { timeout: 15000 }); }
const dlgOk = async (p, v = "ok") => { await p.waitForSelector("#dlg[open]"); await p.click(`#dlg button[value="${v}"]`); await W(150); };
const txt = async (p, s) => (await p.$eval(s, e => e.innerText)).replace(/ /g, " ");
const rok = new Date().getFullYear();
const zrzut = async (p, n) => { if (process.env.ZRZUTY) await p.screenshot({ path: join(process.env.ZRZUTY, n + ".png"), fullPage: true }); };

try {
  let p = await strona(); await zaloguj(p, "wlasciciel");
  // 1. generator
  await p.click("#tabs [data-v=generator]"); await W(400);
  await p.setInputFiles("#gFile", plikEksportu); await p.waitForSelector("#dlg[open]");
  ok("eksport wczytany: 2 pozycje do zapytania", (await txt(p, "#dlg")).includes("Do zapytania (brak na magazynie): 2"), (await txt(p, "#dlg")).replace(/\n/g, " ").slice(0, 100));
  ok("eksport: nowe pozycje z ceną zakupu w bazie", (await txt(p, "#dlg")).includes("Nowe pozycje dopisane do bazy cen: 3") && await ile("zap_ceny") === 3);
  await dlgOk(p); await W(500);
  await p.click("#gDopisz"); await p.waitForSelector("#wlN");
  await p.fill("#wlN", "Kątownik 50x50x5 S235 6m"); await p.fill("#wlI", "3"); await p.keyboard.press("Enter"); await W(200);
  await dlgOk(p); await W(1200);
  ok("dopisano ręcznie do wczytanej listy", (await txt(p, "#widok")).includes("Kątownik 50x50x5 S235 6m"));
  await p.click("#gUtworz"); await p.waitForSelector("#dlg[open]");
  ok("zapytanie utworzone", (await txt(p, "#dlg")).includes(`1-${rok}`));
  await W(800);
  await baza(async db => { const d = (await getDoc(doc(db, "projekty/TESTKL"))).data();
    ok("kod klienta we wspólnym słowniku projektów", d && d.kod === "TESTKL" && d.zrodla?.zap === true, JSON.stringify(d)); });
  await dlgOk(p, "tak"); await p.waitForSelector("#dlg[open]"); await W(200);
  const mail = await txt(p, "#dlg");
  ok("mail: temat, pozycje, adresy", mail.includes(`Zapytanie ofertowe 1/${rok}`) && mail.includes("Profil 120x80x3 S355 6m- 4 szt") && mail.includes("Obejma rurowa 42,4- 10 szt") && mail.includes("Kątownik 50x50x5 S235 6m- 3 szt") && mail.includes("hurtmetal.example"));
  await dlgOk(p);
  ok("projekt zapisany", await ile("zap_projekty") === 1);
  // 2. arkusz: dostawcy, ceny, formuła, wybór kolorem
  await p.click("#tabs [data-v=zapytania]"); await W(300); await p.fill("#lQ", `1-${rok}`); await p.keyboard.press("Enter"); await p.waitForSelector("#aGrid table");
  await p.click('#aGrid input[data-r="1"][data-c="2"]'); await p.keyboard.type("Stal-Pol"); await p.keyboard.press("Enter");
  await p.keyboard.type("58"); await p.keyboard.press("Enter"); await p.keyboard.type("=2,5*2"); await p.keyboard.press("Enter");
  await p.click('#aGrid input[data-r="1"][data-c="3"]'); await p.keyboard.type("Hurt Metal"); await p.keyboard.press("Enter");
  await p.keyboard.type("55,5"); await p.keyboard.press("Enter"); await p.keyboard.type("4,8"); await p.keyboard.press("Enter"); await p.keyboard.type("4,9"); await p.keyboard.press("Enter"); await W(1500);
  const b3 = await p.$eval('#aGrid input[data-r="3"][data-c="2"]', e => e.value.replace(/ /g, " "));
  ok("formuła =2,5*2 → 5,00 zł", b3 === "5,00 zł", b3);
  await p.click("#aWybor"); await p.click('#aGrid td[data-r="2"][data-c="3"]'); await p.click('#aGrid td[data-r="3"][data-c="3"]'); await p.click('#aGrid td[data-r="4"][data-c="3"]'); await W(300); await p.click("#aWybor"); await W(1800);
  ok("historia arkusza", (await txt(p, "#aLog")).includes("wybór dostawcy"));
  // kolor dostawcy z przycisku w nagłówku (bez trybu wyboru): nadanie i usunięcie
  await p.click('#aGrid [data-kol="2"]'); await p.waitForSelector("#dlg[open] [data-p]"); await p.click('#dlg [data-p="FFC000"]'); await W(600);
  const kSP = await p.$eval('#aGrid td.dost[data-c="2"]', e => e.classList.contains("kol"));
  await p.click('#aGrid [data-kol="2"]'); await p.waitForSelector("#dlg[open]"); await dlgOk(p, "brak"); await W(600);
  ok("kolor dostawcy: wybór i usunięcie z nagłówka", kSP && !(await p.$eval('#aGrid td.dost[data-c="2"]', e => e.classList.contains("kol"))));
  await p.click("#aKom"); ok("przycisk Pokaż komentarze", await p.$eval("#aBox", e => e.classList.contains("komentarze"))); await p.click("#aKom");
  // 3. zamówienie i dostawa w Logistyce
  const karta = "#aZam .sup-z";
  await p.waitForSelector(karta);
  ok("panel zamówień: Hurt Metal", (await txt(p, karta)).includes("Hurt Metal"), (await txt(p, karta)).split("\n")[0]);
  await p.click(karta + ' [data-za="zam"]'); await p.waitForSelector("#dlg[open]");
  await p.fill('#dlg input[name="nr"]', "ZD 7/" + rok); await p.fill('#dlg input[name="dostawa"]', `${rok}-12-01`); await dlgOk(p); await W(2000);
  ok("zamówiono", (await txt(p, karta)).includes("ZD 7/" + rok));
  await W(1500);
  await baza(async db => { const d = (await getDocs(collection(db, "zap_ceny"))).docs.map(x => x.data()).find(x => x.nazwa === "Kątownik 50x50x5 S235 6m");
    ok("zamówienie: nowa pozycja w bazie z ceną", d && d.historia?.[0]?.c === 4.9 && d.zrodlo === "zamowienie", JSON.stringify(d && { jm: d.jm, c: d.historia[0].c, skad: d.skad })); });
  ok("stan zamówienia nad dostawcą", (await txt(p, "#aGrid tr.r1")).includes("zam. ZD 7/" + rok));
  await zrzut(p, "arkusz");
  await p.click(karta + ' [data-za="kurs"]'); await p.waitForSelector("#dlg[open]");
  ok("okno dostawy: adres z listy Truck App", (await p.$eval('#dlg input[name="miejsce"]', e => e.value)) === "ul. Hutnicza 9, 00-009 Testowo");
  await p.selectOption('#dlg select[name="oddzial"]', "Oddział B");
  await dlgOk(p); await W(2500);
  await baza(async db => { const s = await getDocs(collection(db, "kursy")); const d = s.docs[0]?.data() || {};
    ok("dostawa w Logistyce (do uzupełnienia)", s.size === 1 && d.doUzup === true && d.kontr === "Hurt Metal" && d.pozycje?.length === 3, JSON.stringify({ kontr: d.kontr, poz: d.pozycje?.length, waga: d.waga }));
    ok("dostawa: adres, oddział i telefon dostawcy", d.miejsce === "ul. Hutnicza 9, 00-009 Testowo" && d.oddzial === "Oddział B" && d.kontakt === "600 000 009", JSON.stringify({ miejsce: d.miejsce, oddzial: d.oddzial, kontakt: d.kontakt })); });
  // 3b. pozycje profili do Zakupów profili
  await p.click(karta + ' [data-za="zak"]'); await p.waitForSelector("#dlg[open]");
  ok("Zakupy: dostawca dopasowany", (await p.$eval('#dlg select[name="sup"]', e => e.value)) === "Hurt Metal");
  const ind = await p.$$eval('#dlg select[name^="key"]', L => L.map(e => e.value));
  ok("Zakupy: indeks profilu dopasowany, reszta pominięta", ind.filter(Boolean).length === 1 && ind.includes("120x80x3 / 6000"), JSON.stringify(ind));
  await dlgOk(p); await W(2500);
  await baza(async db => { const L = (await getDocs(collection(db, "zak_zam"))).docs.map(x => x.data());
    ok("Zakupy: zamówienie zapisane (indeks, tony, ZD, dostawca)", L.length === 1 && L[0].key === "120x80x3 / 6000" && Math.abs(L[0].t - 0.21) < 0.001 && L[0].zd === "ZD 7/" + rok && L[0].sup === "Hurt Metal", JSON.stringify(L[0])); });
  ok("Zakupy: znacznik w karcie zamówienia", (await txt(p, karta)).includes("w Zakupach profili: 1 poz."));
  // 3b. projekt: pozycja dopisana do zapytania „do projektu” i edycja ilości w projekcie
  await p.click("#aZListy"); await p.waitForSelector("#wlN");
  await p.fill("#wlN", "IPE 330 S355 12m"); await p.fill("#wlI", "2"); await p.keyboard.press("Enter"); await W(200);
  await dlgOk(p); await p.waitForSelector("#dlg[open]"); ok("pytanie: do projektu czy na magazyn", (await txt(p, "#dlg")).includes("Do projektu")); await dlgOk(p, "proj"); await W(2500);
  ok("wiersz oznaczony P (projekt)", (await p.$$eval("#aGrid .tagP", t => t.length)) === 3 + 1, (await p.$$eval("#aGrid .tagP", t => t.length)) + " wierszy P");
  await p.click("#aProj"); await p.waitForSelector("#pjRows tr[data-i]");
  await p.fill('#pjRows tr[data-i="0"] [data-f="ilosc"]', "3"); await dlgOk(p); await W(2500);
  await baza(async db => { const pr = (await getDocs(collection(db, "zap_projekty"))).docs[0].data(), P0 = pr.pozycje;
    const ipe = P0.find(x => x.nazwa === "IPE 330 S355 12m");
    ok("projekt: zmieniona ilość i nowa pozycja IPE 330 12m", P0[0].ilosc === 3 && ipe && ipe.ilosc === 2 && ipe.tresc === "IPE 330 S355 12m- 2 szt" && ipe.ark === `1-${rok}`, JSON.stringify(P0.map(x => [x.nazwa, x.ilosc, x.niez]))); });
  await p.click("#aKoszt"); await p.waitForSelector("#kEdytuj", { timeout: 15000 }); await W(500);
  ok("koszt projektu z nową pozycją", (await txt(p, "#widok")).includes("IPE 330 S355 12m"));
  await p.goBack(); await p.waitForSelector("#aGrid table"); await W(500);
  // 4. zapytanie na magazyn z ręczną pozycją
  await p.click("#tabs [data-v=zapytania]"); await W(400);
  await p.click("#lMag"); await p.waitForSelector("#wlN");
  await p.fill("#wlN", "Wypałka trapez 240x80x5"); await p.fill("#wlI", "50"); await p.keyboard.press("Enter"); await W(200);
  await dlgOk(p); await p.waitForSelector("#dlg[open]");
  ok("magazyn: kod MAG", (await p.$eval('#dlg input[name="k"]', e => e.value)) === "MAG");
  await dlgOk(p); await p.waitForSelector("#dlg[open]"); await dlgOk(p, "tak"); await p.waitForSelector("#dlg[open]");
  ok("magazyn: mail z ręczną pozycją", (await txt(p, "#dlg")).includes("Wypałka trapez 240x80x5- 50 szt"));
  await dlgOk(p); await p.waitForSelector("#aGrid table"); await W(800);
  // Enter w kolumnie A aż za ostatni pusty wiersz – arkusz rośnie, dalej da się pisać
  { const n0 = await p.$$eval("#aGrid textarea", t => t.length);
    await p.click('#aGrid textarea[data-r="3"]');
    for (let i = 0; i < n0 + 1; i++) { await p.keyboard.type("Poz " + i); await p.keyboard.press("Enter"); }
    await W(1500); const n1 = await p.$$eval("#aGrid textarea", t => t.length), akt = await p.evaluate(() => document.activeElement?.dataset?.r || "");
    ok("Enter na końcu arkusza dokłada wiersze", n1 > n0 && +akt === n0 + 4, `wierszy ${n0} → ${n1}, kursor w wierszu ${akt}`); }
  ok("dwa zapytania, jeden projekt", await ile("zap_zapytania") === 2 && await ile("zap_projekty") === 1);
  // 5. pomoc
  await p.click("#btnPomoc"); await p.waitForSelector("#dlg[open]");
  ok("pomoc dla arkusza", (await txt(p, "#dlg")).includes("Arkusz zapytania"));
  await dlgOk(p);
  // 6. kopia zapasowa i przywrócenie
  await p.click("#tabs [data-v=ustawienia]"); await W(600);
  // 5b. jedna lista dostawców: nowy dostawca w Zapytaniach → kartoteka Truck App (bez nadpisywania)
  await p.click('[data-dodaj="dostawcy"]'); await W(300);
  const wiersze = p.locator('table[data-tab="dostawcy"] tbody tr');
  const ost = wiersze.nth((await wiersze.count()) - 1);
  await ost.locator('input[data-f="dostawca"]').fill("Nowa Hurtownia"); await ost.locator('input[data-f="email"]').fill("nowa@hurtownia.example");
  await p.click("#uZapisz"); await W(2000);
  await baza(async db => { const L = (await getDoc(doc(db, "ustawienia/glowne"))).data().dostawcy;
    const n = L.find(x => x.nazwa === "Nowa Hurtownia"), h = L.find(x => x.nazwa === "HURT METAL");
    ok("kartoteka Truck App: nowy dostawca z Zapytań", n && n.email === "nowa@hurtownia.example" && n.zap === true, JSON.stringify(n));
    ok("kartoteka Truck App: istniejącemu uzupełniony e-mail, adres bez zmian", h && h.email === "biuro@hurtmetal.example" && h.adres === "ul. Hutnicza 9, 00-009 Testowo", JSON.stringify(h)); });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#kpJson")]);
  const plikKopii = join(TMP, "kopia.json"); await dl.saveAs(plikKopii);
  const k = JSON.parse(readFileSync(plikKopii, "utf8"));
  ok("kopia: 2 zapytania, 1 projekt", k.zapytania.length === 2 && k.projekty.length === 1);
  const [dlx] = await Promise.all([p.waitForEvent("download"), p.click("#kpXls")]);
  const plikXls = join(TMP, "kopia.xlsx"); await dlx.saveAs(plikXls);
  const wbk = XLSX.read(readFileSync(plikXls), { type: "buffer" });
  ok("kopia Excel: arkusz zapytania", wbk.SheetNames.includes(`1-${rok}`), [...wbk.SheetNames].join(", "));
  await baza(async db => { await deleteDoc(doc(db, "zap_zapytania/" + k.zapytania.find(z => z.kod !== "MAG")._doc)); }); await W(1000);
  await p.setInputFiles("#kpPrzywroc", plikKopii); await dlgOk(p);
  await p.waitForFunction(() => location.hash === "#zapytania", null, { timeout: 30000 }); await W(1500);
  ok("przywrócono z kopii", await ile("zap_zapytania") === 2);
  // 7. zastępstwo
  await p.click("#tabs [data-v=dostep]"); await W(800);
  await p.selectOption("#gKto", U.zastepca); const d = new Date(); d.setDate(d.getDate() + 5); await p.fill("#gDo", d.toISOString().slice(0, 10));
  await p.click("#gF button[type=submit]"); await W(1200);
  ok("zastępstwo nadane", (await txt(p, "#gRows")).includes("aktywne"));
  await p.click("#btnOut"); await p.close();
  p = await strona(390); await zaloguj(p, "zastepca");
  await p.waitForSelector("#dlg[open]", { timeout: 5000 });
  ok("zastępca: skrót „od czego zacząć”", (await txt(p, "#dlg")).includes("od czego zacząć")); await dlgOk(p);
  await p.click("#tabs [data-v=zapytania]"); await W(500); await p.fill("#lQ", `1-${rok}`); await p.keyboard.press("Enter"); await p.waitForSelector("#aGrid table");
  await p.click('#aGrid input[data-r="2"][data-c="2"]'); await p.keyboard.type("57"); await p.keyboard.press("Enter"); await W(1800);
  await zrzut(p, "arkusz-telefon");
  // po Enter i zapisie (wpis w dzienniku wraca z bazy) dalej da się pisać w komórce niżej
  await p.click('#aGrid input[data-r="2"][data-c="2"]'); await p.keyboard.type("57"); await p.keyboard.press("Enter"); await W(2500);
  await p.keyboard.type("6,1"); await p.keyboard.press("Enter"); await W(1500);
  const b3e = await p.$eval('#aGrid input[data-r="3"][data-c="2"]', e => e.value.replace(/\u00a0/g, " "));
  ok("Enter: przejście w dół i dalsze pisanie po zapisie", b3e === "6,10 zł", b3e);
  const b2 = await p.$eval('#aGrid input[data-r="2"][data-c="2"]', e => e.value.replace(/\u00a0/g, " "));
  ok("wpisanie zastępuje cenę (jak w Excelu)", b2 === "57,00 zł", b2);
  ok("zastępca zapisał cenę", (await p.$eval("#aStatus", e => e.textContent)).includes("zapisano"));
  await p.click("#btnOut"); await p.close();
  p = await strona(); await zaloguj(p, "wlasciciel"); await W(1500);
  ok("właściciel widzi zmianę zastępcy", +(await p.$eval("#logCnt", e => e.hidden ? "0" : e.textContent)) >= 1);
} catch (e) { ok("przebieg testu", false, e.message.split("\n")[0]); }

console.log(wyniki.join("\n"));
if (bledy.length) console.log("\nBłędy strony:\n" + bledy.slice(0, 10).join("\n"));
const zle = wyniki.filter(r => !r.startsWith("OK")).length + bledy.length;
console.log(`\n${wyniki.length - wyniki.filter(r => !r.startsWith("OK")).length}/${wyniki.length} OK`);
await b.close(); await env.cleanup();
process.exit(zle ? 1 : 0);
