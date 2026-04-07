import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { assertAdmin } from '@/lib/admin';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

function normalizeShopImageInput(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return 'inv_misc_questionmark';

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return value;
  }

  return value.toLowerCase();
}

export async function GET(request: Request) {
  if (!authPool) {
    return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get('userId') || 0);

    const adminCheck = await assertAdmin(userId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status || 403 });
    }

    // Auto-patch shop_items table with missing columns for premium features
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
      { name: 'item_level', type: 'INT UNSIGNED NOT NULL DEFAULT 0' }
    ];

    for (const col of columnsToFix) {
      try { await authPool.query(`ALTER TABLE shop_items ADD COLUMN ${col.name} ${col.type}`); } catch { /* ignore if already exists */ }
    }

    const [rows] = await authPool.query<RowDataPacket[]>(
      `SELECT id, name, item_id, price, currency, price_dp, price_vp, quality, category, tier, class_mask, image, soap_item_count, service_type, service_data, faction, item_level, description
       FROM shop_items
       ORDER BY id DESC`
    );

    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin shop GET error:', error);
    return NextResponse.json({ error: 'No se pudo cargar la tienda', details: errorMsg }, { status: 500 });
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

    // Ensure table has requirements for INSERT before processing
    try {
      await authPool.query('ALTER TABLE shop_items ADD COLUMN service_type VARCHAR(50) NOT NULL DEFAULT "none"');
      await authPool.query('ALTER TABLE shop_items ADD COLUMN service_data TEXT NULL DEFAULT NULL');
      await authPool.query('ALTER TABLE shop_items ADD COLUMN faction VARCHAR(10) NOT NULL DEFAULT "all"');
      await authPool.query('ALTER TABLE shop_items ADD COLUMN item_level INT UNSIGNED NOT NULL DEFAULT 0');
      await authPool.query('ALTER TABLE shop_items ADD COLUMN soap_item_entry INT UNSIGNED NULL DEFAULT NULL');
      await authPool.query('ALTER TABLE shop_items ADD COLUMN soap_item_count INT UNSIGNED NOT NULL DEFAULT 1');
    } catch { /* already exist */ }

    const name = String(body?.name || '').trim();
    const itemId = Number(body?.itemId || 0);

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

    const rawQuality = String(body?.quality || 'comun').toLowerCase();
    const qualityOptions = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];
    const quality = qualityOptions.includes(rawQuality) ? rawQuality : 'comun';

    // Ahora permitimos cualquier categoría que exista en la tabla shop_categories
    const category = String(body?.category || 'misc').toLowerCase().trim() || 'misc';

    const tier = Math.max(0, Math.min(999, Number(body?.tier ?? 0)));
    const classMask = Math.max(0, Number(body?.classMask ?? 0));
    const image = normalizeShopImageInput(body?.image);
    const soapCount = Math.max(1, Math.min(255, Number(body?.soapCount ?? 1)));
    const service_type = String(body?.serviceType || 'none');
    const service_data = body?.serviceData ? String(body.serviceData) : null;
    const faction = String(body?.faction || 'all').toLowerCase();
    const itemLevel = Number(body?.itemLevel || 0);
    const description = body?.description ? String(body.description) : null;
    const safeItemId = Math.round(itemId);

    if (!name || (safeItemId <= 0 && service_type === 'none') || safeItemId < 0) {
      return NextResponse.json({ error: 'Datos invalidos. Revisa name e itemId.' }, { status: 400 });
    }
    if (finalPriceDp <= 0 && finalPriceVp <= 0) {
      return NextResponse.json({ error: 'Debes asignar al menos un precio (Donaciones o Estelas).' }, { status: 400 });
    }

    const [result] = await authPool.query<ResultSetHeader>(
      `INSERT INTO shop_items (name, item_id, price, currency, price_dp, price_vp, image, quality, category, tier, class_mask, soap_item_entry, soap_item_count, service_type, service_data, faction, item_level, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, safeItemId, legacyPrice, legacyCurrency, finalPriceDp, finalPriceVp, image, quality, category, tier, classMask, safeItemId || null, soapCount, service_type, service_data, faction, itemLevel, description]
    );

    return NextResponse.json({ success: true, id: result?.insertId || null, message: 'Item agregado correctamente' }, { status: 201 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin shop POST error:', error);
    return NextResponse.json({ error: 'No se pudo agregar el item', details: errorMsg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!authPool) {
    return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
  }
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
      return NextResponse.json({ error: 'Debes asignar al menos un precio (Donaciones o Estelas).' }, { status: 400 });
    }

    const category = String(body?.category || 'misc').toLowerCase().trim() || 'misc';
    const tier = Math.max(0, Math.min(999, Number(body?.tier ?? 0)));
    const classMask = Math.max(0, Number(body?.classMask ?? 0));
    const image = normalizeShopImageInput(body?.image);
    const soapCount = Math.max(1, Math.min(255, Number(body?.soapCount ?? 1)));
    const service_type = String(body?.serviceType || 'none');
    const service_data = body?.serviceData ? String(body.serviceData) : null;
    const faction = String(body?.faction || 'all').toLowerCase();
    const itemLevel = Number(body?.itemLevel || 0);
    const description = body?.description ? String(body.description) : null;

    const [result] = await authPool.query<ResultSetHeader>(
      `UPDATE shop_items SET
        name = ?, item_id = ?, price = ?, currency = ?, price_dp = ?, price_vp = ?, image = ?,
        quality = ?, category = ?, tier = ?, class_mask = ?,
        soap_item_entry = ?, soap_item_count = ?, service_type = ?, service_data = ?, faction = ?, item_level = ?, description = ?
       WHERE id = ? LIMIT 1`,
      [name, itemId, legacyPrice, legacyCurrency, finalPriceDp, finalPriceVp, image, body?.quality || 'comun', category, tier, classMask, itemId || null, soapCount, service_type, service_data, faction, itemLevel, description, id]
    );

    if (!result?.affectedRows) {
      return NextResponse.json({ error: 'Item no encontrado para actualizar' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Item actualizado correctamente' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin shop PUT error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el item', details: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!authPool) {
    return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
  }
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

    const [result] = await authPool.query<ResultSetHeader>('DELETE FROM shop_items WHERE id = ? LIMIT 1', [id]);
    if (!result?.affectedRows) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Item eliminado' }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Admin shop DELETE error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el item', details: errorMsg }, { status: 500 });
  }
}
