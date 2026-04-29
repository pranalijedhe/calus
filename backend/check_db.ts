import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
    
    if (fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"))),
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with service account.");
    } else {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with default credentials.");
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err);
    process.exit(1);
  }
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

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
