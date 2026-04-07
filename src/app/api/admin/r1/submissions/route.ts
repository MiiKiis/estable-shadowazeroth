import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { authPool, pool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

type SubmissionType = 'shop' | 'addon' | 'forum';

interface SubmissionRow extends RowDataPacket {
  id: number;
  submission_type: SubmissionType;
  payload: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: number;
  reviewed_by: number | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const ADDONS_PATH = path.join(process.cwd(), 'data', 'addons.json');

async function ensureSubmissionTable() {
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

async function readAddons(): Promise<Array<{ name: string; url: string }>> {
  try {
    const raw = await fs.readFile(ADDONS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAddons(addons: Array<{ name: string; url: string }>) {
  await fs.mkdir(path.dirname(ADDONS_PATH), { recursive: true });
  await fs.writeFile(ADDONS_PATH, JSON.stringify(addons, null, 2), 'utf-8');
}

async function ensureShopColumns() {
  const columnsToFix = [
    { name: 'description', type: 'TEXT NULL DEFAULT NULL' },
    { name: 'price_dp', type: 'INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'price_vp', type: 'INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'quality', type: 'VARCHAR(20) NOT NULL DEFAULT \'comun\'' },
    { name: 'category', type: 'VARCHAR(50) NOT NULL DEFAULT \'misc\'' },
    { name: 'tier', type: 'INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'class_mask', type: 'INT UNSIGNED NOT NULL DEFAULT 0' },
    { name: 'soap_item_entry', type: 'INT UNSIGNED NULL DEFAULT NULL' },
    { name: 'soap_item_count', type: 'INT UNSIGNED NOT NULL DEFAULT 1' },
    { name: 'service_type', type: 'VARCHAR(50) NOT NULL DEFAULT \'none\'' },
    { name: 'service_data', type: 'TEXT NULL DEFAULT NULL' },
    { name: 'faction', type: 'VARCHAR(10) NOT NULL DEFAULT \'all\'' },
    { name: 'item_level', type: 'INT UNSIGNED NOT NULL DEFAULT 0' },
  ];

  for (const col of columnsToFix) {
    try { await authPool.query(`ALTER TABLE shop_items ADD COLUMN ${col.name} ${col.type}`); } catch {}
  }
}

async function publishShopSubmission(payload: any) {
  await ensureShopColumns();

  const name = String(payload?.name || '').trim();
  const category = String(payload?.category || 'misc').toLowerCase().trim() || 'misc';
  const image = String(payload?.image || 'inv_misc_questionmark').trim() || 'inv_misc_questionmark';
  const description = payload?.description ? String(payload.description) : null;

  const priceDp = Math.max(0, Math.round(Number(payload?.priceDp || 0)));
  const priceVp = Math.max(0, Math.round(Number(payload?.priceVp || 0)));
  const quality = String(payload?.quality || 'comun').toLowerCase();

  const bundleItems = Array.isArray(payload?.bundleItems)
    ? payload.bundleItems
        .map((x: any) => ({
          id: Math.max(0, Number(x?.id || 0)),
          count: Math.max(1, Number(x?.count || 1)),
        }))
        .filter((x: any) => x.id > 0)
    : [];

  const baseItemId = Math.max(0, Number(payload?.itemId || bundleItems?.[0]?.id || 0));
  const soapCount = Math.max(1, Math.min(255, Number(payload?.soapCount || bundleItems?.[0]?.count || 1)));

  if (!name) throw new Error('Nombre obligatorio en solicitud de tienda');
  if (priceDp <= 0 && priceVp <= 0) throw new Error('Debes asignar precio DP o VP');

  const legacyPrice = priceDp > 0 ? priceDp : priceVp;
  const legacyCurrency = priceDp > 0 ? 'dp' : 'vp';

  const serviceType = bundleItems.length > 0 ? 'bundle' : 'none';
  const serviceData = bundleItems.length > 0
    ? JSON.stringify(bundleItems.map((b: any) => ({ id: b.id, count: b.count })))
    : null;

  await authPool.query(
    `INSERT INTO shop_items
      (name, item_id, price, currency, price_dp, price_vp, image, quality, category, tier, class_mask, soap_item_entry, soap_item_count, service_type, service_data, faction, item_level, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'all', 0, ?)`,
    [
      name,
      baseItemId,
      legacyPrice,
      legacyCurrency,
      priceDp,
      priceVp,
      image,
      quality,
      category,
      baseItemId || null,
      soapCount,
      serviceType,
      serviceData,
      description,
    ]
  );
}

async function publishAddonSubmission(payload: any) {
  const name = String(payload?.name || '').trim();
  const url = String(payload?.url || '').trim();
  if (!name || !url) throw new Error('Addon requiere nombre y URL');

  const addons = await readAddons();
  addons.push({ name, url });
  await writeAddons(addons);
}

async function ensureForumTables() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS forum_topics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'general',
      author_id INT UNSIGNED NOT NULL,
      pinned TINYINT(1) NOT NULL DEFAULT 0,
      locked TINYINT(1) NOT NULL DEFAULT 0,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      views INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await authPool.query(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      topic_id INT NOT NULL,
      author_id INT UNSIGNED NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await authPool.query('ALTER TABLE forum_topics ADD COLUMN author_character VARCHAR(32) NULL DEFAULT NULL AFTER author_id');
  } catch {}
}

async function publishForumSubmission(payload: any, authorId: number) {
  await ensureForumTables();
  const title = String(payload?.title || '').trim();
  const category = String(payload?.category || 'general').trim();
  const comment = String(payload?.comment || '').trim();
  const characterName = String(payload?.characterName || '').trim();
  const pinned = payload?.pinned ? 1 : 0;

  if (!title || title.length < 3) throw new Error('Titulo de foro invalido');
  if (!comment || comment.length < 10) throw new Error('Comentario inicial invalido');
  if (!characterName) throw new Error('Debes seleccionar un personaje para publicar en foro');

  const [characterRows] = await pool.query<RowDataPacket[]>(
    'SELECT guid FROM characters WHERE account = ? AND name = ? LIMIT 1',
    [authorId, characterName]
  );
  if (!characterRows.length) throw new Error('El personaje seleccionado no pertenece a la cuenta del solicitante');

  const [topicResult] = await authPool.query<ResultSetHeader>(
    `INSERT INTO forum_topics (title, category, author_id, author_character, pinned)
     VALUES (?, ?, ?, ?, ?)`,
    [title, category, authorId, characterName, pinned]
  );

  await authPool.query(
    `INSERT INTO forum_comments (topic_id, author_id, comment)
     VALUES (?, ?, ?)`,
    [topicResult.insertId, authorId, comment]
  );
}

export async function GET(request: Request) {
  try {
    await ensureSubmissionTable();
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);
    const status = String(searchParams.get('status') || 'pending');

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const allowedStatus = ['pending', 'approved', 'rejected'];
    const safeStatus = allowedStatus.includes(status) ? status : 'pending';

    const [rows] = await authPool.query<SubmissionRow[]>(
      `SELECT id, submission_type, payload, status, created_by, reviewed_by, review_note, created_at, reviewed_at
       FROM gm_r1_submissions
       WHERE status = ?
       ORDER BY id DESC`,
      [safeStatus]
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
    await ensureSubmissionTable();
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const submissionId = Number(body?.submissionId || 0);
    const action = String(body?.action || '').toLowerCase();
    const note = String(body?.note || '').trim() || null;

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      return NextResponse.json({ error: 'submissionId invalido' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
    }

    const [rows] = await authPool.query<SubmissionRow[]>(
      `SELECT id, submission_type, payload, status, created_by
       FROM gm_r1_submissions
       WHERE id = ?
       LIMIT 1`,
      [submissionId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const row = rows[0];
    if (row.status !== 'pending') {
      return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 });
    }

    let payload: any = {};
    try { payload = JSON.parse(row.payload || '{}'); } catch {}

    if (action === 'approve') {
      if (row.submission_type === 'shop') {
        await publishShopSubmission(payload);
      } else if (row.submission_type === 'addon') {
        await publishAddonSubmission(payload);
      } else if (row.submission_type === 'forum') {
        await publishForumSubmission(payload, Number(row.created_by));
      }
    }

    await authPool.query(
      `UPDATE gm_r1_submissions
       SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW()
       WHERE id = ?
       LIMIT 1`,
      [action === 'approve' ? 'approved' : 'rejected', userId, note, submissionId]
    );

    return NextResponse.json({ success: true, message: action === 'approve' ? 'Publicado correctamente' : 'Solicitud eliminada/rechazada' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'No se pudo procesar solicitud', details: message }, { status: 500 });
  }
}
