import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// GET /api/download — descarga el ZIP del proyecto completo
export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), 'download', 'rag-documental.zip');
    const fileBuffer = await readFile(zipPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="rag-documental.zip"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'ZIP no encontrado. Ejecuta el script de build primero.' },
      { status: 404 },
    );
  }
}
