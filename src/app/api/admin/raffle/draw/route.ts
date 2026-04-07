import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';
import { ensureRaffleTables } from '@/lib/raffle';
import type { RowDataPacket } from 'mysql2';

interface RaffleForDrawRow extends RowDataPacket {
  id: number;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  title: string;
}

interface TicketRangeRow extends RowDataPacket {
  account_id: number;
  ticket_count: number;
  reward_character_guid: number | null;
}

export async function POST(request: Request) {
  const connection = await authPool.getConnection();

  try {
    await ensureRaffleTables(connection);

    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const raffleId = Number(body?.raffleId || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    if (!Number.isInteger(raffleId) || raffleId <= 0) {
      return NextResponse.json({ error: 'raffleId inválido' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [raffleRows] = await connection.query<RaffleForDrawRow[]>(
      `SELECT id, status, title
       FROM raffles
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [raffleId]
    );

    if (raffleRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Sorteo no encontrado' }, { status: 404 });
    }

    const raffle = raffleRows[0];
    if (raffle.status === 'drawn') {
      await connection.rollback();
      return NextResponse.json({ error: 'Este sorteo ya fue sorteado.' }, { status: 400 });
    }

    const [entries] = await connection.query<TicketRangeRow[]>(
      `SELECT account_id, ticket_count, reward_character_guid
       FROM raffle_ticket_totals
       WHERE raffle_id = ? AND ticket_count > 0
       ORDER BY account_id ASC`,
      [raffleId]
    );

    if (entries.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'No hay tickets comprados para este sorteo.' }, { status: 400 });
    }

    const totalTickets = entries.reduce((acc, row) => acc + Number(row.ticket_count || 0), 0);
    const winningNumber = Math.floor(Math.random() * totalTickets) + 1;

    let cursor = 0;
    let winnerAccountId = 0;
    let winnerCharacterGuid: number | null = null;

    for (const entry of entries) {
      cursor += Number(entry.ticket_count || 0);
      if (winningNumber <= cursor) {
        winnerAccountId = Number(entry.account_id);
        winnerCharacterGuid = entry.reward_character_guid ? Number(entry.reward_character_guid) : null;
        break;
      }
    }

    if (!winnerAccountId) {
      await connection.rollback();
      return NextResponse.json({ error: 'No se pudo calcular ganador.' }, { status: 500 });
    }

    await connection.query(
      `UPDATE raffles
       SET status = 'drawn', winner_account_id = ?, winner_note = ?, drawn_at = NOW()
       WHERE id = ?
       LIMIT 1`,
      [
        winnerAccountId,
        winnerCharacterGuid
          ? `Ticket ganador #${winningNumber} - personaje ${winnerCharacterGuid}`
          : `Ticket ganador #${winningNumber}`,
        raffleId,
      ]
    );

    await connection.query(
      `INSERT INTO raffle_winners (raffle_id, account_id, character_guid, ticket_number, note)
       VALUES (?, ?, ?, ?, ?)`,
      [raffleId, winnerAccountId, winnerCharacterGuid, winningNumber, `Ganador del sorteo ${raffle.title}`]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      raffleId,
      winnerAccountId,
      winnerCharacterGuid,
      winningTicket: winningNumber,
      totalTickets,
      message: `Ganador seleccionado: cuenta ${winnerAccountId}. Ticket #${winningNumber}`,
    });
  } catch (error: unknown) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors
    }

    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Admin Raffle Draw] Error:', message);
    return NextResponse.json({ error: 'No se pudo sortear ganador', details: message }, { status: 500 });
  } finally {
    connection.release();
  }
}
