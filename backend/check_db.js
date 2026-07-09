const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'fantasy_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  try {
    await client.connect();
    console.log('Connected to DB successfully.');
    
    const races = await client.query('SELECT * FROM races');
    console.log(`Races count: ${races.rows.length}`);
    console.log('Races:', races.rows.map(r => r.name));
    
    const athletes = await client.query('SELECT COUNT(*) FROM athletes');
    console.log(`Athletes count: ${athletes.rows[0].count}`);

    const sponsors = await client.query('SELECT COUNT(*) FROM sponsors');
    console.log(`Sponsors count: ${sponsors.rows[0].count}`);
  } catch (err) {
    console.error('Error during check:', err.message);
  } finally {
    await client.end();
  }
}

check();
