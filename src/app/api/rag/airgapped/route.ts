import { NextResponse } from 'next/server';
import { AIR_GAPPED, AIR_GAPPED_INFO } from '@/lib/rag/airgapped';

// GET /api/rag/airgapped — devuelve el estado del modo air-gapped
export async function GET() {
  return NextResponse.json({
    ...AIR_GAPPED_INFO,
    env: {
      AIR_GAPPED: process.env.AIR_GAPPED ?? 'false',
      LLM_PROVIDER: process.env.LLM_PROVIDER ?? 'zai',
      OLLAMA_URL: process.env.OLLAMA_URL ?? 'http://localhost:11434',
      LOCAL_SERVER_URL: process.env.LOCAL_SERVER_URL ?? 'http://localhost:3031',
      HYBRID_SERVER_URL: process.env.HYBRID_SERVER_URL ?? 'http://localhost:3032',
      CHROMA_URL: process.env.CHROMA_URL ?? '',
      DATABASE_URL: process.env.DATABASE_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') ?? '',
    },
    layers: AIR_GAPPED
      ? [
          {
            name: 'Inferencia',
            services: ['Ollama (LLM)', 'Servidor local (z-ai-sdk)', 'Router híbrido (fallback)'],
            ports: [11434, 3031, 3032],
            external: false,
          },
          {
            name: 'Datos',
            services: ['PostgreSQL', 'ChromaDB (vector DB)', 'Almacenamiento de documentos'],
            ports: [5432, 8000],
            external: false,
          },
          {
            name: 'Aplicación',
            services: ['Next.js API', 'UI', 'Orquestación RAG'],
            ports: [3000],
            external: false,
          },
        ]
      : [],
  });
}
