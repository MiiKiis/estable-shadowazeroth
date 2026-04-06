import { NextResponse } from 'next/server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { authPool } from '@/lib/db';
import { getGMLevel } from '@/lib/gmLevel';

async function isGM(userId: number): Promise<boolean> {
  const lvl = await getGMLevel(userId);
  return lvl >= 3;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);
    const gm = userId > 0 ? await isGM(userId) : false;

    const [rows] = await authPool.query<RowDataPacket[]>(
      'SELECT * FROM forum_sections ORDER BY order_index ASC'
    );
    return NextResponse.json({ sections: rows, isGM: gm }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error cargando secciones', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, id, label, description, icon, color, border, text_color, parent_id } = body;

    if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const gm = await isGM(userId);
    if (!gm) return NextResponse.json({ error: 'No tienes permisos (GM 3+ requerido)' }, { status: 403 });

    if (!id || !label) return NextResponse.json({ error: 'Faltan campos obligatorios (ID, Label)' }, { status: 400 });

    const finalDesc = description || null;
    const finalIcon = icon || 'MessageSquare';
    const finalColor = color || 'from-purple-700 to-indigo-700';
    const finalBorder = border || 'border-purple-700/50';
    const finalTextColor = text_color || 'text-purple-300';
    const finalParent = parent_id || null;

    await authPool.query(
      `INSERT INTO forum_sections (id, label, description, icon, color, border, text_color, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label=?, description=?, icon=?, color=?, border=?, text_color=?, parent_id=?`,
      [
        id, label, finalDesc, finalIcon, finalColor, finalBorder, finalTextColor, finalParent,
        label, finalDesc, finalIcon, finalColor, finalBorder, finalTextColor, finalParent
      ]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error creando sección', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, id, is_locked } = body;

    if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const gm = await isGM(userId);
    if (!gm) return NextResponse.json({ error: 'No tienes permisos (GM 3+ requerido)' }, { status: 403 });

    if (!id) return NextResponse.json({ error: 'ID de sección faltante' }, { status: 400 });

    // Intentar agregar la columna por si no existe
    try {
      await authPool.query('ALTER TABLE forum_sections ADD COLUMN is_locked TINYINT(1) DEFAULT 0');
    } catch(e) {}

    await authPool.query(
      'UPDATE forum_sections SET is_locked = ? WHERE id = ?',
      [is_locked ? 1 : 0, id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error actualizando sección', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);
    const sectionId = searchParams.get('id');

    if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const gm = await isGM(userId);
    if (!gm) return NextResponse.json({ error: 'No tienes permisos (GM 3+ requerido)' }, { status: 403 });

    if (!sectionId) return NextResponse.json({ error: 'ID de sección faltante' }, { status: 400 });

    // The front shouldn't be able to delete the hardcoded default sections just in case, but let's allow anything for now

    await authPool.query('DELETE FROM forum_sections WHERE id = ? LIMIT 1', [sectionId]);

    // To prevent orphans, optionally move topics to 'general' or just let them be orphaned,
    // they just won't show in any section unless the category matches.
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error eliminando sección', details: error.message }, { status: 500 });
  }
}
