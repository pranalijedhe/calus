import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    console.log(`Users count via Web SDK: ${snapshot.size}`);
  } catch (err: any) {
    console.error("Web SDK Check failed:", err.message);
  }
}

check();
