import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import pool from '@/lib/db'; // acore_characters
import { executeSoapCommand } from '@/lib/soap';

// ─── Recompensas de Estelas por nivel hito ───────────────────────────────────
// Cada cuenta solo recibe la recompensa UNA VEZ por nivel hito (anti-farm)
const LEVEL_REWARDS: { level: number; estelas: number; subject: string; body: string }[] = [
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

// ─── Asegurar que la tabla de tracking exista ────────────────────────────────
async function ensureRewardTable(connection: any) {
  await connection.query(`
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
}

// ─── Enviar correo in-game via SOAP ──────────────────────────────────────────
async function sendInGameMail(characterName: string, subject: string, body: string) {
  try {
    // Escapar comillas en subject y body para SOAP
    const safeSubject = subject.replace(/"/g, '\\"');
    const safeBody = body.replace(/"/g, '\\"');
    const command = `.send mail ${characterName} "${safeSubject}" "${safeBody}"`;
    await executeSoapCommand(command);
    console.log(`📧 Correo enviado a ${characterName}: ${subject}`);
  } catch (err) {
    console.error(`❌ Error enviando correo a ${characterName}:`, err);
    // No lanzar error — el correo es best-effort
  }
}

/**
 * POST /api/estelas/level-check
 * Escanea los personajes de una cuenta y otorga Estelas por niveles hito.
 * Body: { accountId: number }
 *
 * Retorna las recompensas otorgadas (si las hay).
 */
export async function POST(request: Request) {
  let authConn: any = null;
  let charConn: any = null;

  try {
    const body = await request.json();
    const accountId = Number(body?.accountId);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    authConn = await authPool.getConnection();
    charConn = await pool.getConnection();

    // 1. Asegurar que la tabla existe
    await ensureRewardTable(authConn);

    // 2. Obtener el nivel máximo de TODOS los personajes de esta cuenta
    //    y el nombre + guid del personaje con mayor nivel
    const [charRows]: any = await charConn.query(
      `SELECT guid, name, level, account
       FROM characters
       WHERE account = ?
       ORDER BY level DESC`,
      [accountId]
    );

    if (!charRows || charRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay personajes en esta cuenta.',
        rewards: [],
      });
    }

    // El personaje de mayor nivel (para trackear quién triggereó la recompensa)
    const highestChar = charRows[0];
    const maxLevel = Number(highestChar.level);

    // 3. Ver qué recompensas ya se otorgaron a esta cuenta
    const [existingRewards]: any = await authConn.query(
      'SELECT reward_level FROM estelas_level_rewards_log WHERE account_id = ?',
      [accountId]
    );
    const alreadyAwarded = new Set(
      (existingRewards || []).map((r: any) => Number(r.reward_level))
    );

    // 4. Determinar qué recompensas nuevas aplicar
    const newRewards: typeof LEVEL_REWARDS = [];
    for (const reward of LEVEL_REWARDS) {
      if (maxLevel >= reward.level && !alreadyAwarded.has(reward.level)) {
        newRewards.push(reward);
      }
    }

    if (newRewards.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay recompensas pendientes.',
        rewards: [],
        maxLevel,
      });
    }

    // 5. Otorgar recompensas dentro de una transacción
    await authConn.beginTransaction();

    const awarded: { level: number; estelas: number; character: string }[] = [];
    let totalEstelas = 0;

    for (const reward of newRewards) {
      // Encontrar el primer personaje que tiene al menos ese nivel
      const triggerChar = charRows.find((c: any) => Number(c.level) >= reward.level) || highestChar;

      try {
        // Insertar en el log (UNIQUE constraint previene duplicados)
        await authConn.query(
          `INSERT INTO estelas_level_rewards_log
           (account_id, reward_level, estelas_awarded, character_guid, character_name)
           VALUES (?, ?, ?, ?, ?)`,
          [accountId, reward.level, reward.estelas, triggerChar.guid, triggerChar.name]
        );

        totalEstelas += reward.estelas;
        awarded.push({
          level: reward.level,
          estelas: reward.estelas,
          character: triggerChar.name,
        });
      } catch (insertErr: any) {
        // ER_DUP_ENTRY = ya fue otorgada (race condition safe)
        if (insertErr.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ Recompensa nivel ${reward.level} ya otorgada a cuenta ${accountId}`);
          continue;
        }
        throw insertErr;
      }
    }

    // 6. Sumar todas las Estelas a la cuenta en una sola operación
    if (totalEstelas > 0) {
      await authConn.query(
        'UPDATE account SET vp = vp + ? WHERE id = ?',
        [totalEstelas, accountId]
      );
    }

    await authConn.commit();

    // 7. Enviar correos in-game (fuera de la transacción — best effort)
    for (const reward of newRewards) {
      const triggerChar = charRows.find((c: any) => Number(c.level) >= reward.level) || highestChar;
      // No esperar los correos para no bloquear la respuesta
      sendInGameMail(triggerChar.name, reward.subject, reward.body).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `¡${totalEstelas} Estelas otorgadas!`,
      rewards: awarded,
      totalEstelas,
      maxLevel,
    });
  } catch (error: any) {
    if (authConn) {
      try { await authConn.rollback(); } catch { /* ignore */ }
    }
    console.error('Level-check error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  } finally {
    authConn?.release();
    charConn?.release();
  }
}

/**
 * GET /api/estelas/level-check?accountId=X
 * Consulta el estado de recompensas de una cuenta (sin otorgar nada).
 */
export async function GET(request: Request) {
  let authConn: any = null;
  let charConn: any = null;

  try {
    const { searchParams } = new URL(request.url);
    const accountId = Number(searchParams.get('accountId'));

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    authConn = await authPool.getConnection();
    charConn = await pool.getConnection();

    await ensureRewardTable(authConn);

    // Max level del personaje
    const [charRows]: any = await charConn.query(
      'SELECT MAX(level) AS maxLevel FROM characters WHERE account = ?',
      [accountId]
    );
    const maxLevel = Number(charRows?.[0]?.maxLevel || 0);

    // Recompensas ya otorgadas
    const [existingRewards]: any = await authConn.query(
      'SELECT reward_level, estelas_awarded, character_name, awarded_at FROM estelas_level_rewards_log WHERE account_id = ? ORDER BY reward_level',
      [accountId]
    );

    const alreadyAwarded = new Set(
      (existingRewards || []).map((r: any) => Number(r.reward_level))
    );

    // Estado de cada hito
    const milestones = LEVEL_REWARDS.map((reward) => ({
      level: reward.level,
      estelas: reward.estelas,
      status: alreadyAwarded.has(reward.level)
        ? 'awarded'
        : maxLevel >= reward.level
          ? 'pending' // califica pero no se ha otorgado aún
          : 'locked',  // aún no llega al nivel
      awardedInfo: (existingRewards || []).find((r: any) => Number(r.reward_level) === reward.level) || null,
    }));

    const totalPossible = LEVEL_REWARDS.reduce((sum, r) => sum + r.estelas, 0);
    const totalAwarded = (existingRewards || []).reduce((sum: number, r: any) => sum + Number(r.estelas_awarded), 0);

    return NextResponse.json({
      accountId,
      maxLevel,
      milestones,
      totalPossible,
      totalAwarded,
      remaining: totalPossible - totalAwarded,
    });
  } catch (error: any) {
    console.error('Level-check GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  } finally {
    authConn?.release();
    charConn?.release();
  }
}
