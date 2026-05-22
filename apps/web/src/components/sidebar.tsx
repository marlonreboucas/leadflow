'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Kanban,
  ListChecks,
  Calendar,
  Bot,
  Workflow,
  Smartphone,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  CreditCard,
  ScrollText,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox WhatsApp', icon: Inbox },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/kanban', label: 'Funil', icon: Kanban },
  { href: '/tasks', label: 'Tarefas', icon: ListChecks },
  { href: '/calendar', label: 'Calendário', icon: Calendar },
  { href: '/agents', label: 'Agentes IA', icon: Bot },
  { href: '/automations', label: 'Automações', icon: Workflow },
  { href: '/integrations/n8n', label: 'n8n', icon: Plug },
  { href: '/whatsapp', label: 'WhatsApp', icon: Smartphone },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/knowledge-base', label: 'Conhecimento', icon: BookOpen },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
];

const adminItems = [
  { href: '/team', label: 'Equipe', icon: Users },
  { href: '/settings', label: 'Configurações', icon: Settings },
  { href: '/billing', label: 'Plano & cobrança', icon: CreditCard },
  { href: '/logs', label: 'Logs', icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="h-14 flex items-center px-4 border-b">
        <span className="text-lg font-semibold bg-gradient-to-br from-primary to-violet-600 bg-clip-text text-transparent">
          LeadFlow AI
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {items.map((item) => (
          <NavItem key={item.href} item={item} active={pathname?.startsWith(item.href)} />
        ))}
        <div className="pt-4 pb-1 px-2 text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
        {adminItems.map((item) => (
          <NavItem key={item.href} item={item} active={pathname?.startsWith(item.href)} />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
