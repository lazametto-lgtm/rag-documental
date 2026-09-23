import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUsageSummary } from '@/lib/saas/usage';
import { PLANS } from '@/lib/saas/plans';

// GET /api/saas/usage — resumen de uso del usuario
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (userId) {
    const usage = await getUsageSummary(userId);
    return NextResponse.json({ usage, plans: PLANS });
  }

  // Sin userId: devolver planes disponibles
  return NextResponse.json({ plans: PLANS });
}
