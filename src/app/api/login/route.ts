import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { calculateVerifier, calculateVerifierLegacy } from '@/lib/srp6';
import { RowDataPacket } from 'mysql2';

function toBinaryBuffer(value: unknown): Buffer {
  if (!value) return Buffer.alloc(32);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && (trimmed.length === 64 || trimmed.length % 2 === 0)) {
      return Buffer.from(trimmed, 'hex');
    }
    return Buffer.from(trimmed, 'binary');
  }
  // Try to convert to string if it's something else
  try {
    const str = String(value);
    return Buffer.from(str, 'binary');
  } catch {
    throw new Error('Formato de credenciales SRP6 no soportado en base de datos');
  }
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const normalizedUsername = String(username || '').trim();

    if (!normalizedUsername || !password) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    // 1. Get account from acore_auth
    if (!authPool) {
      return NextResponse.json({ error: 'Base de datos de autenticación no disponible' }, { status: 500 });
    }

    interface AccountRow extends RowDataPacket {
      id: number;
      username: string;
      salt: string | Buffer;
      verifier: string | Buffer;
    }

    const [rows] = await authPool.query<AccountRow[]>(
      'SELECT id, username, salt, verifier FROM account WHERE UPPER(username) = UPPER(?)',
      [normalizedUsername]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    }

    const account = rows[0];

    try {
      // 2. Calculate verifier with provided password and stored salt
      // AzerothCore stores salt and verifier as binary (BLOB/VARBINARY)
      const storedSalt = toBinaryBuffer(account.salt);
      const storedVerifier = toBinaryBuffer(account.verifier);

      // Use canonical username from DB to avoid casing/spacing differences.
      const calculatedVerifier = calculateVerifier(account.username, password, storedSalt);
      const legacyCalculatedVerifier = calculateVerifierLegacy(account.username, password, storedSalt);

      // 3. Compare verifiers
      if (calculatedVerifier.equals(storedVerifier) || legacyCalculatedVerifier.equals(storedVerifier)) {
        // SUCCESS
        return NextResponse.json({ 
          success: true,
          message: 'Login successful',
          user: {
            id: account.id,
            username: account.username,
          }
        }, { status: 200 });
      } else {
        return NextResponse.json({ error: 'Código de acceso incorrecto' }, { status: 401 });
      }
    } catch (cryptoError: unknown) {
      const errorMsg = cryptoError instanceof Error ? cryptoError.message : 'Error desconocido';
      console.error('Crypto Error during login:', cryptoError);
      return NextResponse.json({ 
        error: 'Error al verificar credenciales',
        details: errorMsg 
      }, { status: 500 });
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error del servidor inesperado';
    console.error('Fatal Login Error:', error);
    return NextResponse.json({ 
      error: 'Error del servidor inesperado',
      details: errorMsg
    }, { status: 500 });
  }
}
