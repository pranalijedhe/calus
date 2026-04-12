import axios from "axios";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users?key=${firebaseConfig.apiKey}`;

async function test() {
  try {
    const response = await axios.get(url);
    console.log("REST API Success:", response.data);
  } catch (err: any) {
    console.error("REST API Failed:", err.response?.data || err.message);
  }
}

test();
