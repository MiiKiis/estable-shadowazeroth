import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface SearchResultRow extends RowDataPacket {
  guid: number;
  name: string;
  class: number;
  level: number;
  race: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim() ?? '';

  if (name.length < 1) {
    return NextResponse.json({ error: 'Nombre muy corto (mínimo 1 caracter)' }, { status: 400 });
  }

  const pattern = `%${name}%`;

  try {
    const [rows] = await pool.query<SearchResultRow[]>(
      `SELECT guid, name, class, level, race
       FROM characters
       WHERE name LIKE ? COLLATE utf8mb4_general_ci
       ORDER BY (name = ?) DESC, level DESC, name ASC
       LIMIT 10`,
      [pattern, name]
    );
    return NextResponse.json({ characters: rows });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json(
      { error: 'Error buscando personaje', details: errorMsg },
      { status: 500 }
    );
  }
}
