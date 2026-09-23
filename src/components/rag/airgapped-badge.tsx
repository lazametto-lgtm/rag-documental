'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldOff, Wifi, WifiOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AirGappedInfo {
  enabled: boolean;
  description: string;
  layers?: Array<{
    name: string;
    services: string[];
    ports: number[];
    external: boolean;
  }>;
}

export function AirGappedBadge() {
  const [info, setInfo] = useState<AirGappedInfo | null>(null);

  useEffect(() => {
    fetch('/api/rag/airgapped')
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => {
        // Fallback: no air-gapped
        setInfo({ enabled: false, description: 'Modo normal' });
      });
  }, []);

  if (!info) return null;

  if (info.enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-600 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 cursor-help"
            >
              <Shield className="size-2.5 mr-1" />
              Air-Gapped
              <WifiOff className="size-2.5 ml-1" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">{info.description}</p>
            {info.layers && info.layers.length > 0 && (
              <div className="space-y-1 mt-2 pt-2 border-t border-border/60">
                {info.layers.map((layer) => (
                  <div key={layer.name} className="text-[10px]">
                    <strong className="text-foreground">{layer.name}:</strong>{' '}
                    {layer.services.join(', ')}
                    <span className="text-muted-foreground ml-1">(puertos: {layer.ports.join(', ')})</span>
                  </div>
                ))}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Modo normal: mostrar badge sutil
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] hidden md:flex cursor-help">
            <Wifi className="size-2.5 mr-1" />
            Online
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Conexión externa habilitada — providers ZAI y API disponibles</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
