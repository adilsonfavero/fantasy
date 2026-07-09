const http = require('http');

function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseBody || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function put(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody || '{}') });
        } catch(e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await post('http://localhost:3000/api/auth/login', {
      email: 'admin@fantasy.com',
      password: 'admin123'
    });
    console.log('Login Status:', loginRes.status);
    const token = loginRes.body.token;
    if (!token) {
      console.error('No token received:', loginRes.body);
      return;
    }

    // 2. Put Athlete Edit
    console.log('Editing athlete 1...');
    const putRes = await put('http://localhost:3000/api/races/athletes/1', {
      name: 'Tadej Pogačar',
      nationality: 'Eslovenia',
      official_team: 'UAE Team Emirates',
      value: 460
    }, token);

    console.log('PUT Status:', putRes.status);
    console.log('PUT Body:', putRes.body);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

run();
