const { Client } = require('pg');
const client = new Client({
  database: 'fantasy_db',
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432
});

async function run() {
  await client.connect();
  const res = await client.query('DELETE FROM users WHERE email = $1 RETURNING *', ['sec_admin@fantasy.com']);
  console.log('Deleted user row:', res.rows[0]);
  await client.end();
}

run().catch(console.error);
