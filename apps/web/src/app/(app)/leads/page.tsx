'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchDeals, formatBRL, temperatureClass, temperatureLabel } from '@/lib/crm';
import type { Deal } from '@/lib/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function LeadsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads-list', q, status, temperature],
    queryFn: () =>
      fetchDeals({
        q: q || undefined,
        status: status || undefined,
        temperature: temperature || undefined,
        take: 200,
      }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">Oportunidades e negócios do CRM</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por título ou contato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="OPEN">Abertos</option>
          <option value="WON">Ganhos</option>
          <option value="LOST">Perdidos</option>
        </select>
        <select
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas temperaturas</option>
          <option value="HOT">Quente</option>
          <option value="WARM">Morno</option>
          <option value="COLD">Frio</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${data?.total ?? 0} lead(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">Erro ao carregar leads.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Título</th>
                    <th className="py-2 pr-4 font-medium">Contato</th>
                    <th className="py-2 pr-4 font-medium">Estágio</th>
                    <th className="py-2 pr-4 font-medium">Valor</th>
                    <th className="py-2 pr-4 font-medium">Temp.</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((deal) => (
                    <LeadRow key={deal.id} deal={deal} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadRow({ deal }: { deal: Deal }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="py-3 pr-4">
        <Link href={`/leads/${deal.id}`} className="font-medium text-primary hover:underline">
          {deal.title}
        </Link>
      </td>
      <td className="py-3 pr-4 text-muted-foreground">
        {deal.contact.name ?? deal.contact.phone}
      </td>
      <td className="py-3 pr-4">{deal.stage.name}</td>
      <td className="py-3 pr-4 font-medium">{formatBRL(deal.valueCents)}</td>
      <td className="py-3 pr-4">
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded font-medium',
            temperatureClass[deal.temperature],
          )}
        >
          {temperatureLabel[deal.temperature]}
        </span>
      </td>
      <td className="py-3">
        <StatusBadge status={deal.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: Deal['status'] }) {
  const map = {
    OPEN: 'Aberto',
    WON: 'Ganho',
    LOST: 'Perdido',
  };
  const cls = {
    OPEN: 'bg-blue-100 text-blue-800',
    WON: 'bg-green-100 text-green-800',
    LOST: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', cls[status])}>
      {map[status]}
    </span>
  );
}
