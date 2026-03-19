import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get('username') || '').trim();

    if (!username) {
      return NextResponse.json({ error: 'Nombre de cuenta requerido' }, { status: 400 });
    }

    const [rows]: any = await authPool.query(
      'SELECT id, username, dp, vp FROM account WHERE UPPER(username) = UPPER(?) LIMIT 1',
      [username]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: `No se encontró la cuenta "${username}"` }, { status: 404 });
    }

    const acc = rows[0];
    return NextResponse.json({
      account: {
        id: acc.id,
        username: acc.username,
        dp: Number(acc.dp ?? 0),
        vp: Number(acc.vp ?? 0),
      },
    });
  } catch (error: any) {
    console.error('search-account error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
