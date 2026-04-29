import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkDb() {
  try {
    const snapshot = await getDocs(collection(db, "providers"));
    console.log("Providers count:", snapshot.size);
    snapshot.docs.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (err: any) {
    console.error("Error fetching providers:", err.message);
  }
}

checkDb();
