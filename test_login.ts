import axios from "axios";

async function testLogin() {
  try {
    const res = await axios.post("http://localhost:3000/api/v1/auth/login", {
      email: "admin@yourcompany.com",
      password: "yourpassword"
    });
    console.log("Login success:", res.data);
  } catch (err: any) {
    console.error("Login failed:", err.response?.data || err.message);
  }
}

testLogin();
