import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { calculateVerifier, calculateVerifierLegacy } from '@/lib/srp6';
import { sendPasswordChangedEmail } from '@/lib/email';
import { RowDataPacket } from 'mysql2';

function toBinaryBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex');
    }
    return Buffer.from(trimmed, 'binary');
  }
  throw new Error('Formato de credenciales SRP6 no soportado');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId = Number(body?.accountId);
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    const pin = String(body?.pin || '').trim();

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId invalido' }, { status: 400 });
    }

    if (!currentPassword || !newPassword || !pin) {
      return NextResponse.json({ error: 'Completa todos los campos' }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN invalido. Debe ser de 4 digitos.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    if (!authPool) {
      return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
    }

    interface AccountRow extends RowDataPacket {
      id: number;
      username: string;
      email: string;
      salt: string | Buffer;
      verifier: string | Buffer;
    }

    const [rows] = await authPool.query<AccountRow[]>(
      'SELECT id, username, email, salt, verifier FROM account WHERE id = ? LIMIT 1',
      [accountId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const account = rows[0];
    const salt = toBinaryBuffer(account.salt);
    const storedVerifier = toBinaryBuffer(account.verifier);

    const verifier = calculateVerifier(account.username, currentPassword, salt);
    const legacyVerifier = calculateVerifierLegacy(account.username, currentPassword, salt);

    if (!verifier.equals(storedVerifier) && !legacyVerifier.equals(storedVerifier)) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
    }

    interface PinRow extends RowDataPacket {
      pin_salt: string | Buffer;
      pin_hash: string | Buffer;
    }

    const [pinRows] = await authPool.query<PinRow[]>(
      'SELECT pin_salt, pin_hash FROM account_security_pin WHERE account_id = ? LIMIT 1',
      [accountId]
    );

    if (!pinRows || pinRows.length === 0) {
      return NextResponse.json({ error: 'Tu cuenta no tiene PIN configurado.' }, { status: 403 });
    }

    const pinSalt = toBinaryBuffer(pinRows[0].pin_salt);
    const storedPinHash = toBinaryBuffer(pinRows[0].pin_hash);
    const providedPinHash = crypto
      .createHash('sha256')
      .update(pinSalt)
      .update(pin)
      .digest();

    if (!crypto.timingSafeEqual(storedPinHash, providedPinHash)) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    const newSalt = crypto.randomBytes(32);
    const newVerifier = calculateVerifier(account.username, newPassword, newSalt);

    await authPool.query(
      'UPDATE account SET salt = ?, verifier = ? WHERE id = ? LIMIT 1',
      [newSalt, newVerifier, accountId]
    );

    const accountEmail = String(account.email || '').trim();
    if (accountEmail) {
      try {
        await sendPasswordChangedEmail({
          email: accountEmail,
          username: String(account.username || ''),
        });
      } catch (mailError) {
        console.error('Password changed email error:', mailError);
      }
    }

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' }, { status: 200 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error del servidor';
    console.error('Account password API error:', error);
    return NextResponse.json(
      { error: 'Error del servidor', details: errorMsg },
      { status: 500 }
    );
  }
}
