import { NextRequest, NextResponse } from 'next/server';

const ROLE_LABELS: Record<string, string> = {
  developer: '🛠️ Developer / Programador',
  gamemaster: '⚔️ Game Master',
  moderator: '🎭 Moderador / Eventos',
  support: '💙 Soporte Técnico',
};

const ROLE_COLORS: Record<string, number> = {
  developer: 0xFFD700,   // Dorado
  gamemaster: 0x8B0000,  // Rojo oscuro
  moderator: 0xBF00FF,   // Morado neón
  support: 0x5DADE2,     // Azul claro
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, answers, discord, edad, country, whatsapp, disponibilidad, experiencia } = body;

    if (!role || !ROLE_LABELS[role]) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // Build Discord embed fields from the submitted form answers
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: '📋 Rol Solicitado', value: ROLE_LABELS[role], inline: false },
      { name: '🎮 Usuario de Discord', value: discord || 'No especificado', inline: true },
      { name: '🎂 Edad', value: edad || 'No especificada', inline: true },
      { name: '🌍 País', value: country || 'No especificado', inline: true },
      { name: '📱 WhatsApp / Contacto', value: whatsapp || 'No especificado', inline: true },
      { name: '⏰ Disponibilidad', value: disponibilidad || 'No especificada', inline: true },
      { name: '📖 Experiencia Previa', value: experiencia || 'Sin experiencia previa indicada', inline: false },
    ];

    // Add role-specific answers
    if (answers && typeof answers === 'object') {
      for (const [key, val] of Object.entries(answers)) {
        fields.push({
          name: key,
          value: String(val).substring(0, 1024) || 'Sin respuesta',
          inline: false,
        });
      }
    }

    const webhookUrl = process.env.DISCORD_STAFF_WEBHOOK;
    if (!webhookUrl) {
      console.error('DISCORD_STAFF_WEBHOOK no configurado');
      return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
    }

    const embed = {
      title: `📨 Nueva Postulación — ${ROLE_LABELS[role]}`,
      color: ROLE_COLORS[role],
      fields,
      footer: {
        text: 'Shadow Azeroth — Sistema de Postulaciones',
      },
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Shadow Azeroth Staff',
        avatar_url: 'https://i.imgur.com/4M34hi2.png',
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error('Error al enviar a Discord:', errText);
      return NextResponse.json({ error: 'Error al enviar a Discord' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error en /api/staff/apply:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
