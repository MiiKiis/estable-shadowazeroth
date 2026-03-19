import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

type AdminCheckResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

async function assertAdmin(userId: number): Promise<AdminCheckResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: 'userId invalido', status: 400 };
  }

  try {
    const [rows]: any = await authPool.query(
      'SELECT MAX(gmlevel) AS gmlevel FROM account_access WHERE id = ?',
      [userId]
    );

    const gmlevel = Number(rows?.[0]?.gmlevel ?? 0);
    if (gmlevel < 3) {
      return { ok: false, error: 'Acceso denegado: requiere rol de administrador', status: 403 };
    }

    return { ok: true };
  } catch (error: any) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return { ok: false, error: 'Tabla account_access no encontrada', status: 500 };
    }
    return { ok: false, error: 'No se pudo validar permisos de administrador', status: 500 };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const [rows]: any = await authPool.query(
      `SELECT id, name, item_id, price, currency, quality, category, tier, class_mask, image, soap_item_count, service_type, service_data
       FROM shop_items
       ORDER BY id DESC`
    );

    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error: any) {
    console.error('Admin shop GET error:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar la tienda', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const name = String(body?.name || '').trim();
    const itemId = Number(body?.itemId || 0);
    const price = Number(body?.price || 0);
    const rawCurrency = String(body?.currency || 'vp').toLowerCase();
    const currency = rawCurrency === 'dp' ? 'dp' : 'vp';

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const rawQuality = String(body?.quality || 'comun').toLowerCase();
    const qualityOptions = ['comun','poco_comun','raro','epico','legendario'];
    const quality = qualityOptions.includes(rawQuality) ? rawQuality : 'comun';

    const rawCategory = String(body?.category || 'misc').toLowerCase();
    const categoryOptions = ['pve','pvp','misc'];
    const category = categoryOptions.includes(rawCategory) ? rawCategory : 'misc';

    const tier = Math.max(0, Math.min(9, Number(body?.tier ?? 0)));
    const classMask = Math.max(0, Number(body?.classMask ?? 0));
    const image = String(body?.image || 'inv_misc_questionmark').trim() || 'inv_misc_questionmark';
    const soapCount = Math.max(1, Math.min(255, Number(body?.soapCount ?? 1)));

    const service_type = String(body?.serviceType || 'none');
    const service_data = body?.serviceData ? String(body.serviceData) : null;

    const safeItemId = Math.round(itemId);
    const safePrice = Math.round(price);
    
    // Allow itemId to be 0 for services
    if (!name || (safeItemId <= 0 && service_type === 'none') || safeItemId < 0 || !safePrice || safePrice <= 0) {
      return NextResponse.json(
        { error: 'Datos invalidos. Revisa name, itemId y price.' },
        { status: 400 }
      );
    }

    const [result]: any = await authPool.query(
      `INSERT INTO shop_items (name, item_id, price, currency, image, quality, category, tier, class_mask, soap_item_entry, soap_item_count, service_type, service_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, safeItemId, safePrice, currency, image, quality, category, tier, classMask, safeItemId || null, soapCount, service_type, service_data]
    );

    return NextResponse.json(
      { success: true, id: result?.insertId || null, message: 'Item agregado correctamente' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Admin shop POST error:', error);
    return NextResponse.json(
      { error: 'No se pudo agregar el item', details: error.message },
      { status: 500 }
    );
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

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const [result]: any = await authPool.query('DELETE FROM shop_items WHERE id = ? LIMIT 1', [id]);

    if (!result?.affectedRows) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Item eliminado' }, { status: 200 });
  } catch (error: any) {
    console.error('Admin shop DELETE error:', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el item', details: error.message },
      { status: 500 }
    );
  }
}
