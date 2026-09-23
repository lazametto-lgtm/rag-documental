import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateLicenseKey, isValidLicenseKeyFormat } from '@/lib/saas/branding';
import { PLANS } from '@/lib/saas/plans';

// POST /api/saas/license — generar una nueva licencia para un cliente
export async function POST(req: Request) {
  try {
    const { resellerId, customerName, customerEmail, plan, monthlyFee, expiresAt, instanceUrl, notes } = await req.json();

    if (!resellerId || !customerName || !customerEmail) {
      return NextResponse.json({ error: 'resellerId, customerName y customerEmail son requeridos' }, { status: 400 });
    }

    const reseller = await db.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller) {
      return NextResponse.json({ error: 'Revendedor no encontrado' }, { status: 404 });
    }

    const planData = PLANS.find((p) => p.id === (plan ?? 'pro')) ?? PLANS[1];
    const licenseKey = generateLicenseKey();
    const fee = monthlyFee ?? planData.price;

    const license = await db.license.create({
      data: {
        licenseKey,
        resellerId,
        customerName,
        customerEmail,
        plan: plan ?? 'pro',
        monthlyFee: fee,
        maxQueries: planData.maxQueries,
        maxDocuments: planData.maxDocuments,
        maxChunks: planData.maxChunks,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        instanceUrl: instanceUrl ?? null,
        notes: notes ?? null,
      },
    });

    // Actualizar stats del revendedor
    await db.reseller.update({
      where: { id: resellerId },
      data: {
        totalRevenue: { increment: fee },
        totalCustomers: { increment: 1 },
      },
    });

    // Crear cliente del revendedor
    await db.resellerCustomer.create({
      data: {
        resellerId,
        name: customerName,
        email: customerEmail,
        plan: plan ?? 'pro',
        monthlyFee: fee,
      },
    });

    return NextResponse.json({
      success: true,
      license: {
        id: license.id,
        licenseKey: license.licenseKey,
        customerName: license.customerName,
        customerEmail: license.customerEmail,
        plan: license.plan,
        monthlyFee: license.monthlyFee,
        expiresAt: license.expiresAt?.toISOString(),
        instanceUrl: license.instanceUrl,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// GET /api/saas/license — validar una licencia o listar licencias
export async function GET(req: Request) {
  const url = new URL(req.url);
  const licenseKey = url.searchParams.get('key');
  const resellerId = url.searchParams.get('resellerId');

  // Validar una licencia específica
  if (licenseKey) {
    if (!isValidLicenseKeyFormat(licenseKey)) {
      return NextResponse.json({ valid: false, error: 'Formato de licencia inválido' }, { status: 400 });
    }

    const license = await db.license.findUnique({
      where: { licenseKey },
      include: { reseller: true },
    });

    if (!license) {
      return NextResponse.json({ valid: false, error: 'Licencia no encontrada' }, { status: 404 });
    }

    const expired = license.expiresAt && license.expiresAt < new Date();
    const valid = license.status === 'active' && !expired;

    return NextResponse.json({
      valid,
      license: {
        licenseKey: license.licenseKey,
        customerName: license.customerName,
        customerEmail: license.customerEmail,
        plan: license.plan,
        monthlyFee: license.monthlyFee,
        maxQueries: license.maxQueries,
        maxDocuments: license.maxDocuments,
        maxChunks: license.maxChunks,
        status: license.status,
        expired: !!expired,
        expiresAt: license.expiresAt?.toISOString(),
        instanceUrl: license.instanceUrl,
        reseller: {
          name: license.reseller.name,
          company: license.reseller.company,
          brandName: license.reseller.brandName,
        },
      },
    });
  }

  // Listar licencias de un revendedor
  if (resellerId) {
    const licenses = await db.license.findMany({
      where: { resellerId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      licenses: licenses.map((l) => ({
        id: l.id,
        licenseKey: l.licenseKey,
        customerName: l.customerName,
        customerEmail: l.customerEmail,
        plan: l.plan,
        monthlyFee: l.monthlyFee,
        status: l.status,
        expiresAt: l.expiresAt?.toISOString(),
        instanceUrl: l.instanceUrl,
        notes: l.notes,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  }

  return NextResponse.json({ error: 'Proporciona ?key= o ?resellerId=' }, { status: 400 });
}

// PATCH /api/saas/license — revocar o actualizar una licencia
export async function PATCH(req: Request) {
  try {
    const { licenseKey, action } = await req.json();
    if (!licenseKey) {
      return NextResponse.json({ error: 'licenseKey es requerido' }, { status: 400 });
    }

    const license = await db.license.findUnique({ where: { licenseKey } });
    if (!license) {
      return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 });
    }

    if (action === 'revoke') {
      await db.license.update({
        where: { licenseKey },
        data: { status: 'revoked' },
      });
      // Actualizar stats del revendedor
      await db.reseller.update({
        where: { id: license.resellerId },
        data: {
          totalRevenue: { decrement: license.monthlyFee },
          totalCustomers: { decrement: 1 },
        },
      });
      return NextResponse.json({ success: true, message: 'Licencia revocada' });
    }

    if (action === 'renew') {
      await db.license.update({
        where: { licenseKey },
        data: {
          status: 'active',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({ success: true, message: 'Licencia renovada por 1 año' });
    }

    return NextResponse.json({ error: 'Acción no reconocida (use: revoke | renew)' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
