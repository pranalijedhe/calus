const http = require('http');

http.get('http://localhost:3000/api/v1/pricing/database?provider_id=aws-mock&region_id=aws-us-east-1', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data.substring(0, 200));
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
