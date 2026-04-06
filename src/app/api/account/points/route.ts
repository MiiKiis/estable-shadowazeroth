import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { authPool } from '@/lib/db';

interface AccountRow extends RowDataPacket {
  id: number;
  vp: number;
  dp: number;
  username?: string;
}

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
}

interface AccessRow extends RowDataPacket {
  lv: number;
}

// ── Lista de superadmins garantizados (sin depender de blizzcms) ───────────────
const SUPERADMIN_ACCOUNTS = ['miikiis'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = Number(searchParams.get('accountId'));

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId invalido' }, { status: 400 });
    }

    if (!authPool) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // 1. Obtener DP y VP de la cuenta ──────────────────────────────────────────
    let rows: AccountRow[];
    try {
      const [result] = await authPool.query<AccountRow[]>(
        'SELECT id, vp, dp, username FROM account WHERE id = ? LIMIT 1',
        [accountId]
      );
      rows = result;
    } catch (dbError: unknown) {
      const errorObj = dbError as { message: string; code?: string };
      return NextResponse.json({ 
        error: 'Error en consulta account', 
        details: errorObj.message, 
        code: errorObj.code 
      }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const row = rows[0];
    const dp = Number(row.dp || 0);
    const vp = Number(row.vp || 0);

    // 2. Obtener nivel de GM desde account_access ─────────────────────────────
    let gmlevel = 0;
    try {
      // Detectar columna disponible dinámicamente
      const [cols] = await authPool.query<ColumnRow[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'account_access'
           AND COLUMN_NAME IN ('SecurityLevel', 'gmlevel', 'security', 'level')
         LIMIT 1`
      );
      const colName = cols?.[0]?.COLUMN_NAME;
      if (colName) {
        const [r] = await authPool.query<AccessRow[]>(
          `SELECT MAX(\`${colName}\`) AS lv FROM account_access WHERE id = ?`,
          [accountId]
        );
        gmlevel = Number(r?.[0]?.lv || 0);
      }
    } catch { /* sin acceso GM si falla */ }

    // 3. Bypass superadmin por username ────────────────────────────────────────
    const username = (row.username || '').toLowerCase();
    if (SUPERADMIN_ACCOUNTS.includes(username)) {
      gmlevel = 4; // Superadmin total
    }

    const role = gmlevel > 0 ? 'GM' : 'ADALID';

    return NextResponse.json({
      accountId,
      dp,
      vp,
      gmlevel,
      role,
      credits: dp,
    });
  } catch (error: unknown) {
    const errorObj = error as { message: string; code?: string };
    console.error('Account points API error:', errorObj);
    return NextResponse.json({ 
      error: 'Error del servidor', 
      details: errorObj.message, 
      code: errorObj.code 
    }, { status: 500 });
  }
}
