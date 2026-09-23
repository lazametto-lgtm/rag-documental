// Middleware de límites de uso por plan.
// Verifica que el usuario no haya excedido su cuota mensual.

import { db } from '@/lib/db';
import { getPlan } from './plans';

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  remaining: number;
}

export async function checkUsageLimit(
  userId: string | null,
  type: 'query' | 'ingest' | 'search' | 'eval',
): Promise<UsageCheckResult> {
  // Si no hay userId (modo demo sin auth), permitir todo
  if (!userId) {
    return { allowed: true, current: 0, limit: -1, remaining: -1 };
  }

  // Obtener la suscripción del usuario
  const sub = await db.subscription.findUnique({ where: { userId } });
  const planId = sub?.plan ?? 'free';
  const plan = getPlan(planId);

  // Mapear tipo a límite
  let limit: number;
  switch (type) {
    case 'query':
      limit = plan.maxQueries;
      break;
    case 'ingest':
      limit = plan.maxDocuments;
      break;
    default:
      limit = plan.maxQueries;
  }

  // -1 = ilimitado
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, remaining: -1 };
  }

  // Contar uso del mes actual
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await db.usageLog.count({
    where: {
      userId,
      type,
      createdAt: { gte: startOfMonth },
    },
  });

  const remaining = Math.max(0, limit - count);
  const allowed = count < limit;

  return {
    allowed,
    reason: !allowed ? `Has alcanzado el límite de ${limit} ${type}s del plan ${plan.name}` : undefined,
    current: count,
    limit,
    remaining,
  };
}

// Registra un uso en el log
export async function logUsage(
  userId: string | null,
  type: 'query' | 'ingest' | 'search' | 'eval',
  detail?: string,
  tokensIn = 0,
  tokensOut = 0,
  cost = 0,
): Promise<void> {
  if (!userId) return; // No registrar si no hay usuario (demo)
  try {
    await db.usageLog.create({
      data: { userId, type, detail, tokensIn, tokensOut, cost },
    });
  } catch {
    // No bloquear el flujo si falla el log
  }
}

// Obtiene el resumen de uso del mes actual
export async function getUsageSummary(userId: string | null) {
  if (!userId) return null;

  const sub = await db.subscription.findUnique({ where: { userId } });
  const planId = sub?.plan ?? 'free';
  const plan = getPlan(planId);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [queries, ingests, searches, evals] = await Promise.all([
    db.usageLog.count({ where: { userId, type: 'query', createdAt: { gte: startOfMonth } } }),
    db.usageLog.count({ where: { userId, type: 'ingest', createdAt: { gte: startOfMonth } } }),
    db.usageLog.count({ where: { userId, type: 'search', createdAt: { gte: startOfMonth } } }),
    db.usageLog.count({ where: { userId, type: 'eval', createdAt: { gte: startOfMonth } } }),
  ]);

  return {
    plan: planId,
    planName: plan.name,
    price: plan.price,
    usage: {
      queries: { current: queries, limit: plan.maxQueries },
      documents: { current: ingests, limit: plan.maxDocuments },
      searches: { current: searches, limit: plan.maxQueries },
      evaluations: { current: evals, limit: plan.maxQueries },
    },
    features: plan.features,
  };
}
