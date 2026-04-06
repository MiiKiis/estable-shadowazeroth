import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { getAccountAccessSchema, getGMLevel } from '@/lib/gmLevel';

// Reutiliza la misma promise de migración del route padre para no duplicar checks
async function isGM(userId: number): Promise<boolean> {
  const lvl = await getGMLevel(userId);
  return lvl >= 3;
}

async function isStaff(userId: number): Promise<boolean> {
  const lvl = await getGMLevel(userId);
  return lvl >= 1;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id || id <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Increment view count (fire-and-forget — no espera para no bloquear la respuesta)
    authPool.query('UPDATE forum_topics SET views = views + 1 WHERE id = ?', [id]).catch(() => {});

    const schema = await getAccountAccessSchema();

    const [rows]: any = await authPool.query(
      `SELECT
         t.id, t.title, t.category, t.pinned, t.locked,
         COALESCE(t.completed, 0) AS completed,
         t.views, t.created_at,
         t.author_id, COALESCE(a.username, '[Deleted]') AS author_username,
         MAX(aa.\`${schema.gmCol}\`) AS gmlevel
       FROM forum_topics t
       LEFT JOIN account a ON t.author_id = a.id
       LEFT JOIN account_access aa ON a.id = aa.\`${schema.idCol}\`
       WHERE t.id = ?
       GROUP BY t.id, t.author_id, a.username`,
      [id]
    );

    if (!rows.length) return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });

    const t = rows[0];
    return NextResponse.json({
      topic: {
        id: t.id,
        title: t.title,
        category: t.category,
        pinned: !!t.pinned,
        locked: !!t.locked,
        completed: !!t.completed,
        views: t.views,
        created_at: t.created_at,
        author: {
          id: t.author_id,
          username: t.author_username,
        },
      },
    }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/forum/topics/[id] error:', e);
    return NextResponse.json({ error: 'Error cargando tema', details: e.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const topicId = Number(rawId);
    if (!topicId || topicId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const userId    = Number(body?.userId || 0);
    const completed = Boolean(body?.completed);

    if (!userId || userId <= 0) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const staff = await isStaff(userId);
    if (!staff) return NextResponse.json({ error: 'No tienes permisos para marcar tema' }, { status: 403 });

    const [topicRows]: any = await authPool.query('SELECT id FROM forum_topics WHERE id = ? LIMIT 1', [topicId]);
    if (!topicRows.length) return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });

    await authPool.query(
      'UPDATE forum_topics SET completed = ?, updated_at = NOW() WHERE id = ? LIMIT 1',
      [completed ? 1 : 0, topicId]
    );

    return NextResponse.json({ success: true, completed }, { status: 200 });
  } catch (e: any) {
    console.error('PATCH /api/forum/topics/[id] error:', e);
    return NextResponse.json({ error: 'Error actualizando estado del tema', details: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const conn = await authPool.getConnection();
  try {
    const { id: rawId } = await params;
    const topicId = Number(rawId);
    if (!topicId || topicId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);
    if (!userId || userId <= 0) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const gm = await isGM(userId);
    if (!gm) return NextResponse.json({ error: 'No tienes permisos para borrar temas' }, { status: 403 });

    const [topicRows]: any = await conn.query('SELECT id FROM forum_topics WHERE id = ? LIMIT 1', [topicId]);
    if (!topicRows.length) return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });

    await conn.beginTransaction();
    await conn.query('DELETE FROM forum_comments WHERE topic_id = ?', [topicId]);
    await conn.query('DELETE FROM forum_topics WHERE id = ? LIMIT 1', [topicId]);
    await conn.commit();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    await conn.rollback();
    console.error('DELETE /api/forum/topics/[id] error:', e);
    return NextResponse.json({ error: 'Error eliminando tema', details: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
