const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/body', // or application/json
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, bodyRaw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Testing Login...');
    const loginRes = await post('http://localhost:3000/api/auth/login', {
      email: 'admin@fantasy.com',
      password: 'admin123'
    });
    console.log('Login Response Status:', loginRes.statusCode);
    const token = loginRes.data.token;
    console.log('Token received:', token ? 'YES' : 'NO');

    console.log('\n2. Testing GET /api/races...');
    const racesRes = await get('http://localhost:3000/api/races');
    console.log('Races Response Status:', racesRes.statusCode);
    console.log('Races count:', racesRes.data.length);

    console.log('\n3. Testing GET /api/teams...');
    const teamsRes = await get('http://localhost:3000/api/teams', token);
    console.log('Teams Response Status:', teamsRes.statusCode);
    console.log('Teams data:', teamsRes.data);
  } catch (err) {
    console.error('Error during run:', err);
  }
}

run();
