import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const defaultFrom = process.env.RESEND_FROM || 'Shadow Azeroth <onboarding@resend.dev>';
const pinTemplateId = process.env.RESEND_TEMPLATE_PIN_ID || '7d7e25cd-f80f-4823-a318-c198536244bd';
const recruitTemplateId = process.env.RESEND_TEMPLATE_RECRUIT_ID || '';
const creationTemplateRef = process.env.RESEND_TEMPLATE_CREATION_ID || process.env.RESEND_TEMPLATE_CORREO_CREACION_ID || '';
const recoveryTemplateRef = process.env.RESEND_TEMPLATE_RECOVERY_ID || process.env.RESEND_TEMPLATE_RECUPERACION_CODE_ID || '';

function canSendEmail() {
  return Boolean(resend);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyTemplateData(html: string, values: Record<string, string>): string {
  let out = html;
  for (const [key, value] of Object.entries(values)) {
    const safeKey = escapeRegExp(key);
    out = out
      .replace(new RegExp(`{{\\s*${safeKey}\\s*}}`, 'g'), value)
      .replace(new RegExp(`\\[\\[\\s*${safeKey}\\s*\\]\\]`, 'g'), value);
  }
  return out;
}

async function getResendTemplateHtml(templateRef: string): Promise<string> {
  const ref = String(templateRef || '').trim();
  if (!ref || !resend) return '';

  try {
    const direct = await resend.templates.get(ref);
    const directHtml = String(((direct as any)?.data?.html) || '').trim();
    if (directHtml) return directHtml;
  } catch {
    // Continue with search by template name.
  }

  try {
    const list: any = await resend.templates.list();
    const rows = Array.isArray(list?.data?.data) ? list.data.data : (Array.isArray(list?.data) ? list.data : []);
    const target = ref.toLowerCase();
    const found = rows.find((row: any) => String(row?.name || '').trim().toLowerCase() === target)
      || rows.find((row: any) => String(row?.name || '').trim().toLowerCase().includes(target));

    if (!found?.id) return '';
    const byName = await resend.templates.get(String(found.id));
    return String(((byName as any)?.data?.html) || '').trim();
  } catch {
    return '';
  }
}

export async function sendWelcomeEmail(params: {
  email: string;
  username: string;
}) {
  if (!canSendEmail()) return { skipped: true };

  let htmlContent = '';
  if (creationTemplateRef) {
    htmlContent = await getResendTemplateHtml(creationTemplateRef);
    if (htmlContent) {
      htmlContent = applyTemplateData(htmlContent, {
        ACCOUNT_NAME: params.username,
        USERNAME: params.username,
      });
    }
  }

  await resend!.emails.send({
    from: defaultFrom,
    to: params.email,
    subject: 'Bienvenido a Shadow Azeroth',
    html: htmlContent || `
      <div style="font-family:Arial,sans-serif;background:#090812;color:#f8fafc;padding:24px;line-height:1.6;">
        <div style="max-width:640px;margin:0 auto;background:#120b1f;border:1px solid rgba(168,85,247,.35);border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(90deg,#28103d,#101828);">
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">Bienvenido a Shadow Azeroth</h1>
            <p style="margin:8px 0 0;color:#cbd5e1;">Tu cuenta ha sido creada correctamente.</p>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;">Hola <strong>${params.username}</strong>,</p>
            <p style="margin:0 0 12px;">Ya puedes iniciar sesion en la web y acceder a tu panel, armoria, tienda y funciones de cuenta.</p>
            <p style="margin:0 0 12px;">Recuerda mantener segura tu contraseña y tu PIN de 4 digitos.</p>
            <p style="margin:16px 0 0;color:#67e8f9;font-weight:700;">Lok'tar ogar.</p>
          </div>
        </div>
      </div>
    `,
  });

  return { skipped: false };
}

export async function sendPasswordChangedEmail(params: {
  email: string;
  username: string;
}) {
  if (!canSendEmail()) return { skipped: true };

  await resend!.emails.send({
    from: defaultFrom,
    to: params.email,
    subject: 'Cambio de contraseña en Shadow Azeroth',
    html: `
      <div style="font-family:Arial,sans-serif;background:#090812;color:#f8fafc;padding:24px;line-height:1.6;">
        <div style="max-width:640px;margin:0 auto;background:#120b1f;border:1px solid rgba(34,211,238,.35);border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(90deg,#06263d,#101828);">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Tu contraseña fue actualizada</h1>
            <p style="margin:8px 0 0;color:#cbd5e1;">Notificacion de seguridad de cuenta.</p>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;">Hola <strong>${params.username}</strong>,</p>
            <p style="margin:0 0 12px;">Te confirmamos que la contraseña de tu cuenta fue cambiada correctamente.</p>
            <p style="margin:0 0 12px;">Si no realizaste este cambio, debes revisar tu acceso inmediatamente.</p>
            <p style="margin:16px 0 0;color:#67e8f9;font-weight:700;">Shadow Azeroth Security</p>
          </div>
        </div>
      </div>
    `,
  });

  return { skipped: false };
}

/**
 * Envia el correo de confirmacion con el PIN de seguridad del usuario.
 */
export async function sendPinReminderEmail(toEmail: string, accountName: string, pinCode: string) {
  if (!canSendEmail()) return { skipped: true };

  let htmlContent = '';

  try {
    const templateResponse = await resend!.templates.get(pinTemplateId);
    if ('data' in templateResponse && templateResponse.data) {
      const templateData = templateResponse.data as { html?: string };
      const templateHtml = String(templateData.html || '').trim();
      if (templateHtml) {
        htmlContent = templateHtml;
      }
    }
  } catch (templateError: unknown) {
    console.warn('No se pudo obtener plantilla de Resend, se usara fallback local:', templateError);
  }

  if (!htmlContent) {
    const templatePath = path.join(process.cwd(), 'shadow-azeroth-email.html');
    htmlContent = fs.readFileSync(templatePath, 'utf-8');
  }

  htmlContent = htmlContent
    .replace(/{{ACCOUNT_NAME}}/g, accountName)
    .replace(/{{PIN_CODE}}/g, pinCode);

  const { data, error } = await resend!.emails.send({
    from: process.env.RESEND_FROM || 'Shadow Azeroth <noreply@shadowazeroth.com>',
    to: [toEmail],
    subject: `Tu PIN de seguridad, ${accountName}`,
    html: htmlContent,
  });

  if (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }

  console.log(`Email enviado a ${toEmail} | ID: ${data?.id || 'sin-id'}`);
  return data;
}

export async function sendPasswordRecoveryEmail(params: {
  email: string;
  username: string;
  newToken: string;
}) {
  if (!canSendEmail()) return { skipped: true };

  let htmlContent = '';
  if (recoveryTemplateRef) {
    htmlContent = await getResendTemplateHtml(recoveryTemplateRef);
    if (htmlContent) {
      htmlContent = applyTemplateData(htmlContent, {
        ACCOUNT_NAME: params.username,
        USERNAME: params.username,
        RECOVERY_CODE: params.newToken,
        NEW_TOKEN: params.newToken,
      });
    }
  }

  await resend!.emails.send({
    from: defaultFrom,
    to: params.email,
    subject: 'Recuperación de cuenta - Shadow Azeroth',
    html: htmlContent || `
      <div style="font-family:Arial,sans-serif;background:#090812;color:#f8fafc;padding:24px;line-height:1.6;">
        <div style="max-width:640px;margin:0 auto;background:#120b1f;border:1px solid rgba(251,146,60,.35);border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(90deg,#3d2206,#101828);">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Recuperación de Contraseña</h1>
            <p style="margin:8px 0 0;color:#cbd5e1;">Has solicitado recuperar tu cuenta.</p>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;">Hola <strong>${params.username}</strong>,</p>
            <p style="margin:0 0 12px;">Tu contraseña ha sido reseteada por razones de seguridad. Usa la siguiente contraseña provisional para ingresar al servidor y a la web:</p>
            
            <div style="margin:24px 0;padding:16px;background:#090812;border:1px solid rgba(251,146,60,.4);border-radius:12px;text-align:center;">
              <span style="font-family:monospace;font-size:24px;font-weight:bold;color:#fcd34d;letter-spacing:2px;">${params.newToken}</span>
            </div>
            
            <p style="margin:0 0 12px;">Te recomendamos encarecidamente cambiar esta contraseña por una tuya desde el Panel de Usuario una vez inicies sesión.</p>
            <p style="margin:16px 0 0;color:#fcd34d;font-weight:700;">El equipo de Shadow Azeroth</p>
          </div>
        </div>
      </div>
    `,
  });

  return { skipped: false };
}

export async function sendRecruitInviteEmail(params: {
  toEmail: string;
  friendName: string;
  recruiterUsername: string;
  inviteUrl: string;
  referralId: number;
  inviteToken?: string;
}) {
  if (!canSendEmail()) return { skipped: true };

  const referralIdText = String(Math.trunc(Number(params.referralId || 0)) || '');
  const inviteTokenText = String(params.inviteToken || '').trim();
  const templateValues = {
    ACCOUNT_NAME: params.friendName,
    FRIEND_NAME: params.friendName,
    RECRUITER_NAME: params.recruiterUsername,
    INVITE_URL: params.inviteUrl,
    RECRUITMENT_ID: referralIdText,
    REFERRAL_ID: referralIdText,
    INVITE_TOKEN: inviteTokenText,
  };

  let htmlContent = '';

  if (recruitTemplateId) {
    htmlContent = await getResendTemplateHtml(recruitTemplateId);
    if (htmlContent) {
      htmlContent = applyTemplateData(htmlContent, templateValues);
    }
  }

  const { data, error } = await resend!.emails.send({
    from: defaultFrom,
    to: params.toEmail,
    subject: 'Invitacion a Shadow Azeroth - Recluta un Amigo',
    html: htmlContent || `
      <div style="font-family:Arial,sans-serif;background:#090812;color:#f8fafc;padding:24px;line-height:1.6;">
        <div style="max-width:640px;margin:0 auto;background:#120b1f;border:1px solid rgba(56,189,248,.35);border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(90deg,#06263d,#101828);">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Recluta un Amigo</h1>
            <p style="margin:8px 0 0;color:#cbd5e1;">${params.recruiterUsername} te invito a jugar en Shadow Azeroth.</p>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;">Hola <strong>${params.friendName}</strong>,</p>
            <p style="margin:0 0 12px;">Usa este enlace especial para crear tu cuenta vinculada al sistema de reclutamiento.</p>
            <p style="margin:0 0 12px;">ID de reclutamiento: <strong>${referralIdText || 'N/A'}</strong></p>
            <div style="margin:20px 0;">
              <a href="${params.inviteUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Crear Cuenta Vinculada</a>
            </div>
            ${inviteTokenText ? `<p style="margin:0 0 12px;color:#93c5fd;">Token de invitacion: <strong>${inviteTokenText}</strong></p>` : ''}
            <p style="margin:0 0 12px;color:#cbd5e1;">Beneficios al reclutarte: recibiras 4 bolsas de bienvenida + 300g para reclamar desde el panel web y elegir el personaje destino.</p>
            <p style="margin:0;color:#67e8f9;font-weight:700;">Nos vemos en Azeroth.</p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw error;
  }

  return { skipped: false, id: data?.id || null };
}
