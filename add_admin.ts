import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import bcrypt from "bcryptjs";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function addAdmin() {
  const email = "admin@yourcompany.com";
  const password = "yourpassword";
  const hash = await bcrypt.hash(password, 10);
  
  const q = query(collection(db, "users"), where("email", "==", email));
  const existing = await getDocs(q);
  if (existing.empty) {
    await addDoc(collection(db, "users"), {
      email,
      password_hash: hash,
      role: "admin",
      created_at: new Date().toISOString()
    });
    console.log(`User ${email} created.`);
  } else {
    console.log(`User ${email} already exists.`);
  }
}

addAdmin().catch(console.error);
