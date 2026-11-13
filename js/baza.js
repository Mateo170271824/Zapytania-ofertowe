/* Połączenie z bazą (Firebase: logowanie + Firestore). Ten sam projekt co Truck App, Kooperacje i Kombajn.
   Konfiguracja, zapis loginu i tryb emulatora (?emu na localhost) – wspólny moduł SteelFlow (js/steelflow-konto.js). */
import { firebaseConfig, zaladujSDK, polacz, zaloguj, komunikat } from "./steelflow-konto.js?v=202611121300";
export { firebaseConfig, komunikat };
export const C = { z: "zap_zapytania", p: "zap_projekty", log: "zap_dziennik", u: "zap_ustawienia", c: "zap_ceny" };
export async function firebase() {
  const sdk = await zaladujSDK(), A = sdk.auth, F = sdk.firestore;
  const { auth, db } = polacz(sdk, { emuPort: 8085, offline: true });   // dane w urządzeniu – przeglądanie bez internetu
  const wrapT = T => ({
    get: async (c, id) => { const s = await T.get(F.doc(db, c, id)); return s.exists() ? s.data() : null; },
    set: (c, id, d) => T.set(F.doc(db, c, id), d),
    update: (c, id, d) => T.update(F.doc(db, c, id), d),
    del: (c, id) => T.delete(F.doc(db, c, id)),
  });
  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    login: (l, p) => zaloguj(sdk, auth, l, p),
    logout: () => A.signOut(auth),
    watch: (c, cb, err) => F.onSnapshot(c === C.log ? F.query(F.collection(db, c), F.orderBy("kiedy", "desc"), F.limit(1500)) : F.collection(db, c), s => cb(s.docs.map(d => ({ _id: d.id, ...d.data() }))), err),
    watchDoc: (c, id, cb, err) => F.onSnapshot(F.doc(db, c, id), s => cb(s.exists() ? s.data() : null), err),
    accounts: async () => (await F.getDocs(F.query(F.collection(db, "uzytkownicy"), F.where("rola", "==", "biuro")))).docs.map(d => ({ uid: d.id, ...d.data() })),
    tx: fn => F.runTransaction(db, T => fn(wrapT(T))),
    batch: async ops => { const b = F.writeBatch(db); for (const o of ops) { const r = F.doc(db, o.c, o.id); if (o.del) b.delete(r); else if (o.upd) b.update(r, o.d); else b.set(r, o.d, o.merge ? { merge: true } : {}); } await b.commit(); },
    get: async (c, id) => { const s = await F.getDoc(F.doc(db, c, id)); return s.exists() ? s.data() : null; },
    // kartoteka dostawców Truck App (ustawienia/glowne.dostawcy) – zmiana tylko pola dostawcy, w transakcji
    zmienDostawcowTruck: fn => F.runTransaction(db, async T => { const r = F.doc(db, "ustawienia", "glowne"); const s = await T.get(r); if (!s.exists()) return 0;
      const { lista, zmiany } = fn(s.data().dostawcy || []); if (zmiany) T.update(r, { dostawcy: lista }); return zmiany; }),
    newId: c => F.doc(F.collection(db, c)).id,
    now: () => F.serverTimestamp(),
    inc: n => F.increment(n),
  };
}

