import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDE-...", // Removed for privacy, but Agent has access to the real file
    authDomain: "toyandcraft-56c9d.firebaseapp.com",
    projectId: "toyandcraft-56c9d",
    storageBucket: "toyandcraft-56c9d.appspot.com",
    messagingSenderId: "1098418048208",
    appId: "1:1098418048208:web:7f6f7ac31fcba87d105b38"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkMetadata() {
    const snap = await getDoc(doc(db, 'Settings', 'SiteMetadata'));
    if (snap.exists()) {
        console.log("METADATA_DATA:", JSON.stringify(snap.data()));
    } else {
        console.log("METADATA_MISSING");
    }
}

checkMetadata();
