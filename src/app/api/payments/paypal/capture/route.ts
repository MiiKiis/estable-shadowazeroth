import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { executeSoapCommand } from '@/lib/soap';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API = process.env.PAYPAL_ENV === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const { orderID, userId, points } = await req.json();

    console.log(`💎 Solicitud de captura PayPal: Pedido ${orderID} | Usuario ${userId} | Puntos ${points}`);

    // Validación preventiva: Credenciales idénticas en .env.local
    if (PAYPAL_CLIENT_ID === PAYPAL_CLIENT_SECRET) {
      console.error('❌ Error de configuración: PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET son idénticos en .env.local');
      return NextResponse.json({ 
        error: 'Error de configuración en el servidor (PayPal Credentials)',
        details: 'El Client ID y el Secret son idénticos. Por favor corrige la línea 50 de .env.local.'
      }, { status: 500 });
    }

    if (!orderID || !userId || !points) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (orderID, userId o points)' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // 1. Capturar el pedido en PayPal
    const captureResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const captureData = await captureResponse.json();

    if (captureData.status === 'COMPLETED') {
        const transactionId = captureData.purchase_units[0].payments.captures[0].id;
        const amountFull = captureData.purchase_units[0].payments.captures[0].amount.value;

      console.log(`✅ Pago PayPal completado: ${amountFull} USD | Transacción: ${transactionId}`);

      // 2. Actualizar créditos en la base de datos acore_auth.account
      const [result]: any = await authPool.query(
        'UPDATE account SET dp = dp + ? WHERE id = ?',
        [Number(points), Number(userId)]
      );

      if (result.affectedRows === 0) {
        console.error(`❌ Usuario ID ${userId} no encontrado después del pago.`);
        return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
      }

      // 3. Obtener el nombre de usuario para la notificación SOAP
      let username = 'Jugador';
      try {
        const [rows]: any = await authPool.query('SELECT username FROM account WHERE id = ?', [userId]);
        if (rows.length > 0) username = rows[0].username;
      } catch (err) {
          console.warn('Error obteniendo username para SOAP:', err);
      }

      // 4. Ejecutar notificación SOAP
      try {
        const announceCmd = `.announce ¡La cuenta ${username} ha realizado una donación y ha recibido ${points} Créditos (DP)! ¡Gracias por el apoyo a Shadow Azeroth!`;
        await executeSoapCommand(announceCmd);
        console.log(`📣 Notificación SOAP enviada para: ${username}`);
      } catch (soapError: any) {
        console.warn('⚠️ Alerta: Los puntos se entregaron en la DB pero falló la notificación SOAP:', soapError.message);
      }

      return NextResponse.json({ 
        success: true, 
        message: '¡Pago recibido con éxito! Tus créditos han sido añadidos.',
        pointsAdded: points,
        transactionId
      });
    } else {
      console.error('❌ Estado de pago no completado:', captureData.status);
      return NextResponse.json({ error: 'El pago no ha sido completado en PayPal.', details: captureData }, { status: 400 });
    }
  } catch (error: any) {
    console.error('❌ Error crítico en captura PayPal:', error);
    return NextResponse.json({ error: 'Error interno del servidor al procesar el pago.', details: error.message }, { status: 500 });
  }
}
