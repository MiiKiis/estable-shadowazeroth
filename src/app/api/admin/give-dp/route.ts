import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { userId, targetUsername, amount } = await request.json();

    // En un escenario real, aquí podrías comprobar que `userId` es realmente un admin
    if (!targetUsername || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Faltan parámetros o la cantidad es inválida' }, { status: 400 });
    }

    const cleanUsername = String(targetUsername).trim().toUpperCase();
    const dpAmount = Number(amount);

    // Buscar si la cuenta existe
    const [rows]: any = await authPool.query(
      'SELECT id, username FROM account WHERE UPPER(username) = ?',
      [cleanUsername]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'La cuenta no existe' }, { status: 404 });
    }

    // Actualizar DP
    await authPool.query(
      'UPDATE account SET dp = dp + ? WHERE UPPER(username) = ?',
      [dpAmount, cleanUsername]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Se añadieron ${dpAmount} DP correctamente a la cuenta ${rows[0].username}` 
    });

  } catch (error: any) {
    console.error('Error in give-dp API:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
