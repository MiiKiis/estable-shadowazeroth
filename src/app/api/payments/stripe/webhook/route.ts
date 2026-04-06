import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authPool } from '@/lib/db';
import { executeSoapCommand } from '@/lib/soap';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  let event: Stripe.Event;

  try {
    // Para Next.js App Router usamos req.text() para obtener el raw body exacto.
    const rawBody = await req.text();
    
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } else {
      // Si no hay firma, parseamos el JSON directamente (útil solo para pruebas manuales si no usas Stripe CLI).
      event = JSON.parse(rawBody);
    }
  } catch (err: any) {
    console.error('❌ Error de firma en Webhook:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Manejamos solo el evento de pago completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extracción de metadatos (asegúrate de que coincidan con los de checkout/route.ts)
    const userId = session.metadata?.userId;
    const username = session.metadata?.username || 'Usuario';
    const points = Number(session.metadata?.points || 0);

    console.log(`💳 Procesando pago Stripe: ${username} (ID: ${userId}) | Puntos: ${points}`);

    if (!userId || points <= 0) {
       console.error('❌ Webhook de Stripe sin metadatos válidos (userId o points missing).');
       return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    try {
      // 1. Añadimos los créditos DP en la base de datos de Auth (acore_auth)
      const [result]: any = await authPool.query(
        'UPDATE account SET dp = dp + ? WHERE id = ?',
        [points, Number(userId)]
      );

      if (result.affectedRows === 0) {
        console.error(`❌ Usuario ID ${userId} no encontrado al intentar añadir créditos.`);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      console.log(`✅ Créditos (${points} DP) entregados en DB a: ${username}`);

      // 2. Ejecutamos comandos SOAP (Notification & Confirmation)
      // Usamos el username (account name) para notificar al jugador si está conectado.
      try {
        // Commando: .announce - Avisa a todo el servidor (opcional, como agradecimiento público)
        // Commando: .send mail - Por si quieres que le llegue un aviso In-game
        
        const announceCmd = `.announce ¡La cuenta ${username} ha realizado una donacion y ha recibido ${points} DP! ¡Gracias por el apoyo a Shadow Azeroth!`;
        await executeSoapCommand(announceCmd);
        
        // También puedes enviar un comando personalizado si tienes un módulo de créditos que use SOAP
        // Por ahora, usamos el aviso público y log.
        console.log(`📣 Notificación SOAP enviada para: ${username}`);
      } catch (soapError: any) {
        // No fallamos el webhook si solo falla la notificación SOAP, 
        // ya que los puntos ya se guardaron en la DB.
        console.warn('⚠️ Alerta: Los puntos se entregaron en la DB pero falló la notificación SOAP:', soapError.message);
      }

    } catch (dbError: any) {
      console.error('❌ Error de base de datos en Webhook de Stripe:', dbError.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
