export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary to-violet-600 text-primary-foreground">
        <div className="font-semibold text-lg">LeadFlow AI</div>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">CRM WhatsApp com IA</h2>
          <p className="text-primary-foreground/80">
            Múltiplos agentes inteligentes, automações e funil de vendas, tudo em um só lugar.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/60">© LeadFlow AI</div>
      </div>
      <div className="flex items-center justify-center p-6 lg:p-10">{children}</div>
    </div>
  );
}
