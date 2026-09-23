import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateLicenseKey } from '@/lib/saas/branding';
import { PLANS } from '@/lib/saas/plans';

// POST /api/saas/reseller — registrar un revendedor
export async function POST(req: Request) {
  try {
    const { email, name, company, commissionPct } = await req.json();
    if (!email || !name) {
      return NextResponse.json({ error: 'Email y nombre son requeridos' }, { status: 400 });
    }

    const existing = await db.reseller.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un revendedor con ese email' }, { status: 409 });
    }

    const reseller = await db.reseller.create({
      data: {
        email,
        name,
        company: company ?? null,
        commissionPct: commissionPct ?? 30,
        brandName: company ?? 'RAG Documental',
      },
    });

    return NextResponse.json({
      success: true,
      reseller: { id: reseller.id, email: reseller.email, name: reseller.name, commissionPct: reseller.commissionPct },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// GET /api/saas/reseller — lista revendedores o detalle de uno
export async function GET(req: Request) {
  const url = new URL(req.url);
  const resellerId = url.searchParams.get('id');

  if (resellerId) {
    // Detalle de un revendedor con sus licencias y clientes
    const reseller = await db.reseller.findUnique({
      where: { id: resellerId },
      include: {
        licenses: { orderBy: { createdAt: 'desc' }, take: 50 },
        customers: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!reseller) {
      return NextResponse.json({ error: 'Revendedor no encontrado' }, { status: 404 });
    }

    // Calcular ingresos del mes
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const activeLicenses = reseller.licenses.filter(l => l.status === 'active');
    const monthlyRevenue = activeLicenses.reduce((s, l) => s + l.monthlyFee, 0);
    const commission = monthlyRevenue * (reseller.commissionPct / 100);

    return NextResponse.json({
      reseller: {
        ...reseller,
        monthlyRevenue,
        commission,
        activeLicenses: activeLicenses.length,
      },
    });
  }

  // Lista de todos los revendedores
  const resellers = await db.reseller.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { licenses: true, customers: true } } },
  });

  return NextResponse.json({
    resellers: resellers.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      company: r.company,
      commissionPct: r.commissionPct,
      status: r.status,
      brandName: r.brandName,
      totalRevenue: r.totalRevenue,
      totalCustomers: r.totalCustomers,
      licenseCount: (r as any)._count?.licenses ?? 0,
      customerCount: (r as any)._count?.customers ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
