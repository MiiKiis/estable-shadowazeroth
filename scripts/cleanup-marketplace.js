const mysql = require('mysql2/promise');
const { Client } = require('ssh2');
const net = require('net');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const HOLD_ACCOUNT_ID = Number(process.env.MARKET_HOLD_ACCOUNT_ID || 1);
const DELETE_HOLD_CHARS = process.argv.includes('--delete-hold-chars');

function getDbConfig(database, port) {
  return {
    host: '127.0.0.1',
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

async function openConnectionThroughSsh(database) {
  const sshEnabled = String(process.env.SSH_ENABLED || '').toLowerCase() === 'true';

  if (!sshEnabled) {
    return mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database,
    });
  }

  const ssh = new Client();

  return new Promise((resolve, reject) => {
    ssh.on('ready', () => {
      const server = net.createServer((sock) => {
        ssh.forwardOut('127.0.0.1', 0, '127.0.0.1', 3306, (err, stream) => {
          if (err) {
            sock.destroy();
            return;
          }
          sock.pipe(stream).pipe(sock);
        });
      });

      server.listen(0, '127.0.0.1', async () => {
        try {
          const port = server.address().port;
          const conn = await mysql.createConnection(getDbConfig(database, port));
          conn._ssh = ssh;
          conn._proxyServer = server;
          resolve(conn);
        } catch (err) {
          reject(err);
        }
      });
    });

    ssh.on('error', reject);

    ssh.connect({
      host: process.env.SSH_HOST,
      port: Number(process.env.SSH_PORT || 22),
      username: process.env.SSH_USER,
      password: process.env.SSH_PASSWORD,
      readyTimeout: 30000,
    });
  });
}

async function closeConnection(conn) {
  if (!conn) return;
  try {
    await conn.end();
  } catch {}
  try {
    if (conn._proxyServer) conn._proxyServer.close();
  } catch {}
  try {
    if (conn._ssh) conn._ssh.end();
  } catch {}
}

async function run() {
  let authConn;
  let charConn;

  try {
    const authDb = process.env.DB_AUTH || process.env.DB_NAME_AUTH || 'auth';
    const charDb = process.env.DB_CHARACTERS || process.env.DB_NAME_CHARACTERS || 'characters';

    authConn = await openConnectionThroughSsh(authDb);
    charConn = await openConnectionThroughSsh(charDb);

    const [[listingStats]] = await authConn.query(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
         COUNT(*) AS total_listings
       FROM marketplace_listings`
    );

    const [[salesStats]] = await authConn.query(
      'SELECT COUNT(*) AS total_sales FROM marketplace_sales'
    );

    const [[holdBefore]] = await charConn.query(
      'SELECT COUNT(*) AS hold_chars FROM characters WHERE account = ?',
      [HOLD_ACCOUNT_ID]
    );

    console.log('--- ESTADO ANTES DE LIMPIEZA ---');
    console.log(`Hold account ID: ${HOLD_ACCOUNT_ID}`);
    console.log(`Listings activos: ${Number(listingStats?.active_count || 0)}`);
    console.log(`Listings totales: ${Number(listingStats?.total_listings || 0)}`);
    console.log(`Ventas totales: ${Number(salesStats?.total_sales || 0)}`);
    console.log(`Chars en hold account: ${Number(holdBefore?.hold_chars || 0)}`);

    await authConn.beginTransaction();

    await authConn.query('DELETE FROM marketplace_sales');
    await authConn.query('DELETE FROM marketplace_listings');

    await authConn.commit();

    let deletedChars = 0;
    if (DELETE_HOLD_CHARS) {
      const [deleteRes] = await charConn.query(
        'DELETE FROM characters WHERE account = ?',
        [HOLD_ACCOUNT_ID]
      );
      deletedChars = Number(deleteRes?.affectedRows || 0);
    }

    const [[holdAfter]] = await charConn.query(
      'SELECT COUNT(*) AS hold_chars FROM characters WHERE account = ?',
      [HOLD_ACCOUNT_ID]
    );

    console.log('--- LIMPIEZA COMPLETADA ---');
    console.log('marketplace_sales: vaciada');
    console.log('marketplace_listings: vaciada');
    if (DELETE_HOLD_CHARS) {
      console.log(`characters borrados de hold account: ${deletedChars}`);
    } else {
      console.log('characters en hold account: sin borrar (usa --delete-hold-chars)');
    }
    console.log(`Chars en hold account ahora: ${Number(holdAfter?.hold_chars || 0)}`);

    if (Number(holdAfter?.hold_chars || 0) > 500) {
      console.log('AVISO: hold account supera 500 personajes.');
    } else {
      console.log('OK: hold account en o por debajo de 500 personajes.');
    }
  } catch (err) {
    try {
      if (authConn) await authConn.rollback();
    } catch {}
    console.error('Error en cleanup-marketplace:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await closeConnection(authConn);
    await closeConnection(charConn);
  }
}

run();
