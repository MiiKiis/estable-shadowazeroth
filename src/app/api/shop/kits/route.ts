
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'blizzcms',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_WORLD || 'acore_world',
};

export async function GET(req: NextRequest) {
  try {
    const kitId = req.nextUrl.searchParams.get('kitId');
    if (!kitId) return NextResponse.json({ items: [] }, { status: 200 });

    const conn = await mysql.createConnection(dbConfig);
    const [itemRows] = await conn.execute(
      'SELECT item_id FROM shop_kits_items WHERE kit_id = ?',
      [kitId]
    );
    const itemIds = itemRows.map((row: any) => row.item_id);

    if (!itemIds.length) {
      await conn.end();
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const [items] = await conn.query(
      `SELECT entry, name, icon FROM item_template WHERE entry IN (${itemIds.join(',')})`
    );
    await conn.end();

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ items: [], error: 'Error al consultar el kit' }, { status: 200 });
  }
}
