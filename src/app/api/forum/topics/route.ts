import { NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authPool } from '@/lib/db';
import { readAvatarMap } from '@/lib/avatarStore';
import { getAccountAccessSchema, getGMLevel } from '@/lib/gmLevel';

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

// ─── Migraciones one-time (se ejecutan UNA sola vez por proceso) ──────────────
let migrationsRan: Promise<void> | null = null;

async function runMigrations(): Promise<void> {
  if (migrationsRan) return migrationsRan;

  migrationsRan = (async () => {
    // 0. Base tables (para instalaciones nuevas)
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await authPool.query(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic_id INT NOT NULL,
        author_id INT UNSIGNED NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1. Tabla de secciones
    await authPool.query(`
      CREATE TABLE IF NOT EXISTS forum_sections (
        id VARCHAR(64) PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(64) DEFAULT 'MessageSquare',
        color VARCHAR(255) DEFAULT 'from-purple-700 to-indigo-700',
        border VARCHAR(255) DEFAULT 'border-purple-700/50',
        text_color VARCHAR(255) DEFAULT 'text-purple-300',
        parent_id VARCHAR(64) NULL,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES forum_sections(id) ON DELETE SET NULL
      )
    `);

    // 2. Seeds si vacía
    const [sectionRows]: any = await authPool.query('SELECT COUNT(*) as count FROM forum_sections');
    if (sectionRows[0].count === 0) {
      const defaults = [
        ['announcements', 'Anuncios', 'Novedades oficiales', 'Megaphone', 'from-fuchsia-700 to-fuchsia-900', 'border-fuchsia-700/50', 'text-fuchsia-300', null],
        ['support', 'Soporte', 'Ayuda técnica', 'LifeBuoy', 'from-rose-700 to-rose-900', 'border-rose-700/50', 'text-rose-300', null],
        ['guides', 'Guías', 'Tutoriales y tips', 'Lightbulb', 'from-cyan-700 to-cyan-900', 'border-cyan-700/50', 'text-cyan-300', null],
        ['reports', 'Denuncias', 'Reporta infracciones', 'AlertOctagon', 'from-red-700 to-red-900', 'border-red-700/50', 'text-red-300', null],
        ['suggestions', 'Sugerencias', 'Ideas de mejora', 'Sparkles', 'from-emerald-700 to-emerald-900', 'border-emerald-700/50', 'text-emerald-300', null],
        ['migrations', 'Migraciones', 'Cambia de servidor', 'Globe', 'from-blue-700 to-blue-900', 'border-blue-700/50', 'text-blue-300', null],
      ];
      for (const d of defaults) {
        await authPool.query(
          'INSERT IGNORE INTO forum_sections (id, label, description, icon, color, border, text_color, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          d
        );
      }
    }

    // 3. Columna `completed`
    const [completedRows]: any = await authPool.query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_topics' AND COLUMN_NAME = 'completed' LIMIT 1`
    );
    if (!completedRows?.length) {
      await authPool.query(
        'ALTER TABLE forum_topics ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 0 AFTER locked'
      );
    }

    // 4. Migrar category ENUM → VARCHAR
    const [catRows]: any = await authPool.query(
      `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_topics' AND COLUMN_NAME = 'category' LIMIT 1`
    );
    if (catRows?.length && catRows[0].DATA_TYPE === 'enum') {
      await authPool.query(
        'ALTER TABLE forum_topics MODIFY COLUMN category VARCHAR(64) NOT NULL DEFAULT "general"'
      );
    }

    // 5. Columna `updated_at` — sin ella el ORDER BY falla
    const [updatedRows]: any = await authPool.query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_topics' AND COLUMN_NAME = 'updated_at' LIMIT 1`
    );
    if (!updatedRows?.length) {
      await authPool.query(
        'ALTER TABLE forum_topics ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
      );
    }

    // 6. Índices de performance en forum_topics
    try {
      await authPool.query('ALTER TABLE forum_topics ADD INDEX idx_category (category)');
    } catch { /* índice ya existe */ }
    try {
      await authPool.query('ALTER TABLE forum_topics ADD INDEX idx_pinned_updated (pinned, updated_at)');
    } catch { /* índice ya existe */ }

    // 7. Índice en forum_comments para las agregaciones
    try {
      await authPool.query('ALTER TABLE forum_comments ADD INDEX idx_topic_id (topic_id)');
    } catch { /* índice ya existe */ }

  })().catch((err) => {
    console.error('[Forum] Error en migraciones:', err);
    migrationsRan = null; // Permitir reintento en el próximo ciclo
  });

  return migrationsRan;
}

