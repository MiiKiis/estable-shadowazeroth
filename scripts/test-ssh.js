const { Client } = require('ssh2');
const mysql = require('mysql2/promise');
const net = require('net');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  console.log('--- TEST DE CONEXIÓN SSH ---');
  console.log(`Host: ${process.env.SSH_HOST}`);
  console.log(`User: ${process.env.SSH_USER}`);
  
  const ssh = new Client();
  
  ssh.on('ready', () => {
    console.log('✅ SSH: Autenticación exitosa.');
    
    // Crear el túnel para MySQL
    const server = net.createServer((sock) => {
      ssh.forwardOut('127.0.0.1', 0, '127.0.0.1', 3306, (err, stream) => {
        if (err) {
          console.error('❌ Error en el túnel:', err);
          return;
        }
        sock.pipe(stream).pipe(sock);
      });
    });

    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      console.log(`📡 Túnel local abierto en puerto ${port}. Probando MySQL...`);
      
      try {
        const connection = await mysql.createConnection({
          host: '127.0.0.1',
          port: port,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_AUTH
        });
        
        console.log('✅ MySQL: Conexión exitosa a través del túnel.');
        const [rows] = await connection.query('SELECT count(*) as count FROM account');
        console.log(`📊 Datos reales obtenidos: ${rows[0].count} cuentas activas.`);
        
        connection.end();
        console.log('✨ TEST COMPLETADO CON ÉXITO.');
        process.exit(0);
      } catch (err) {
        console.error('❌ MySQL: Error de conexión:', err.message);
        process.exit(1);
      }
    });
  });

  ssh.on('error', (err) => {
    console.error('❌ SSH: Falló la conexión:', err.message);
    if (err.message.includes('Authentication failed')) {
      console.log('\n👉 RECOMENDACIÓN: Tu contraseña de SSH (la de la consola negra) no es la misma que la de MySQL.');
      console.log('Revisa la línea SSH_PASSWORD en tu .env.local');
    }
    process.exit(1);
  });

  ssh.connect({
    host: process.env.SSH_HOST,
    port: parseInt(process.env.SSH_PORT || '22'),
    username: process.env.SSH_USER,
    password: process.env.SSH_PASSWORD
  });
}

testConnection();
