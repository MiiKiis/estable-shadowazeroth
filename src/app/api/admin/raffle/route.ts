import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';
import { ensureRaffleTables } from '@/lib/raffle';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface AdminRaffleRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  prize_text: string;
  prize_item_id: number | null;
  status: string;
  starts_at: string;
  ends_at: string;
  winner_account_id: number | null;
  winner_note: string | null;
  drawn_at: string | null;
  created_by: number;
  created_at: string;
  total_tickets: number;
}

export async function GET(request: Request) {
  const connection = await authPool.getConnection();
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    await ensureRaffleTables(connection);

    const [rows] = await connection.query<AdminRaffleRow[]>(
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
         r.created_by,
         r.created_at,
         COALESCE(SUM(rt.ticket_count), 0) AS total_tickets
       FROM raffles r
       LEFT JOIN raffle_ticket_totals rt ON rt.raffle_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );

    return NextResponse.json({ raffles: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Admin Raffle GET] Error:', message);
    return NextResponse.json({ error: 'No se pudo cargar sorteos de admin', details: message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(request: Request) {
  const connection = await authPool.getConnection();
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    await ensureRaffleTables(connection);

    const title = String(body?.title || '').trim();
    const prizeText = String(body?.prizeText || '').trim();
    const prizeItemIdRaw = Number(body?.prizeItemId || 0);
    const description = body?.description ? String(body.description).trim() : '';
    const startsAt = String(body?.startsAt || '').trim();
    const endsAt = String(body?.endsAt || '').trim();
    const status = String(body?.status || 'draft').trim().toLowerCase();

    if (!title || !prizeText || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'title, prizeText, startsAt y endsAt son requeridos.' }, { status: 400 });
    }

    const validStatuses = new Set(['draft', 'active', 'closed']);
    if (!validStatuses.has(status)) {
      return NextResponse.json({ error: 'Estado inválido. Usa draft, active o closed.' }, { status: 400 });
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);
    const prizeItemId = Number.isInteger(prizeItemIdRaw) && prizeItemIdRaw > 0 ? prizeItemIdRaw : null;

    if (!Number.isFinite(startsAtDate.getTime()) || !Number.isFinite(endsAtDate.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas.' }, { status: 400 });
    }
    if (endsAtDate.getTime() <= startsAtDate.getTime()) {
      return NextResponse.json({ error: 'La fecha de cierre debe ser mayor a la de inicio.' }, { status: 400 });
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO raffles (title, description, prize_text, prize_item_id, status, starts_at, ends_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, prizeText, prizeItemId, status, startsAtDate, endsAtDate, userId]
    );

    return NextResponse.json({ success: true, raffleId: result.insertId, message: 'Sorteo creado.' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Admin Raffle POST] Error:', message);
    return NextResponse.json({ error: 'No se pudo crear el sorteo', details: message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PUT(request: Request) {
  const connection = await authPool.getConnection();
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const raffleId = Number(body?.raffleId || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    await ensureRaffleTables(connection);

    if (!Number.isInteger(raffleId) || raffleId <= 0) {
      return NextResponse.json({ error: 'raffleId inválido' }, { status: 400 });
    }

    const status = body?.status ? String(body.status).toLowerCase().trim() : null;
    const title = body?.title ? String(body.title).trim() : null;
    const description = body?.description !== undefined ? String(body.description || '').trim() : null;
    const prizeText = body?.prizeText ? String(body.prizeText).trim() : null;
    const prizeItemId = body?.prizeItemId !== undefined ? Number(body.prizeItemId || 0) : null;
    const startsAt = body?.startsAt ? String(body.startsAt).trim() : null;
    const endsAt = body?.endsAt ? String(body.endsAt).trim() : null;

    const sets: string[] = [];
    const values: Array<string | Date | number | null> = [];

    if (title !== null) {
      sets.push('title = ?');
      values.push(title);
    }
    if (description !== null) {
      sets.push('description = ?');
      values.push(description || null);
    }
    if (prizeText !== null) {
      sets.push('prize_text = ?');
      values.push(prizeText);
    }
    if (prizeItemId !== null) {
      sets.push('prize_item_id = ?');
      values.push(Number.isInteger(prizeItemId) && prizeItemId > 0 ? prizeItemId : null);
    }
    if (startsAt !== null) {
      const startsDate = new Date(startsAt);
      if (!Number.isFinite(startsDate.getTime())) {
        return NextResponse.json({ error: 'startsAt inválida' }, { status: 400 });
      }
      sets.push('starts_at = ?');
      values.push(startsDate);
    }
    if (endsAt !== null) {
      const endsDate = new Date(endsAt);
      if (!Number.isFinite(endsDate.getTime())) {
        return NextResponse.json({ error: 'endsAt inválida' }, { status: 400 });
      }
      sets.push('ends_at = ?');
      values.push(endsDate);
    }
    if (status !== null) {
      const validStatuses = new Set(['draft', 'active', 'closed']);
      if (!validStatuses.has(status)) {
        return NextResponse.json({ error: 'Estado inválido. Usa draft, active o closed.' }, { status: 400 });
      }
      sets.push('status = ?');
      values.push(status);
      if (status !== 'drawn') {
        sets.push('winner_account_id = NULL', 'winner_note = NULL', 'drawn_at = NULL');
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 });
    }

    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE raffles
       SET ${sets.join(', ')}
       WHERE id = ?
       LIMIT 1`,
      [...values, raffleId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Sorteo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Sorteo actualizado.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Admin Raffle PUT] Error:', message);
    return NextResponse.json({ error: 'No se pudo actualizar el sorteo', details: message }, { status: 500 });
  } finally {
    connection.release();
  }
}
