import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description: string;
  phase: string;
  bullets?: string[];
}

export function ComingSoon({ title, description, phase, bullets }: ComingSoonProps) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Construction className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Em construção</CardTitle>
            <CardDescription>{phase}</CardDescription>
          </div>
        </CardHeader>
        {bullets && bullets.length > 0 ? (
          <CardContent>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
