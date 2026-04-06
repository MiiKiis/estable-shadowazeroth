import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface CharacterRow extends RowDataPacket {
  guid: number;
  name: string;
  race: number;
  class: number;
  gender: number;
  level: number;
  online: number;
  money: number;
}

export async function GET(request: Request) {
  let accountId: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const [rows] = await pool.query<CharacterRow[]>(
      `SELECT guid, name, race, class, gender, level, online, money,
              map, zone, xp, totaltime, leveltime, logout_time
       FROM characters
       WHERE account = ?`,
      [accountId]
    );

    return NextResponse.json({ characters: rows });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Characters API Error:', error);
    try {
        const [rows] = await pool.query<CharacterRow[]>(
          'SELECT guid, name, race, class, gender, level, online, money FROM characters WHERE account = ?',
          [accountId]
        );
        return NextResponse.json({ characters: rows });
    } catch (innerError: unknown) {
        const innerErrorMsg = innerError instanceof Error ? innerError.message : 'Database fallback error';
        return NextResponse.json({ error: 'Database error fetching characters', details: innerErrorMsg }, { status: 500 });
    }
  }
}
