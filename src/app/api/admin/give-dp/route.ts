import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    const { targetUsername, amount, currency = 'dp' } = await request.json();

    if (!targetUsername || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Faltan parámetros o la cantidad es inválida' }, { status: 400 });
    }

    if (currency !== 'dp' && currency !== 'vp') {
      return NextResponse.json({ error: 'Moneda inválida. Usa dp o vp.' }, { status: 400 });
    }

    if (!authPool) {
      return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
    }

    const cleanUsername = String(targetUsername).trim().toUpperCase();
    const finalAmount = Number(amount);

    // Buscar si la cuenta existe
    const [rows] = await authPool.query<RowDataPacket[]>(
      'SELECT id, username FROM account WHERE UPPER(username) = ?',
      [cleanUsername]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'La cuenta no existe' }, { status: 404 });
    }

    // Actualizar DP o VP
    if (currency === 'dp') {
      await authPool.query(
        'UPDATE account SET dp = dp + ? WHERE UPPER(username) = ?',
        [finalAmount, cleanUsername]
      );
    } else {
      await authPool.query(
        'UPDATE account SET vp = vp + ? WHERE UPPER(username) = ?',
        [finalAmount, cleanUsername]
      );
    }

    const currencyName = currency === 'dp' ? 'Donation Points' : 'Estelas';

    return NextResponse.json({ 
      success: true, 
      message: `Se añadieron ${finalAmount} ${currencyName} correctamente a la cuenta ${rows[0].username}` 
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error del servidor';
    console.error('Error in give-currency API:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
