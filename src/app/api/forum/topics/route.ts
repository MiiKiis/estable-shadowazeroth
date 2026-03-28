import { NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authPool } from '@/lib/db';
import { readAvatarMap } from '@/lib/avatarStore';

type GmRow = RowDataPacket & { gmlevel: number | null };
type AccountRow = RowDataPacket & { id: number };
type TopicRow = RowDataPacket & {
  id: number;
  title: string;
  category: string;
  pinned: number;
  locked: number;
  completed: number;
  views: number;
  created_at: string;
  author_username: string;
  author_id: number;
  gmlevel: number | null;
  comment_count: number;
  last_reply_at: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido';
}

let ensureCompletedColumnPromise: Promise<void> | null = null;

async function ensureCompletedColumn(): Promise<void> {
  if (!ensureCompletedColumnPromise) {
    ensureCompletedColumnPromise = (async () => {
      const [rows]: any = await authPool.query(
        `SELECT 1 AS ok
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'forum_topics'
           AND COLUMN_NAME = 'completed'
         LIMIT 1`
      );

      if (!rows?.length) {
        await authPool.query(
          'ALTER TABLE forum_topics ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 0 AFTER locked'
        );
      }
    })().catch(() => {
      // Si falla por permisos/entorno, mantenemos fallback en queries.
    });
  }

  await ensureCompletedColumnPromise;
}

function resolveRole(gmlevel: number | null): string {
  const lvl = Number(gmlevel ?? 0);
  if (lvl >= 3) return 'GM';
  if (lvl >= 1) return 'Moderador';
  return 'Jugador';
}

async function isGM(userId: number): Promise<boolean> {
  const [rows] = await authPool.query<GmRow[]>(
    'SELECT MAX(gmlevel) AS gmlevel FROM account_access WHERE id = ?',
    [userId]
  );
  return Number(rows?.[0]?.gmlevel ?? 0) >= 3;
}

export async function GET(request: Request) {
  try {
    await ensureCompletedColumn();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || null;

    let rows: TopicRow[] = [];
    try {
      const [withCompleted] = await authPool.query<TopicRow[]>(
        `SELECT
           t.id,
           t.title,
           t.category,
           t.pinned,
           t.locked,
           t.completed,
           t.views,
           t.created_at,
           COALESCE(a.username, '[Deleted]') AS author_username,
           t.author_id                       AS author_id,
           MAX(aa.gmlevel)                   AS gmlevel,
           (SELECT COUNT(*) FROM forum_comments fc WHERE fc.topic_id = t.id) AS comment_count,
           (SELECT fc2.created_at FROM forum_comments fc2 WHERE fc2.topic_id = t.id ORDER BY fc2.created_at DESC LIMIT 1) AS last_reply_at
         FROM forum_topics t
         LEFT JOIN account a          ON t.author_id = a.id
         LEFT JOIN account_access aa  ON a.id = aa.id
         ${category ? 'WHERE t.category = ?' : ''}
         GROUP BY t.id, t.title, t.category, t.pinned, t.locked, t.completed, t.views, t.created_at, t.author_id, a.username
         ORDER BY t.pinned DESC, t.updated_at DESC`,
        category ? [category] : []
      );
      rows = withCompleted;
    } catch {
      const [withoutCompleted] = await authPool.query<TopicRow[]>(
      `SELECT
         t.id,
         t.title,
         t.category,
         t.pinned,
         t.locked,
         0 AS completed,
         t.views,
         t.created_at,
         COALESCE(a.username, '[Deleted]') AS author_username,
         t.author_id                       AS author_id,
         MAX(aa.gmlevel)                   AS gmlevel,
         (SELECT COUNT(*) FROM forum_comments fc WHERE fc.topic_id = t.id) AS comment_count,
         (SELECT fc2.created_at FROM forum_comments fc2 WHERE fc2.topic_id = t.id ORDER BY fc2.created_at DESC LIMIT 1) AS last_reply_at
       FROM forum_topics t
       LEFT JOIN account a          ON t.author_id = a.id
       LEFT JOIN account_access aa  ON a.id = aa.id
       ${category ? 'WHERE t.category = ?' : ''}
       GROUP BY t.id, t.title, t.category, t.pinned, t.locked, t.views, t.created_at, t.author_id, a.username
       ORDER BY t.pinned DESC, t.updated_at DESC`,
      category ? [category] : []
    );
      rows = withoutCompleted;
    }

    const avatarMap = await readAvatarMap();

    const topics = rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      pinned: !!r.pinned,
      locked: !!r.locked,
      completed: !!r.completed,
      views: r.views,
      created_at: r.created_at,
      last_reply_at: r.last_reply_at ?? null,
      comment_count: Number(r.comment_count),
      author: {
        id: r.author_id,
        username: r.username ?? r.author_username,
        avatar: avatarMap[String(r.author_id)] ?? null,
        role: resolveRole(r.gmlevel),
      },
    }));

    return NextResponse.json({ topics }, { status: 200 });
  } catch (e: unknown) {
    console.error('GET /api/forum/topics error:', e);
    return NextResponse.json({ error: 'Error cargando temas', details: getErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const title  = String(body?.title || '').trim();
    const category = String(body?.category || 'general');
    const comment  = String(body?.comment || '').trim();
    const pinned   = body?.pinned ? 1 : 0;

    const validCategories = ['general', 'support', 'guides', 'guild', 'reports', 'suggestions', 'announcements'];

    if (!userId || userId <= 0)       return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!title || title.length < 3)   return NextResponse.json({ error: 'El título debe tener al menos 3 caracteres' }, { status: 400 });
    if (title.length > 200)           return NextResponse.json({ error: 'El título no puede exceder 200 caracteres' }, { status: 400 });
    if (!validCategories.includes(category)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    if (!comment || comment.length < 10) return NextResponse.json({ error: 'El mensaje debe tener al menos 10 caracteres' }, { status: 400 });

    const [accountRows] = await authPool.query<AccountRow[]>('SELECT id FROM account WHERE id = ? LIMIT 1', [userId]);
    if (!accountRows.length) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    if (category === 'announcements') {
      const gm = await isGM(userId);
      if (!gm) {
        return NextResponse.json({ error: 'Solo el staff puede publicar anuncios' }, { status: 403 });
      }
    }

    const conn = await authPool.getConnection();
    try {
      await conn.beginTransaction();
      const [topicResult] = await conn.query<ResultSetHeader>(
        'INSERT INTO forum_topics (title, category, author_id, pinned) VALUES (?, ?, ?, ?)',
        [title, category, userId, pinned]
      );
      const topicId = topicResult.insertId;
      await conn.query(
        'INSERT INTO forum_comments (topic_id, author_id, comment) VALUES (?, ?, ?)',
        [topicId, userId, comment]
      );
      await conn.commit();
      return NextResponse.json({ success: true, topicId }, { status: 201 });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (e: unknown) {
    console.error('POST /api/forum/topics error:', e);
    const details = getErrorMessage(e);
    if (details.toLowerCase().includes('incorrect') && details.toLowerCase().includes('category')) {
      return NextResponse.json(
        { error: 'La base de datos del foro necesita migración de categorías', details: 'Ejecuta alter-forum-categories.sql para habilitar las categorías nuevas.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Error creando tema', details }, { status: 500 });
  }
}
