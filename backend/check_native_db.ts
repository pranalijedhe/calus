import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    projectId: "ais-asia-southeast1-e0b4917002"
  });
}

const db = getFirestore();

async function check() {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`Users count in ais-asia-southeast1-e0b4917002 (default): ${snapshot.size}`);
  } catch (err: any) {
    console.error("Check failed:", err.message);
  }
}

check();
