import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

type ShopItemRow = {
  id: number;
  item_id: number;
  image: string | null;
  name: string;
  price: number;
  currency: string;
  price_dp: number;
  price_vp: number;
  quality: string | null;
  category?: string | null;
  tier?: number | null;
  class_mask?: number | null;
  soap_item_entry?: number | null;
  soap_item_count?: number | null;
  service_type: string | null;
  service_data: string | null;
  faction?: string | null;
  item_level?: number | null;
  description?: string | null;
};

export async function GET() {
  try {
    const [rows] = await authPool.query(
      `SELECT id, item_id, image, name, price, currency,
              COALESCE(price_dp, 0) AS price_dp,
              COALESCE(price_vp, 0) AS price_vp,
              quality, category, tier, class_mask,
              soap_item_entry, soap_item_count,
              service_type, service_data, faction, item_level, description
       FROM shop_items
       ORDER BY category ASC, tier ASC, price ASC, id ASC`
    );

    const items = (rows as ShopItemRow[]).map((item) => {
      // If dual prices exist use them; otherwise fallback to legacy price+currency
      let priceDp = Number(item.price_dp || 0);
      let priceVp = Number(item.price_vp || 0);
      if (priceDp === 0 && priceVp === 0) {
        const legacyPrice = Number(item.price || 0);
        const legacyCurrency = String(item.currency || 'vp').toLowerCase();
        if (legacyCurrency === 'dp') priceDp = legacyPrice;
        else priceVp = legacyPrice;
      }

      return {
        id: item.id,
        item_id: Number(item.item_id),
        image: item.image || 'inv_misc_questionmark',
        name: item.name,
        price: Number(item.price || 0), // legacy
        currency: String(item.currency || '').toLowerCase(), // legacy
        price_dp: priceDp,
        price_vp: priceVp,
        quality: item.quality || 'comun',
        category: item.category || 'misc',
        tier: Number(item.tier ?? 0),
        class_mask: Number(item.class_mask ?? 0),
        soap_item_entry: item.soap_item_entry ?? null,
        soap_item_count: item.soap_item_count ?? 1,
        service_type: item.service_type || 'none',
        service_data: item.service_data || null,
        faction: item.faction || 'all',
        item_level: item.item_level || 0,
        description: item.description || '',
      };
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    console.error('Shop items error:', error);
    return NextResponse.json(
      {
        error: 'No se pudieron cargar los items de la tienda',
        details: error.message,
      },
      { status: 500 }
    );
  }
}