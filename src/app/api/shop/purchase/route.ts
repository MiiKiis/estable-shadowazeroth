import { NextResponse } from 'next/server';
import pool, { authPool } from '@/lib/db';
import crypto from 'crypto';

type Currency = 'vp' | 'dp';

type ShopItemRow = {
  id: number;
  item_id?: number; // Agregado para compatibilidad con queries y uso en el código
  name?: string;
  price: number;
  currency: string;
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

async function executeSoapCommand(command: string) {
  const soapEndpoint = process.env.ACORE_SOAP_URL;
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  // Validar configuración SOAP
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
      error: 'No se pudo conectar al servidor SOAP. Revisa que el endpoint esté activo y accesible.',
      soapCommand: command,
      soapRequest: xml,
      soapResponse: null,
    };
    throw Object.assign(new Error(errorObj.error), errorObj);
  }

  if (!response.ok) {
    let userMessage = 'Error al comunicarse con el servidor.';
    if (response.status === 401 || response.status === 403) {
      userMessage = 'Permisos insuficientes para ejecutar el comando SOAP. Verifica el usuario y nivel GM.';
    } else if (response.status === 404) {
      userMessage = 'Endpoint SOAP no encontrado. Revisa la configuración.';
    } else if (response.status === 500) {
      userMessage = 'Error interno del servidor SOAP.';
    }
    if (/incorrect|denied|not allowed|no permission|invalid/i.test(text)) {
      userMessage = text;
    }
    const errorObj = {
      error: userMessage,
      soapCommand: command,
      soapRequest: xml,
      soapResponse: text,
      httpStatus: response.status,
    };
    throw Object.assign(new Error(userMessage), errorObj);
  }

  if (/faultcode|SOAP-ENV:Fault|<result>false<\/result>/i.test(text)) {
    const match = text.match(/<faultstring>(.*?)<\/faultstring>/i);
    const faultMsg = match ? match[1] : 'Comando SOAP falló.';
    const errorObj = {
      error: faultMsg,
      soapCommand: command,
      soapRequest: xml,
      soapResponse: text,
      httpStatus: response.status,
    };
    throw Object.assign(new Error(faultMsg), errorObj);
  }

  return { skipped: false };
}

async function sendSoapItem(params: {
  characterName: string;
  itemEntry: number;
  itemCount: number;
}) {
  const command = `.send items ${params.characterName} "Agradecimiento" "gracias por tu apoyo esto ayuda al servidor" ${params.itemEntry}:${params.itemCount}`;
  return executeSoapCommand(command);
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
      'SELECT id, name, price, currency, item_id, soap_item_entry, soap_item_count, service_type, service_data, faction FROM shop_items WHERE id = ? LIMIT 1',
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
      } else if (item.soap_item_entry && (!item.service_type || item.service_type === 'none')) {
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
            const targetLevel = Number(item.service_data) || 80;
            // Usamos .character level para establecer el nivel exacto, evitando errores con .levelup
            await executeSoapCommand(`.character level ${character.name} ${targetLevel}`);
            // Si el boost incluye items, envíalos por correo automáticamente
            if (item.service_data && item.service_data.includes('{')) {
              try {
                const data = JSON.parse(item.service_data);
                if (Array.isArray(data.items)) {
                  for (const b of data.items) {
                    await sendSoapItem({
                      characterName: character.name,
                      itemEntry: Number(b.id || b.item_id),
                      itemCount: Number(b.count || 1),
                    });
                  }
                }
              } catch (e) { /* No items o formato inválido, ignora */ }
            }
            break;
          case 'experience':
            const xpAmount = Number(item.service_data) || 100000;
            // .modify xp <amount> para añadir experiencia (AC standard)
            await executeSoapCommand(`.modify xp ${character.name} ${xpAmount}`);
            break;
          case 'gold_pack':
            const goldAmount = Number(item.service_data) || 1000;
            const copperAmount = goldAmount * 10000;
            await executeSoapCommand(`.send money ${character.name} "Agradecimiento" "gracias por tu apoyo esto ayuda al servidor" ${copperAmount}`);
            break;
          case 'profession':
            const skillId = Number(item.item_id);
            const skillLevel = Number(item.service_data) || 450;
            if (skillId > 0) {
              await executeSoapCommand(`.setskill ${character.name} ${skillId} ${skillLevel} ${skillLevel}`);
            }
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

    // Log completo para depuración
    console.error('Shop purchase error:', error);
    return NextResponse.json(
      {
        error: 'Error en el servidor',
        details: error.message,
        code: error.code,
        stack: error.stack,
        soapCommand: error.soapCommand,
        soapRequest: error.soapRequest,
        soapResponse: error.soapResponse,
        httpStatus: error.httpStatus,
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}