import { NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool, { worldPool } from '@/lib/db';

interface CharacterRow extends RowDataPacket {
  guid: number;
  name: string;
  race: number;
  class: number;
  gender: number;
  level: number;
  money: number;
  map: number;
  zone: number;
  xp: number;
  totaltime: number;
  online: number;
}

interface EquipmentRow extends RowDataPacket {
  slot: number;
  itemGuid: number;
  itemEntry: number;
  itemName: string | null;
  itemIcon: string | null;
  quality: number | null;
  itemLevel: number | null;
  requiredLevel: number | null;
  inventoryType: number | null;
  durability: number;
  creatorGuid: number;
  enchantments: string;
  randomPropertyId: number;
  count: number;
}

interface ProfessionRow extends RowDataPacket {
  skill: number;
  value: number;
  max: number;
}

interface IconCacheRow extends RowDataPacket {
  itemEntry: number;
  icon: string | null;
  expiresAtUnix: number;
}

const ICON_SUCCESS_TTL_SECONDS = 60 * 60 * 24 * 14;
const ICON_FAILURE_TTL_SECONDS = 60 * 15;
const ICON_MEM_CACHE_MAX = 5000;
const ICON_FETCH_TIMEOUT_MS = 2500;
const ICON_FETCHS_PER_MINUTE = 30;
const ICON_EAGER_FETCH_PER_REQUEST = 4;

const iconMemCache = new Map<number, { icon: string | null; expiresAt: number }>();
const iconWarmupQueue: number[] = [];
const iconWarmupSet = new Set<number>();

let iconCacheTableReadyPromise: Promise<void> | null = null;
let iconWorkerStarted = false;
let iconWorkerRunning = false;
let wowheadTokens = ICON_FETCHS_PER_MINUTE;
let wowheadLastRefill = Date.now();

function refillWowheadTokens() {
  const now = Date.now();
  const elapsedMs = now - wowheadLastRefill;
  if (elapsedMs <= 0) return;

  const refillPerMs = ICON_FETCHS_PER_MINUTE / 60000;
  wowheadTokens = Math.min(ICON_FETCHS_PER_MINUTE, wowheadTokens + elapsedMs * refillPerMs);
  wowheadLastRefill = now;
}

function consumeWowheadToken(): boolean {
  refillWowheadTokens();
  if (wowheadTokens < 1) return false;
  wowheadTokens -= 1;
  return true;
}

function setMemIcon(entry: number, icon: string | null, expiresAt: number) {
  iconMemCache.set(entry, { icon, expiresAt });

  if (iconMemCache.size > ICON_MEM_CACHE_MAX) {
    const firstKey = iconMemCache.keys().next().value;
    if (typeof firstKey === 'number') {
      iconMemCache.delete(firstKey);
    }
  }
}

async function ensureIconCacheTable(): Promise<void> {
  if (!iconCacheTableReadyPromise) {
    iconCacheTableReadyPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS armory_item_icon_cache (
          item_entry INT UNSIGNED NOT NULL,
          icon VARCHAR(128) NULL,
          expires_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          fail_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          last_error VARCHAR(255) NULL,
          PRIMARY KEY (item_entry),
          KEY idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    })().catch((error) => {
      iconCacheTableReadyPromise = null;
      throw error;
    });
  }

  await iconCacheTableReadyPromise;
}

async function getPersistentIcons(entries: number[]): Promise<Map<number, string | null>> {
  const result = new Map<number, string | null>();
  if (entries.length === 0) return result;

  await ensureIconCacheTable();

  const placeholders = entries.map(() => '?').join(', ');
  const [rows] = await pool.query<IconCacheRow[]>(
    `SELECT item_entry AS itemEntry,
            icon,
            UNIX_TIMESTAMP(expires_at) AS expiresAtUnix
     FROM armory_item_icon_cache
     WHERE item_entry IN (${placeholders})
       AND expires_at > UTC_TIMESTAMP()`,
    entries
  );

  const now = Date.now();
  for (const row of rows) {
    const expiresAt = Number(row.expiresAtUnix || 0) * 1000;
    if (!row.itemEntry || expiresAt <= now) continue;
    result.set(row.itemEntry, row.icon ?? null);
    setMemIcon(row.itemEntry, row.icon ?? null, expiresAt);
  }

  return result;
}

async function upsertPersistentIcon(entry: number, icon: string | null, ttlSeconds: number, errorMessage?: string) {
  await ensureIconCacheTable();

  await pool.query<ResultSetHeader>(
    `INSERT INTO armory_item_icon_cache (item_entry, icon, expires_at, updated_at, fail_count, last_error)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP(), ?, ?)
     ON DUPLICATE KEY UPDATE
       icon = VALUES(icon),
       expires_at = VALUES(expires_at),
       updated_at = UTC_TIMESTAMP(),
       fail_count = VALUES(fail_count),
       last_error = VALUES(last_error)`,
    [entry, icon, ttlSeconds, icon ? 0 : 1, errorMessage || null]
  );
}

