import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { buildRecruitInviteToken, ensureRecruitTables } from '@/lib/recruitAFriend';
import { sendRecruitInviteEmail } from '@/lib/email';

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const recruiterAccountId = Number(body?.recruiterAccountId || 0);
    const friendName = String(body?.friendName || '').trim();
    const friendEmail = normalizeEmail(String(body?.friendEmail || ''));

    if (!Number.isInteger(recruiterAccountId) || recruiterAccountId <= 0) {
      return NextResponse.json({ error: 'recruiterAccountId invalido' }, { status: 400 });
    }
    if (friendName.length < 2) {
      return NextResponse.json({ error: 'Nombre del amigo invalido' }, { status: 400 });
    }
    if (!isValidEmail(friendEmail)) {
      return NextResponse.json({ error: 'Correo del amigo invalido' }, { status: 400 });
    }

    connection = await authPool.getConnection();
    await ensureRecruitTables(connection);

    const [accRows]: any = await connection.query(
      'SELECT id, username FROM account WHERE id = ? LIMIT 1',
      [recruiterAccountId]
    );
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Cuenta reclutadora no encontrada' }, { status: 404 });
    }

    const recruiterUsername = String(accRows[0].username || '').trim() || `Cuenta ${recruiterAccountId}`;

    const inviteToken = buildRecruitInviteToken();
    const [insertResult]: any = await connection.query(
      `INSERT INTO recruit_a_friend_referrals
       (recruiter_account_id, recruiter_username, friend_name, friend_email, invite_token)
       VALUES (?, ?, ?, ?, ?)`,
      [recruiterAccountId, recruiterUsername, friendName, friendEmail, inviteToken]
    );
    const referralId = Number(insertResult?.insertId || 0);
    if (!Number.isInteger(referralId) || referralId <= 0) {
      throw new Error('No se pudo obtener la ID de reclutamiento creada.');
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || new URL(request.url).origin;
    const inviteUrl = `${appBaseUrl}/?ref=${encodeURIComponent(inviteToken)}&rid=${referralId}&register=1`;

    let emailDeliveryId: string | null = null;
    try {
      const emailResult = await sendRecruitInviteEmail({
        toEmail: friendEmail,
        friendName,
        recruiterUsername,
        inviteUrl,
        referralId,
        inviteToken,
      });
      if (emailResult?.skipped) {
        return NextResponse.json(
          {
            error: 'Servicio de correo no configurado. Configura RESEND_API_KEY para enviar la invitacion por email.',
            inviteUrl,
            referralId,
          },
          { status: 503 }
        );
      }
      emailDeliveryId = (emailResult as any)?.id || null;
    } catch (emailError) {
      console.error('Recruit invite email error:', emailError);
      return NextResponse.json(
        {
          error: 'La invitacion fue creada, pero no se pudo enviar el correo de reclutamiento.',
          inviteUrl,
          referralId,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitacion enviada correctamente.',
      inviteUrl,
      referralId,
      emailDeliveryId,
    });
  } catch (error: any) {
    console.error('Recruit invite POST error:', error);
    return NextResponse.json({ error: 'Error creando invitacion', details: error?.message || 'Error desconocido' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
