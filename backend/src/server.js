const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // We can restrict this to the frontend URL if desired
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logger middleware for debugging
app.use((req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const sponsorRoutes = require('./routes/sponsors');
const raceRoutes = require('./routes/races');
const teamRoutes = require('./routes/teams');
const leagueRoutes = require('./routes/leagues');
const telemetryRoutes = require('./routes/telemetry');

app.use('/api/auth', authRoutes);
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando perfeitamente.' });
});

// Initialize database then start server
async function startServer() {
  console.log('Initializing database setup...');
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
