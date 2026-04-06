import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

interface ArmorySearchRow extends RowDataPacket {
  guid: number;
  name: string;
  class: number;
  race: number;
  level: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get('name') || '').trim();

  if (name.length < 1) {
    return NextResponse.json({ error: 'Nombre muy corto (mínimo 1 carácter)' }, { status: 400 });
  }

  const pattern = `%${name}%`;

  try {
    const [rows] = await pool.query<ArmorySearchRow[]>(
      `SELECT guid, name, class, race, level
       FROM characters
       WHERE name LIKE ? COLLATE utf8mb4_general_ci
       ORDER BY (name = ?) DESC, level DESC, name ASC
       LIMIT 20`,
      [pattern, name]
    );

    return NextResponse.json({
      characters: rows,
      total: rows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error buscando personaje en Armería', details: message },
      { status: 500 }
    );
  }
}
