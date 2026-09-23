// Servidor LLM local — expone z-ai-web-dev-sdk como API REST.
// Puerto: 3031. Compatible con Node.js (npm) y Bun.
// Funciona con: npx tsx index.ts  o  npx tsx watch index.ts

import ZAI from 'z-ai-web-dev-sdk';
import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = 3031;
let zaiClient: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient() {
  if (!zaiClient) {
    console.log('[llm-local] Inicializando ZAI SDK...');
    zaiClient = await ZAI.create();
    console.log('[llm-local] ZAI SDK listo.');
  }
  return zaiClient;
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: ServerResponse, status: number, data: any) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    if (!body.messages?.length) {
      return sendJson(res, 400, { error: 'messages es requerido' });
    }

    const client = await getClient();
    const mapped = body.messages.map((m: any) => ({
      role: m.role === 'system' ? 'assistant' : m.role,
      content: m.content,
    }));

    const completion = await client.chat.completions.create({
      messages: mapped,
      thinking: { type: 'disabled' },
    });

    const content = completion.choices?.[0]?.message?.content ?? '';
    if (!content?.trim()) {
      return sendJson(res, 502, { error: 'Respuesta vacía' });
    }

    return sendJson(res, 200, {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'zai-local',
      choices: [
        { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
      ],
      usage: {
        prompt_tokens: body.messages.reduce((s: number, m: any) => s + Math.ceil(m.content.length / 4), 0),
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil(
          (body.messages.reduce((s: number, m: any) => s + m.content.length, 0) + content.length) / 4,
        ),
      },
    });
  } catch (err) {
    return sendJson(res, 500, { error: (err as Error).message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    return res.end();
  }

  // Health check
  if (url.pathname === '/health' || url.pathname === '/') {
    return sendJson(res, 200, { status: 'ok', service: 'llm-local', port: PORT });
  }

  // Modelos
  if (url.pathname === '/v1/models' && req.method === 'GET') {
    return sendJson(res, 200, {
      object: 'list',
      data: [{ id: 'zai-local', object: 'model', owned_by: 'zai' }],
    });
  }

  // Chat completions
  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    return handleChat(req, res);
  }

  return sendJson(res, 404, { error: 'Not found', path: url.pathname });
});

server.listen(PORT, () => {
  console.log(`[llm-local] ✅ Servidor listo en http://localhost:${PORT}`);
  console.log(`[llm-local] Endpoints: GET /health · GET /v1/models · POST /v1/chat/completions`);
});
