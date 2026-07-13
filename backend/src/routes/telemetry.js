const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretcyclingfantasykey123!';

// POST /api/telemetry - Record app access / page view (Public/Authenticated)
router.post('/', async (req, res) => {
  const { country, state, city } = req.body;
  if (!country || !state || !city) {
    return res.status(400).json({ message: 'Country, state, and city are required' });
  }

  // Resolve client IP (handles proxy headers if present)
  let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (ipAddress.includes(',')) {
    // If multiple IPs are forwarded, extract the first client IP
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

  try {
    await db.query(
      `INSERT INTO telemetry_logs (user_id, ip_address, country, state, city)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, ipAddress, country, state, city]
    );
    res.status(201).json({ message: 'Telemetry logged successfully' });
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
