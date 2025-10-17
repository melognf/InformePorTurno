import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const firebaseConfig = {
  apiKey: "AIzaSyDeTI8mHF5QkNEbgu69L5JMqui-aimFlFM",
  authDomain: "informeporturno.firebaseapp.com",
  projectId: "informeporturno",
  storageBucket: "informeporturno.firebasestorage.app",
  messagingSenderId: "1080632095129",
  appId: "1:1080632095129:web:0f1c6abebecc30022a6308"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  window._db = db; // 🔹 lo dejamos global para usarlo en app.js