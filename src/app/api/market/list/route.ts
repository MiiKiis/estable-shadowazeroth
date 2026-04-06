import { NextResponse } from 'next/server';
import { authPool, pool as charPool } from '@/lib/db';

// Mapeos básicos para el snapshot
const RACE_MAP: Record<number, string> = { 1: 'Humano', 2: 'Orco', 3: 'Enano', 4: 'Elfo de la Noche', 5: 'No-Muerto', 6: 'Tauren', 7: 'Gnomo', 8: 'Trol', 10: 'Elfo de Sangre', 11: 'Draenei' };
const CLASS_MAP: Record<number, string> = { 1: 'Guerrero', 2: 'Paladín', 3: 'Cazador', 4: 'Pícaro', 5: 'Sacerdote', 6: 'Caballero de la Muerte', 7: 'Chamán', 8: 'Mago', 9: 'Brujo', 11: 'Druida' };

export async function POST(req: Request) {
  try {
    const { guid, priceDp, accountId } = await req.json();
    
    if (!accountId || !guid || !priceDp || priceDp <= 0 || priceDp > 5000000) {
      return NextResponse.json({ error: 'Parámetros inválidos o precio fuera de límite' }, { status: 400 });
    }

    const sellerAccountId = Number(accountId);

    // 1. Verificar propiedad y datos del personaje
    const [charRows]: any = await charPool.query(
      'SELECT guid, name, race, class, level, gender, money, totalKills, arenaPoints, totalHonorPoints FROM characters WHERE guid = ? AND account = ?',
      [guid, sellerAccountId]
    );

    if (charRows.length === 0) {
      return NextResponse.json({ error: 'Personaje no encontrado o no te pertenece' }, { status: 404 });
    }

    const character = charRows[0];

    // 1.5 Fetch Equipment y Profesiones
    let equippedItems = [];
    let professions = [];
    try {
      const [equipmentRows]: any = await charPool.query(
        `SELECT ci.slot, ii.itemEntry 
         FROM character_inventory ci 
         JOIN item_instance ii ON ci.item = ii.guid 
         WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot <= 18`,
        [guid]
      );
      equippedItems = equipmentRows;

      const [profRows]: any = await charPool.query(
        `SELECT skill, value, max 
         FROM character_skills 
         WHERE guid = ? 
         AND skill IN (164, 165, 171, 182, 186, 197, 202, 333, 393, 755, 773, 185, 129, 356)`,
        [guid]
      );
      professions = profRows;
    } catch (e) {
      console.warn('Error parcial obteniendo items/profesiones:', e);
    }

    // Snapshot básico del personaje
    const snapshot = {
      name: character.name,
      level: character.level,
      raceId: character.race,
      raceName: RACE_MAP[character.race] || 'Desconocido',
      classId: character.class,
      className: CLASS_MAP[character.class] || 'Desconocido',
      gender: character.gender,
      moneyGold: Math.floor(character.money / 10000),
      totalKills: character.totalKills,
      arenaPoints: character.arenaPoints,
      honorPoints: character.totalHonorPoints,
      equippedItems,
      professions
    };

    const conn = await authPool.getConnection();
    try {
      await conn.beginTransaction();

      // 2. Comprobar si ya está listado (por seguridad)
      const [existing]: any = await conn.query(
        'SELECT id FROM marketplace_listings WHERE char_guid = ? AND status = "active"',
        [guid]
      );

      if (existing.length > 0) {
        throw new Error('El personaje ya está a la venta.');
      }

      // 3. Crear el Listado en Store Shadow
      const snapshotJson = JSON.stringify(snapshot);
      await conn.query(
        'INSERT INTO marketplace_listings (seller_account, char_guid, char_snapshot, price_dp, status) VALUES (?, ?, ?, ?, "active")',
        [sellerAccountId, guid, snapshotJson, priceDp]
      );

      // 4. Renombrar cuenta atómicamente a 999999 (Market Hold Account)
      // Esta actualización se hace directo en acore_characters/characters
      const [updateResult]: any = await charPool.query(
        'UPDATE characters SET account = 999999 WHERE guid = ? AND account = ?',
        [guid, sellerAccountId]
      );

      if (updateResult.affectedRows === 0) {
         throw new Error('Fallo al retener el personaje. Operación abortada.');
      }

      await conn.commit();
      return NextResponse.json({ success: true, message: 'Personaje puesto a la venta exitosamente.' });
    } catch (dbError: any) {
      await conn.rollback();
      console.error('[Marketplace List] Transaction Error:', dbError);
      return NextResponse.json({ error: dbError.message || 'Error en la transacción' }, { status: 500 });
    } finally {
      conn.release();
    }
    
  } catch (err: any) {
    console.error('Error listing char:', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
