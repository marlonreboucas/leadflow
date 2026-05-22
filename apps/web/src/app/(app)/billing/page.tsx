'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Plan = {
  id: string;
  slug: string;
  name: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  limits: Record<string, unknown>;
};

type BillingOverview = {
  company: { id: string; name: string; status: string };
  subscription: {
    status: string;
    plan: Plan | null;
  } | null;
  plans: Plan[];
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BillingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['billing-overview'],
    queryFn: async () => (await api.get<BillingOverview>('/billing/overview')).data,
  });

  const checkout = useMutation({
    mutationFn: async (planSlug: string) =>
      (await api.post<{ url?: string; mock?: boolean; message?: string }>('/billing/checkout', {
        planSlug,
      })).data,
    onSuccess: (res) => {
      if (res.url) {
        if (res.mock) {
          toast.success(res.message ?? 'Plano atualizado');
          refetch();
        } else {
          window.location.href = res.url;
        }
      }
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro no checkout');
    },
  });

  const currentSlug = data?.subscription?.plan?.slug;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plano & cobrança</h1>
        <p className="text-sm text-muted-foreground">
          Assinatura atual — checkout mock em dev ou Stripe com STRIPE_SECRET_KEY
        </p>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Erro ao carregar planos.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Assinatura atual</CardTitle>
              <CardDescription>{data?.company.name}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {isLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : (
                <>
                  <p>
                    <span className="text-muted-foreground">Plano: </span>
                    <span className="font-medium">{data?.subscription?.plan?.name ?? '—'}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">{data?.subscription?.status ?? '—'}</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {data?.plans.map((plan) => {
              const isCurrent = plan.slug === currentSlug;
              const limits = plan.limits as {
                maxInstances?: number;
                maxUsers?: number;
                maxAiAgents?: number;
              };
              return (
                <Card
                  key={plan.id}
                  className={cn(isCurrent && 'border-primary ring-1 ring-primary/20')}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>
                      {formatBrl(plan.monthlyPriceCents)}/mês
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1 text-muted-foreground">
                    <p>{limits.maxInstances ?? 1} instância(s) WhatsApp</p>
                    <p>{limits.maxUsers ?? '—'} usuários</p>
                    <p>{limits.maxAiAgents ?? '—'} agentes IA</p>
                    {isCurrent ? (
                      <p className="text-primary font-medium pt-2">Plano atual</p>
                    ) : (
                      <Button
                        size="sm"
                        className="mt-2"
                        variant="outline"
                        disabled={checkout.isPending}
                        onClick={() => checkout.mutate(plan.slug)}
                      >
                        {checkout.isPending ? 'Processando...' : 'Assinar / upgrade'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
