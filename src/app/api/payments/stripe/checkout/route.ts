import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, username, amount, points, plan } = body;

    if (!userId || !amount || !points) {
      return NextResponse.json({ error: 'Faltan datos requeridos (userId, amount o points)' }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
       return NextResponse.json({ error: 'Stripe API no configurada correctamente' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${points} Créditos DP (${plan})`,
              description: `Compra de ${points} DP (Donation Points) para la cuenta: ${username} (ID: ${userId})`,
              images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/coin.png`],
            },
            unit_amount: Math.round(amount * 100), // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/success',
      cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/cancel',
      client_reference_id: String(userId),
      metadata: {
        userId: String(userId),
        username: String(username),
        points: String(points),
        amount: String(amount),
      },
      customer_email: undefined, // Let user enter email on Stripe checkout or use user's email if available
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar pago' }, { status: 500 });
  }
}
