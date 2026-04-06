import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const [rows]: any = await authPool.query(
      'SELECT id, slug, name, icon, image_url, description, parent_id, order_index FROM shop_categories ORDER BY order_index ASC, id ASC'
    );

    return NextResponse.json({ categories: rows });
  } catch (error: any) {
    console.error('Admin categories GET error:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las categorías', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const { slug, name, icon, image_url, description, parent_id, order_index } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: 'Slug y Nombre son obligatorios' }, { status: 400 });
    }

    const [result]: any = await authPool.query(
      'INSERT INTO shop_categories (slug, name, icon, image_url, description, parent_id, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [slug.toLowerCase().trim(), name.trim(), icon || 'Package', image_url || null, description || null, parent_id || null, order_index || 0]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Admin categories POST error:', error);
    return NextResponse.json({ error: 'No se pudo crear la categoría', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const id = Number(body?.id || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    if (!id) return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });

    const { slug, name, icon, image_url, description, parent_id, order_index } = body;

    await authPool.query(
      'UPDATE shop_categories SET slug = ?, name = ?, icon = ?, image_url = ?, description = ?, parent_id = ?, order_index = ? WHERE id = ?',
      [slug.toLowerCase().trim(), name.trim(), icon || 'Package', image_url || null, description || null, parent_id || null, order_index || 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin categories PUT error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la categoría', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);
    const id = Number(searchParams.get('id') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Verificar si hay subcategorías
    const [subcats]: any = await authPool.query('SELECT id FROM shop_categories WHERE parent_id = ? LIMIT 1', [id]);
    if (subcats.length > 0) {
      return NextResponse.json({ error: 'No puedes eliminar una categoría que tiene subcategorías' }, { status: 400 });
    }

    await authPool.query('DELETE FROM shop_categories WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin categories DELETE error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar la categoría', details: error.message }, { status: 500 });
  }
}
