// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA5JhqDHts0spJhHonaSArQD3IB8SdXV4w",
    authDomain: "pokemon-team-builder-8a424.firebaseapp.com",
    projectId: "pokemon-team-builder-8a424",
    storageBucket: "pokemon-team-builder-8a424.firebasestorage.app",
    messagingSenderId: "517838734209",
    appId: "1:517838734209:web:04d7452f6de2719dd0de80",
    measurementId: "G-VHMKNTGK8Y"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

console.log("✅ Firebase verbonden");


