const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretcyclingfantasykey123!';

// Helper to identify local development addresses
function isLocalIp(ip) {
  return ip === '::1' || 
         ip === '127.0.0.1' || 
         ip.includes('localhost') || 
         ip.startsWith('::ffff:127.0.0.1') ||
         ip.startsWith('10.') || 
         ip.startsWith('192.168.') || 
         ip.startsWith('172.16.');
}

// POST /api/telemetry - Record app access (Resolves location on backend)
router.post('/', async (req, res) => {
  // Resolve client IP (handles proxy headers from Render/Neon if present)
  let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (ipAddress.includes(',')) {
    ipAddress = ipAddress.split(',')[0].trim();
  }

  // Optional user identification if logged in
  let userId = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // Ignore token verification errors for telemetry logging
    }
  }

  let country = 'Desconhecido';
  let state = 'Desconhecido';
  let city = 'Desconhecido';

  try {
    if (isLocalIp(ipAddress)) {
      // Localhost access: fallback to logged-in user profile, otherwise use simulated data
      if (userId) {
        const userLoc = await db.query('SELECT country, state, city FROM users WHERE id = $1', [userId]);
        if (userLoc.rows.length > 0 && userLoc.rows[0].country) {
          country = userLoc.rows[0].country;
          state = userLoc.rows[0].state;
          city = userLoc.rows[0].city;
        } else {
          // Local user with no profile info set yet
          country = 'Brasil';
          state = 'São Paulo';
          city = 'São Paulo (Simulado)';
        }
      } else {
        // Local anonymous access
        country = 'Brasil';
        state = 'São Paulo';
        city = 'São Paulo (Simulado)';
      }
    } else {
      // Production access: query external geolocation API from the backend
      try {
        const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
        if (response.ok) {
          const geo = await response.json();
          if (geo && !geo.error) {
            country = geo.country_name || 'Desconhecido';
            state = geo.region || 'Desconhecido';
            city = geo.city || 'Desconhecido';
          }
        }
      } catch (err) {
        console.warn(`External IP lookup failed for ${ipAddress}, falling back to user profile:`, err.message);
      }

      // Secondary fallback to user profile if geolocation API fails or returns unknown
      if (country === 'Desconhecido' && userId) {
        const userLoc = await db.query('SELECT country, state, city FROM users WHERE id = $1', [userId]);
        if (userLoc.rows.length > 0 && userLoc.rows[0].country) {
          country = userLoc.rows[0].country;
          state = userLoc.rows[0].state;
          city = userLoc.rows[0].city;
        }
      }
    }

    await db.query(
      `INSERT INTO telemetry_logs (user_id, ip_address, country, state, city)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, ipAddress, country, state, city]
    );
    res.status(201).json({ message: 'Telemetry logged successfully', geo: { country, state, city } });
  } catch (err) {
    console.error('Error logging telemetry:', err);
    res.status(500).json({ message: 'Error logging telemetry' });
  }
});

// GET /api/telemetry - Retrieve telemetry summary (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    // 1. General totals
    const totalResult = await db.query('SELECT COUNT(*) FROM telemetry_logs');
    const totalAccesses = parseInt(totalResult.rows[0].count);

    // 2. Group by Country
    const countriesResult = await db.query(`
      SELECT country, COUNT(*) as count
      FROM telemetry_logs
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `);

    // 3. Group by State
    const statesResult = await db.query(`
      SELECT state, country, COUNT(*) as count
      FROM telemetry_logs
      GROUP BY state, country
      ORDER BY count DESC
      LIMIT 15
    `);

    // 4. Group by City
    const citiesResult = await db.query(`
      SELECT city, state, country, COUNT(*) as count
      FROM telemetry_logs
      GROUP BY city, state, country
      ORDER BY count DESC
      LIMIT 20
    `);

    // 5. Recent Access Logs (latest 50)
    const logsResult = await db.query(`
      SELECT 
        t.id, 
        t.ip_address, 
        t.country, 
        t.state, 
        t.city, 
        to_char(t.accessed_at, 'YYYY-MM-DD HH24:MI:SS') as accessed_at,
        u.email as user_email
      FROM telemetry_logs t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.accessed_at DESC
      LIMIT 50
    `);

    res.json({
      totalAccesses,
      byCountry: countriesResult.rows,
      byState: statesResult.rows,
      byCity: citiesResult.rows,
      recentLogs: logsResult.rows
    });
  } catch (err) {
    console.error('Error retrieving telemetry data:', err);
    res.status(500).json({ message: 'Error retrieving telemetry data' });
  }
});

module.exports = router;
