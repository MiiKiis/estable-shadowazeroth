import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { authPool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';

type AdminPurchaseRow = RowDataPacket & {
  id: number;
  account_id: number;
  account_username: string | null;
  item_id: number;
  item_name: string;
  currency: 'vp' | 'dp';
  price: number;
  character_guid: number | null;
  character_name: string;
  is_gift: number;
  created_at: string;
};

async function ensurePurchaseTableAndIndexes() {
  await authPool.query(`
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

  // Best-effort indexes for admin history queries.
  try { await authPool.query('ALTER TABLE shop_purchases ADD KEY idx_created_at (created_at)'); } catch {}
  try { await authPool.query('ALTER TABLE shop_purchases ADD KEY idx_character_name (character_name)'); } catch {}
  try { await authPool.query('ALTER TABLE shop_purchases ADD KEY idx_currency_gift (currency, is_gift)'); } catch {}
}

function parseBoolFilter(value: string | null): number | null {
  if (value === '1' || value === 'true') return 1;
  if (value === '0' || value === 'false') return 0;
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    await ensurePurchaseTableAndIndexes();

    const pageParam = Number(searchParams.get('page') || 1);
    const limitParam = Number(searchParams.get('limit') || 25);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 25;
    const offset = (page - 1) * limit;

    const accountId = Number(searchParams.get('accountId') || 0);
    const accountName = String(searchParams.get('accountName') || '').trim();
    const characterName = String(searchParams.get('characterName') || '').trim();
    const currency = String(searchParams.get('currency') || '').toLowerCase().trim();
    const giftFilter = parseBoolFilter(searchParams.get('isGift'));
    const dateFrom = String(searchParams.get('dateFrom') || '').trim();
    const dateTo = String(searchParams.get('dateTo') || '').trim();

    const where: string[] = [];
    const params: Array<number | string> = [];

    if (Number.isInteger(accountId) && accountId > 0) {
      where.push('p.account_id = ?');
      params.push(accountId);
    }

    if (accountName) {
      where.push('a.username LIKE ?');
      params.push(`%${accountName}%`);
    }

    if (characterName) {
      where.push('p.character_name LIKE ?');
      params.push(`%${characterName}%`);
    }

    if (currency === 'vp' || currency === 'dp') {
      where.push('p.currency = ?');
      params.push(currency);
    }

    if (giftFilter !== null) {
      where.push('p.is_gift = ?');
      params.push(giftFilter);
    }

    if (dateFrom) {
      where.push('p.created_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      where.push('p.created_at <= ?');
      params.push(`${dateTo} 23:59:59`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await authPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM shop_purchases p
       LEFT JOIN account a ON a.id = p.account_id
       ${whereSql}`,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await authPool.query<AdminPurchaseRow[]>(
      `SELECT
         p.id,
         p.account_id,
         a.username AS account_username,
         p.item_id,
         p.item_name,
         p.currency,
         p.price,
         p.character_guid,
         p.character_name,
         p.is_gift,
         p.created_at
       FROM shop_purchases p
       LEFT JOIN account a ON a.id = p.account_id
       ${whereSql}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json(
      {
        purchases: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin purchases GET error:', message);
    return NextResponse.json(
      { error: 'No se pudo cargar el historial global de compras', details: message },
      { status: 500 }
    );
  }
}
