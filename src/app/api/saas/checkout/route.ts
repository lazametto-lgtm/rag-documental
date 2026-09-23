import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLANS, STRIPE_PRICES } from '@/lib/saas/plans';

// POST /api/saas/checkout — inicia checkout de Stripe (real o demo)
export async function POST(req: Request) {
  try {
    const { planId, userId } = await req.json();
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });

    // Plan free: actualizar directamente
    if (plan.price === 0) {
      if (userId) {
        await db.subscription.update({
          where: { userId },
          data: { plan: 'free', maxQueries: plan.maxQueries, maxDocuments: plan.maxDocuments, maxChunks: plan.maxChunks, features: JSON.stringify(plan.features) },
        });
      }
      return NextResponse.json({ success: true, plan: 'free', redirectUrl: '/' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // ── MODO REAL CON STRIPE ──
    if (stripeKey && stripeKey !== 'demo') {
      const priceId = planId === 'pro' ? STRIPE_PRICES.pro : STRIPE_PRICES.enterprise;

      // Crear Checkout Session con la API REST de Stripe (sin SDK)
      const session = await createStripeSession(stripeKey, {
        priceId,
        userId: userId ?? 'guest',
        planId,
        successUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/?upgraded=${planId}`,
        cancelUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/?canceled=1`,
      });

      return NextResponse.json({
        success: true,
        url: session.url,  // Redirigir al usuario a Stripe Checkout
        plan: planId,
        planName: plan.name,
        price: plan.price,
      });
    }

    // ── MODO DEMO (sin Stripe) ──
    // En demo sin userId, igual devolvemos success para que el frontend actualice localStorage
    if (userId) {
      // Si hay userId, actualizar en DB
      await db.subscription.upsert({
        where: { userId },
        update: {
          plan: planId,
          maxQueries: plan.maxQueries,
          maxDocuments: plan.maxDocuments,
          maxChunks: plan.maxChunks,
          features: JSON.stringify(plan.features),
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        create: {
          userId,
          plan: planId,
          maxQueries: plan.maxQueries,
          maxDocuments: plan.maxDocuments,
          maxChunks: plan.maxChunks,
          features: JSON.stringify(plan.features),
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return NextResponse.json({
      success: true,
      plan: planId,
      planName: plan.name,
      price: plan.price,
      redirectUrl: '/',
      demo: true,
      message: `Plan ${plan.name} activado (modo demo). Configura STRIPE_SECRET_KEY para cobros reales.`,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Crea una Stripe Checkout Session usando fetch (sin SDK de Stripe)
async function createStripeSession(secretKey: string, opts: {
  priceId: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; id: string }> {
  const params = new URLSearchParams({
    'mode': 'subscription',
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': '1',
    'success_url': opts.successUrl,
    'cancel_url': opts.cancelUrl,
    'client_reference_id': opts.userId,
    'metadata[planId]': opts.planId,
    'metadata[userId]': opts.userId,
    'allow_promotion_codes': 'true',
    'billing_address_collection': 'auto',
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe error: ${err}`);
  }

  const data = await res.json();
  return { url: data.url, id: data.id };
}
