import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCU1qW9k1Ib7cGUzz40twhV53iClhWKEhY",
  authDomain: "gemsstar-orders.firebaseapp.com",
  projectId: "gemsstar-orders",
  storageBucket: "gemsstar-orders.firebasestorage.app",
  messagingSenderId: "1013985281082",
  appId: "1:1013985281082:web:bf3a30cc6b2cfffd042103"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
