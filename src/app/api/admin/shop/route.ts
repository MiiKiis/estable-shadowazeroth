import { NextResponse } from 'next/server';
import { authPool, cmsPool } from '@/lib/db';

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
    // 1. Chequear BlizzCMS primero
    const [cmsRows]: any = await cmsPool.query(
      'SELECT role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (cmsRows?.[0]?.role === 1) {
      return { ok: true };
    }

    // 2. Fallback a AzerothCore (usando id en vez de AccountID)
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

    // Auto-add dual price columns if not present
    try {
      await authPool.query('ALTER TABLE shop_items ADD COLUMN description TEXT NULL DEFAULT NULL');
    } catch { /* ya existe */ }
    try {
      await authPool.query('ALTER TABLE shop_items ADD COLUMN price_dp INT UNSIGNED NOT NULL DEFAULT 0');
    } catch { /* ya existe */ }
    try {
      await authPool.query('ALTER TABLE shop_items ADD COLUMN price_vp INT UNSIGNED NOT NULL DEFAULT 0');
    } catch { /* ya existe */ }

    const [rows]: any = await authPool.query(
      `SELECT id, name, item_id, price, currency, price_dp, price_vp, quality, category, tier, class_mask, image, soap_item_count, service_type, service_data, faction, item_level, description
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

    // ── DUAL PRICING ──────────────────────────────────────────
    const priceDp = Math.max(0, Math.round(Number(body?.priceDp || 0)));
    const priceVp = Math.max(0, Math.round(Number(body?.priceVp || 0)));

    // Backward compat: si no vienen precios duales, usar price+currency legacy
    let finalPriceDp = priceDp;
    let finalPriceVp = priceVp;
    if (priceDp === 0 && priceVp === 0) {
      const legacyPrice = Math.round(Number(body?.price || 0));
      const legacyCurrency = String(body?.currency || 'vp').toLowerCase();
      if (legacyCurrency === 'dp') finalPriceDp = legacyPrice;
      else finalPriceVp = legacyPrice;
    }

    // Legacy columns keep highest priority price for backward compat
    const legacyPrice = finalPriceDp > 0 ? finalPriceDp : finalPriceVp;
    const legacyCurrency = finalPriceDp > 0 ? 'dp' : 'vp';

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    const rawQuality = String(body?.quality || 'comun').toLowerCase();
    const qualityOptions = ['comun','poco_comun','raro','epico','legendario'];
    const quality = qualityOptions.includes(rawQuality) ? rawQuality : 'comun';

    const rawCategory = String(body?.category || 'misc').toLowerCase();
    const categoryOptions = ['pve', 'pvp', 'profesiones', 'monturas', 'transmo', 'oro', 'boost', 'misc'];
    const category = categoryOptions.includes(rawCategory) ? rawCategory : 'misc';

    const tier = Math.max(0, Math.min(999, Number(body?.tier ?? 0)));
    const classMask = Math.max(0, Number(body?.classMask ?? 0));
    const image = String(body?.image || 'inv_misc_questionmark').trim() || 'inv_misc_questionmark';
    const soapCount = Math.max(1, Math.min(255, Number(body?.soapCount ?? 1)));

    const service_type = String(body?.serviceType || 'none');
    const service_data = body?.serviceData ? String(body.serviceData) : null;

    const faction = String(body?.faction || 'all').toLowerCase();
    const itemLevel = Number(body?.itemLevel || 0);
    const description = body?.description ? String(body.description) : null;

    const safeItemId = Math.round(itemId);
    
    // Validate: at least one price must be > 0
    if (!name || (safeItemId <= 0 && service_type === 'none') || safeItemId < 0) {
      return NextResponse.json(
        { error: 'Datos invalidos. Revisa name e itemId.' },
        { status: 400 }
      );
    }
    if (finalPriceDp <= 0 && finalPriceVp <= 0) {
      return NextResponse.json(
        { error: 'Debes asignar al menos un precio (Donaciones o Estelas).' },
        { status: 400 }
      );
    }

    const [result]: any = await authPool.query(
      `INSERT INTO shop_items (name, item_id, price, currency, price_dp, price_vp, image, quality, category, tier, class_mask, soap_item_entry, soap_item_count, service_type, service_data, faction, item_level, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, safeItemId, legacyPrice, legacyCurrency, finalPriceDp, finalPriceVp, image, quality, category, tier, classMask, safeItemId || null, soapCount, service_type, service_data, faction, itemLevel, description]
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const userId = Number(body?.userId || 0);
    const id = Number(body?.id || 0);
    
    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID de item invalido' }, { status: 400 });
    }

    const name = String(body?.name || '').trim();
    const itemId = Number(body?.itemId || 0);
    
    // ── DUAL PRICING ──────────────────────────────────────────
    const priceDp = Math.max(0, Math.round(Number(body?.priceDp || 0)));
    const priceVp = Math.max(0, Math.round(Number(body?.priceVp || 0)));

    let finalPriceDp = priceDp;
    let finalPriceVp = priceVp;
    if (priceDp === 0 && priceVp === 0) {
      const legacyPrice = Math.round(Number(body?.price || 0));
      const legacyCurrency = String(body?.currency || 'vp').toLowerCase();
      if (legacyCurrency === 'dp') finalPriceDp = legacyPrice;
      else finalPriceVp = legacyPrice;
    }

    const legacyPrice = finalPriceDp > 0 ? finalPriceDp : finalPriceVp;
    const legacyCurrency = finalPriceDp > 0 ? 'dp' : 'vp';

    if (finalPriceDp <= 0 && finalPriceVp <= 0) {
      return NextResponse.json(
        { error: 'Debes asignar al menos un precio (Donaciones o Estelas).' },
        { status: 400 }
      );
    }

    const rawCategory = String(body?.category || 'misc').toLowerCase();
    const category = ['pve', 'pvp', 'profesiones', 'monturas', 'transmo', 'oro', 'boost', 'misc'].includes(rawCategory) ? rawCategory : 'misc';
    const tier = Math.max(0, Math.min(999, Number(body?.tier ?? 0)));
    const classMask = Math.max(0, Number(body?.classMask ?? 0));
    const image = String(body?.image || 'inv_misc_questionmark').trim();
    const soapCount = Math.max(1, Math.min(255, Number(body?.soapCount ?? 1)));
    const service_type = String(body?.serviceType || 'none');
    const service_data = body?.serviceData ? String(body.serviceData) : null;

    const faction = String(body?.faction || 'all').toLowerCase();
    const itemLevel = Number(body?.itemLevel || 0);
    const description = body?.description ? String(body.description) : null;

    const [result]: any = await authPool.query(
      `UPDATE shop_items SET 
        name = ?, item_id = ?, price = ?, currency = ?, price_dp = ?, price_vp = ?, image = ?, 
        quality = ?, category = ?, tier = ?, class_mask = ?, 
        soap_item_entry = ?, soap_item_count = ?, service_type = ?, service_data = ?, faction = ?, item_level = ?, description = ?
       WHERE id = ? LIMIT 1`,
      [
        name, itemId, legacyPrice, legacyCurrency, finalPriceDp, finalPriceVp, image, 
        body?.quality || 'comun', category, tier, classMask, 
        itemId || null, soapCount, service_type, service_data, faction, itemLevel, description, id
      ]
    );

    if (!result?.affectedRows) {
      return NextResponse.json({ error: 'Item no encontrado para actualizar' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Item actualizado correctamente' });
  } catch (error: any) {
    console.error('Admin shop PUT error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el item', details: error.message }, { status: 500 });
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
