type WowheadItemMeta = {
  itemId: number;
  iconName: string;
  iconUrl: string;
  itemUrl: string;
  qualityId: number;
};

type CacheEntry = {
  expiresAt: number;
  value: WowheadItemMeta;
};

const WOWHEAD_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const wowheadCache = new Map<number, CacheEntry>();

function normalizeIconName(iconName: string) {
  return String(iconName || '').trim().toLowerCase();
}

function fallbackMeta(itemId: number): WowheadItemMeta {
  return {
    itemId,
    iconName: 'inv_misc_questionmark',
    iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg',
    itemUrl: `https://www.wowhead.com/wotlk/item=${itemId}`,
    qualityId: 1,
  };
}

export async function getWowheadItemMeta(itemId: number): Promise<WowheadItemMeta> {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return fallbackMeta(0);
  }

  const now = Date.now();
  const cached = wowheadCache.get(itemId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const xmlUrl = `https://www.wowhead.com/wotlk/item=${itemId}?xml`;
    const res = await fetch(xmlUrl, { cache: 'no-store' });
    if (!res.ok) {
      const fb = fallbackMeta(itemId);
      wowheadCache.set(itemId, { expiresAt: now + WOWHEAD_TTL_MS, value: fb });
      return fb;
    }

    const text = await res.text();
    const iconMatch = text.match(/<icon[^>]*>([^<]+)<\/icon>/i);
    const qualityMatch = text.match(/<quality\s+id="(\d+)"\s*\/?>/i);
    const iconName = normalizeIconName(iconMatch?.[1] || 'inv_misc_questionmark');
    const qualityId = Number(qualityMatch?.[1] || 1);

    const meta: WowheadItemMeta = {
      itemId,
      iconName,
      iconUrl: `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`,
      itemUrl: `https://www.wowhead.com/wotlk/item=${itemId}`,
      qualityId: Number.isFinite(qualityId) ? qualityId : 1,
    };

    wowheadCache.set(itemId, { expiresAt: now + WOWHEAD_TTL_MS, value: meta });
    return meta;
  } catch {
    const fb = fallbackMeta(itemId);
    wowheadCache.set(itemId, { expiresAt: now + WOWHEAD_TTL_MS, value: fb });
    return fb;
  }
}
