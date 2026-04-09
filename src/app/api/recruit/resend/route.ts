import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { ensureRecruitTables } from '@/lib/recruitAFriend';
import { sendRecruitInviteEmail } from '@/lib/email';

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof authPool.getConnection>> | null = null;

  try {
    const body = await request.json();
    const accountId = Number(body?.accountId || 0);
    const referralId = Number(body?.referralId || 0);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'accountId invalido' }, { status: 400 });
    }
    if (!Number.isInteger(referralId) || referralId <= 0) {
      return NextResponse.json({ error: 'referralId invalido' }, { status: 400 });
    }

    connection = await authPool.getConnection();
    await ensureRecruitTables(connection);

    const [rows]: any = await connection.query(
      `SELECT id, recruiter_account_id, recruiter_username, friend_name, friend_email,
              invite_token, status, recruited_account_id
       FROM recruit_a_friend_referrals
       WHERE id = ? AND recruiter_account_id = ?
       LIMIT 1`,
      [referralId, accountId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invitacion no encontrada para esta cuenta.' }, { status: 404 });
    }

    const referral = rows[0];
    if (String(referral.status || '') !== 'invited' || Number(referral.recruited_account_id || 0) > 0) {
      return NextResponse.json(
        { error: 'Solo se pueden reenviar invitaciones en estado invited.' },
        { status: 409 }
      );
    }

    const inviteToken = String(referral.invite_token || '').trim();
    if (!inviteToken) {
      return NextResponse.json({ error: 'La invitacion no tiene token valido.' }, { status: 500 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || new URL(request.url).origin;
    const inviteUrl = `${appBaseUrl}/?ref=${encodeURIComponent(inviteToken)}&rid=${Number(referral.id)}&register=1`;

    try {
      const emailResult = await sendRecruitInviteEmail({
        toEmail: String(referral.friend_email || '').trim().toLowerCase(),
        friendName: String(referral.friend_name || '').trim() || 'Aventurero',
        recruiterUsername: String(referral.recruiter_username || '').trim() || `Cuenta ${accountId}`,
        inviteUrl,
        referralId: Number(referral.id),
        inviteToken,
      });

      if (emailResult?.skipped) {
        return NextResponse.json(
          {
            error: 'Servicio de correo no configurado. Configura RESEND_API_KEY para reenviar invitaciones.',
            referralId: Number(referral.id),
            inviteUrl,
          },
          { status: 503 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Invitacion reenviada correctamente.',
        referralId: Number(referral.id),
        emailDeliveryId: (emailResult as any)?.id || null,
        inviteUrl,
      });
    } catch (emailError: any) {
      console.error('Recruit resend email error:', emailError);
      return NextResponse.json(
        {
          error: 'No se pudo reenviar el correo de reclutamiento.',
          referralId: Number(referral.id),
          inviteUrl,
          details: emailError?.message || 'Error desconocido',
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error('Recruit resend POST error:', error);
    return NextResponse.json({ error: 'Error reenviando invitacion', details: error?.message || 'Error desconocido' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
