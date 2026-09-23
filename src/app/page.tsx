'use client';

import { useState, useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquare,
  FileText,
  Upload,
  FlaskConical,
  Layers,
  BookOpen,
  Sparkles,
  History,
  Keyboard,
  Search,
  LayoutDashboard,
  Brain,
  Crown,
  Download,
  Store,
} from 'lucide-react';
import { ChatPanel } from '@/components/rag/chat-panel';
import { DocumentsPanel } from '@/components/rag/documents-panel';
import { IngestPanel } from '@/components/rag/ingest-panel';
import { EvaluationPanel } from '@/components/rag/evaluation-panel';
import { ArchitecturePanel } from '@/components/rag/architecture-panel';
import { HistoryPanel } from '@/components/rag/history-panel';
import { DashboardPanel } from '@/components/rag/dashboard-panel';
import { StatsSidebar } from '@/components/rag/stats-sidebar';
import { ThemeToggle } from '@/components/rag/theme-toggle';
import { useKeyboardShortcuts, KeyboardHelpDialog } from '@/components/rag/keyboard-shortcuts';
import { FullTextSearchModal } from '@/components/rag/full-text-search-modal';
import { OnboardingTour, TourButton } from '@/components/rag/onboarding-tour';
import { SemanticSearchModal } from '@/components/rag/semantic-search-modal';
import { PricingPanel } from '@/components/rag/pricing-panel';
import { ResellerPanel } from '@/components/rag/reseller-panel';

