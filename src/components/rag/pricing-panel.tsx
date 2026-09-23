'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Crown,
  Zap,
  Sparkles,
  Building2,
  Loader2,
  TrendingUp,
  FileText,
  MessageSquare,
  Shield,
  ArrowRight,
  Star,
} from 'lucide-react';
import { PLANS, type Plan } from '@/lib/saas/plans';
import { toast } from 'sonner';

interface PricingPanelProps {
  onNavigate?: (tab: string) => void;
}

const FEATURE_LABELS: Record<string, string> = {
  export: 'Exportar conversación (MD/JSON)',
  api: 'Acceso a API REST',
  airgapped: 'Modo air-gapped (offline)',
  eval: 'Evaluación RAGAS-like',
  compare: 'Comparación de chunks y evaluaciones',
  voice: 'Comando de voz (STT) y TTS',
  semanticSearch: 'Búsqueda semántica con embeddings',
  abTest: 'Comparación A/B de LLMs',
};

export function PricingPanel({ onNavigate }: PricingPanelProps) {
  // Leer plan guardado en localStorage (modo demo sin login)
  const [currentPlan, setCurrentPlan] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rag-current-plan') || 'free';
    }
    return 'free';
  });
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    // Leer plan de localStorage primero (modo demo)
    const savedPlan = localStorage.getItem('rag-current-plan');
    if (savedPlan) setCurrentPlan(savedPlan);
    // Luego intentar leer de la API (si hay usuario logueado)
    fetch('/api/saas/usage')
      .then((r) => r.json())
      .then((d) => {
        if (d.usage) {
          setUsage(d.usage);
          if (d.usage.plan) {
            setCurrentPlan(d.usage.plan);
            localStorage.setItem('rag-current-plan', d.usage.plan);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleCheckout = async (planId: string) => {
    if (planId === currentPlan) return;
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/saas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userId: null }),
      });
      const data = await res.json();
      if (data.success) {
        // ── MODO STRIPE REAL: redirigir a la página de pago ──
        if (data.url) {
          // Stripe devuelve una URL → abrir la página de pago
          window.location.href = data.url;
          return; // La página se redirige, no seguimos aquí
        }

        // ── MODO DEMO: guardar en localStorage ──
        localStorage.setItem('rag-current-plan', planId);
        setCurrentPlan(planId);
        toast.success(`Plan ${data.planName} activado`, {
          description: data.demo
            ? 'Modo demo — sin cobro real. El plan se guarda en tu navegador.'
            : 'Pago procesado correctamente.',
        });
        fetch('/api/saas/usage')
          .then((r) => r.json())
          .then((d) => setUsage(d.usage))
          .catch(() => {});
      } else {
        toast.error('No se pudo cambiar de plan', { description: data.error });
      }
    } catch (err) {
      toast.error('Error al procesar', { description: (err as Error).message });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="space-y-6 overflow-y-auto rag-scroll pr-1">
      {/* ===== HERO SECTION ===== */}
      <div className="text-center py-8 px-4 rounded-2xl rag-gradient border border-border/60">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-medium mb-4">
            <Sparkles className="size-3" />
            Planes simples y transparentes
          </div>
          <h2 className="text-3xl font-bold mb-2">
            Elige tu plan
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Empieza gratis hoy. Sin tarjeta de crédito. Cambia o cancela cuando quieras.
          </p>
        </motion.div>
      </div>

      {/* ===== PLAN CARDS ===== */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan, idx) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <PlanCard
              plan={plan}
              current={plan.id === currentPlan}
              loading={checkoutLoading === plan.id}
              onSelect={() => handleCheckout(plan.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* ===== USO ACTUAL ===== */}
      {usage && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Tu uso del mes
              <Badge variant="outline" className="text-[10px] ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30">
                <Crown className="size-2.5 mr-1" />
                {usage.planName} · ${usage.price}/mes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageRow icon={<MessageSquare className="size-3.5" />} label="Consultas" current={usage.usage.queries.current} limit={usage.usage.queries.limit} />
            <UsageRow icon={<FileText className="size-3.5" />} label="Documentos" current={usage.usage.documents.current} limit={usage.usage.documents.limit} />
            <UsageRow icon={<Zap className="size-3.5" />} label="Búsquedas" current={usage.usage.searches.current} limit={usage.usage.searches.limit} />
          </CardContent>
        </Card>
      )}

      {/* ===== TABLA COMPARATIVA ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            Comparación de características
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rag-scroll">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Característica</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={`text-center py-2 px-2 ${p.highlight ? 'text-primary font-bold' : 'font-medium text-muted-foreground'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(FEATURE_LABELS).map((key) => (
                  <tr key={key} className="border-b border-border/40">
                    <td className="py-1.5 pr-4 text-foreground">{FEATURE_LABELS[key]}</td>
                    {PLANS.map((p) => (
                      <td key={p.id} className="text-center py-1.5 px-2">
                        {p.features[key as keyof typeof p.features] ? (
                          <Check className="size-4 text-emerald-500 mx-auto" />
                        ) : (
                          <X className="size-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-b border-border/40">
                  <td className="py-1.5 pr-4 font-medium">Consultas/mes</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="text-center py-1.5 font-mono">
                      {p.maxQueries === -1 ? '∞' : p.maxQueries.toLocaleString('es-AR')}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-1.5 pr-4 font-medium">Documentos</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="text-center py-1.5 font-mono">
                      {p.maxDocuments === -1 ? '∞' : p.maxDocuments}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 font-bold">Precio</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="text-center py-1.5 font-bold">
                      ${p.price}<span className="text-muted-foreground font-normal">/mes</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== FAQ ===== */}
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { q: '¿Puedo cambiar de plan?', a: 'Sí, en cualquier momento. El cambio se prorratea automáticamente.' },
          { q: '¿Qué pasa si supero el límite?', a: 'El plan Free se pausa. Los planes de pago siguen con uso extra a $0.02/query.' },
          { q: '¿Puedo usar mis propios LLMs?', a: 'Sí. Soporta Ollama (local), OpenAI, Anthropic, o cualquier API compatible.' },
          { q: '¿Mis documentos son privados?', a: 'Con el plan Empresa + air-gapped, todo corre en tu red. Sin tráfico saliente.' },
        ].map((item, i) => (
          <Card key={i} className="bg-muted/20">
            <CardContent className="p-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">{item.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== CTA FINAL ===== */}
      <div className="text-center py-6 rounded-xl bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20">
        <Crown className="size-8 text-amber-500 mx-auto mb-2" />
        <p className="text-lg font-bold mb-1">¿Listo para empezar?</p>
        <p className="text-sm text-muted-foreground mb-4">Sin tarjeta de crédito para el plan gratis</p>
        <Button
          size="lg"
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          onClick={() => onNavigate?.('chat')}
        >
          <Sparkles className="size-4 mr-2" />
          Empezar a chatear
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function PlanCard({ plan, current, loading, onSelect }: { plan: Plan; current: boolean; loading: boolean; onSelect: () => void }) {
  return (
    <Card className={`relative overflow-hidden h-full flex flex-col ${plan.highlight ? 'border-amber-500 shadow-lg ring-2 ring-amber-500/30' : ''} ${current ? 'ring-2 ring-primary' : ''}`}>
      {plan.highlight && (
        <div className="absolute top-0 inset-x-0 bg-amber-500 text-white text-[10px] font-bold py-1 text-center flex items-center justify-center gap-1">
          <Star className="size-2.5 fill-current" />
          MÁS POPULAR
          <Star className="size-2.5 fill-current" />
        </div>
      )}
      <CardHeader className={`pb-2 ${plan.highlight ? 'pt-8' : ''}`}>
        <div className="flex items-center gap-2">
          {plan.id === 'free' && <Sparkles className="size-5 text-muted-foreground" />}
          {plan.id === 'pro' && <Zap className="size-5 text-amber-500" />}
          {plan.id === 'enterprise' && <Building2 className="size-5 text-violet-500" />}
          <CardTitle className="text-lg">{plan.name}</CardTitle>
        </div>
        <CardDescription className="text-xs">{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        {/* Precio */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">${plan.price}</span>
            <span className="text-sm text-muted-foreground">/mes</span>
          </div>
          {plan.price > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Facturado mensualmente · Cancela cuando quieras</p>
          )}
        </div>

        {/* Límites */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {plan.maxQueries === -1 ? '∞' : plan.maxQueries.toLocaleString('es-AR')}
            </span>
            <span className="text-muted-foreground">consultas/mes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="size-3 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {plan.maxDocuments === -1 ? '∞' : plan.maxDocuments}
            </span>
            <span className="text-muted-foreground">documentos</span>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-1.5">
          {Object.entries(plan.features).map(([key, enabled]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              {enabled ? (
                <Check className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="size-3.5 text-muted-foreground/30 shrink-0" />
              )}
              <span className={enabled ? 'text-foreground' : 'text-muted-foreground/50 line-through'}>
                {FEATURE_LABELS[key] ?? key}
              </span>
            </div>
          ))}
        </div>

        {/* Botón */}
        <Button
          className={`w-full font-semibold ${plan.highlight && !current ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
          variant={plan.highlight ? 'default' : 'outline'}
          disabled={current || loading}
          onClick={onSelect}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : current ? (
            <>
              <Check className="size-4 mr-1.5" />
              Plan actual
            </>
          ) : plan.price === 0 ? (
            'Empezar gratis'
          ) : (
            <>
              <Crown className="size-4 mr-1.5" />
              Cambiar a {plan.name}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function UsageRow({ icon, label, current, limit }: { icon: React.ReactNode; label: string; current: number; limit: number }) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const isNear = !isUnlimited && pct >= 80;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
        <span className="font-mono">
          <strong className={isNear ? 'text-amber-600' : 'text-foreground'}>{current}</strong>
          <span className="text-muted-foreground"> / {isUnlimited ? '∞' : limit}</span>
        </span>
      </div>
      {!isUnlimited && <Progress value={pct} className={`h-1.5 ${isNear ? '[&>div]:bg-amber-500' : ''}`} />}
    </div>
  );
}
