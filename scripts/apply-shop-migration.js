const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function applyMigration() {
  console.log('🚀 Iniciando migración de base de datos...');
  
  // Nota: El túnel SSH normal solo funciona dentro del runtime de Next.js
  // Para este script manual, intentaremos conectar directamente o via proxy si está activo.
  // Si el usuario está en local y tiene el túnel SSH de Next corriendo, 127.0.0.1:3306 podría funcionar.
  
  const connectionConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_AUTH || 'auth',
    multipleStatements: true
  };

  try {
    const connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Conectado a la base de datos Auth.');

    const sqlPath = path.join(__dirname, 'migrations', 'shop_robust_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Ejecutando SQL...');
    await connection.query(sql);
    
    console.log('✨ Migración completada con éxito.');
    await connection.end();
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    process.exit(1);
  }
}

applyMigration();
