import { NextResponse } from 'next/server';
import { authPool, pool as charPool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { listingId, accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!listingId) {
      return NextResponse.json({ error: 'Falta el ID del listado' }, { status: 400 });
    }

    const sellerId = Number(accountId);
    const conn = await authPool.getConnection();

    try {
      await conn.beginTransaction();

      const [listings]: any = await conn.query(
        'SELECT * FROM marketplace_listings WHERE id = ? FOR UPDATE',
        [listingId]
      );

      if (listings.length === 0) {
        throw new Error('Listado no encontrado.');
      }

      const listing = listings[0];

      if (listing.seller_account !== sellerId) {
        throw new Error('No puedes cancelar un listado que no te pertenece.');
      }

      if (listing.status !== 'active') {
        throw new Error('Este personaje ya fue vendido o la venta cancelada.');
      }

      // 1. Mover el personaje de vuelta de la Cuenta Retenida al Vendedor original
      const [updateChar]: any = await charPool.query(
        'UPDATE characters SET account = ? WHERE guid = ? AND account = 999999',
        [sellerId, listing.char_guid]
      );

      if (updateChar.affectedRows === 0) {
        throw new Error('El personaje no fue encontrado en la cuenta de retención o ya fue restaurado.');
      }

      // 2. Marcar listado como cancelado
      await conn.query(
        'UPDATE marketplace_listings SET status = "cancelled" WHERE id = ?',
        [listingId]
      );

      await conn.commit();
      return NextResponse.json({ success: true, message: 'Venta cancelada exitosamente. Tu personaje fue devuelto.' });

    } catch (txError: any) {
      await conn.rollback();
      console.error('[Marketplace Cancel] Transaction Error:', txError);
      return NextResponse.json({ error: txError.message || 'Error cancelando la venta' }, { status: 400 });
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('Error in market cancel:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
