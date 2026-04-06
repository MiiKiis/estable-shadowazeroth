import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 20;

    const [listings]: any = await authPool.query(
      'SELECT id, seller_account, char_guid, char_snapshot, price_dp, created_at FROM marketplace_listings WHERE status = "active" ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    // Mapear el json de nuevo a objeto para lectura fácil
    const results = listings.map((l: any) => ({
      id: l.id,
      sellerAccountId: l.seller_account,
      charGuid: l.char_guid,
      char: JSON.parse(l.char_snapshot),
      priceDp: l.price_dp,
      createdAt: l.created_at
    }));

    return NextResponse.json(results);
  } catch (err: any) {
    console.error('Error fetching market listings:', err);
    return NextResponse.json({ error: 'Error del servidor obteniendo el mercado' }, { status: 500 });
  }
}
