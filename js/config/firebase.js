import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, deleteDoc, updateDoc,
    onSnapshot, getDocs, getDoc, query, where, writeBatch, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyARQW48lm5jEavNwCDG7tKlolxJPg1ggLg",
    authDomain: "toyandcraftstore.firebaseapp.com",
    projectId: "toyandcraftstore",
    storageBucket: "toyandcraftstore.firebasestorage.app",
    messagingSenderId: "732577086084",
    appId: "1:732577086084:web:9f5db5dce1491124aaa0d1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
    app, db,
    collection, doc, setDoc, deleteDoc, updateDoc,
    onSnapshot, getDocs, getDoc, query, where, writeBatch, runTransaction
};
