// Sistema de branding white-label.
// Permite personalizar nombre, logo, colores y dominio vía variables de entorno.

export interface BrandConfig {
  name: string;
  logoUrl: string;
  primaryColor: string;
  domain: string;
  tagline: string;
  footerText: string;
  supportEmail: string;
}

export function getBrandConfig(): BrandConfig {
  return {
    name: process.env.BRAND_NAME || 'RAG Documental',
    logoUrl: process.env.BRAND_LOGO_URL || '/logo.svg',
    primaryColor: process.env.BRAND_PRIMARY_COLOR || '',
    domain: process.env.BRAND_DOMAIN || 'localhost:3000',
    tagline: process.env.BRAND_TAGLINE || 'Chat con balances, contratos y normativas · citas verificables',
    footerText: process.env.BRAND_FOOTER || 'Powered by Z.ai',
    supportEmail: process.env.BRAND_SUPPORT_EMAIL || 'support@example.com',
  };
}

// Genera una license key única (formato: RAG-XXXX-XXXX-XXXX)
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments: string[] = [];
  for (let s = 0; s < 3; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return `RAG-${segments.join('-')}`;
}

// Valida una license key
export function isValidLicenseKeyFormat(key: string): boolean {
  return /^RAG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}
