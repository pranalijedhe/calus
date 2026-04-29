import axios from 'axios';

async function checkHealth() {
  try {
    const res = await axios.get('http://localhost:3000/api/healthz');
    console.log('Server is healthy:', res.data);
  } catch (err: any) {
    console.error('Server is not healthy:', err.message);
  }
}

checkHealth();
