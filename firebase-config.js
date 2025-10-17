import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeTI8mHF5QkNEbgu69L5JMqui-aimFlFM",
  authDomain: "informeporturno.firebaseapp.com",
  projectId: "informeporturno",
  storageBucket: "informeporturno.firebasestorage.app",
  messagingSenderId: "1080632095129",
  appId: "1:1080632095129:web:0f1c6abebecc30022a6308"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