async function fetchWowheadIcon(entry: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ICON_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://www.wowhead.com/item=${entry}&xml`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'ShadowAzeroth-Armory/1.0' },
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const xml = await res.text();
    const match = xml.match(/<icon[^>]*>([^<]+)<\/icon>/i);
    return match?.[1]?.trim()?.toLowerCase() || null;
  } finally {
    clearTimeout(timeout);
  }
}

async function processIconWarmupQueue() {
  if (iconWorkerRunning) return;
  iconWorkerRunning = true;

  try {
    while (iconWarmupQueue.length > 0) {
      if (!consumeWowheadToken()) {
        break;
      }

      const entry = iconWarmupQueue.shift();
      if (!entry || entry <= 0) continue;

      iconWarmupSet.delete(entry);

      const now = Date.now();
      const cached = iconMemCache.get(entry);
      if (cached && cached.expiresAt > now) {
        continue;
      }

      try {
        const icon = await fetchWowheadIcon(entry);
        if (icon) {
          const expiresAt = now + ICON_SUCCESS_TTL_SECONDS * 1000;
          setMemIcon(entry, icon, expiresAt);
          await upsertPersistentIcon(entry, icon, ICON_SUCCESS_TTL_SECONDS);
        } else {
          const expiresAt = now + ICON_FAILURE_TTL_SECONDS * 1000;
          setMemIcon(entry, null, expiresAt);
          await upsertPersistentIcon(entry, null, ICON_FAILURE_TTL_SECONDS, 'Icono no encontrado en Wowhead');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        const expiresAt = now + ICON_FAILURE_TTL_SECONDS * 1000;
        setMemIcon(entry, null, expiresAt);
        try {
          await upsertPersistentIcon(entry, null, ICON_FAILURE_TTL_SECONDS, message);
        } catch {
          // Evita romper el worker por errores puntuales de DB.
        }
      }
    }
  } finally {
    iconWorkerRunning = false;
  }
}

function startIconWarmupWorker() {
  if (iconWorkerStarted) return;
  iconWorkerStarted = true;

  setInterval(() => {
    void processIconWarmupQueue();
  }, 1000);
}

function queueIconWarmup(entries: number[]) {
  for (const entry of entries) {
    if (!entry || entry <= 0) continue;
    if (iconWarmupSet.has(entry)) continue;
    iconWarmupSet.add(entry);
    iconWarmupQueue.push(entry);
  }

  if (entries.length > 0) {
    startIconWarmupWorker();
    void processIconWarmupQueue();
  }
}

async function getIconsForEntries(entries: number[]): Promise<Map<number, string | null>> {
  const iconByEntry = new Map<number, string | null>();
  if (entries.length === 0) return iconByEntry;

  const now = Date.now();
  const missingEntries: number[] = [];

  for (const entry of entries) {
    const cached = iconMemCache.get(entry);
    if (cached && cached.expiresAt > now) {
      iconByEntry.set(entry, cached.icon);
    } else {
      missingEntries.push(entry);
    }
  }

  if (missingEntries.length > 0) {
    try {
      const persistent = await getPersistentIcons(missingEntries);
      for (const [entry, icon] of persistent.entries()) {
        iconByEntry.set(entry, icon);
      }
    } catch {
      // Si falla la tabla/cache persistente, seguimos con fallback en memoria + cola.
    }
  }

  const unresolved = entries.filter((entry) => !iconByEntry.has(entry));
  if (unresolved.length > 0) {
    const eagerEntries = unresolved.slice(0, ICON_EAGER_FETCH_PER_REQUEST);

    for (const entry of eagerEntries) {
      if (!consumeWowheadToken()) {
        break;
      }

      try {
        const icon = await fetchWowheadIcon(entry);
        const now = Date.now();

        if (icon) {
          const expiresAt = now + ICON_SUCCESS_TTL_SECONDS * 1000;
          setMemIcon(entry, icon, expiresAt);
          iconByEntry.set(entry, icon);
          await upsertPersistentIcon(entry, icon, ICON_SUCCESS_TTL_SECONDS);
        } else {
          const expiresAt = now + ICON_FAILURE_TTL_SECONDS * 1000;
          setMemIcon(entry, null, expiresAt);
          await upsertPersistentIcon(entry, null, ICON_FAILURE_TTL_SECONDS, 'Icono no encontrado en Wowhead');
        }
      } catch (error: unknown) {
        const now = Date.now();
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setMemIcon(entry, null, now + ICON_FAILURE_TTL_SECONDS * 1000);
        try {
          await upsertPersistentIcon(entry, null, ICON_FAILURE_TTL_SECONDS, message);
        } catch {
          // Ignorar error de persistencia y seguir con el flujo.
        }
      }
    }
  }

  const stillUnresolved = entries.filter((entry) => !iconByEntry.has(entry));
  if (stillUnresolved.length > 0) {
    queueIconWarmup(stillUnresolved);
  }

  return iconByEntry;
}

async function runFirstSuccess<T extends RowDataPacket>(
  queries: Array<{ sql: string; params?: unknown[] }>
): Promise<T[]> {
  let lastError: unknown = null;

  for (const query of queries) {
    try {
      const [rows] = await pool.query<T[]>(query.sql, query.params || []);
      return rows;
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ guid: string }> }
) {
  const { guid } = await context.params;
  const numericGuid = Number(guid);

  if (!guid || Number.isNaN(numericGuid) || numericGuid <= 0) {
    return NextResponse.json({ error: 'GUID inválido' }, { status: 400 });
  }

  const warnings: string[] = [];

  try {
    const characters = await runFirstSuccess<CharacterRow>([
      {
        sql: `SELECT guid, name, race, class, gender, level, money, map, zone, xp, totaltime, online
              FROM characters
              WHERE guid = ?
              LIMIT 1`,
        params: [numericGuid],
      }
    ]);

    const character = characters[0] || null;

    if (!character) {
      return NextResponse.json({ error: 'Personaje no encontrado' }, { status: 404 });
    }

    const stats = null;

    let equipment: EquipmentRow[] = [];
    try {
      // Consultar personaje+equipamiento desde character pool, items desde worldPool
      const [charInvRows]: any = await pool.query(
        `SELECT ci.slot,
                ii.guid AS itemGuid,
                ii.itemEntry,
                ii.durability,
                ii.creatorGuid,
                ii.enchantments,
                ii.randomPropertyId,
                ii.count
         FROM character_inventory ci
         INNER JOIN item_instance ii ON ii.guid = ci.item
         WHERE ci.guid = ?
           AND ci.bag = 0
           AND ci.slot BETWEEN 0 AND 18
         ORDER BY ci.slot ASC`,
        [numericGuid]
      );

      // Enriquecer con datos de item_template desde world ──────────────────────
      const entryIds = [...new Set((charInvRows as any[]).map((r: any) => r.itemEntry).filter((e: number) => e > 0))];
      const itemDataMap = new Map<number, { name: string; quality: number; itemLevel: number; requiredLevel: number; inventoryType: number }>();
      if (entryIds.length > 0) {
        try {
          const placeholders = entryIds.map(() => '?').join(',');
          const [templateRows]: any = await worldPool.query(
            `SELECT entry, name, Quality, ItemLevel, RequiredLevel, InventoryType FROM item_template WHERE entry IN (${placeholders})`,
            entryIds
          );
          for (const t of templateRows) {
            itemDataMap.set(t.entry, { name: t.name, quality: t.Quality, itemLevel: t.ItemLevel, requiredLevel: t.RequiredLevel, inventoryType: t.InventoryType });
          }
        } catch (e) { /* world pool fallo, continuar sin datos de item */ }
      }

      equipment = (charInvRows as any[]).map((row: any) => ({
        ...row,
        itemName: itemDataMap.get(row.itemEntry)?.name ?? null,
        itemIcon: null,
        quality: itemDataMap.get(row.itemEntry)?.quality ?? null,
        itemLevel: itemDataMap.get(row.itemEntry)?.itemLevel ?? null,
        requiredLevel: itemDataMap.get(row.itemEntry)?.requiredLevel ?? null,
        inventoryType: itemDataMap.get(row.itemEntry)?.inventoryType ?? null,
      }));

      const uniqueEntries = Array.from(new Set(equipment.map((item) => item.itemEntry).filter((entry) => entry > 0)));
      const iconByEntry = await getIconsForEntries(uniqueEntries);

      equipment = equipment.map((item) => ({
        ...item,
        itemIcon: iconByEntry.get(item.itemEntry) || null,
      }));
    } catch {
      warnings.push('No se pudo cargar equipamiento.');
    }

    const talents: never[] = [];

    let professions: ProfessionRow[] = [];
    try {
      professions = await runFirstSuccess<ProfessionRow>([
        {
          sql: `SELECT skill, value, max
                FROM character_skills
                WHERE guid = ?
                  AND skill IN (164, 165, 171, 182, 186, 197, 202, 333, 393, 755, 773)
                ORDER BY value DESC, skill ASC`,
          params: [numericGuid],
        },
      ]);
    } catch {
      warnings.push('No se pudo cargar profesiones.');
    }

    return NextResponse.json({
      character,
      stats,
      equipment,
      talents,
      professions,
      warnings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error cargando datos de Armería', details: message },
      { status: 500 }
    );
  }
}
