/**
 * MySQL Service Layer para AzerothCore
 * Conexión directa a base de datos MySQL acore_characters
 */

import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'blizzcms',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'acore_characters',
};

/**
 * Crear conexión a la base de datos
 */
async function getConnection() {
  try {
    return await mysql.createConnection(DB_CONFIG);
  } catch (error) {
    console.error('Error conectando a MySQL:', error);
    throw error;
  }
}

/**
 * Obtener todos los datos de una tabla
 */
export async function getTableData<T>(
  table: string,
  conditions?: { [key: string]: string | number | boolean | null },
  limit?: number
): Promise<T[]> {
  const connection = await getConnection();

  try {
    let query = `SELECT * FROM \`${table}\``;
    const params: (string | number | boolean | null)[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key) => `\`${key}\` = ?`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...(Object.values(conditions) as (string | number | boolean | null)[]));
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = connection as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = ((await conn.execute(query, params)) as any[])[0] as T[];
    return rows;

  } catch (error) {
    console.error(`Error obteniendo datos de ${table}:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Obtener un registro por ID
 */
export async function getRecord<T>(
  table: string,
  id: string | number,
  idColumn: string = 'guid'
): Promise<T | null> {
  const connection = await getConnection();

  try {
    const [rows] = await connection.execute(
      `SELECT * FROM \`${table}\` WHERE \`${idColumn}\` = ? LIMIT 1`,
      [id]
    );

    const records = rows as T[];
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error(`Error obteniendo registro de ${table}:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Obtener personajes de un jugador
 */
export async function getCharactersByAccount(
  accountId: number
): Promise<Character[]> {
  const connection = await getConnection();

  try {
    const [rows] = await connection.execute(
      `SELECT guid, name, race, class, level, gender, skin, face, 
              hairStyle, hairColor, facialStyle, createtime, deletetime
       FROM character WHERE account = ?`,
      [accountId]
    );

    return rows as Character[];
  } catch (error) {
    console.error('Error obteniendo personajes:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Obtener inventario de un personaje
 */
export async function getCharacterInventory(
  characterGuid: number
): Promise<Item[]> {
  const connection = await getConnection();

  try {
    const [rows] = await connection.execute(
      `SELECT guid, itemEntry, creatorGuid, giftCreatorGuid, count, duration, 
              charges, flags, enchantments, randomPropertyId, durability
       FROM item_instance WHERE owner_guid = ? ORDER BY slot ASC`,
      [characterGuid]
    );

    return rows as Item[];
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Interface para Personaje
 */
export interface Character {
  guid: number;
  name: string;
  race: number;
  class: number;
  level: number;
  gender: number;
  skin: number;
  face: number;
  hairStyle: number;
  hairColor: number;
  facialStyle: number;
  createtime: string;
  deletetime: string | null;
}

/**
 * Interface para Item
 */
export interface Item {
  guid: number;
  itemEntry: number;
  creatorGuid: number;
  giftCreatorGuid: number;
  count: number;
  duration: number;
  charges: string;
  flags: number;
  enchantments: string;
  randomPropertyId: number;
  durability: number;
}
