import axios from "axios";

async function test() {
  try {
    const response = await axios.post("http://localhost:3000/api/v1/auth/login", {
      email: "user@yourcompany.com",
      password: "userpassword",
    });
    console.log("Login success:", response.data);
  } catch (err: any) {
    console.error("Login failed:", err.response?.data || err.message);
  }
}

test();
