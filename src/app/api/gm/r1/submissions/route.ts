import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { pool } from '@/lib/db';
import { getGMLevel } from '@/lib/gmLevel';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

type SubmissionType = 'shop' | 'addon' | 'forum';

interface SubmissionRow extends RowDataPacket {
  id: number;
  submission_type: SubmissionType;
  payload: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: number;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const R1_ALLOWED_USERS = new Set(['soporte1', 'gmsoporte1']);

interface AccountRow extends RowDataPacket {
  username: string;
}

interface CharacterRow extends RowDataPacket {
  guid: number;
}

async function isR1Allowed(userId: number): Promise<boolean> {
  const gmLevel = await getGMLevel(userId);
  if (gmLevel >= 1) return true;

  const [rows] = await authPool.query<AccountRow[]>(
    'SELECT username FROM account WHERE id = ? LIMIT 1',
    [userId]
  );
  const username = String(rows?.[0]?.username || '').toLowerCase();
  return R1_ALLOWED_USERS.has(username);
}

async function ensureTable() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS gm_r1_submissions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      submission_type ENUM('shop','addon','forum') NOT NULL,
      payload LONGTEXT NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_by INT UNSIGNED NOT NULL,
      reviewed_by INT UNSIGNED NULL,
      review_note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_r1_status_created (status, created_at),
      KEY idx_r1_author_created (created_by, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function isValidType(value: unknown): value is SubmissionType {
  return value === 'shop' || value === 'addon' || value === 'forum';
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalido' }, { status: 400 });
    }

    const allowed = await isR1Allowed(userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Acceso denegado para este panel' }, { status: 403 });
    }

    const [rows] = await authPool.query<SubmissionRow[]>(
      `SELECT id, submission_type, payload, status, created_by, review_note, created_at, reviewed_at
       FROM gm_r1_submissions
       WHERE created_by = ?
       ORDER BY id DESC`,
      [userId]
    );

    const submissions = rows.map((r) => {
      let payload: any = {};
      try { payload = JSON.parse(r.payload || '{}'); } catch {}
      return { ...r, payload };
    });

    return NextResponse.json({ submissions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'No se pudieron cargar solicitudes', details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const type = body?.type;
    const payload = body?.payload || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalido' }, { status: 400 });
    }

    const allowed = await isR1Allowed(userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Solo GM rango 1+ puede enviar solicitudes' }, { status: 403 });
    }

    if (!isValidType(type)) {
      return NextResponse.json({ error: 'Tipo de solicitud invalido' }, { status: 400 });
    }

    if (type === 'forum') {
      const characterName = String(payload?.characterName || '').trim();
      if (!characterName) {
        return NextResponse.json({ error: 'Debes seleccionar un personaje para publicar en foro' }, { status: 400 });
      }

      const [characterRows] = await pool.query<CharacterRow[]>(
        'SELECT guid FROM characters WHERE account = ? AND name = ? LIMIT 1',
        [userId, characterName]
      );

      if (!characterRows.length) {
        return NextResponse.json({ error: 'El personaje seleccionado no pertenece a tu cuenta' }, { status: 403 });
      }
    }

    const payloadText = JSON.stringify(payload || {});

    const [result] = await authPool.query<ResultSetHeader>(
      `INSERT INTO gm_r1_submissions (submission_type, payload, status, created_by)
       VALUES (?, ?, 'pending', ?)`,
      [type, payloadText, userId]
    );

    return NextResponse.json({ success: true, id: result.insertId, message: 'Solicitud enviada para revision' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'No se pudo enviar la solicitud', details: message }, { status: 500 });
  }
}
