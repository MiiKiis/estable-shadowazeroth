import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import crypto from 'crypto';

// Tasa de cambio: 1 DP = N Estelas
const DP_TO_ESTELAS_RATE = 10;

// Mínimo y máximo por transacción
const MIN_DP = 1;
const MAX_DP_PER_TX = 1000;

function toBinaryBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex');
    }
    return Buffer.from(trimmed, 'binary');
  }
  throw new Error('Formato de datos no soportado');
}

/**
 * POST /api/estelas/exchange
 * Convierte DP en Estelas (VP) para la cuenta del usuario.
 * Las Estelas son Soulbound: NUNCA se pueden regalar ni transferir.
 *
 * Body: { accountId: number, dpAmount: number, pin: string }
 */
export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const accountId = Number(body?.accountId);
    const dpAmount = Number(body?.dpAmount);
    const pin = String(body?.pin || '').trim();

    // ── Validaciones de entrada ──────────────────────────────────
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
    }

    if (!Number.isInteger(dpAmount) || dpAmount < MIN_DP || dpAmount > MAX_DP_PER_TX) {
      return NextResponse.json(
        { error: `El monto de DP debe estar entre ${MIN_DP} y ${MAX_DP_PER_TX}` },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN de seguridad de 4 dígitos requerido para el intercambio' },
        { status: 400 }
      );
    }

    const estelaAmount = dpAmount * DP_TO_ESTELAS_RATE;

    connection = await authPool.getConnection();
    await connection.beginTransaction();

    // ── 1. Verificar PIN de seguridad ────────────────────────────
    const [pinRows]: any = await connection.query(
      'SELECT pin_salt, pin_hash FROM account_security_pin WHERE account_id = ? LIMIT 1',
      [accountId]
    );

    if (!pinRows || pinRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: 'No tienes PIN de seguridad configurado. Ve al Dashboard → Cuenta → Configurar PIN.' },
        { status: 403 }
      );
    }

    const pinSalt = toBinaryBuffer(pinRows[0].pin_salt);
    const storedPinHash = toBinaryBuffer(pinRows[0].pin_hash);
    const providedPinHash = crypto.createHash('sha256').update(pinSalt).update(pin).digest();

    if (!crypto.timingSafeEqual(storedPinHash, providedPinHash)) {
      await connection.rollback();
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    // ── 2. Verificar saldo DP suficiente ─────────────────────────
    const [accountRows]: any = await connection.query(
      'SELECT id, dp, vp FROM account WHERE id = ? LIMIT 1',
      [accountId]
    );

    if (!accountRows || accountRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const account = accountRows[0];
    const currentDp = Number(account.dp || 0);
    const currentVp = Number(account.vp || 0);

    if (currentDp < dpAmount) {
      await connection.rollback();
      return NextResponse.json(
        {
          error: `DP insuficientes. Tienes ${currentDp} DP, necesitas ${dpAmount} DP.`,
          currentDp,
          requiredDp: dpAmount,
        },
        { status: 400 }
      );
    }

    // ── 3. Atomic swap: descontar DP, añadir Estelas ─────────────
    const [updateResult]: any = await connection.query(
      `UPDATE account
       SET dp = dp - ?, vp = vp + ?
       WHERE id = ? AND dp >= ?`,
      [dpAmount, estelaAmount, accountId, dpAmount]
    );

    if (!updateResult?.affectedRows) {
      await connection.rollback();
      return NextResponse.json(
        { error: 'No se pudo completar el intercambio. Intenta de nuevo.' },
        { status: 400 }
      );
    }

    // ── 4. Registrar el intercambio en historial (opcional) ──────
    // Reusa la tabla shop_purchases como registro de auditoría
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS estelas_exchange_log (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          account_id INT UNSIGNED NOT NULL,
          dp_spent INT UNSIGNED NOT NULL,
          estelas_received INT UNSIGNED NOT NULL,
          rate INT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_account (account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await connection.query(
        'INSERT INTO estelas_exchange_log (account_id, dp_spent, estelas_received, rate) VALUES (?, ?, ?, ?)',
        [accountId, dpAmount, estelaAmount, DP_TO_ESTELAS_RATE]
      );
    } catch {
      // Log failure is non-critical; don't rollback main transaction
    }

    await connection.commit();

    const newDp = currentDp - dpAmount;
    const newVp = currentVp + estelaAmount;

    return NextResponse.json({
      success: true,
      message: `Intercambio exitoso: ${dpAmount} DP → ${estelaAmount} Estelas`,
      exchange: {
        dpSpent: dpAmount,
        estelaReceived: estelaAmount,
        rate: `1 DP = ${DP_TO_ESTELAS_RATE} Estelas`,
      },
      balances: {
        dp: newDp,
        vp: newVp,
        estelas: newVp, // alias legible en UI
      },
    });
  } catch (error: any) {
    if (connection) {
      try { await connection.rollback(); } catch { /* ignore */ }
    }
    console.error('Estelas exchange error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}

/**
 * GET /api/estelas/exchange
 * Devuelve la tasa de cambio actual y los límites.
 */
export async function GET() {
  return NextResponse.json({
    rate: {
      dpCost: 1,
      estelaReward: DP_TO_ESTELAS_RATE,
      description: `1 DP = ${DP_TO_ESTELAS_RATE} Estelas`,
    },
    limits: {
      minDp: MIN_DP,
      maxDpPerTransaction: MAX_DP_PER_TX,
    },
    note: 'Las Estelas son Soulbound (Ligadas al alma). No se pueden regalar ni transferir.',
  });
}
