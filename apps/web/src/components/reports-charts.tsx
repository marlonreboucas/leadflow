'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DayPoint = { day: string; count: number };
type StagePoint = { stage: string; count: number };

export function MessagesByDayChart({ data }: { data: DayPoint[] }) {
  const chartData = data.map((d) => ({
    label: new Date(d.day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    count: d.count,
  }));

  if (!chartData.length) {
    return <p className="text-sm text-muted-foreground">Sem mensagens no período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Mensagens" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DealsByStageChart({ data }: { data: StagePoint[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Sem leads abertos.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="hsl(262 83% 58%)" radius={[0, 4, 4, 0]} name="Leads" />
      </BarChart>
    </ResponsiveContainer>
  );
}
