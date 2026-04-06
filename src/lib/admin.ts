import { RowDataPacket } from 'mysql2';
import { authPool } from './db';

const SUPERADMIN_ACCOUNTS = ['miikiis'];

export type AdminCheckResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

interface AccountRow extends RowDataPacket {
  username: string;
}

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
}

interface AccessRow extends RowDataPacket {
  lv: number;
}

/**
 * Verifica si un userId tiene permisos de administrador.
 * Prioridad:
 *   1. Superadmin hardcodeado (username en SUPERADMIN_ACCOUNTS)
 *   2. gmlevel >= 3 en account_access (AzerothCore)
 */
export async function assertAdmin(userId: number): Promise<AdminCheckResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: 'userId invalido', status: 400 };
  }

  if (!authPool) {
    return { ok: false, error: 'Conexión a base de datos no disponible', status: 500 };
  }

  try {
    // 1. Verificar si es superadmin por username ─────────────────
    const [accRows] = await authPool.query<AccountRow[]>(
      'SELECT username FROM account WHERE id = ? LIMIT 1',
      [userId]
    );
    const username = (accRows?.[0]?.username || '').toLowerCase();
    if (SUPERADMIN_ACCOUNTS.includes(username)) {
      return { ok: true };
    }

    // 2. Fallback: nivel >= 3 en account_access (AzerothCore) ──
    let gmlevel = 0;
    try {
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
          [userId]
        );
        gmlevel = Number(r?.[0]?.lv ?? 0);
      }
    } catch { /* sin acceso GM si falla */ }

    if (gmlevel < 3) {
      return { ok: false, error: 'Acceso denegado: requiere rol de administrador', status: 403 };
    }

    return { ok: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('assertAdmin error:', errorMsg);
    return { ok: false, error: 'No se pudo validar permisos de administrador', status: 500 };
  }
}
