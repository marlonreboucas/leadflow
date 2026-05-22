'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STORAGE_KEY = 'leadflow_onboarding_done';

const steps = [
  {
    title: 'Conectar WhatsApp',
    description: 'Crie uma instância e escaneie o QR em /whatsapp',
    href: '/whatsapp',
  },
  {
    title: 'Configurar agente IA',
    description: 'Modo FULL_AUTO + base de conhecimento em /agents',
    href: '/agents',
  },
  {
    title: 'Funil e leads',
    description: 'Revise o kanban e vincule conversas a deals',
    href: '/kanban',
  },
  {
    title: 'Automações',
    description: 'Regras como “orçamento → qualificação” em /automations',
    href: '/automations',
  },
];

export function OnboardingWizard() {
  const [done, setDone] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [step, setStep] = useState(0);

  if (done) return null;

  const current = steps[step];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Primeiros passos ({step + 1}/{steps.length})</CardTitle>
        <CardDescription>{current.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href={current.href}>Ir para etapa</Link>
        </Button>
        {step < steps.length - 1 ? (
          <Button size="sm" variant="outline" onClick={() => setStep((s) => s + 1)}>
            Próximo
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, '1');
              setDone(true);
            }}
          >
            Concluir tour
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
