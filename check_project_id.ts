import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
async function run() {
  try {
    await db.collection('test').get();
  } catch (e) {}
  console.log("Project ID:", (db as any).projectId);
}
run();
