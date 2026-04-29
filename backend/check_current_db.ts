import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function check() {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`Users count in current project (default): ${snapshot.size}`);
  } catch (err: any) {
    console.error("Check failed:", err.message);
  }
}

check();
