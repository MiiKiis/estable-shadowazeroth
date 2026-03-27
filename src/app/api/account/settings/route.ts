import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

/**
 * GET /api/account/settings?accountId=X
 * Returns user settings: accept_gifts, etc.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = Number(searchParams.get('accountId') || 0);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    // Auto-add column if it doesn't exist yet
    try {
      await authPool.query(
        'ALTER TABLE account ADD COLUMN accept_gifts TINYINT(1) UNSIGNED NOT NULL DEFAULT 1'
      );
    } catch { /* already exists */ }

    const [rows]: any = await authPool.query(
      'SELECT accept_gifts FROM account WHERE id = ? LIMIT 1',
      [accountId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      accept_gifts: Number(rows[0].accept_gifts ?? 1) === 1,
    });
  } catch (error: any) {
    console.error('Account settings GET error:', error);
    return NextResponse.json(
      { error: 'Error al cargar configuración', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/account/settings
 * Body: { accountId: number, accept_gifts: boolean }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const accountId = Number(body?.accountId || 0);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    // Auto-add column if it doesn't exist yet
    try {
      await authPool.query(
        'ALTER TABLE account ADD COLUMN accept_gifts TINYINT(1) UNSIGNED NOT NULL DEFAULT 1'
      );
    } catch { /* already exists */ }

    // Validate and update accept_gifts
    if (typeof body.accept_gifts === 'boolean' || typeof body.accept_gifts === 'number') {
      const value = body.accept_gifts ? 1 : 0;
      const [result]: any = await authPool.query(
        'UPDATE account SET accept_gifts = ? WHERE id = ? LIMIT 1',
        [value, accountId]
      );

      if (!result?.affectedRows) {
        return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        accept_gifts: value === 1,
        message: value === 1
          ? 'Recepción de regalos activada'
          : 'Modo Streamer activado: ya no recibirás regalos',
      });
    }

    return NextResponse.json({ error: 'Configuración no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Account settings PUT error:', error);
    return NextResponse.json(
      { error: 'Error al guardar configuración', details: error.message },
      { status: 500 }
    );
  }
}
