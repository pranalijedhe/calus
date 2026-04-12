import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(); // Default database

async function check() {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`Users count in default database: ${snapshot.size}`);
  } catch (err: any) {
    console.error("Check failed:", err.message);
  }
}

check();