const TAB_ORDER = ['dashboard', 'chat', 'documents', 'ingest', 'history', 'evaluation', 'pricing', 'reseller', 'architecture'] as const;
type TabValue = (typeof TAB_ORDER)[number];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');
  const [searchOpen, setSearchOpen] = useState(false);
  const [semanticOpen, setSemanticOpen] = useState(false);

  const handler = useMemo(
    () => ({
      onSearch: () => {
        // Si estamos en chat y hay un textarea, enfocarlo; si no, abrir búsqueda full-text
        if (activeTab === 'chat') {
          const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
          if (ta) {
            ta.focus();
            return;
          }
        }
        setSearchOpen(true);
      },
      onGoToTab: (tab: string) => {
        if (TAB_ORDER.includes(tab as TabValue)) {
          setActiveTab(tab as TabValue);
        }
      },
    }),
    [activeTab],
  );

  const { helpOpen, setHelpOpen } = useKeyboardShortcuts(handler);

  const goToTab = useCallback((t: TabValue) => setActiveTab(t), []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 lg:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center rag-glow">
              <BookOpen className="size-5 text-primary" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold">RAG Documental</h1>
              <p className="text-[11px] text-muted-foreground">
                Chat con balances, contratos y normativas · citas verificables
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setSemanticOpen(true)}
              title="Búsqueda semántica (embeddings)"
            >
              <Brain className="size-3.5 text-violet-500" />
              <span className="hidden sm:inline">Semántica</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setSearchOpen(true)}
              title="Buscar en texto completo (Cmd/Ctrl+K fuera del chat)"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="font-mono text-[9px] bg-muted px-1 py-0.5 rounded border border-border ml-1 hidden md:inline">
                ⌘K
              </kbd>
            </Button>
            <Badge variant="outline" className="text-[10px] hidden sm:flex">
              <Sparkles className="size-2.5 mr-1" />
              Next.js 16 · TS · shadcn
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hidden md:inline-flex"
                    onClick={() => setHelpOpen(true)}
                  >
                    <Keyboard className="size-3.5 mr-1" />
                    Atajos
                    <kbd className="font-mono text-[9px] bg-muted px-1 py-0.5 rounded border border-border ml-1">
                      ?
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atajos de teclado (Shift+?)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={() => goToTab('architecture')}
              className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
            >
              <Layers className="size-3.5" />
              v2.0
            </button>
            <TourButton />
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => window.open('/api/download', '_blank')}
              title="Descargar proyecto completo (ZIP)"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Descargar ZIP</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1.5 shadow-sm"
              onClick={() => setActiveTab('pricing')}
              title="Ver planes y precios"
            >
              <Crown className="size-3.5" />
              <span className="hidden sm:inline">Ver Planes</span>
              <span className="hidden md:inline text-[9px] bg-white/20 px-1 py-0.5 rounded">
                $5
              </span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main — altura fija para que el footer siempre quede pegado y solo paneles internos hagan scroll */}
      <main className="flex-1 flex flex-col px-4 lg:px-6 py-4 min-h-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex-1 flex flex-col min-h-0 gap-3" id="rag-tabs">
          <TabsList className="grid grid-cols-5 sm:grid-cols-9 w-full shrink-0">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
              <LayoutDashboard className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm">
              <MessageSquare className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm">
              <FileText className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="ingest" className="text-xs sm:text-sm">
              <Upload className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Ingesta</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              <History className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="text-xs sm:text-sm">
              <FlaskConical className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Evaluación</span>
            </TabsTrigger>
            <TabsTrigger
              value="pricing"
              className="text-xs sm:text-sm relative data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md [&[data-state=active]]:bg-amber-500 [&[data-state=active]]:text-white [&[data-state=active]]:shadow-md"
            >
              <Crown className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline font-semibold">Planes</span>
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none shadow-sm">
                PRO
              </span>
            </TabsTrigger>
            <TabsTrigger value="reseller" className="text-xs sm:text-sm">
              <Store className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Revendedores</span>
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs sm:text-sm">
              <Layers className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Arquitectura</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_280px] gap-4 overflow-hidden">
            <div className="min-h-0 flex overflow-hidden">
              <TabsContent value="dashboard" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll rag-tab-enter data-[state=active]:flex data-[state=active]:flex-col" tabIndex={-1}>
                <DashboardPanel onNavigate={(tab) => setActiveTab(tab as TabValue)} />
              </TabsContent>
              <TabsContent value="chat" className="flex-1 mt-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter overflow-hidden" tabIndex={-1}>
                <ChatPanel />
              </TabsContent>
              <TabsContent value="documents" className="flex-1 mt-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter overflow-hidden" tabIndex={-1}>
                <DocumentsPanel />
              </TabsContent>
              <TabsContent value="ingest" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter" tabIndex={-1}>
                <IngestPanel />
              </TabsContent>
              <TabsContent value="history" className="flex-1 mt-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter overflow-hidden" tabIndex={-1}>
                <HistoryPanel />
              </TabsContent>
              <TabsContent value="evaluation" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter" tabIndex={-1}>
                <EvaluationPanel />
              </TabsContent>
              <TabsContent value="pricing" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter" tabIndex={-1}>
                <PricingPanel onNavigate={(tab) => setActiveTab(tab as TabValue)} />
              </TabsContent>
              <TabsContent value="reseller" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter" tabIndex={-1}>
                <ResellerPanel />
              </TabsContent>
              <TabsContent value="architecture" className="flex-1 mt-0 min-h-0 overflow-y-auto rag-scroll data-[state=active]:flex data-[state=active]:flex-col rag-tab-enter" tabIndex={-1}>
                <ArchitecturePanel />
              </TabsContent>
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:flex flex-col min-h-0 overflow-hidden">
              <StatsSidebar />
            </aside>
          </div>
        </Tabs>
      </main>

      {/* Footer sticky */}
      <footer className="mt-auto border-t border-border bg-muted/20">
        <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-3 flex-wrap text-xs text-foreground/70">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary" />
            <span>
              Sistema RAG end-to-end · <strong className="text-foreground">anti-alucinación</strong> · citas verificables
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-foreground/60">
              Z.ai · TypeScript · Next.js 16 · Prisma · shadcn/ui
            </span>
            <Badge variant="outline" className="text-[10px]">
              DEMO · datos ficticios
            </Badge>
          </div>
        </div>
      </footer>

      {/* Diálogo de ayuda de atajos */}
      <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Modal de búsqueda full-text */}
      <FullTextSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Modal de búsqueda semántica */}
      <SemanticSearchModal open={semanticOpen} onClose={() => setSemanticOpen(false)} />

      {/* Tour de onboarding para nuevos usuarios */}
      <OnboardingTour />
    </div>
  );
}
