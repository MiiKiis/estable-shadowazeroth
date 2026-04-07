import { NextResponse } from 'next/server';
import pool, { authPool, getSoapUrl } from '@/lib/db';
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
  const soapEndpoint = await getSoapUrl();
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  if (!soapEndpoint || !soapUser || !soapPassword) {
    throw new Error('SOAP no está configurado correctamente. Revisa las variables de entorno: ACORE_SOAP_USER, ACORE_SOAP_PASSWORD.');
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

// ─── Mail-based item delivery via SOAP (AzerothCore compatible) ─────────────

function sanitizeSoapText(input: string): string {
  return String(input || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .trim();
}

async function sendItemsViaMail(params: {
  receiverName: string;
  subject: string;
  body: string;
  items: { entry: number; count: number }[];
  gold?: number; // in gold
}) {
  const receiverName = sanitizeSoapText(params.receiverName);
  if (!receiverName) {
    throw new Error('Nombre de personaje invalido para envio por correo.');
  }

  const subject = sanitizeSoapText(params.subject || 'Compra en Tienda');
  const body = sanitizeSoapText(params.body || 'Gracias por tu apoyo.');

  const normalizedItems = (params.items || [])
    .map((it) => ({ entry: Number(it.entry), count: Math.max(1, Number(it.count) || 1) }))
    .filter((it) => Number.isInteger(it.entry) && it.entry > 0);

  // One SOAP mail per batch of 12 items to match in-game mailbox attachment limits.
  const ITEMS_PER_MAIL = 12;
  const batches: { entry: number; count: number }[][] = [];
  for (let i = 0; i < normalizedItems.length; i += ITEMS_PER_MAIL) {
    batches.push(normalizedItems.slice(i, i + ITEMS_PER_MAIL));
  }

  for (const batch of batches) {
    const itemPayload = batch.map((it) => `${it.entry}:${it.count}`).join(' ');
    await executeSoapCommand(`.send items ${receiverName} "${subject}" "${body}" ${itemPayload}`);
  }

  const goldAmount = Math.max(0, Number(params.gold || 0));
  if (goldAmount > 0) {
    const goldCopper = Math.floor(goldAmount * 10000);
    await executeSoapCommand(`.send money ${receiverName} "${subject}" "${body}" ${goldCopper}`);
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

  // 1. Level boost via SOAP (instant for online), DB fallback if offline
  try {
    await executeSoapCommand(`.character level ${character.name} ${targetLevel}`);
  } catch {
    await pool.query(
      'UPDATE characters SET level = ? WHERE guid = ? AND level < ?',
      [targetLevel, character.guid, targetLevel]
    );
  }

  // 2. Send items + gold via mail
  const items = parseItemList(itemsRaw);
  if (items.length > 0 || gold > 0) {
    await sendItemsViaMail({
      receiverName: character.name,
      subject: 'Boost de Nivel',
      body: `¡Felicidades! Has recibido un boost a nivel ${targetLevel}. Aquí están tus objetos y recursos.`,
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

  const professionRanks: Record<number, number> = {
    171: 51304, 164: 51300, 333: 51313, 202: 51306, 182: 51296,
    773: 45363, 755: 51311, 165: 51302, 186: 51294, 393: 51296,
    197: 51309, 185: 51294, 129: 45542, 356: 51294,
  };

  const rankSpellId = professionRanks[skillId];

  if (skillId > 0) {
    try {
      if (rankSpellId) await executeSoapCommand(`.learn ${rankSpellId} ${character.name}`);
      const safeLevel = Math.min(skillLevel, 450);
      await executeSoapCommand(`.setskill ${character.name} ${skillId} ${safeLevel} ${safeLevel}`);
    } catch {
      const safeLevel = Math.min(skillLevel, 450);
      const [existingSkill]: any = await pool.query(
        'SELECT guid FROM character_skills WHERE guid = ? AND skill = ? LIMIT 1',
        [character.guid, skillId]
      );
      if (existingSkill && existingSkill.length > 0) {
        await pool.query('UPDATE character_skills SET value = ?, max = ? WHERE guid = ? AND skill = ?', [safeLevel, safeLevel, character.guid, skillId]);
      } else {
        await pool.query('INSERT INTO character_skills (guid, skill, value, max) VALUES (?, ?, ?, ?)', [character.guid, skillId, safeLevel, safeLevel]);
      }
    }
  }

  const materials = parseItemList(materialsRaw);
  if (materials.length > 0) {
    await sendItemsViaMail({
      receiverName: character.name,
      subject: 'Kit de Profesión',
      body: 'Aquí tienes los materiales para tu profesión. ¡Revisa tu buzón!',
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
  let userId = 0, itemId = 0, isGift = false, chosenCurrency = '', currency = '';

  try {
    const body = await request.json();
    console.log('🛍️ [SHOP] Iniciando compra/regalo:', { userId: body?.userId, itemId: body?.itemId, char: body?.characterGuid });

    userId = Number(body?.userId);
    itemId = Number(body?.itemId);
    const characterGuid = body?.characterGuid ? Number(body.characterGuid) : null;
    isGift = body?.isGift === true;
    const pin = String(body?.pin || '').trim();
    
    // ── Buyer chooses currency ───────────────────────────────
    chosenCurrency = String(body?.currency || '').toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    if (isGift && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN invalido para realizar un regalo' }, { status: 400 });
    }

    connection = await authPool.getConnection();
    await ensurePurchaseHistoryTable(connection);
    
    // Iniciar transacción explícita
    await connection.query('START TRANSACTION');
    let transactionStarted = true;

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

    const currentBalance = Number(user[currency as Currency] || 0);
    if (currentBalance < price) {
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
        const itemNameSafe = (item.name || 'un servicio').replace(/"/g, "'");
        await executeSoapCommand(
          `.send mail ${character!.name} "Regalo Pendiente" "El jugador ${donorName} quiere regalarte ${itemNameSafe}. Revisa tu panel web en shadowazeroth.com/dashboard para aceptar o rechazar."`
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

    // DELIVERY START
    if (character) {
      const donorName = isGift ? await getDonorUsername(connection, userId) : null;
      console.log(`🎁 [SHOP] Preparando envío para ${character.name}, Donante: ${donorName || 'N/A'}`);

      const mailSubject = isGift ? '¡Has recibido un regalo!' : 'Compra en Tienda';
      const mailBody = isGift 
          ? `¡Hola ${character.name}!\n\nHas recibido un regalo de parte de ${donorName}.\nObjeto: ${item.name}\n\n¡Gracias por jugar en TrinityCore!`
          : `¡Hola ${character.name}!\n\nGracias por tu compra de ${item.name}. Aquí tienes tu objeto.\n\nDisfrútalo.`;

      // 1. Deliver Items (Single or Bundle)
      let itemsToDeliver: { entry: number; count: number }[] = [];

      if (item.service_type === 'bundle' && item.service_data) {
        try {
          const bundleItems = JSON.parse(item.service_data);
          if (Array.isArray(bundleItems)) {
            itemsToDeliver = bundleItems.map(b => ({ entry: Number(b.id || b.item_id), count: Number(b.count || 1) }));
          }
        } catch {}
      } else if (item.soap_item_entry) {
        itemsToDeliver.push({ entry: Number(item.soap_item_entry), count: Number(item.soap_item_count || 1) });
      }

      if (itemsToDeliver.length > 0) {
        await sendItemsViaMail({
          receiverName: character.name,
          subject: mailSubject,
          body: mailBody,
          items: itemsToDeliver
        });
      }

      // 2. Deliver Services
      if (item.service_type && item.service_type !== 'none' && item.service_type !== 'bundle') {
        switch (item.service_type) {
          case 'name_change': await pool.query('UPDATE characters SET at_login = at_login | 1 WHERE guid = ?', [character.guid]); break;
          case 'race_change': await pool.query('UPDATE characters SET at_login = at_login | 128 WHERE guid = ?', [character.guid]); break;
          case 'faction_change': await pool.query('UPDATE characters SET at_login = at_login | 64 WHERE guid = ?', [character.guid]); break;
          case 'level_boost': await deliverLevelBoost(character, item.service_data || null); break;
          case 'experience': await executeSoapCommand(`.modify xp ${character.name} ${Number(item.service_data) || 100000}`); break;
          case 'gold_pack': await sendItemsViaMail({ receiverName: character.name, subject: mailSubject, body: mailBody, items: [], gold: Number(item.service_data) || 1000 }); break;
          case 'profession': await deliverProfession(character, Number(item.item_id), item.service_data || null); break;
        }
      }
    }

    await connection.query(`INSERT INTO shop_purchases (account_id, item_id, item_name, currency, price, character_guid, character_name, is_gift) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
      [userId, itemId, item.name || '', currency, price, character?.guid || null, character?.name || '', isGift ? 1 : 0]);

    await connection.commit();
    return NextResponse.json({ success: true, message: isGift ? 'Regalo enviado con éxito' : 'Compra realizada con éxito' });

  } catch (error: any) {
    // Solo intentar rollback si la transacción se inició realmente
    if (connection) {
      try {
        await connection.query('ROLLBACK');
      } catch (rbError) {
        console.error('Rollback error (safe to ignore if no transaction):', rbError);
      }
    }

    console.error('❌ Error crítico en la compra:', {
      message: error.message,
      stack: error.stack,
      userId,
      itemId,
      currency,
      isGift
    });

    return NextResponse.json(
      {
        error: 'Error interno en el servidor',
        details: error.message,
        code: error.code || 'INTERNAL_ERROR',
        hint: 'Verifica que el personaje esté desconectado si es un servicio de login.'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
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
