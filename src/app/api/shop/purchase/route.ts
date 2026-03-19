import { NextResponse } from 'next/server';
import pool, { authPool } from '@/lib/db';
import crypto from 'crypto';

type Currency = 'vp' | 'dp';

type ShopItemRow = {
  id: number;
  name?: string;
  price: number;
  currency: string;
  soap_item_entry?: number | null;
  soap_item_count?: number | null;
  service_type?: string;
  service_data?: string | null;
};

type UserRow = {
  id: number;
  vp: number;
  dp: number;
};

type CharacterRow = {
  guid: number;
  name: string;
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

async function sendSoapItem(params: {
  characterName: string;
  itemEntry: number;
  itemCount: number;
}) {
  const soapEndpoint = process.env.ACORE_SOAP_URL;
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  // Keep the API usable even before SOAP is configured.
  if (!soapEndpoint || !soapUser || !soapPassword) {
    return { skipped: true };
  }

  const command = `.send items ${params.characterName} "Tienda Shadow Azeroth" "Gracias por tu compra" ${params.itemEntry}:${params.itemCount}`;
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
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'executeCommand',
    },
    body: xml,
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SOAP HTTP ${response.status}: ${text}`);
  }

  if (/faultcode|SOAP-ENV:Fault|<result>false<\/result>/i.test(text)) {
    throw new Error(`SOAP command failed: ${text}`);
  }

  return { skipped: false };
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const itemId = Number(body?.itemId);
    const characterGuid = body?.characterGuid ? Number(body.characterGuid) : null;
    const isGift = body?.isGift === true;
    const pin = String(body?.pin || '').trim();

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
      'SELECT id, name, price, currency, soap_item_entry, soap_item_count, service_type, service_data FROM shop_items WHERE id = ? LIMIT 1',
      [itemId]
    );
    const items = itemRows as ShopItemRow[];

    if (items.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    const item = items[0];
    if (!isValidCurrency(item.currency)) {
      await connection.rollback();
      return NextResponse.json({ error: 'Moneda del item no soportada' }, { status: 400 });
    }

    const [userRows] = await connection.query(
      'SELECT id, vp, dp FROM account WHERE id = ? LIMIT 1',
      [userId]
    );
    const users = userRows as UserRow[];

    if (users.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

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
    const currency = item.currency;
    const price = Number(item.price || 0);

    if (price <= 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Precio invalido' }, { status: 400 });
    }

    if (Number(user[currency]) < price) {
      await connection.rollback();
      return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 });
    }

    let character: CharacterRow | null = null;
    if (characterGuid) {
      // When gifting, skip the account ownership check
      const sql = isGift
        ? 'SELECT guid, name FROM characters WHERE guid = ? LIMIT 1'
        : 'SELECT guid, name FROM characters WHERE guid = ? AND account = ? LIMIT 1';
      const params = isGift ? [characterGuid] : [characterGuid, userId];

      const [characterRows] = await pool.query(sql, params);
      const characters = characterRows as CharacterRow[];

      if (characters.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Personaje destino no encontrado' }, { status: 404 });
      }

      character = characters[0];
    }

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
      } else if (item.soap_item_entry) {
        await sendSoapItem({
          characterName: character.name,
          itemEntry: Number(item.soap_item_entry),
          itemCount: Number(item.soap_item_count || 1),
        });
      }

      // 2. Database Services
      if (item.service_type && item.service_type !== 'none' && item.service_type !== 'bundle') {
        const charPool = pool; // Assuming 'pool' is the characters pool based on previous imports
        
        switch (item.service_type) {
          case 'name_change':
            await charPool.query('UPDATE characters SET at_login = at_login | 1 WHERE guid = ?', [character.guid]);
            break;
          case 'race_change':
            await charPool.query('UPDATE characters SET at_login = at_login | 128 WHERE guid = ?', [character.guid]);
            break;
          case 'faction_change':
            await charPool.query('UPDATE characters SET at_login = at_login | 64 WHERE guid = ?', [character.guid]);
            break;
          case 'level_boost':
            const targetLevel = Number(item.service_data) || 60;
            await charPool.query('UPDATE characters SET level = ? WHERE guid = ?', [targetLevel, character.guid]);
            break;
          case 'gold_pack':
            const goldAmount = Number(item.service_data) || 1000;
            const copperAmount = goldAmount * 10000;
            await charPool.query('UPDATE characters SET money = money + ? WHERE guid = ?', [copperAmount, character.guid]);
            break;
          case 'character_transfer':
            const targetAccountId = Number(body?.targetAccountId);
            if (targetAccountId > 0) {
              await charPool.query('UPDATE characters SET account = ? WHERE guid = ?', [targetAccountId, character.guid]);
            }
            break;
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
        stack: error.stack,
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}