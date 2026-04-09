const firebaseConfig = {
  apiKey:            "AIzaSyBc9IX_AEFDNyiA2Klm4RGdbHYmqfXEbOc",
  authDomain:        "arvin-phone.firebaseapp.com",
  projectId:         "arvin-phone",
  storageBucket:     "arvin-phone.firebasestorage.app",   // bisa dikosongkan, tidak wajib
  messagingSenderId: "851488823602",
  appId:             "1:851488823602:web:16615db037fd1d1fe45f2b"
};

/* ────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────── */
const ADMIN_EMAIL     = "arvinphoneindonesia@gmail.com";
const WHATSAPP_NUMBER = "62895611324747"; // ← Ganti dengan nomor WA asli (tanpa +)
const COLLECTION_NAME = "products";

/* ────────────────────────────────────────────────
   FIREBASE INIT
   Firebase Storage TIDAK digunakan — gambar via URL
   ──────────────────────────────────────────────── */
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

/* ────────────────────────────────────────────────
   UTILITY — Format Harga IDR
   Contoh: 5000000 → "Rp 5.000.000"
   ──────────────────────────────────────────────── */
function formatPrice(price) {
  if (price === undefined || price === null || price === "") return "—";
  return "Rp " + Number(price).toLocaleString("id-ID");
}

/* ────────────────────────────────────────────────
   UTILITY — Buat URL WhatsApp per produk
   ──────────────────────────────────────────────── */
function getWhatsAppUrl(productName) {
  const text = encodeURIComponent(
    `Halo kak, saya tertarik dengan *${productName}*. Apakah masih tersedia? 😊`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

/* ────────────────────────────────────────────────
   UTILITY — Toast Notification
   ──────────────────────────────────────────────── */
function showToast(message, isError = false) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "show" + (isError ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.className = ""; }, 3500);
}

/* ────────────────────────────────────────────────
   UTILITY — Sanitize HTML (cegah XSS)
   ──────────────────────────────────────────────── */
function sanitize(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

/* ────────────────────────────────────────────────
   UTILITY — Validasi Form Produk
   Returns { valid: boolean, errors: string[] }
   ──────────────────────────────────────────────── */
function validateProductForm(data) {
  const errors = [];
  if (!data.name || data.name.trim().length < 2)
    errors.push("Nama produk minimal 2 karakter.");
  if (!data.price || isNaN(data.price) || Number(data.price) <= 0)
    errors.push("Harga harus berupa angka positif.");
  return { valid: errors.length === 0, errors };
}

/* ────────────────────────────────────────────────
   LANDING ANIMATION
   Tampil logo → loading bar → fade out → callback
   ──────────────────────────────────────────────── */
function runLandingAnimation(callback) {
  const screen = document.getElementById("loading-screen");
  if (!screen) { if (callback) callback(); return; }

  // Total durasi animasi ±3.5 detik, lalu fade out
  setTimeout(() => {
    screen.classList.add("fade-out");
    setTimeout(() => {
      screen.style.display = "none";
      if (callback) callback();
    }, 800);
  }, 3500);
}

/* ────────────────────────────────────────────────
   AUTH — Guard halaman admin
   Redirect ke login.html jika belum login / bukan admin
   ──────────────────────────────────────────────── */
function guardAdminPage(onAuthed) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      auth.signOut().then(() => window.location.href = "login.html");
      return;
    }
    if (onAuthed) onAuthed(user);
  });
}

/* ────────────────────────────────────────────────
   AUTH — Logout
   ──────────────────────────────────────────────── */
async function logoutUser() {
  try {
    await auth.signOut();
    window.location.href = "login.html";
  } catch (err) {
    showToast("Logout gagal: " + err.message, true);
  }
}

/* ────────────────────────────────────────────────
   FIRESTORE — Tambah produk baru
   ──────────────────────────────────────────────── */
async function addProduct(data) {
  return db.collection(COLLECTION_NAME).add({
    name:        data.name        || "",
    price:       Number(data.price) || 0,
    imageUrl:    data.imageUrl    || "",
    description: data.description || "",
    features:    data.features    || "",
    warranty:    data.warranty    || "",
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  });
}

/* ────────────────────────────────────────────────
   FIRESTORE — Update produk
   ──────────────────────────────────────────────── */
async function updateProduct(id, data) {
  return db.collection(COLLECTION_NAME).doc(id).update({
    name:        data.name        || "",
    price:       Number(data.price) || 0,
    imageUrl:    data.imageUrl    || "",
    description: data.description || "",
    features:    data.features    || "",
    warranty:    data.warranty    || "",
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  });
}

/* ────────────────────────────────────────────────
   FIRESTORE — Hapus produk
   ──────────────────────────────────────────────── */
async function deleteProductDoc(id) {
  return db.collection(COLLECTION_NAME).doc(id).delete();
}

/* ────────────────────────────────────────────────
   FIRESTORE — Real-time listener (onSnapshot)
   Callback menerima array: [{ id, ...data }, ...]
   Diurutkan dari terbaru ke terlama.
   ──────────────────────────────────────────────── */
function listenProducts(callback) {
  return db
    .collection(COLLECTION_NAME)
    .orderBy("createdAt", "desc")
    .onSnapshot(
      snap => {
        const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(products);
      },
      err => {
        console.error("Firestore listener error:", err);
      }
    );
}
