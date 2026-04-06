const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_AUTH || 'auth'
  });

  const [cols] = await conn.query('DESCRIBE shop_categories');
  console.log('--- COLUMNS ---');
  console.log(JSON.stringify(cols, null, 2));

  const [rows] = await conn.query('SELECT id, name, parent_id FROM shop_categories');
  console.log('--- DATA ---');
  console.log(JSON.stringify(rows, null, 2));

  await conn.end();
}

check().catch(console.error);
