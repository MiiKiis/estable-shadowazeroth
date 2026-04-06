const mysql = require('mysql2/promise');
const { Client } = require('ssh2');
const net = require('net');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

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

async function detectDurabilityColumn(worldConn) {
  const [maxCols] = await worldConn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'item_template'
       AND COLUMN_NAME = 'MaxDurability'`
  );
  if (Number(maxCols?.[0]?.c || 0) > 0) return 'MaxDurability';

  const [lowerCols] = await worldConn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'item_template'
       AND COLUMN_NAME = 'maxDurability'`
  );
  if (Number(lowerCols?.[0]?.c || 0) > 0) return 'maxDurability';

  return null;
}

async function run() {
  let charConn;
  let worldConn;

  try {
    const charDb = process.env.DB_CHARACTERS || process.env.DB_NAME_CHARACTERS || 'characters';
    const worldDb = process.env.DB_WORLD || process.env.DB_NAME_WORLD || 'world';

    charConn = await openConnectionThroughSsh(charDb);
    worldConn = await openConnectionThroughSsh(worldDb);

    const durabilityCol = await detectDurabilityColumn(worldConn);
    if (!durabilityCol) {
      throw new Error('No se encontro columna MaxDurability/maxDurability en world.item_template');
    }

    await charConn.query(`
      CREATE TABLE IF NOT EXISTS item_instance_durability_backup (
        guid BIGINT UNSIGNED NOT NULL,
        itemEntry INT UNSIGNED NOT NULL,
        owner_guid BIGINT UNSIGNED NOT NULL,
        old_durability INT UNSIGNED NOT NULL,
        backup_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guid),
        KEY idx_item_entry (itemEntry),
        KEY idx_owner_guid (owner_guid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [beforeRows] = await charConn.query(
      `SELECT COUNT(*) AS c
       FROM item_instance ii
       JOIN ${worldDb}.item_template it ON it.entry = ii.itemEntry
       WHERE ii.durability = 0
         AND it.${durabilityCol} > 0`
    );
    const before = Number(beforeRows?.[0]?.c || 0);

    await charConn.query(
      `INSERT IGNORE INTO item_instance_durability_backup (guid, itemEntry, owner_guid, old_durability)
       SELECT ii.guid, ii.itemEntry, ii.owner_guid, ii.durability
       FROM item_instance ii
       JOIN ${worldDb}.item_template it ON it.entry = ii.itemEntry
       WHERE ii.durability = 0
         AND it.${durabilityCol} > 0`
    );

    const [updateResult] = await charConn.query(
      `UPDATE item_instance ii
       JOIN ${worldDb}.item_template it ON it.entry = ii.itemEntry
       SET ii.durability = it.${durabilityCol}
       WHERE ii.durability = 0
         AND it.${durabilityCol} > 0`
    );

    const [afterRows] = await charConn.query(
      `SELECT COUNT(*) AS c
       FROM item_instance ii
       JOIN ${worldDb}.item_template it ON it.entry = ii.itemEntry
       WHERE ii.durability = 0
         AND it.${durabilityCol} > 0`
    );
    const after = Number(afterRows?.[0]?.c || 0);

    console.log('--- REPARACION DURABILITY ---');
    console.log(`DB characters: ${charDb}`);
    console.log(`DB world: ${worldDb}`);
    console.log(`Columna detectada: ${durabilityCol}`);
    console.log(`Candidatos antes: ${before}`);
    console.log(`Filas actualizadas: ${Number(updateResult?.affectedRows || 0)}`);
    console.log(`Candidatos despues: ${after}`);
    console.log('Backup: item_instance_durability_backup');
  } catch (err) {
    console.error('Error reparando durability:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await closeConnection(charConn);
    await closeConnection(worldConn);
  }
}

run();
