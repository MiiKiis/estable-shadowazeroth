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

    const buyerId = Number(accountId);
    const conn = await authPool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Bloqueo FOR UPDATE para asegurar que la transacción sea atómica y concurrente
      const [listings]: any = await conn.query(
        'SELECT * FROM marketplace_listings WHERE id = ? FOR UPDATE',
        [listingId]
      );

      if (listings.length === 0) {
        throw new Error('Listado no encontrado.');
      }

      const listing = listings[0];

      if (listing.status !== 'active') {
        throw new Error('Este personaje ya fue vendido o la venta cancelada.');
      }

      if (listing.seller_account === buyerId) {
        throw new Error('No puedes comprar tu propio personaje.');
      }

      const priceDp = listing.price_dp;

      // 2. Comprobar fondos del comprador (For Update para evitar doble gasto)
      const [buyerRows]: any = await conn.query(
        'SELECT dp FROM account WHERE id = ? FOR UPDATE',
        [buyerId]
      );

      if (buyerRows.length === 0 || buyerRows[0].dp < priceDp) {
        throw new Error('Donation Points (DP) insuficientes.');
      }

      // 3. Debitar al comprador (100%) y Acreditar al vendedor (85%)
      const sellerReceive = Math.round(priceDp * 0.85);
      
      await conn.query('UPDATE account SET dp = dp - ? WHERE id = ?', [priceDp, buyerId]);
      await conn.query('UPDATE account SET dp = dp + ? WHERE id = ?', [sellerReceive, listing.seller_account]);

      // 4. Mover el personaje de la Cuenta Retenida al Comprador (TrinityCore Characters DB)
      // Como esto va a charPool (otra BD), asuminos éxito acá si afecta 1 row
      const [updateChar]: any = await charPool.query(
        'UPDATE characters SET account = ? WHERE guid = ? AND account = 999999',
        [buyerId, listing.char_guid]
      );

      if (updateChar.affectedRows === 0) {
        // En un error extremo, hacemos rollback de los DPs.
        throw new Error('El personaje no fue encontrado en la cuenta de retención o ya fue movido.');
      }

      // 5. Marcar como vendido e insertar historial
      await conn.query(
        'UPDATE marketplace_listings SET status = "sold", sold_at = CURRENT_TIMESTAMP WHERE id = ?',
        [listingId]
      );

      await conn.query(
        'INSERT INTO marketplace_sales (listing_id, seller_id, buyer_id, char_guid, price_dp) VALUES (?, ?, ?, ?, ?)',
        [listingId, listing.seller_account, buyerId, listing.char_guid, priceDp]
      );

      await conn.commit();
      return NextResponse.json({ success: true, message: '¡Compra exitosa! El personaje ahora te pertenece.' });

    } catch (txError: any) {
      await conn.rollback();
      console.error('[Marketplace Buy] Transaction Error:', txError);
      return NextResponse.json({ error: txError.message || 'Error en la transacción de compra' }, { status: 400 });
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('Error fetching market buy:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
