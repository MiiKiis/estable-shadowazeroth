import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { readAvatarMap } from '@/lib/avatarStore';
import { getAccountAccessSchema, getGMLevel } from '@/lib/gmLevel';

function resolveRole(gmlevel: number | null): string {
  const lvl = Number(gmlevel ?? 0);
  if (lvl >= 3) return 'GM';
  if (lvl >= 1) return 'Moderador';
  return 'Jugador';
}

const ROLE_COLOR: Record<string, string> = {
  GM: 'text-amber-400',
  Moderador: 'text-cyan-400',
  Jugador: 'text-purple-300',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const topicId = Number(rawId);
    if (!topicId || topicId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const requestingUserId = Number(searchParams.get('userId') || 0);

    const schema = await getAccountAccessSchema();

    // Paralelizar: query de comentarios + avatares + check de GM al mismo tiempo
    const gmCheckPromise = requestingUserId > 0
      ? getGMLevel(requestingUserId).then(lvl => [[{ gmlevel: lvl }]])
      : Promise.resolve([[{ gmlevel: 0 }]]);

    const [
      [rows],
      avatarMap,
      [gmRows],
    ] = await Promise.all([
      authPool.query<any[]>(
        `SELECT
           c.id,
           c.comment,
           c.created_at,
           c.updated_at,
           a.id         AS author_id,
           a.username,
           MAX(aa.\`${schema.gmCol}\`) AS gmlevel
         FROM forum_comments c
         JOIN account a           ON c.author_id = a.id
         LEFT JOIN account_access aa ON a.id = aa.\`${schema.idCol}\`
         WHERE c.topic_id = ?
         GROUP BY c.id, a.id, a.username
         ORDER BY c.created_at ASC`,
        [topicId]
      ),
      readAvatarMap(),
      gmCheckPromise,
    ]);

    const comments = (rows as any[]).map((r: any) => {
      const role = resolveRole(r.gmlevel);
      return {
        id: r.id,
        comment: r.comment,
        created_at: r.created_at,
        updated_at: r.updated_at,
        author: {
          id: r.author_id,
          username: r.username,
          avatar: avatarMap[String(r.author_id)] ?? null,
          role,
          roleColor: ROLE_COLOR[role] ?? 'text-purple-300',
        },
      };
    });

    const gmLevel = Number((gmRows as any[])?.[0]?.gmlevel ?? 0);
    const isGM    = gmLevel >= 3;
    const isStaff = gmLevel >= 1;

    return NextResponse.json({ comments, isGM, isStaff }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/forum/topics/[id]/comments error:', e);
    return NextResponse.json({ error: 'Error cargando comentarios', details: e.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const topicId = Number(rawId);
    if (!topicId || topicId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const userId  = Number(body?.userId || 0);
    const comment = String(body?.comment || '').trim();

    if (!userId || userId <= 0)       return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!comment || comment.length < 2) return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    if (comment.length > 10000)       return NextResponse.json({ error: 'Comentario demasiado largo (máx 10.000 caracteres)' }, { status: 400 });

    // Verify topic exists and is not locked
    const [topicRows]: any = await authPool.query(
      'SELECT id, locked FROM forum_topics WHERE id = ? LIMIT 1',
      [topicId]
    );
    if (!topicRows.length)    return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 });
    if (topicRows[0].locked)  return NextResponse.json({ error: 'Este tema está cerrado' }, { status: 403 });

    // Verify user exists
    const [accountRows]: any = await authPool.query('SELECT id FROM account WHERE id = ? LIMIT 1', [userId]);
    if (!accountRows.length) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const [result]: any = await authPool.query(
      'INSERT INTO forum_comments (topic_id, author_id, comment) VALUES (?, ?, ?)',
      [topicId, userId, comment]
    );

    // Update topic updated_at so it rises in the list
    await authPool.query('UPDATE forum_topics SET updated_at = NOW() WHERE id = ?', [topicId]);

    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/forum/topics/[id]/comments error:', e);
    return NextResponse.json({ error: 'Error publicando comentario', details: e.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json();
    const commentId = Number(body?.commentId || 0);
    const userId    = Number(body?.userId    || 0);
    const newText   = String(body?.comment   || '').trim();

    if (!commentId || commentId <= 0) return NextResponse.json({ error: 'ID de comentario inválido' }, { status: 400 });
    if (!userId    || userId <= 0)    return NextResponse.json({ error: 'No autenticado' },            { status: 401 });
    if (!newText   || newText.length < 2) return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    if (newText.length > 10000)       return NextResponse.json({ error: 'Comentario demasiado largo' }, { status: 400 });

    // Only the author can edit their own comment
    const [rows]: any = await authPool.query(
      'SELECT id, author_id FROM forum_comments WHERE id = ? LIMIT 1',
      [commentId]
    );
    if (!rows.length)               return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    if (rows[0].author_id !== userId) return NextResponse.json({ error: 'No puedes editar comentarios de otros usuarios' }, { status: 403 });

    await authPool.query(
      'UPDATE forum_comments SET comment = ?, updated_at = NOW() WHERE id = ?',
      [newText, commentId]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error('PATCH /api/forum/topics/[id]/comments error:', e);
    return NextResponse.json({ error: 'Error editando comentario', details: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = Number(searchParams.get('commentId') || 0);
    const userId    = Number(searchParams.get('userId')    || 0);

    if (!commentId || commentId <= 0) return NextResponse.json({ error: 'ID de comentario inválido' }, { status: 400 });
    if (!userId    || userId <= 0)    return NextResponse.json({ error: 'No autenticado' },            { status: 401 });

    // Check if user is the author OR a GM (gmlevel >= 3)
    const [commentRows]: any = await authPool.query(
      'SELECT id, author_id FROM forum_comments WHERE id = ? LIMIT 1',
      [commentId]
    );
    if (!commentRows.length) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });

    const isAuthor = commentRows[0].author_id === userId;

    if (!isAuthor) {
      const gmlevel = await getGMLevel(userId);
      if (gmlevel < 3) return NextResponse.json({ error: 'No tienes permiso para eliminar este comentario' }, { status: 403 });
    }

    await authPool.query('DELETE FROM forum_comments WHERE id = ? LIMIT 1', [commentId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error('DELETE /api/forum/topics/[id]/comments error:', e);
    return NextResponse.json({ error: 'Error eliminando comentario', details: e.message }, { status: 500 });
  }
}
