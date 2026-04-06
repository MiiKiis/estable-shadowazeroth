const mysql = require('mysql2/promise');

async function debug() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306, // Intentar puerto directo primero si falla SSH proxy
    user: 'root',
    password: 'Yafetharuquipa12.',
  });

  console.log('--- DATABASES ---');
  const [dbs] = await conn.query('SHOW DATABASES');
  console.log(JSON.stringify(dbs, null, 2));

  for (const db of dbs) {
    const dbName = db.Database || db.SCHEMA_NAME;
    if (dbName.includes('auth') || dbName.includes('character') || dbName.includes('world')) {
       console.log(`--- TABLES IN ${dbName} ---`);
       try {
         const [tables] = await conn.query(`SHOW TABLES FROM ${dbName}`);
         console.log(JSON.stringify(tables, null, 2));
       } catch (e) {
         console.log(`Error reading ${dbName}: ${e.message}`);
       }
    }
  }
  
  await conn.end();
}

debug().catch(console.error);
