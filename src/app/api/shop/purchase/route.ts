import { NextResponse } from 'next/server';
import pool, { authPool } from '@/lib/db';
import crypto from 'crypto';

type Currency = 'vp' | 'dp';

type ShopItemRow = {
  id: number;
  item_id?: number;
  name?: string;
  price: number;
  currency: string;
  price_dp?: number;
  price_vp?: number;
  soap_item_entry?: number | null;
  soap_item_count?: number | null;
  service_type?: string;
  service_data?: string | null;
  faction?: string | null;
};

type UserRow = {
  id: number;
  vp: number;
  dp: number;
};

type CharacterRow = {
  guid: number;
  name: string;
  account?: number;
};

function toBinaryBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex');
    }
    return Buffer.from(trimmed, 'binary');
  }
  throw new Error('Formato de PIN almacenado no soportado');
}

function isValidCurrency(currency: string): currency is Currency {
  return currency === 'vp' || currency === 'dp';
}

async function ensurePurchaseHistoryTable(connection: Awaited<ReturnType<typeof authPool.getConnection>>) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS shop_purchases (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id INT UNSIGNED NOT NULL,
      item_id INT UNSIGNED NOT NULL,
      item_name VARCHAR(120) NOT NULL DEFAULT '',
      currency ENUM('vp','dp') NOT NULL,
      price INT UNSIGNED NOT NULL,
      character_guid INT UNSIGNED NULL,
      character_name VARCHAR(60) NOT NULL DEFAULT '',
      is_gift TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_account_created (account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// ─── SOAP utilities ──────────────────────────────────────────────────────────

async function executeSoapCommand(command: string) {
  const soapEndpoint = process.env.ACORE_SOAP_URL;
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  if (!soapEndpoint || !soapUser || !soapPassword) {
    throw new Error('SOAP no está configurado correctamente. Revisa las variables de entorno: ACORE_SOAP_URL, ACORE_SOAP_USER, ACORE_SOAP_PASSWORD.');
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
  let response;
  let text = '';
  try {
    response = await fetch(soapEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'executeCommand',
      },
      body: xml,
      cache: 'no-store',
    });
    text = await response.text();
  } catch (err) {
    const errorObj = {
      error: 'No se pudo conectar al servidor SOAP.',
      soapCommand: command,
      soapResponse: null,
    };
    throw Object.assign(new Error(errorObj.error), errorObj);
  }

  if (!response.ok) {
    let userMessage = 'Error al comunicarse con el servidor.';
    if (response.status === 401 || response.status === 403) {
      userMessage = 'Permisos insuficientes para ejecutar el comando SOAP.';
    }
    if (/incorrect|denied|not allowed|no permission|invalid/i.test(text)) {
      userMessage = text;
    }
    const errorObj = {
      error: userMessage,
      soapCommand: command,
      soapResponse: text,
      httpStatus: response.status,
    };
    throw Object.assign(new Error(userMessage), errorObj);
  }

  if (/faultcode|SOAP-ENV:Fault|<result>false<\/result>/i.test(text)) {
    const match = text.match(/<faultstring>(.*?)<\/faultstring>/i);
    const faultMsg = match ? match[1] : 'Comando SOAP falló.';
    throw Object.assign(new Error(faultMsg), {
      error: faultMsg,
      soapCommand: command,
      soapResponse: text,
    });
  }

  return { skipped: false };
}

// ─── Mail-based item delivery (writes directly to acore_characters.mail) ─────
// This is the safest method: items go to mailbox, no inventory overflow risk.

async function sendItemsViaMail(params: {
  receiverGuid: number;
  subject: string;
  body: string;
  items: { entry: number; count: number }[];
  gold?: number;                               // in gold (will be converted to copper)
}) {
  const now = Math.floor(Date.now() / 1000);
  const expireTime = now + 30 * 24 * 3600;      // 30 days

  // Insert one mail per batch of 12 items (WoW mail limit per message)
  const ITEMS_PER_MAIL = 12;
  const batches: { entry: number; count: number }[][] = [];
  for (let i = 0; i < params.items.length; i += ITEMS_PER_MAIL) {
    batches.push(params.items.slice(i, i + ITEMS_PER_MAIL));
  }

  // If no items but gold, still send a mail
  if (batches.length === 0 && (params.gold || 0) > 0) {
    batches.push([]);
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const goldCopper = batchIdx === 0 ? (params.gold || 0) * 10000 : 0; // gold only on first mail
    const hasItems = batch.length > 0 ? 1 : 0;

    // mailType=3 = normal (creature/npc sent), stationery=41 (default)
    // has_items flag in mail tells the server to look in mail_items
    const [mailResult]: any = await pool.query(
      `INSERT INTO mail (messageType, stationery, sender, receiver, subject, body, has_items, expire_time, deliver_time, money, checked)
       VALUES (3, 41, 0, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [params.receiverGuid, params.subject, params.body, hasItems, expireTime, now, goldCopper]
    );

    const mailId = mailResult?.insertId;
    if (!mailId) throw new Error('No se pudo crear el correo in-game');

    // Insert each item into mail_items
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      // Generate a unique item_guid by inserting into item_instance first
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

// Parse "49908, 50644, 50078:2" into [{entry, count}]
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

// ─── Boost bundle delivery (level + gold + items via mail) ───────────────────

async function deliverLevelBoost(character: CharacterRow, serviceData: string | null) {
  let targetLevel = 80;
  let gold = 0;
  let itemsRaw = '';

  // Parse JSON service_data  
  if (serviceData) {
    try {
      const sd = JSON.parse(serviceData);
      targetLevel = Number(sd.level) || 80;
      gold = Number(sd.gold) || 0;
      itemsRaw = String(sd.items || '');
    } catch {
      // Legacy: serviceData is just the level number
      targetLevel = Number(serviceData) || 80;
    }
  }

  // 1. Level boost via SOAP (works if online), DB fallback if offline
  try {
    await executeSoapCommand(`.character level ${character.name} ${targetLevel}`);
  } catch {
    // DB fallback for offline characters
    await pool.query(
      'UPDATE characters SET level = ? WHERE guid = ? AND level < ?',
      [targetLevel, character.guid, targetLevel]
    );
  }

  // 2. Send items + gold via mail
  const items = parseItemList(itemsRaw);
  if (items.length > 0 || gold > 0) {
    await sendItemsViaMail({
      receiverGuid: character.guid,
      subject: 'Boost de Nivel',
      body: `Felicidades! Has recibido un boost a nivel ${targetLevel}. Aquí están tus items y recursos.`,
      items,
      gold,
    });
  }
}

// ─── Profession kit delivery (skill + materials via mail) ────────────────────

async function deliverProfession(character: CharacterRow, itemId: number, serviceData: string | null) {
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

  // 1. Set the skill via DB (safe and reliable, no SOAP dependency)
  if (skillId > 0) {
    try {
      const [existingSkill]: any = await pool.query(
        'SELECT guid FROM character_skills WHERE guid = ? AND skill = ? LIMIT 1',
        [character.guid, skillId]
      );
      if (existingSkill && existingSkill.length > 0) {
        await pool.query(
          'UPDATE character_skills SET value = ?, max = ? WHERE guid = ? AND skill = ?',
          [skillLevel, skillLevel, character.guid, skillId]
        );
      } else {
        await pool.query(
          'INSERT INTO character_skills (guid, skill, value, max) VALUES (?, ?, ?, ?)',
          [character.guid, skillId, skillLevel, skillLevel]
        );
      }
      console.log(`Profession ${skillId} set to ${skillLevel} for char ${character.guid} via DB.`);
    } catch (dbErr) {
      console.error('Profession DB write failed, trying SOAP:', dbErr);
      // Fallback to SOAP if DB fails (e.g. character is online and skill table locked)
      try {
        await executeSoapCommand(`.setskill ${skillId} ${skillLevel} ${skillLevel} ${character.name}`);
      } catch (soapErr) {
        throw new Error(`No se pudo aplicar la profesión. Intenta con el personaje desconectado.`);
      }
    }
  }

  // 2. Send materials via mail
  const materials = parseItemList(materialsRaw);
  if (materials.length > 0) {
    await sendItemsViaMail({
      receiverGuid: character.guid,
      subject: 'Kit de Profesion',
      body: 'Aqui tienes los materiales para tu profesion. Revisa tu buzon!',
      items: materials,
    });
  }
}

// ─── SOAP item delivery (legacy / simple items) ──────────────────────────────

async function sendSoapItem(params: {
  characterName: string;
  itemEntry: number;
  itemCount: number;
}) {
  const command = `.send items ${params.characterName} "Agradecimiento" "gracias por tu apoyo esto ayuda al servidor" ${params.itemEntry}:${params.itemCount}`;
  return executeSoapCommand(command);
}

// ─── Main POST handler ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const itemId = Number(body?.itemId);
    const characterGuid = body?.characterGuid ? Number(body.characterGuid) : null;
    const isGift = body?.isGift === true;
    const pin = String(body?.pin || '').trim();
    
    // ── Buyer chooses currency ───────────────────────────────
    const chosenCurrency = String(body?.currency || '').toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    if (isGift && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN invalido para realizar un regalo' }, { status: 400 });
    }

    connection = await authPool.getConnection();
    await ensurePurchaseHistoryTable(connection);
    await connection.beginTransaction();

    const [itemRows] = await connection.query(
      'SELECT id, name, price, currency, price_dp, price_vp, item_id, soap_item_entry, soap_item_count, service_type, service_data, faction FROM shop_items WHERE id = ? LIMIT 1',
      [itemId]
    );
    const items = itemRows as ShopItemRow[];

    if (items.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    const item = items[0];
    
    // ── Resolve price based on chosen currency ───────────────
    const priceDp = Number(item.price_dp || 0);
    const priceVp = Number(item.price_vp || 0);
    
    let currency: Currency;
    let price: number;
    
    if (chosenCurrency === 'dp' && priceDp > 0) {
      currency = 'dp';
      price = priceDp;
    } else if (chosenCurrency === 'vp' && priceVp > 0) {
      currency = 'vp';
      price = priceVp;
    } else if (priceDp > 0 && priceVp > 0) {
      const legacyCur = String(item.currency || 'vp').toLowerCase();
      currency = legacyCur === 'dp' ? 'dp' : 'vp';
      price = currency === 'dp' ? priceDp : priceVp;
    } else if (priceDp > 0) {
      currency = 'dp';
      price = priceDp;
    } else if (priceVp > 0) {
      currency = 'vp';
      price = priceVp;
    } else {
      const legacyCur = String(item.currency || 'vp').toLowerCase();
      if (!isValidCurrency(legacyCur)) {
        await connection.rollback();
        return NextResponse.json({ error: 'Moneda del item no soportada' }, { status: 400 });
      }
      currency = legacyCur;
      price = Number(item.price || 0);
    }

    if (price <= 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Este item no está disponible en esa moneda' }, { status: 400 });
    }

    // ── SOULBOUND RESTRICTION ────────────────────────────────
    if (currency === 'vp' && isGift) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: 'Las Estelas son intransferibles (Soulbound). No pueden usarse para regalar items a otros jugadores. Usa Donaciones para regalos.',
          code: 'ESTELAS_SOULBOUND',
        },
        { status: 403 }
      );
    }

    // ── Fetch buyer account ──────────────────────────────────
    const [userRows] = await connection.query(
      'SELECT id, vp, dp FROM account WHERE id = ? LIMIT 1',
      [userId]
    );
    const users = userRows as UserRow[];

    if (users.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // ── PIN verification for gifts ───────────────────────────
    if (isGift) {
      const [pinRows]: any = await connection.query(
        'SELECT pin_salt, pin_hash FROM account_security_pin WHERE account_id = ? LIMIT 1',
        [userId]
      );

      if (!pinRows || pinRows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Tu cuenta no tiene PIN configurado' }, { status: 403 });
      }

      const pinSalt = toBinaryBuffer(pinRows[0].pin_salt);
      const storedPinHash = toBinaryBuffer(pinRows[0].pin_hash);
      const providedPinHash = crypto.createHash('sha256').update(pinSalt).update(pin).digest();

      if (!crypto.timingSafeEqual(storedPinHash, providedPinHash)) {
        await connection.rollback();
        return NextResponse.json({ error: 'PIN incorrecto para autorizar el regalo' }, { status: 401 });
      }
    }

    const user = users[0];

    if (Number(user[currency]) < price) {
      await connection.rollback();
      return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 });
    }

    // ── ACCEPT_GIFTS CHECK ───────────────────────────────────
    let character: CharacterRow | null = null;
    if (characterGuid) {
      const sql = isGift
        ? 'SELECT guid, name, account FROM characters WHERE guid = ? LIMIT 1'
        : 'SELECT guid, name, account FROM characters WHERE guid = ? AND account = ? LIMIT 1';
      const params = isGift ? [characterGuid] : [characterGuid, userId];

      const [characterRows] = await pool.query(sql, params);
      const characters = characterRows as CharacterRow[];

      if (characters.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Personaje destino no encontrado' }, { status: 404 });
      }

      character = characters[0];

      // Check accept_gifts on the recipient's account
      if (isGift && character.account) {
        const [recipientRows]: any = await connection.query(
          'SELECT accept_gifts FROM account WHERE id = ? LIMIT 1',
          [character.account]
        );
        const acceptGifts = Number(recipientRows?.[0]?.accept_gifts ?? 1);
        if (acceptGifts === 0) {
          await connection.rollback();
          return NextResponse.json(
            {
              error: 'Este jugador tiene desactivada la recepción de regalos (Modo Streamer). No puedes enviarle nada.',
              code: 'GIFTS_DISABLED',
            },
            { status: 403 }
          );
        }
      }
    }

    // ═════════════════════════════════════════════════════════
    // ESCROW: Gifted boost/profession go to pending_gifts
    // ═════════════════════════════════════════════════════════
    const isEscrowService = isGift && character && (item.service_type === 'level_boost' || item.service_type === 'profession');
    
    if (isEscrowService) {
      const [deductResult]: any = await connection.query(
        `UPDATE account SET ${currency} = ${currency} - ? WHERE id = ? AND ${currency} >= ?`,
        [price, userId, price]
      );
      if (!deductResult?.affectedRows) {
        await connection.rollback();
        return NextResponse.json({ error: 'No se pudieron descontar los puntos' }, { status: 400 });
      }

      // Ensure pending_gifts table
      await connection.query(`
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
          KEY idx_donor (donor_account),
          KEY idx_recipient (recipient_account),
          KEY idx_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(
        `INSERT INTO pending_gifts (donor_account, recipient_account, character_guid, character_name, shop_item_id, item_name, currency_used, price_paid, service_type, service_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          character!.account || 0,
          character!.guid,
          character!.name,
          item.id,
          String(item.name || ''),
          currency,
          price,
          item.service_type,
          item.service_data || null,
        ]
      );

      // Record in purchase history as pending
      await connection.query(
        `INSERT INTO shop_purchases
         (account_id, item_id, item_name, currency, price, character_guid, character_name, is_gift)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, itemId, String(item.name || '') + ' [PENDIENTE]', currency, price, character!.guid, character!.name, 1]
      );

      // Send in-game mail notification
      try {
        const donorName = await getDonorUsername(connection, userId);
        await executeSoapCommand(
          `.send mail ${character!.name} "Regalo Pendiente" "El jugador ${donorName} quiere regalarte ${item.name || 'un servicio'}. Revisa tu panel web en shadowazeroth.com/dashboard para aceptar o rechazar."`
        );
      } catch {
        console.error('Failed to send in-game notification (non-critical)');
      }

      await connection.commit();

      return NextResponse.json(
        {
          success: true,
          pending: true,
          message: `El servicio ha quedado en espera. Se notificó a ${character!.name} para que acepte el regalo.`,
        },
        { status: 200 }
      );
    }

    // ═════════════════════════════════════════════════════════
    // STANDARD PURCHASE FLOW
    // ═════════════════════════════════════════════════════════
    const [updateResult]: any = await connection.query(
      `UPDATE account SET ${currency} = ${currency} - ? WHERE id = ? AND ${currency} >= ?`,
      [price, userId, price]
    );

    if (!updateResult?.affectedRows) {
      await connection.rollback();
      return NextResponse.json({ error: 'No se pudieron descontar los puntos' }, { status: 400 });
    }

    if (character) {
      // 1. SOAP Items (Standard or Bundle)
      if (item.service_type === 'bundle' && item.service_data) {
        try {
          const bundleItems = JSON.parse(item.service_data);
          if (Array.isArray(bundleItems)) {
            for (const b of bundleItems) {
              await sendSoapItem({
                characterName: character.name,
                itemEntry: Number(b.id || b.item_id),
                itemCount: Number(b.count || 1),
              });
            }
          }
        } catch (e) { console.error('Error parsing bundle data:', e); }
      } else if (item.soap_item_entry && (!item.service_type || item.service_type === 'none')) {
        await sendSoapItem({
          characterName: character.name,
          itemEntry: Number(item.soap_item_entry),
          itemCount: Number(item.soap_item_count || 1),
        });
      }

      // 2. Database Services
      if (item.service_type && item.service_type !== 'none' && item.service_type !== 'bundle') {
        switch (item.service_type) {
          case 'name_change':
            await pool.query('UPDATE characters SET at_login = at_login | 1 WHERE guid = ?', [character.guid]);
            break;
          case 'race_change':
            await pool.query('UPDATE characters SET at_login = at_login | 128 WHERE guid = ?', [character.guid]);
            break;
          case 'faction_change':
            await pool.query('UPDATE characters SET at_login = at_login | 64 WHERE guid = ?', [character.guid]);
            break;

          case 'level_boost':
            await deliverLevelBoost(character, item.service_data || null);
            break;

          case 'experience': {
            const xpAmount = Number(item.service_data) || 100000;
            await executeSoapCommand(`.modify xp ${character.name} ${xpAmount}`);
            break;
          }

          case 'gold_pack': {
            const goldAmount = Number(item.service_data) || 1000;
            const copperAmount = goldAmount * 10000;
            await executeSoapCommand(`.send money ${character.name} "Agradecimiento" "gracias por tu apoyo esto ayuda al servidor" ${copperAmount}`);
            break;
          }

          case 'profession':
            await deliverProfession(character, Number(item.item_id), item.service_data || null);
            break;

          case 'character_transfer': {
            const targetAccountId = Number(body?.targetAccountId);
            if (targetAccountId > 0) {
              await pool.query('UPDATE characters SET account = ? WHERE guid = ?', [targetAccountId, character.guid]);
            }
            break;
          }
        }
      }
    }

    await connection.query(
      `INSERT INTO shop_purchases
       (account_id, item_id, item_name, currency, price, character_guid, character_name, is_gift)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        itemId,
        String(item.name || ''),
        currency,
        price,
        character ? character.guid : null,
        character ? character.name : '',
        isGift ? 1 : 0,
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        success: true,
        message: isGift ? 'Regalo enviado con exito' : 'Compra realizada con exito',
        purchase: {
          userId,
          itemId,
          characterGuid,
          currency,
          price,
          soapDelivered: Boolean(character && item.soap_item_entry),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Shop purchase error:', error);
    return NextResponse.json(
      {
        error: 'Error en el servidor',
        details: error.message,
        code: error.code,
        soapCommand: error.soapCommand,
        soapResponse: error.soapResponse,
        httpStatus: error.httpStatus,
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}

// Helper to get donor username for in-game notification
async function getDonorUsername(connection: any, accountId: number): Promise<string> {
  try {
    const [rows]: any = await connection.query(
      'SELECT username FROM account WHERE id = ? LIMIT 1',
      [accountId]
    );
    return rows?.[0]?.username || 'Un jugador';
  } catch {
    return 'Un jugador';
  }
}