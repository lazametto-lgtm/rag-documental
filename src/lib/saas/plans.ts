// Definición de planes SaaS y utilidades de límites.

export interface Plan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  maxQueries: number;
  maxDocuments: number;
  maxChunks: number;
  features: {
    export: boolean;
    api: boolean;
    airgapped: boolean;
    eval: boolean;
    compare: boolean;
    voice: boolean;
    semanticSearch: boolean;
    abTest: boolean;
  };
  description: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratis',
    price: 0,
    maxQueries: 50,
    maxDocuments: 10,
    maxChunks: 200,
    features: { export: false, api: false, airgapped: false, eval: false, compare: false, voice: false, semanticSearch: false, abTest: false },
    description: 'Para probar el sistema y proyectos personales.',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5,
    maxQueries: 1000,
    maxDocuments: 100,
    maxChunks: 5000,
    features: { export: true, api: false, airgapped: false, eval: true, compare: true, voice: true, semanticSearch: true, abTest: false },
    description: 'Para despachos de abogados, contadores y equipos de compliance.',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Empresa',
    price: 100,
    maxQueries: -1,
    maxDocuments: -1,
    maxChunks: -1,
    features: { export: true, api: true, airgapped: true, eval: true, compare: true, voice: true, semanticSearch: true, abTest: true },
    description: 'Para bancos, seguros, gobierno. Incluye API, air-gapped y soporte.',
  },
];

export function getPlan(planId: string): Plan {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0];
}

export function hasFeature(planId: string, feature: keyof Plan['features']): boolean {
  return getPlan(planId).features[feature] ?? false;
}

export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO ?? 'price_pro_demo',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise_demo',
};
