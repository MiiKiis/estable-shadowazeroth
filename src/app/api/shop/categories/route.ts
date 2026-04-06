import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

export async function GET() {
  try {
    // Obtener todas las categorías ordenadas
    const [rows]: any = await authPool.query(
      'SELECT id, slug, name, icon, image_url as image, description, parent_id FROM shop_categories ORDER BY order_index ASC, id ASC'
    );

    // Convertir a estructura de árbol si es necesario, pero por ahora devolvemos la lista plana
    // La UI actual de DonatePage espera una lista plana para las tarjetas principales.
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories', details: error.message }, { status: 500 });
  }
}

// POST se mueve a la ruta de admin para mayor seguridad
