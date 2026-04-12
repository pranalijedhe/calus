import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore();

async function check() {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`Users count: ${snapshot.size}`);
    snapshot.forEach(doc => console.log(doc.id, doc.data().email));
  } catch (err) {
    console.error("Check failed:", err);
  }
}

check();
