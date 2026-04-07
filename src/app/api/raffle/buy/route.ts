import { NextResponse } from 'next/server';
import pool, { authPool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  ensureRaffleTables,
  getTicketUnitCost,
  isValidRaffleCurrency,
  RAFFLE_MAX_TICKETS_PER_ACCOUNT,
  RAFFLE_TICKET_COST_GOLD,
  RAFFLE_TICKET_COST_GOLD_COPPER,
  type RaffleCurrency,
} from '@/lib/raffle';

interface RaffleRow extends RowDataPacket {
  id: number;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  ends_at: string;
}

interface TicketTotalRow extends RowDataPacket {
  ticket_count: number;
}

interface CharacterRow extends RowDataPacket {
  guid: number;
  account: number;
  money: number;
}

export async function POST(request: Request) {
  const body = await request.json();

  const raffleId = Number(body?.raffleId || 0);
  const accountId = Number(body?.accountId || 0);
  const quantity = Number(body?.quantity || 0);
  const currency = String(body?.currency || '').toLowerCase();
  const characterGuid = body?.characterGuid ? Number(body.characterGuid) : 0;

  if (!Number.isInteger(raffleId) || raffleId <= 0) {
    return NextResponse.json({ error: 'raffleId inválido' }, { status: 400 });
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'accountId inválido' }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'Cantidad de tickets inválida' }, { status: 400 });
  }
  if (!isValidRaffleCurrency(currency)) {
    return NextResponse.json({ error: 'Moneda no válida. Usa dp, vp o gold.' }, { status: 400 });
  }
  if (!Number.isInteger(characterGuid) || characterGuid <= 0) {
    return NextResponse.json({ error: 'Debes elegir el personaje que recibirá el premio del sorteo.' }, { status: 400 });
  }

  const authConnection = await authPool.getConnection();
  let deductedGold = 0;
  let deductedFromCharacterGuid = 0;

  try {
    await ensureRaffleTables(authConnection);
    await authConnection.beginTransaction();

    const [raffleRows] = await authConnection.query<RaffleRow[]>(
      `SELECT id, status, ends_at
       FROM raffles
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [raffleId]
    );

    if (raffleRows.length === 0) {
      await authConnection.rollback();
      return NextResponse.json({ error: 'Sorteo no encontrado' }, { status: 404 });
    }

    const raffle = raffleRows[0];
    if (raffle.status !== 'active') {
      await authConnection.rollback();
      return NextResponse.json({ error: 'El sorteo no está activo' }, { status: 400 });
    }

    const now = Date.now();
    const endAt = new Date(raffle.ends_at).getTime();
    if (!Number.isFinite(endAt) || now >= endAt) {
      await authConnection.rollback();
      return NextResponse.json({ error: 'Este sorteo ya cerró' }, { status: 400 });
    }

    const [currentRows] = await authConnection.query<TicketTotalRow[]>(
      `SELECT ticket_count
       FROM raffle_ticket_totals
       WHERE raffle_id = ? AND account_id = ?
       LIMIT 1
       FOR UPDATE`,
      [raffleId, accountId]
    );

    const currentTickets = Number(currentRows[0]?.ticket_count || 0);
    const remaining = RAFFLE_MAX_TICKETS_PER_ACCOUNT - currentTickets;

    if (remaining <= 0) {
      await authConnection.rollback();
      return NextResponse.json({ error: `Ya alcanzaste el límite de ${RAFFLE_MAX_TICKETS_PER_ACCOUNT} tickets.` }, { status: 400 });
    }
    if (quantity > remaining) {
      await authConnection.rollback();
      return NextResponse.json({ error: `Solo puedes comprar ${remaining} ticket(s) más en este sorteo.` }, { status: 400 });
    }

    const unitCost = getTicketUnitCost(currency as RaffleCurrency);
    const totalCost = unitCost * quantity;

    const [charRows] = await pool.query<CharacterRow[]>(
      `SELECT guid, account, money
       FROM characters
       WHERE guid = ? AND account = ?
       LIMIT 1`,
      [characterGuid, accountId]
    );

    if (charRows.length === 0) {
      await authConnection.rollback();
      return NextResponse.json({ error: 'Personaje no encontrado o no pertenece a tu cuenta.' }, { status: 404 });
    }

    if (currency === 'dp' || currency === 'vp') {
      const [deductResult] = await authConnection.query<ResultSetHeader>(
        `UPDATE account
         SET ${currency} = ${currency} - ?
         WHERE id = ? AND ${currency} >= ?`,
        [totalCost, accountId, totalCost]
      );

      if (!deductResult.affectedRows) {
        await authConnection.rollback();
        return NextResponse.json({ error: `Saldo insuficiente en ${currency.toUpperCase()}` }, { status: 400 });
      }
    } else {
      const [goldDeductResult] = await pool.query<ResultSetHeader>(
        `UPDATE characters
         SET money = money - ?
         WHERE guid = ? AND account = ? AND money >= ?`,
        [totalCost, characterGuid, accountId, totalCost]
      );

      if (!goldDeductResult.affectedRows) {
        await authConnection.rollback();
        return NextResponse.json({ error: `Oro insuficiente. Cada ticket cuesta ${RAFFLE_TICKET_COST_GOLD} de oro.` }, { status: 400 });
      }

      deductedGold = totalCost;
      deductedFromCharacterGuid = characterGuid;
    }

    await authConnection.query(
      `INSERT INTO raffle_ticket_totals (raffle_id, account_id, ticket_count, reward_character_guid, spent_dp, spent_vp, spent_gold)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ticket_count = ticket_count + VALUES(ticket_count),
         reward_character_guid = VALUES(reward_character_guid),
         spent_dp = spent_dp + VALUES(spent_dp),
         spent_vp = spent_vp + VALUES(spent_vp),
         spent_gold = spent_gold + VALUES(spent_gold)`,
      [
        raffleId,
        accountId,
        quantity,
        characterGuid,
        currency === 'dp' ? totalCost : 0,
        currency === 'vp' ? totalCost : 0,
        currency === 'gold' ? totalCost : 0,
      ]
    );

    await authConnection.query(
      `INSERT INTO raffle_ticket_purchases (raffle_id, account_id, character_guid, currency, quantity, total_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [raffleId, accountId, characterGuid || null, currency, quantity, totalCost]
    );

    await authConnection.commit();

    return NextResponse.json({
      success: true,
      message: `Compraste ${quantity} ticket(s) con ${currency === 'gold' ? 'oro' : currency.toUpperCase()}.`,
      spent: {
        currency,
        amount: currency === 'gold' ? Math.floor(totalCost / 10000) : totalCost,
      },
      purchased: quantity,
      maxPerAccount: RAFFLE_MAX_TICKETS_PER_ACCOUNT,
    });
  } catch (error: unknown) {
    try {
      await authConnection.rollback();
    } catch {
      // Ignore rollback error
    }

    // Compensate gold if auth transaction failed after gold deduction
    if (deductedGold > 0 && deductedFromCharacterGuid > 0) {
      try {
        await pool.query(
          `UPDATE characters
           SET money = money + ?
           WHERE guid = ? AND account = ?`,
          [deductedGold, deductedFromCharacterGuid, accountId]
        );
      } catch (refundError) {
        console.error('[Raffle Buy] Failed to refund gold:', refundError);
      }
    }

    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Raffle Buy] Error:', message);
    return NextResponse.json({ error: 'No se pudo comprar tickets', details: message }, { status: 500 });
  } finally {
    authConnection.release();
  }
}
