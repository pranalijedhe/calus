import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

async function checkAuth() {
  try {
    const listUsers = await getAuth().listUsers(1);
    console.log("Auth access successful, users count:", listUsers.users.length);
  } catch (err) {
    console.error("Auth access failed:", err);
  }
}

checkAuth();
