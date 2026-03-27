import { NextResponse } from 'next/server';
import pool, { authPool } from '@/lib/db';

// ─── SOAP utility (shared) ──────────────────────────────────────────────────

async function executeSoapCommand(command: string) {
  const soapEndpoint = process.env.ACORE_SOAP_URL;
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;
  if (!soapEndpoint || !soapUser || !soapPassword) {
    throw new Error('SOAP no configurado');
  }
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:AC">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${command}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  const auth = Buffer.from(`${soapUser}:${soapPassword}`).toString('base64');
  const response = await fetch(soapEndpoint, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'executeCommand' },
    body: xml,
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok || /faultcode|SOAP-ENV:Fault/i.test(text)) {
    throw new Error(`SOAP error: ${text.slice(0, 300)}`);
  }
}

// ─── Mail-based delivery (writes to acore_characters.mail) ───────────────────

function parseItemList(raw: string): { entry: number; count: number }[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const parts = s.split(':');
      const entry = Number(parts[0]);
      const count = Number(parts[1]) || 1;
      return entry > 0 ? { entry, count } : null;
    })
    .filter(Boolean) as { entry: number; count: number }[];
}

async function sendItemsViaMail(params: {
  receiverGuid: number;
  subject: string;
  body: string;
  items: { entry: number; count: number }[];
  gold?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const expireTime = now + 30 * 24 * 3600;
  const ITEMS_PER_MAIL = 12;
  const batches: { entry: number; count: number }[][] = [];
  for (let i = 0; i < params.items.length; i += ITEMS_PER_MAIL) {
    batches.push(params.items.slice(i, i + ITEMS_PER_MAIL));
  }
  if (batches.length === 0 && (params.gold || 0) > 0) {
    batches.push([]);
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const goldCopper = batchIdx === 0 ? (params.gold || 0) * 10000 : 0;
    const hasItems = batch.length > 0 ? 1 : 0;

    const [mailResult]: any = await pool.query(
      `INSERT INTO mail (messageType, stationery, sender, receiver, subject, body, has_items, expire_time, deliver_time, money, checked)
       VALUES (3, 41, 0, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [params.receiverGuid, params.subject, params.body, hasItems, expireTime, now, goldCopper]
    );
    const mailId = mailResult?.insertId;
    if (!mailId) throw new Error('No se pudo crear el correo in-game');

    for (const item of batch) {
      const [instanceResult]: any = await pool.query(
        `INSERT INTO item_instance (itemEntry, owner_guid, count) VALUES (?, ?, ?)`,
        [item.entry, params.receiverGuid, item.count]
      );
      const itemGuid = instanceResult?.insertId;
      if (!itemGuid) continue;
      await pool.query(
        `INSERT INTO mail_items (mail_id, item_guid, receiver) VALUES (?, ?, ?)`,
        [mailId, itemGuid, params.receiverGuid]
      );
    }
  }
}

// ─── Level Boost delivery ────────────────────────────────────────────────────

async function deliverLevelBoost(charGuid: number, charName: string, serviceData: string | null) {
  let targetLevel = 80;
  let gold = 0;
  let itemsRaw = '';

  if (serviceData) {
    try {
      const sd = JSON.parse(serviceData);
      targetLevel = Number(sd.level) || 80;
      gold = Number(sd.gold) || 0;
      itemsRaw = String(sd.items || '');
    } catch {
      targetLevel = Number(serviceData) || 80;
    }
  }

  // Level via SOAP or DB fallback
  try {
    await executeSoapCommand(`.character level ${charName} ${targetLevel}`);
  } catch {
    await pool.query(
      'UPDATE characters SET level = ? WHERE guid = ? AND level < ?',
      [targetLevel, charGuid, targetLevel]
    );
  }

  // Items + gold via mail
  const items = parseItemList(itemsRaw);
  if (items.length > 0 || gold > 0) {
    await sendItemsViaMail({
      receiverGuid: charGuid,
      subject: 'Boost de Nivel',
      body: `Felicidades! Boost a nivel ${targetLevel}. Aqui estan tus items y recursos.`,
      items,
      gold,
    });
  }
}

// ─── Profession delivery ─────────────────────────────────────────────────────

async function deliverProfession(charGuid: number, charName: string, itemId: number, serviceData: string | null) {
  let skillId = itemId;
  let skillLevel = 450;
  let materialsRaw = '';

  if (serviceData) {
    try {
      const sd = JSON.parse(serviceData);
      skillId = Number(sd.skillId) || itemId;
      skillLevel = Number(sd.skillLevel) || 450;
      materialsRaw = String(sd.materials || '');
    } catch {
      skillLevel = Number(serviceData) || 450;
    }
  }

  // Skill via DB (primary) or SOAP (fallback)
  if (skillId > 0) {
    try {
      const [existing]: any = await pool.query(
        'SELECT guid FROM character_skills WHERE guid = ? AND skill = ? LIMIT 1',
        [charGuid, skillId]
      );
      if (existing && existing.length > 0) {
        await pool.query('UPDATE character_skills SET value = ?, max = ? WHERE guid = ? AND skill = ?',
          [skillLevel, skillLevel, charGuid, skillId]);
      } else {
        await pool.query('INSERT INTO character_skills (guid, skill, value, max) VALUES (?, ?, ?, ?)',
          [charGuid, skillId, skillLevel, skillLevel]);
      }
    } catch {
      try {
        await executeSoapCommand(`.setskill ${skillId} ${skillLevel} ${skillLevel} ${charName}`);
      } catch {
        throw new Error('No se pudo aplicar la profesión.');
      }
    }
  }

  // Materials via mail
  const materials = parseItemList(materialsRaw);
  if (materials.length > 0) {
    await sendItemsViaMail({
      receiverGuid: charGuid,
      subject: 'Kit de Profesion',
      body: 'Aqui tienes los materiales para tu profesion. Revisa tu buzon!',
      items: materials,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/gifts/pending?accountId=X
// ═════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = Number(searchParams.get('accountId') || 0);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    // Auto-create table if not exists
    try {
      await authPool.query(`
        CREATE TABLE IF NOT EXISTS pending_gifts (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          donor_account INT UNSIGNED NOT NULL,
          recipient_account INT UNSIGNED NOT NULL,
          character_guid INT UNSIGNED NOT NULL,
          character_name VARCHAR(60) NOT NULL DEFAULT '',
          shop_item_id INT UNSIGNED NOT NULL,
          item_name VARCHAR(120) NOT NULL DEFAULT '',
          currency_used ENUM('vp','dp') NOT NULL DEFAULT 'dp',
          price_paid INT UNSIGNED NOT NULL DEFAULT 0,
          service_type VARCHAR(50) NOT NULL DEFAULT 'level_boost',
          service_data TEXT NULL,
          status ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP NULL DEFAULT NULL,
          PRIMARY KEY (id),
          KEY idx_recipient (recipient_account),
          KEY idx_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch { /* exists */ }

    const [rows]: any = await authPool.query(
      `SELECT pg.*, a.username AS donor_username
       FROM pending_gifts pg
       LEFT JOIN account a ON a.id = pg.donor_account
       WHERE pg.recipient_account = ? AND pg.status = 'pending'
       ORDER BY pg.created_at DESC
       LIMIT 20`,
      [accountId]
    );

    return NextResponse.json({ gifts: rows || [] });
  } catch (error: any) {
    console.error('Pending gifts GET error:', error);
    return NextResponse.json(
      { error: 'Error al cargar regalos pendientes', details: error.message },
      { status: 500 }
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/gifts/pending
// Body: { giftId, accountId, action: 'accept' | 'reject' }
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const giftId = Number(body?.giftId || 0);
    const accountId = Number(body?.accountId || 0);
    const action = String(body?.action || '').toLowerCase();

    if (!Number.isInteger(giftId) || giftId <= 0) {
      return NextResponse.json({ error: 'giftId inválido' }, { status: 400 });
    }
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }
    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'Acción debe ser "accept" o "reject"' }, { status: 400 });
    }

    connection = await authPool.getConnection();
    await connection.beginTransaction();

    // Fetch pending gift
    const [giftRows]: any = await connection.query(
      `SELECT * FROM pending_gifts WHERE id = ? AND recipient_account = ? AND status = 'pending' LIMIT 1`,
      [giftId, accountId]
    );

    if (!giftRows || giftRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Regalo no encontrado o ya fue procesado' }, { status: 404 });
    }

    const gift = giftRows[0];

    // ─── REJECT: Refund credits to donor ─────────────────────
    if (action === 'reject') {
      const [refundResult]: any = await connection.query(
        `UPDATE account SET ${gift.currency_used} = ${gift.currency_used} + ? WHERE id = ?`,
        [gift.price_paid, gift.donor_account]
      );
      if (!refundResult?.affectedRows) {
        console.error(`Refund failed for donor ${gift.donor_account}`);
      }

      await connection.query(
        `UPDATE pending_gifts SET status = 'rejected', resolved_at = NOW() WHERE id = ?`,
        [giftId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        action: 'rejected',
        message: `Regalo rechazado. Se reintegraron ${gift.price_paid} ${gift.currency_used === 'vp' ? 'Estelas' : 'Donaciones'} al donante.`,
      });
    }

    // ─── ACCEPT: Apply the service ───────────────────────────
    try {
      if (gift.service_type === 'level_boost') {
        await deliverLevelBoost(gift.character_guid, gift.character_name, gift.service_data);
      } else if (gift.service_type === 'profession') {
        // Get the item_id from the shop item for the skillId
        let shopItemId = 0;
        try {
          const [shopRows]: any = await connection.query(
            'SELECT item_id FROM shop_items WHERE id = ? LIMIT 1',
            [gift.shop_item_id]
          );
          shopItemId = Number(shopRows?.[0]?.item_id || 0);
        } catch { /* not critical */ }
        await deliverProfession(gift.character_guid, gift.character_name, shopItemId, gift.service_data);
      }
    } catch (applyErr: any) {
      await connection.rollback();
      return NextResponse.json({
        error: `No se pudo aplicar el servicio: ${applyErr.message || 'Error desconocido'}`,
      }, { status: 500 });
    }

    await connection.query(
      `UPDATE pending_gifts SET status = 'accepted', resolved_at = NOW() WHERE id = ?`,
      [giftId]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      action: 'accepted',
      message: `¡Regalo aceptado! El servicio se aplicó a ${gift.character_name}.`,
    });
  } catch (error: any) {
    if (connection) {
      try { await connection.rollback(); } catch { /* ignore */ }
    }
    console.error('Pending gift action error:', error);
    return NextResponse.json(
      { error: 'Error procesando el regalo', details: error.message },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
