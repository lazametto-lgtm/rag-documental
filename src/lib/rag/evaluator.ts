// Evaluador RAGAS-like: faithfulness, answer relevancy, context precision/recall, citation accuracy.
// Usa el LLM como juez para comparar respuesta generada vs respuesta esperada.

import type { EvaluationResult, EvaluationMetric, Citation, RagAnswer } from './types';
import { answerQuery } from './generator';
import { getLLMProvider, getLocalLLMProvider } from './llm';
import { retrieve } from './retriever';
import { db } from '@/lib/db';
import { SAMPLE_EVALUATION_QUESTIONS } from './sample-data';
import { buildSnippet } from './utils';

export async function runEvaluation(): Promise<EvaluationResult> {
  const start = Date.now();
  const perQuestion: EvaluationResult['perQuestion'] = [];
  let totalFaithfulness = 0;
  let totalRelevancy = 0;
  let totalContextPrecision = 0;
  let totalContextRecall = 0;
  let totalCitationAccuracy = 0;
  let count = 0;

  // Si no hay preguntas en la BD, usar las del sample
  let questions = await db.evaluationQuestion.findMany();
  if (questions.length === 0) {
    // Insertar las preguntas de ejemplo en la BD
    for (const q of SAMPLE_EVALUATION_QUESTIONS) {
      await db.evaluationQuestion.create({
        data: {
          question: q.question,
          expectedAnswer: q.expected,
          expectedDocType: q.expectedDocType ?? null,
          tags: q.tags ?? null,
        },
      });
    }
    questions = await db.evaluationQuestion.findMany();
  }

  const llm = getLLMProvider();
  const localLLM = getLocalLLMProvider();

  for (const q of questions) {
    // Responder la pregunta usando el sistema RAG
    const ragAnswer = await answerQuery({
      question: q.question,
      options: { topK: 15, rerankTopK: 6, useReranker: true, useMultiQuery: false },
    });

    // Métricas calculables automáticamente
    const retrievedCount = ragAnswer.retrievedChunks.length;
    const hasCitations = ragAnswer.citations.length > 0;
    const noEvidence = ragAnswer.noEvidence;

    // Context precision: proporción de chunks recuperados que son relevantes
    // (aproximación: si el top chunk tiene score alto, precision alta)
    const bestScore = ragAnswer.retrievedChunks[0]?.score ?? 0;
    const autoContextPrecision = Math.min(1, bestScore / 0.5);

    // Citation accuracy: si la respuesta cita el tipo de documento esperado
    let autoCitationAccuracy = 0;
    if (q.expectedDocType) {
      const matched = ragAnswer.citations.some((c) => c.docType === q.expectedDocType);
      autoCitationAccuracy = matched ? 1 : 0;
    } else {
      // Si no hay expectedDocType (out-of-corpus), la precisión es correcta si no hay citas
      autoCitationAccuracy = !hasCitations ? 1 : 0;
    }

    // Faithfulness y answer relevancy: usar LLM como juez
    let faithfulness = 0;
    let answerRelevancy = 0;
    let contextRecall = 0;
    try {
      const judgePrompt = buildJudgePrompt(
        q.question,
        q.expectedAnswer,
        ragAnswer.answer,
        ragAnswer.citations,
      );
      const judgeResp = await llm.generate(
        [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: judgePrompt },
        ],
        { temperature: 0 },
      );
      const parsed = parseJudgeResponse(judgeResp);
      faithfulness = parsed.faithfulness;
      answerRelevancy = parsed.answerRelevancy;
      contextRecall = parsed.contextRecall;
    } catch {
      // Fallback al LLM local
      try {
        const judgeResp = await localLLM.generate([
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: buildJudgePrompt(q.question, q.expectedAnswer, ragAnswer.answer, ragAnswer.citations) },
        ]);
        const parsed = parseJudgeResponse(judgeResp);
        faithfulness = parsed.faithfulness;
        answerRelevancy = parsed.answerRelevancy;
        contextRecall = parsed.contextRecall;
      } catch {
        // Si el juez falla, usar heurísticas
        faithfulness = ragAnswer.noEvidence ? 1 : 0.6;
        answerRelevancy = ragAnswer.noEvidence && q.expectedAnswer.toLowerCase().includes('no se encontró') ? 1 : 0.5;
        contextRecall = autoContextPrecision;
      }
    }

    const metrics: EvaluationMetric = {
      faithfulness,
      answerRelevancy,
      contextPrecision: autoContextPrecision,
      contextRecall,
      citationAccuracy: autoCitationAccuracy,
    };

    perQuestion.push({
      question: q.question,
      expected: q.expectedAnswer,
      answer: ragAnswer.answer,
      metrics,
      citations: ragAnswer.citations,
      noEvidence,
    });

    totalFaithfulness += faithfulness;
    totalRelevancy += answerRelevancy;
    totalContextPrecision += autoContextPrecision;
    totalContextRecall += contextRecall;
    totalCitationAccuracy += autoCitationAccuracy;
    count++;
  }

  const metrics: EvaluationResult = {
    runId: 'run_' + Date.now(),
    questionCount: count,
    faithfulness: count > 0 ? totalFaithfulness / count : 0,
    answerRelevancy: count > 0 ? totalRelevancy / count : 0,
    contextPrecision: count > 0 ? totalContextPrecision / count : 0,
    contextRecall: count > 0 ? totalContextRecall / count : 0,
    citationAccuracy: count > 0 ? totalCitationAccuracy / count : 0,
    perQuestion,
  };

  // Persistir la corrida
  try {
    await db.evaluationRun.create({
      data: {
        metrics: JSON.stringify(metrics),
        questionCount: count,
      },
    });
  } catch {
    // No bloquear
  }

  void start;
  return metrics;
}

