/**
 * Shadow Azeroth — Estelas Level Rewards Cron Job
 * ================================================
 * Escanea TODAS las cuentas y otorga Estelas por niveles hito.
 * Ejecutar como cron job cada 5-10 minutos:
 *   node scripts/estelas-level-cron.js
 *
 * O con PM2:
 *   pm2 start scripts/estelas-level-cron.js --cron "*/5 * * * *" --no-autorestart
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'blizzcms';
const DB_PASS = process.env.DB_PASSWORD || '';

// ── Recompensas ──────────────────────────────────────────────────────────────
const LEVEL_REWARDS = [
  {
    level: 10,
    estelas: 3,
    subject: '¡Primeras Estelas!',
    body: '¡Felicidades, Adalid! Conseguiste tus primeras Estelas. Visita la pagina web para usarlas en la tienda. ¡Sigue subiendo niveles para conseguir las 10 totales!',
  },
  {
    level: 40,
    estelas: 4,
    subject: '¡Mas Estelas!',
    body: '¡Felicidades, Adalid! Tu esfuerzo rinde frutos. Aqui tienes mas Estelas. ¡Solo te faltan 3 mas al llegar al nivel 70!',
  },
  {
    level: 70,
    estelas: 3,
    subject: '¡Recompensa Final!',
    body: '¡Felicidades, Adalid! Completaste todas las recompensas de Estelas. Aqui esta tu ultima entrega. ¡Bienvenido a Shadow Azeroth, heroe!',
  },
];

// ── SOAP helper ──────────────────────────────────────────────────────────────
async function sendSoapMail(characterName, subject, body) {
  const soapEndpoint = process.env.ACORE_SOAP_URL;
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  if (!soapEndpoint || !soapUser || !soapPassword) {
    console.warn('  ⚠️ SOAP no configurado, correo no enviado a', characterName);
    return;
  }

  const safeSubject = subject.replace(/"/g, '\\"');
  const safeBody = body.replace(/"/g, '\\"');
  const command = `.send mail ${characterName} "${safeSubject}" "${safeBody}"`;

  const auth = Buffer.from(`${soapUser}:${soapPassword}`).toString('base64');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:AC">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${command}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  try {
    const response = await fetch(soapEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'executeCommand',
      },
      body: xml,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`  ❌ SOAP error for ${characterName}:`, text);
    } else {
      console.log(`  📧 Correo enviado a ${characterName}: ${subject}`);
    }
  } catch (err) {
    console.error(`  ❌ SOAP fetch error for ${characterName}:`, err.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Shadow Azeroth — Estelas Level Rewards Cron');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════');

  const authPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: process.env.DB_AUTH || 'acore_auth',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const charPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: process.env.DB_CHARACTERS || 'acore_characters',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // 1. Ensure reward table exists
    await authPool.query(`
      CREATE TABLE IF NOT EXISTS estelas_level_rewards_log (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        account_id INT UNSIGNED NOT NULL,
        reward_level SMALLINT UNSIGNED NOT NULL,
        estelas_awarded INT UNSIGNED NOT NULL,
        character_guid INT UNSIGNED NOT NULL,
        character_name VARCHAR(32) NOT NULL,
        awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_account_reward_level (account_id, reward_level),
        KEY idx_account (account_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Get all accounts that have characters at or above reward levels
    const minRewardLevel = Math.min(...LEVEL_REWARDS.map((r) => r.level));
    const [charRows] = await charPool.query(
      `SELECT account, MAX(level) AS maxLevel, 
              (SELECT name FROM characters c2 WHERE c2.account = c.account ORDER BY level DESC LIMIT 1) AS topCharName,
              (SELECT guid FROM characters c3 WHERE c3.account = c.account ORDER BY level DESC LIMIT 1) AS topCharGuid
       FROM characters c
       WHERE level >= ?
       GROUP BY account`,
      [minRewardLevel]
    );

    if (!charRows || charRows.length === 0) {
      console.log('\n  No hay cuentas con personajes nivel >= ' + minRewardLevel);
      return;
    }

    console.log(`\n  Cuentas con personajes elegibles: ${charRows.length}`);

    // 3. Get all already-awarded rewards
    const [allAwarded] = await authPool.query(
      'SELECT account_id, reward_level FROM estelas_level_rewards_log'
    );
    const awardedMap = new Map();
    for (const row of allAwarded || []) {
      const key = `${row.account_id}-${row.reward_level}`;
      awardedMap.set(key, true);
    }

    let totalRewardsGiven = 0;
    let totalEsrelasGiven = 0;

    // 4. Process each account
    for (const row of charRows) {
      const accountId = Number(row.account);
      const maxLevel = Number(row.maxLevel);
      const charName = String(row.topCharName || 'Desconocido');
      const charGuid = Number(row.topCharGuid || 0);

      for (const reward of LEVEL_REWARDS) {
        if (maxLevel < reward.level) continue;

        const key = `${accountId}-${reward.level}`;
        if (awardedMap.has(key)) continue;

        // Award!
        try {
          await authPool.query(
            `INSERT INTO estelas_level_rewards_log
             (account_id, reward_level, estelas_awarded, character_guid, character_name)
             VALUES (?, ?, ?, ?, ?)`,
            [accountId, reward.level, reward.estelas, charGuid, charName]
          );

          await authPool.query(
            'UPDATE account SET vp = vp + ? WHERE id = ?',
            [reward.estelas, accountId]
          );

          awardedMap.set(key, true);
          totalRewardsGiven++;
          totalEsrelasGiven += reward.estelas;

          console.log(`  ✅ Cuenta #${accountId} (${charName}) → Nivel ${reward.level}: +${reward.estelas} Estelas`);

          // Send in-game mail
          await sendSoapMail(charName, reward.subject, reward.body);
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            // Already awarded (race condition safe)
            awardedMap.set(key, true);
          } else {
            console.error(`  ❌ Error para cuenta #${accountId}:`, err.message);
          }
        }
      }
    }

    console.log('\n───────────────────────────────────────────────');
    console.log(`  Recompensas otorgadas: ${totalRewardsGiven}`);
    console.log(`  Estelas distribuidas: ${totalEsrelasGiven}`);
    console.log('───────────────────────────────────────────────');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await authPool.end();
    await charPool.end();
  }
}

main().catch(console.error);
