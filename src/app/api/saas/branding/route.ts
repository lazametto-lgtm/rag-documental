import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBrandConfig } from '@/lib/saas/branding';

// GET /api/saas/branding — devuelve la config de branding
export async function GET() {
  const brand = getBrandConfig();
  return NextResponse.json(brand);
}
