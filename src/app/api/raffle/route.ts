import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import {
  ensureRaffleTables,
  autoFinalizeEndedRaffles,
  RAFFLE_MAX_TICKETS_PER_ACCOUNT,
  RAFFLE_TICKET_COST_DP,
  RAFFLE_TICKET_COST_VP,
  RAFFLE_TICKET_COST_GOLD,
} from '@/lib/raffle';
import { getWowheadItemMeta } from '@/lib/wowhead';
import type { RowDataPacket } from 'mysql2';

interface RaffleListRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  prize_text: string;
  prize_item_id: number | null;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  starts_at: string;
  ends_at: string;
  winner_account_id: number | null;
  winner_note: string | null;
  drawn_at: string | null;
  total_tickets: number;
  my_tickets: number;
  my_reward_character_guid: number | null;
}

export async function GET(request: Request) {
  const connection = await authPool.getConnection();

  try {
    await ensureRaffleTables(connection);
    await autoFinalizeEndedRaffles(connection);

    const { searchParams } = new URL(request.url);
    const accountId = Number(searchParams.get('accountId') || 0);
    const includeAdmin = searchParams.get('includeAdmin') === '1';

    const statusFilter = includeAdmin ? '' : `AND r.status IN ('active', 'drawn')`;

    const [rows] = await connection.query<RaffleListRow[]>(
      `SELECT
         r.id,
         r.title,
         r.description,
         r.prize_text,
         r.prize_item_id,
         r.status,
         r.starts_at,
         r.ends_at,
         r.winner_account_id,
         r.winner_note,
         r.drawn_at,
         COALESCE(SUM(rt.ticket_count), 0) AS total_tickets,
         COALESCE(MAX(CASE WHEN rt.account_id = ? THEN rt.ticket_count ELSE 0 END), 0) AS my_tickets,
         MAX(CASE WHEN rt.account_id = ? THEN rt.reward_character_guid ELSE NULL END) AS my_reward_character_guid
       FROM raffles r
       LEFT JOIN raffle_ticket_totals rt ON rt.raffle_id = r.id
       WHERE 1=1 ${statusFilter}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [
        Number.isInteger(accountId) && accountId > 0 ? accountId : 0,
        Number.isInteger(accountId) && accountId > 0 ? accountId : 0,
      ]
    );

    const raffles = await Promise.all(rows.map(async (r) => {
      const prizeItemId = r.prize_item_id ? Number(r.prize_item_id) : null;
      const wowheadItem = prizeItemId ? await getWowheadItemMeta(prizeItemId) : null;

      return {
      id: r.id,
      title: r.title,
      description: r.description,
      prizeText: r.prize_text,
      prizeItemId,
      prizeItem: wowheadItem,
      status: r.status,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      winnerAccountId: r.winner_account_id,
      winnerNote: r.winner_note,
      drawnAt: r.drawn_at,
      totalTickets: Number(r.total_tickets || 0),
      myTickets: Number(r.my_tickets || 0),
      myRewardCharacterGuid: r.my_reward_character_guid ? Number(r.my_reward_character_guid) : null,
      remainingForMe: Math.max(0, RAFFLE_MAX_TICKETS_PER_ACCOUNT - Number(r.my_tickets || 0)),
      ticketCosts: {
        dp: RAFFLE_TICKET_COST_DP,
        vp: RAFFLE_TICKET_COST_VP,
        gold: RAFFLE_TICKET_COST_GOLD,
      },
      maxTicketsPerAccount: RAFFLE_MAX_TICKETS_PER_ACCOUNT,
      };
    }));

    return NextResponse.json({ raffles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Raffle GET] Error:', message);
    return NextResponse.json({ error: 'No se pudo cargar sorteos', details: message }, { status: 500 });
  } finally {
    connection.release();
  }
}
