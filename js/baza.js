/* Połączenie z bazą (Firebase: logowanie + Firestore). Ten sam projekt co Logistyka, Truck App i Kooperacje.
   Adres ?emu na localhost łączy z lokalnym emulatorem (testy). */
export const firebaseConfig = {
  apiKey: "AIzaSyB8Zi3CTsEJDqnxpt2EpmEN0JKbQZkx9Ik",
  authDomain: "logistyka-app-41d7a.firebaseapp.com",
  projectId: "logistyka-app-41d7a",
  storageBucket: "logistyka-app-41d7a.firebasestorage.app",
  messagingSenderId: "730726420764",
  appId: "1:730726420764:web:fbd4a12acd2b5ebdb52ad9"
};
export const C = { z: "zap_zapytania", p: "zap_projekty", log: "zap_dziennik", u: "zap_ustawienia", c: "zap_ceny" };
export async function firebase() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = initializeApp(firebaseConfig), auth = A.getAuth(app), db = F.getFirestore(app);
  if (new URLSearchParams(location.search).has("emu") && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); F.connectFirestoreEmulator(db, "127.0.0.1", 8085);
  }
  const normLogin = t => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "");
  const wrapT = T => ({
    get: async (c, id) => { const s = await T.get(F.doc(db, c, id)); return s.exists() ? s.data() : null; },
    set: (c, id, d) => T.set(F.doc(db, c, id), d),
    update: (c, id, d) => T.update(F.doc(db, c, id), d),
    del: (c, id) => T.delete(F.doc(db, c, id)),
  });
  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    login: (l, p) => A.signInWithEmailAndPassword(auth, normLogin(l) + "@konta." + firebaseConfig.authDomain, p),
    logout: () => A.signOut(auth),
    watch: (c, cb, err) => F.onSnapshot(c === C.log ? F.query(F.collection(db, c), F.orderBy("kiedy", "desc"), F.limit(1500)) : F.collection(db, c), s => cb(s.docs.map(d => ({ _id: d.id, ...d.data() }))), err),
    watchDoc: (c, id, cb, err) => F.onSnapshot(F.doc(db, c, id), s => cb(s.exists() ? s.data() : null), err),
    accounts: async () => (await F.getDocs(F.query(F.collection(db, "uzytkownicy"), F.where("rola", "==", "biuro")))).docs.map(d => ({ uid: d.id, ...d.data() })),
    tx: fn => F.runTransaction(db, T => fn(wrapT(T))),
    batch: async ops => { const b = F.writeBatch(db); for (const o of ops) { const r = F.doc(db, o.c, o.id); if (o.del) b.delete(r); else if (o.upd) b.update(r, o.d); else b.set(r, o.d); } await b.commit(); },
    get: async (c, id) => { const s = await F.getDoc(F.doc(db, c, id)); return s.exists() ? s.data() : null; },
    newId: c => F.doc(F.collection(db, c)).id,
    now: () => F.serverTimestamp(),
  };
}

