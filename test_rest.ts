import axios from "axios";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

async function testRest() {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users?key=${firebaseConfig.apiKey}`;
  try {
    const res = await axios.get(url);
    console.log("REST API Success:", res.data);
  } catch (err: any) {
    console.error("REST API Failed:", err.response?.data || err.message);
  }
}

testRest();