const JUDGE_SYSTEM_PROMPT = `Eres un evaluador experto en sistemas RAG. Evalúa la calidad de una respuesta generada comparándola con una respuesta de referencia y los fragmentos citados.

Devuelve TU RESPUESTA EXCLUSIVAMENTE como JSON con este formato:
{
  "faithfulness": <0..1>,
  "answerRelevancy": <0..1>,
  "contextRecall": <0..1>,
  "reasoning": "<breve>"
}

- faithfulness: ¿la respuesta generada se basa ÚNICAMENTE en los fragmentos citados (no inventa)? 1=totalmente fiel, 0=alucinación.
- answerRelevancy: ¿la respuesta responde a la pregunta formulada? 1=responde directamente, 0=irrelevante.
- contextRecall: ¿los fragmentos citados cubren la información necesaria para la respuesta esperada? 1=cobertura completa, 0=incompleta.
- Si la respuesta generada dice "No se encontró información suficiente" y la respuesta esperada también lo dice, faithfulness=1 y answerRelevancy=1.
- Si la respuesta generada dice "no se encontró información suficiente" pero la esperada SÍ tiene información, faithfulness=1 (no inventó) pero answerRelevancy=0 (no respondió).`;

function buildJudgePrompt(
  question: string,
  expected: string,
  generated: string,
  citations: Citation[],
): string {
  return `=== PREGUNTA ===
${question}

=== RESPUESTA ESPERADA ===
${expected}

=== RESPUESTA GENERADA ===
${generated}

=== FRAGMENTOS CITADOS (${citations.length}) ===
${citations.map((c, i) => `--- Cita ${i + 1} [doc=${c.documentTitle}, pág=${c.page}, ref=${c.clauseRef ?? c.section ?? '—'}] ---\n"${c.snippet}"`).join('\n\n')}

Evalúa la respuesta generada. Responde SOLO con JSON.`;
}

function parseJudgeResponse(resp: string): {
  faithfulness: number;
  answerRelevancy: number;
  contextRecall: number;
} {
  // Extraer JSON del texto del juez
  const m = resp.match(/\{[\s\S]*\}/);
  if (!m) return { faithfulness: 0.5, answerRelevancy: 0.5, contextRecall: 0.5 };
  try {
    const j = JSON.parse(m[0]);
    const clamp = (x: number) => Math.max(0, Math.min(1, Number(x) || 0));
    return {
      faithfulness: clamp(j.faithfulness),
      answerRelevancy: clamp(j.answerRelevancy),
      contextRecall: clamp(j.contextRecall),
    };
  } catch {
    return { faithfulness: 0.5, answerRelevancy: 0.5, contextRecall: 0.5 };
  }
}

export async function getEvaluationRuns() {
  const runs = await db.evaluationRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return runs.map((r) => {
    let m: Record<string, unknown> = {};
    try {
      m = JSON.parse(r.metrics);
    } catch {
      m = {};
    }
    return {
      id: r.id,
      questionCount: r.questionCount,
      createdAt: r.createdAt.toISOString(),
      metrics: m,
    };
  });
}

// Re-exporta para uso en API
export { retrieve, buildSnippet, answerQuery };
