// Router LLM híbrido — balancea entre servidores con fallback automático.
// Puerto: 3032. Compatible con Node.js (npm) y Bun.
// Funciona con: npx tsx index.ts  o  npx tsx watch index.ts

import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = 3032;
const LOCAL_URL = 'http://localhost:3031';
const OLLAMA_URL = 'http://localhost:11434';
const API_URL = 'https://api.openai.com/v1';

const status = {
  local: { available: false, requests: 0, failures: 0, avgLatency: 0 },
  ollama: { available: false, requests: 0, failures: 0, avgLatency: 0 },
  api: { available: false, requests: 0, failures: 0, avgLatency: 0 },
};

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-LLM-Strategy, X-Ollama-URL, X-Ollama-Model, X-API-URL, X-API-Key, X-API-Model');
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function callLocal(body: any): Promise<string> {
  const start = Date.now();
  const res = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Local ${res.status}`);
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content?.trim()) throw new Error('Local: vacío');
  status.local.avgLatency = Date.now() - start;
  return content;
}

async function callOllama(body: any, url: string, model: string): Promise<string> {
  const start = Date.now();
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: body.messages, stream: false, options: { temperature: body.temperature ?? 0.2 } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data: any = await res.json();
  const content = data?.message?.content ?? '';
  if (!content?.trim()) throw new Error('Ollama: vacío');
  status.ollama.avgLatency = Date.now() - start;
  return content;
}

async function callApi(body: any, url: string, apiKey: string, model: string): Promise<string> {
  if (!apiKey) throw new Error('API: falta key');
  const start = Date.now();
  const res = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: body.messages, temperature: body.temperature ?? 0.2 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content?.trim()) throw new Error('API: vacío');
  status.api.avgLatency = Date.now() - start;
  return content;
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    if (!body.messages?.length) return sendJson(res, 400, { error: 'messages requerido' });

    const strategy = req.headers['x-llm-strategy'] ?? 'auto';
    const ollamaUrl = (req.headers['x-ollama-url'] as string) ?? OLLAMA_URL;
    const ollamaModel = (req.headers['x-ollama-model'] as string) ?? 'llama3';
    const apiUrl = (req.headers['x-api-url'] as string) ?? API_URL;
    const apiKey = (req.headers['x-api-key'] as string) ?? '';
    const apiModel = (req.headers['x-api-model'] as string) ?? 'gpt-4o-mini';

    const attempts: Array<{ name: 'local' | 'ollama' | 'api'; fn: () => Promise<string> }> = [];
    if (strategy === 'local') attempts.push({ name: 'local', fn: () => callLocal(body) });
    else if (strategy === 'ollama') attempts.push({ name: 'ollama', fn: () => callOllama(body, ollamaUrl, ollamaModel) });
    else if (strategy === 'api') attempts.push({ name: 'api', fn: () => callApi(body, apiUrl, apiKey, apiModel) });
    else {
      attempts.push({ name: 'local', fn: () => callLocal(body) });
      attempts.push({ name: 'ollama', fn: () => callOllama(body, ollamaUrl, ollamaModel) });
      attempts.push({ name: 'api', fn: () => callApi(body, apiUrl, apiKey, apiModel) });
    }

    let lastError: Error | null = null;
    for (const a of attempts) {
      try {
        status[a.name].requests++;
        const content = await a.fn();
        status[a.name].available = true;
        console.log(`[hybrid] ✓ ${a.name} respondió en ${status[a.name].avgLatency}ms`);
        return sendJson(res, 200, {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: a.name,
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          provider: a.name,
          latency_ms: status[a.name].avgLatency,
        });
      } catch (err) {
        status[a.name].failures++;
        status[a.name].available = false;
        lastError = err as Error;
        console.log(`[hybrid] ✗ ${a.name}: ${(err as Error).message}`);
      }
    }
    return sendJson(res, 503, { error: 'Todos fallaron', lastError: lastError?.message });
  } catch (err) {
    return sendJson(res, 500, { error: (err as Error).message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    return res.end();
  }

  if (url.pathname === '/health' || url.pathname === '/') {
    return sendJson(res, 200, { status: 'ok', service: 'llm-hybrid', port: PORT });
  }

  if (url.pathname === '/status') {
    return sendJson(res, 200, { providers: status, strategy: 'auto' });
  }

  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    return handleChat(req, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[hybrid] ✅ Router listo en http://localhost:${PORT}`);
  console.log(`[hybrid] Estrategia: auto (local → ollama → api)`);
  console.log(`[hybrid] Endpoints: GET /health · GET /status · POST /v1/chat/completions`);
});