function resolveRole(gmlevel: number | null): string {
  const lvl = Number(gmlevel ?? 0);
  if (lvl >= 3) return 'GM';
  if (lvl >= 1) return 'Moderador';
  return 'Jugador';
}

async function isGM(userId: number): Promise<boolean> {
  const lvl = await getGMLevel(userId);
  return lvl >= 3;
}

export async function GET(request: Request) {
  try {
    // Migrations corren una sola vez; en requests subsiguientes es un noop
    await runMigrations();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || null;

    const schema = await getAccountAccessSchema();

    // ─── Query optimizada: LEFT JOINs en lugar de subconsultas correlacionadas ──
    const [rows] = await authPool.query<TopicRow[]>(
      `SELECT
         t.id,
         t.title,
         t.category,
         t.pinned,
         t.locked,
         COALESCE(t.completed, 0)          AS completed,
         t.views,
         t.created_at,
         COALESCE(t.updated_at, t.created_at) AS updated_at,
         COALESCE(a.username, '[Deleted]') AS author_username,
         t.author_id                       AS author_id,
         MAX(aa.\`${schema.gmCol}\`)                   AS gmlevel,
         COALESCE(fc_agg.comment_count, 0) AS comment_count,
         fc_agg.last_reply_at              AS last_reply_at
       FROM forum_topics t
       LEFT JOIN account a          ON t.author_id = a.id
       LEFT JOIN account_access aa  ON a.id = aa.\`${schema.idCol}\`
       LEFT JOIN (
         SELECT topic_id,
                COUNT(*)        AS comment_count,
                MAX(created_at) AS last_reply_at
         FROM forum_comments
         GROUP BY topic_id
       ) fc_agg ON fc_agg.topic_id = t.id
       ${category ? 'WHERE t.category = ?' : ''}
       GROUP BY t.id, t.title, t.category, t.pinned, t.locked, t.completed,
                t.views, t.created_at, t.updated_at, t.author_id, a.username,
                fc_agg.comment_count, fc_agg.last_reply_at
       ORDER BY t.pinned DESC, COALESCE(t.updated_at, t.created_at) DESC`,
      category ? [category] : []
    );

    const avatarMap = await readAvatarMap();

    // Ya filtramos en SQL con WHERE; no se necesita doble-filtrado JS
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
        username: r.author_username,
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
    await runMigrations();

    const body = await request.json();
    const userId   = Number(body?.userId || 0);
    const title    = String(body?.title || '').trim();
    const category = String(body?.category || 'general');
    const comment  = String(body?.comment || '').trim();
    const pinned   = body?.pinned ? 1 : 0;

    const [sections] = await authPool.query<RowDataPacket[]>('SELECT id FROM forum_sections');
    const validCategories = sections.map(s => s.id);

    if (!userId || userId <= 0)       return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!title || title.length < 3)   return NextResponse.json({ error: 'El título debe tener al menos 3 caracteres' }, { status: 400 });
    if (title.length > 200)           return NextResponse.json({ error: 'El título no puede exceder 200 caracteres' }, { status: 400 });
    if (validCategories.length > 0 && !validCategories.includes(category)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
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
