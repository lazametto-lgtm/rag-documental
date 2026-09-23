'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Store,
  Key,
  Users,
  DollarSign,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  RefreshCw,
  Ban,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export function ResellerPanel() {
  const [resellers, setResellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<string | null>(null);
  const [resellerDetail, setResellerDetail] = useState<any>(null);
  const [newLicense, setNewLicense] = useState({ customerName: '', customerEmail: '', plan: 'pro', monthlyFee: 5 });
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [validateResult, setValidateResult] = useState<any>(null);

  const loadResellers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/saas/reseller');
      const data = await res.json();
      setResellers(data.resellers || []);
    } catch {
      toast.error('Error al cargar revendedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResellers();
  }, []);

  const loadDetail = async (id: string) => {
    setSelectedReseller(id);
    try {
      const res = await fetch(`/api/saas/reseller?id=${id}`);
      const data = await res.json();
      setResellerDetail(data.reseller);
    } catch {
      toast.error('Error al cargar detalle');
    }
  };

  const registerReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const company = formData.get('company') as string;
    const commissionPct = parseFloat(formData.get('commissionPct') as string) || 30;

    try {
      const res = await fetch('/api/saas/reseller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, company, commissionPct }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Revendedor registrado', { description: `${name} - ${commissionPct}% comisión` });
        setShowRegister(false);
        void loadResellers();
      } else {
        toast.error('Error', { description: data.error });
      }
    } catch (err) {
      toast.error('Error', { description: (err as Error).message });
    }
  };

  const generateLicense = async () => {
    if (!selectedReseller || !newLicense.customerName || !newLicense.customerEmail) {
      toast.error('Completa todos los campos');
      return;
    }
    setLicenseLoading(true);
    try {
      const res = await fetch('/api/saas/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resellerId: selectedReseller,
          customerName: newLicense.customerName,
          customerEmail: newLicense.customerEmail,
          plan: newLicense.plan,
          monthlyFee: newLicense.monthlyFee,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Licencia generada', { description: data.license.licenseKey });
        setNewLicense({ customerName: '', customerEmail: '', plan: 'pro', monthlyFee: 5 });
        void loadDetail(selectedReseller);
      } else {
        toast.error('Error', { description: data.error });
      }
    } catch (err) {
      toast.error('Error', { description: (err as Error).message });
    } finally {
      setLicenseLoading(false);
    }
  };

  const revokeLicense = async (key: string) => {
    try {
      const res = await fetch('/api/saas/license', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, action: 'revoke' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Licencia revocada');
        if (selectedReseller) void loadDetail(selectedReseller);
      }
    } catch (err) {
      toast.error('Error', { description: (err as Error).message });
    }
  };

  const validateLicense = async () => {
    if (!searchKey) return;
    setValidateResult(null);
    try {
      const res = await fetch(`/api/saas/license?key=${searchKey}`);
      const data = await res.json();
      setValidateResult(data);
    } catch {
      toast.error('Error al validar');
    }
  };

  const totalRevenue = resellers.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const totalCustomers = resellers.reduce((s, r) => s + (r.totalCustomers || 0), 0);

  return (
    <div className="space-y-4 overflow-y-auto rag-scroll pr-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Store className="size-4 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Programa de Revendedores</h2>
            <p className="text-xs text-muted-foreground">White-label: tus clientes ven tu marca, tú cobras</p>
          </div>
        </div>
        <Button onClick={() => setShowRegister(!showRegister)} size="sm">
          <Plus className="size-3.5 mr-1" />
          Nuevo revendedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="bg-violet-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Store className="size-3.5 text-violet-500" />
                <span className="text-xs text-muted-foreground">Revendedores</span>
              </div>
              <div className="text-2xl font-bold rag-mono">{resellers.length}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-emerald-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="size-3.5 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Ingresos/mes</span>
              </div>
              <div className="text-2xl font-bold rag-mono">${totalRevenue.toFixed(0)}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-blue-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="size-3.5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Clientes</span>
              </div>
              <div className="text-2xl font-bold rag-mono">{totalCustomers}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Formulario de registro */}
      {showRegister && (
        <Card className="border-violet-500/30 bg-violet-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registrar nuevo revendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={registerReseller} className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email *</Label>
                <Input name="email" type="email" required placeholder="vendedor@empresa.com" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input name="name" required placeholder="Juan Pérez" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Input name="company" placeholder="TechCorp S.A." className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Comisión %</Label>
                <Input name="commissionPct" type="number" defaultValue="30" min="0" max="100" className="h-8 text-xs" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" size="sm" className="text-xs">
                  <Check className="size-3.5 mr-1" />
                  Registrar
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowRegister(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Validador de licencias */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="size-3.5 text-primary" />
            Validar licencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value.toUpperCase())}
              placeholder="RAG-XXXX-XXXX-XXXX"
              className="h-8 text-xs font-mono"
            />
            <Button onClick={validateLicense} size="sm" className="text-xs h-8">
              <Search className="size-3.5 mr-1" />
              Validar
            </Button>
          </div>
          {validateResult && (
            <div className={`mt-2 p-2 rounded text-xs ${validateResult.valid ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
              {validateResult.valid ? (
                <>
                  <p className="font-medium text-emerald-600 dark:text-emerald-300">✅ Licencia válida</p>
                  <p>Cliente: {validateResult.license.customerName} ({validateResult.license.customerEmail})</p>
                  <p>Plan: {validateResult.license.plan} · ${validateResult.license.monthlyFee}/mes</p>
                  <p>Revendedor: {validateResult.license.reseller.name}</p>
                </>
              ) : (
                <p className="font-medium text-rose-600 dark:text-rose-300">❌ {validateResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de revendedores */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Revendedores registrados</CardTitle>
            <Button variant="ghost" size="icon" className="size-6" onClick={loadResellers} title="Recargar">
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : resellers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Sin revendedores. Clic en "Nuevo revendedor" para empezar.
            </p>
          ) : (
            <div className="space-y-1.5">
              {resellers.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedReseller === r.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/30 border border-transparent'}`}
                  onClick={() => loadDetail(r.id)}
                >
                  <div className="size-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                    <Building2 className="size-3 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">{r.commissionPct}%</Badge>
                    <span>{r.licenseCount || 0} lic.</span>
                    <span>${(r.totalRevenue || 0).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle del revendedor seleccionado */}
      {resellerDetail && (
        <Card className="border-violet-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="size-4 text-violet-500" />
              {resellerDetail.name}
              <Badge variant="outline" className="text-[10px] ml-auto">{resellerDetail.commissionPct}% comisión</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {resellerDetail.company || 'Sin empresa'} · {resellerDetail.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-border/60 p-2 text-center">
                <div className="text-lg font-bold rag-mono text-emerald-600">${resellerDetail.monthlyRevenue?.toFixed(0) || 0}</div>
                <div className="text-[9px] text-muted-foreground">Ingresos/mes</div>
              </div>
              <div className="rounded border border-border/60 p-2 text-center">
                <div className="text-lg font-bold rag-mono">${resellerDetail.commission?.toFixed(0) || 0}</div>
                <div className="text-[9px] text-muted-foreground">Tu comisión</div>
              </div>
              <div className="rounded border border-border/60 p-2 text-center">
                <div className="text-lg font-bold rag-mono">{resellerDetail.activeLicenses || 0}</div>
                <div className="text-[9px] text-muted-foreground">Licencias activas</div>
              </div>
            </div>

            {/* Generar nueva licencia */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Key className="size-3 text-primary" />
                Generar licencia para nuevo cliente
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  value={newLicense.customerName}
                  onChange={(e) => setNewLicense({ ...newLicense, customerName: e.target.value })}
                  placeholder="Nombre del cliente"
                  className="h-7 text-xs"
                />
                <Input
                  value={newLicense.customerEmail}
                  onChange={(e) => setNewLicense({ ...newLicense, customerEmail: e.target.value })}
                  placeholder="Email del cliente"
                  className="h-7 text-xs"
                />
                <Select value={newLicense.plan} onValueChange={(v) => setNewLicense({ ...newLicense, plan: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free ($0)</SelectItem>
                    <SelectItem value="pro">Pro ($5)</SelectItem>
                    <SelectItem value="enterprise">Enterprise ($100)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={newLicense.monthlyFee}
                  onChange={(e) => setNewLicense({ ...newLicense, monthlyFee: parseFloat(e.target.value) || 0 })}
                  placeholder="$/mes"
                  className="h-7 text-xs"
                />
              </div>
              <Button onClick={generateLicense} disabled={licenseLoading} size="sm" className="w-full text-xs h-7">
                {licenseLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Key className="size-3.5 mr-1" />}
                Generar licencia
              </Button>
            </div>

            {/* Lista de licencias */}
            <div>
              <p className="text-xs font-medium mb-1.5">Licencias emitidas ({resellerDetail.licenses?.length || 0})</p>
              {resellerDetail.licenses?.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sin licencias emitidas aún.</p>
              ) : (
                <div className="space-y-1">
                  {resellerDetail.licenses.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2 p-1.5 rounded border border-border/60 text-xs">
                      <Key className="size-3 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-medium">{l.licenseKey}</span>
                        <span className="text-muted-foreground ml-2">{l.customerName}</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${l.status === 'active' ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-600 border-rose-500/30'}`}>
                        {l.status}
                      </Badge>
                      <span className="font-mono text-[10px]">${l.monthlyFee}/mes</span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(l.licenseKey);
                          toast.success('Licencia copiada');
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" />
                      </button>
                      {l.status === 'active' && (
                        <button
                          onClick={() => revokeLicense(l.licenseKey)}
                          className="text-muted-foreground hover:text-rose-500"
                          title="Revocar"
                        >
                          <Ban className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info de cómo funciona */}
      <Card className="bg-muted/20">
        <CardContent className="p-3 text-xs space-y-2">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary" />
            Cómo funciona el programa white-label
          </p>
          <div className="space-y-1 text-muted-foreground">
            <p>1. Registras a un revendedor (ej: "TechCorp", 30% comisión)</p>
            <p>2. El revendedor vende el sistema a sus clientes con su marca</p>
            <p>3. Generas una licencia por cada cliente (key: RAG-XXXX-XXXX-XXXX)</p>
            <p>4. El cliente valida su licencia al instalar el sistema</p>
            <p>5. El revendedor cobra al cliente, tú cobras al revendedor</p>
            <p>6. Revenue share: 70% tú / 30% revendedor (configurable)</p>
          </div>
          <div className="pt-2 border-t border-border/40">
            <p className="font-medium text-foreground">Configurar branding en .env:</p>
            <pre className="text-[10px] rag-mono mt-1 p-2 rounded bg-muted/40 overflow-x-auto">
{`BRAND_NAME=TuMarca AI
BRAND_LOGO_URL=https://tudominio.com/logo.png
BRAND_PRIMARY_COLOR=#7c3aed
BRAND_DOMAIN=tudominio.com
BRAND_TAGLINE=Tú solgán aquí
BRAND_FOOTER=© TuMarca 2024`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
