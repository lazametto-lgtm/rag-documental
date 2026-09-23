import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/auth/register — registra un usuario nuevo con plan free
export async function POST(req: Request) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password son requeridos' }, { status: 400 });
    }

    // Verificar si ya existe
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 });
    }

    // Crear usuario (en producción: hash con bcrypt)
    const user = await db.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash: Buffer.from(password).toString('base64'), // simplificado
        subscription: {
          create: {
            plan: 'free',
            maxQueries: 50,
            maxDocuments: 10,
            maxChunks: 200,
            features: JSON.stringify({ export: false, api: false, airgapped: false, eval: false, compare: false, voice: false, semanticSearch: false, abTest: false }),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
