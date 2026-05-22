import { PrismaClient, RoleSlug } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ===== Permission catalog =====
const PERMISSIONS: Array<{ key: string; group: string }> = [
  // leads
  { key: 'leads.view', group: 'leads' },
  { key: 'leads.create', group: 'leads' },
  { key: 'leads.update', group: 'leads' },
  { key: 'leads.delete', group: 'leads' },
  // conversations / messages
  { key: 'conversations.view', group: 'conversations' },
  { key: 'conversations.assume', group: 'conversations' },
  { key: 'messages.send', group: 'conversations' },
  // ai
  { key: 'agents.view', group: 'ai' },
  { key: 'agents.manage', group: 'ai' },
  { key: 'automations.manage', group: 'ai' },
  // whatsapp
  { key: 'whatsapp.connect', group: 'whatsapp' },
  // reports
  { key: 'reports.view', group: 'reports' },
  // admin
  { key: 'users.manage', group: 'admin' },
  { key: 'billing.manage', group: 'admin' },
  { key: 'settings.manage', group: 'admin' },
];

const ROLE_PERMISSIONS: Record<RoleSlug, string[]> = {
  OWNER: PERMISSIONS.map((p) => p.key),
  ADMIN: PERMISSIONS.map((p) => p.key).filter((k) => k !== 'billing.manage'),
  MANAGER: [
    'leads.view', 'leads.create', 'leads.update', 'leads.delete',
    'conversations.view', 'conversations.assume', 'messages.send',
    'agents.view', 'agents.manage', 'automations.manage',
    'whatsapp.connect', 'reports.view',
  ],
  ATTENDANT: [
    'leads.view', 'leads.update',
    'conversations.view', 'conversations.assume', 'messages.send',
  ],
  SALES: [
    'leads.view', 'leads.create', 'leads.update',
    'conversations.view', 'conversations.assume', 'messages.send',
    'reports.view',
  ],
  FINANCE: [
    'leads.view', 'conversations.view', 'reports.view', 'billing.manage',
  ],
  READONLY: [
    'leads.view', 'conversations.view', 'reports.view',
  ],
  AI_AGENT: [
    'leads.view', 'leads.update',
    'conversations.view', 'messages.send',
  ],
};

const ROLE_DEFS: Array<{ slug: RoleSlug; name: string; description: string }> = [
  { slug: 'OWNER', name: 'Owner', description: 'Acesso total e billing' },
  { slug: 'ADMIN', name: 'Admin', description: 'Administrador da empresa' },
  { slug: 'MANAGER', name: 'Gerente', description: 'Gerencia equipe e IA' },
  { slug: 'ATTENDANT', name: 'Atendente', description: 'Atende conversas WhatsApp' },
  { slug: 'SALES', name: 'Comercial', description: 'Conduz negociações' },
  { slug: 'FINANCE', name: 'Financeiro', description: 'Acesso a billing e financeiro' },
  { slug: 'READONLY', name: 'Somente leitura', description: 'Visualização sem edição' },
  { slug: 'AI_AGENT', name: 'Agente IA', description: 'Identidade de agente IA dentro do CRM' },
];

const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    monthlyPriceCents: 9700,
    yearlyPriceCents: 97000,
    limits: {
      maxInstances: 1,
      maxUsers: 2,
      maxAgents: 1,
      maxFunnels: 1,
      maxMessagesMonth: 1000,
      features: ['inbox', 'kanban'],
    },
  },
  {
    slug: 'pro',
    name: 'Pro',
    monthlyPriceCents: 19700,
    yearlyPriceCents: 197000,
    limits: {
      maxInstances: 2,
      maxUsers: 5,
      maxAgents: 3,
      maxFunnels: 3,
      maxMessagesMonth: 5000,
      features: ['inbox', 'kanban', 'automations'],
    },
  },
  {
    slug: 'business',
    name: 'Business',
    monthlyPriceCents: 49700,
    yearlyPriceCents: 497000,
    limits: {
      maxInstances: 5,
      maxUsers: 15,
      maxAgents: 10,
      maxFunnels: 10,
      maxMessagesMonth: 20000,
      features: ['inbox', 'kanban', 'automations', 'n8n', 'advanced_reports'],
    },
  },
  {
    slug: 'agency',
    name: 'Agency',
    monthlyPriceCents: 99700,
    yearlyPriceCents: 997000,
    limits: {
      maxInstances: 999,
      maxUsers: 999,
      maxAgents: 999,
      maxFunnels: 999,
      maxMessagesMonth: 100000,
      features: ['inbox', 'kanban', 'automations', 'n8n', 'advanced_reports', 'multi_tenant', 'white_label'],
    },
  },
];

async function main() {
  console.log('Seeding permissions...');
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { group: p.group },
      create: p,
    });
  }

  console.log('Seeding system roles + role-permissions...');
  for (const def of ROLE_DEFS) {
    // Composite unique on (companyId, slug) allows multiple NULLs in Postgres,
    // so we resolve by manual find-or-create against companyId=null.
    let role = await prisma.role.findFirst({ where: { companyId: null, slug: def.slug } });
    if (role) {
      role = await prisma.role.update({
        where: { id: role.id },
        data: { name: def.name, description: def.description, isSystem: true },
      });
    } else {
      role = await prisma.role.create({
        data: { slug: def.slug, name: def.name, description: def.description, isSystem: true },
      });
    }

    const wantedKeys = ROLE_PERMISSIONS[def.slug];
    const perms = await prisma.permission.findMany({ where: { key: { in: wantedKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((perm) => ({ roleId: role.id, permissionId: perm.id })),
      skipDuplicates: true,
    });
  }

  console.log('Seeding plans...');
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        yearlyPriceCents: plan.yearlyPriceCents,
        limits: plan.limits,
      },
      create: plan,
    });
  }

  // Demo account (apenas em dev)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Seeding demo account...');
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const user = await prisma.user.upsert({
      where: { email: 'demo@leadflow.ai' },
      update: {},
      create: {
        email: 'demo@leadflow.ai',
        passwordHash,
        name: 'Demo Owner',
      },
    });

    const company = await prisma.company.upsert({
      where: { slug: 'demo' },
      update: {},
      create: {
        name: 'Demo Company',
        slug: 'demo',
        segment: 'Outros',
        status: 'TRIAL',
        timezone: 'America/Sao_Paulo',
      },
    });

    const starter = await prisma.plan.findUniqueOrThrow({ where: { slug: 'starter' } });
    await prisma.subscription.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        planId: starter.id,
        provider: 'MANUAL',
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const ownerRole = await prisma.role.findFirstOrThrow({ where: { companyId: null, slug: 'OWNER' } });
    await prisma.companyUser.upsert({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
      update: {},
      create: {
        companyId: company.id,
        userId: user.id,
        roleId: ownerRole.id,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveCompanyId: company.id },
    });

    const pipeline = await prisma.pipeline.upsert({
      where: { id: `${company.id}-default` },
      update: {},
      create: {
        id: `${company.id}-default`,
        companyId: company.id,
        name: 'Funil principal',
        isDefault: true,
        position: 0,
      },
    });

    const stages = [
      { name: 'Novo lead', position: 0, color: '#94a3b8' },
      { name: 'Qualificação', position: 1, color: '#60a5fa' },
      { name: 'Diagnóstico', position: 2, color: '#a78bfa' },
      { name: 'Proposta', position: 3, color: '#f59e0b' },
      { name: 'Negociação', position: 4, color: '#f97316' },
      { name: 'Ganho', position: 5, color: '#22c55e', isWon: true },
      { name: 'Perdido', position: 6, color: '#ef4444', isLost: true },
    ];
    const stageRecords = [];
    for (const s of stages) {
      const stage = await prisma.pipelineStage.upsert({
        where: { pipelineId_position: { pipelineId: pipeline.id, position: s.position } },
        update: { name: s.name, color: s.color, isWon: s.isWon ?? false, isLost: s.isLost ?? false },
        create: { pipelineId: pipeline.id, ...s },
      });
      stageRecords.push(stage);
    }

    const novoStage = stageRecords.find((s) => s.position === 0)!;
    const qualStage = stageRecords.find((s) => s.position === 1)!;

    const contact1 = await prisma.contact.upsert({
      where: { companyId_phone: { companyId: company.id, phone: '5511999000001' } },
      update: {},
      create: {
        companyId: company.id,
        phone: '5511999000001',
        name: 'Ana Silva',
        segment: 'Premium',
        origin: 'WhatsApp',
      },
    });
    const contact2 = await prisma.contact.upsert({
      where: { companyId_phone: { companyId: company.id, phone: '5511999000002' } },
      update: {},
      create: {
        companyId: company.id,
        phone: '5511999000002',
        name: 'Bruno Costa',
        segment: 'SMB',
        origin: 'Indicação',
      },
    });

    await prisma.deal.upsert({
      where: { id: `${company.id}-deal-1` },
      update: {},
      create: {
        id: `${company.id}-deal-1`,
        companyId: company.id,
        pipelineId: pipeline.id,
        stageId: novoStage.id,
        contactId: contact1.id,
        title: 'Plano Enterprise — Ana',
        valueCents: 480000,
        temperature: 'HOT',
        ownerUserId: user.id,
        nextActionAt: new Date(Date.now() + 2 * 3600000),
      },
    });
    await prisma.deal.upsert({
      where: { id: `${company.id}-deal-2` },
      update: {},
      create: {
        id: `${company.id}-deal-2`,
        companyId: company.id,
        pipelineId: pipeline.id,
        stageId: qualStage.id,
        contactId: contact2.id,
        title: 'Onboarding — Bruno',
        valueCents: 120000,
        temperature: 'WARM',
        ownerUserId: user.id,
      },
    });

    await prisma.task.upsert({
      where: { id: `${company.id}-task-1` },
      update: {},
      create: {
        id: `${company.id}-task-1`,
        companyId: company.id,
        title: 'Enviar proposta para Ana',
        dealId: `${company.id}-deal-1`,
        assigneeUserId: user.id,
        dueAt: new Date(Date.now() + 24 * 3600000),
        status: 'PENDING',
      },
    });

    const kb = await prisma.knowledgeBase.upsert({
      where: { id: `${company.id}-kb-main` },
      update: {},
      create: {
        id: `${company.id}-kb-main`,
        companyId: company.id,
        name: 'Produtos e preços',
        description: 'FAQ comercial para agentes IA',
      },
    });

    await prisma.knowledgeItem.upsert({
      where: { id: `${company.id}-kb-item-1` },
      update: {},
      create: {
        id: `${company.id}-kb-item-1`,
        kbId: kb.id,
        kind: 'PRICE',
        title: 'Plano Starter',
        content:
          'O plano Starter custa R$ 97/mês e inclui 1 número WhatsApp, 2 usuários e agente IA básico.',
      },
    });

    const sdrAgent = await prisma.aiAgent.upsert({
      where: { id: `${company.id}-agent-sdr` },
      update: {},
      create: {
        id: `${company.id}-agent-sdr`,
        companyId: company.id,
        name: 'SDR Demo',
        type: 'SDR',
        mode: 'FULL_AUTO',
        systemPrompt:
          'Você é um SDR consultivo da Demo Company. Qualifique leads, responda sobre preços usando a base de conhecimento, mova o lead para Qualificação quando houver interesse claro e agende demos com schedule_event quando o cliente pedir horário.',
        objective: 'Qualificar leads e agendar próximos passos',
        voiceTone: 'Profissional e amigável',
        isActive: true,
      },
    });

    await prisma.aiAgentKnowledgeBase.upsert({
      where: { agentId_kbId: { agentId: sdrAgent.id, kbId: kb.id } },
      update: {},
      create: { agentId: sdrAgent.id, kbId: kb.id },
    });

    await prisma.aiAgent.upsert({
      where: { id: `${company.id}-agent-sales` },
      update: { isActive: true },
      create: {
        id: `${company.id}-agent-sales`,
        companyId: company.id,
        name: 'Vendas Demo',
        type: 'SALES',
        mode: 'FULL_AUTO',
        systemPrompt:
          'Você é consultor de vendas. Feche objeções, envie propostas e conduza o lead até fechamento com tom consultivo.',
        objective: 'Converter leads qualificados',
        voiceTone: 'Consultivo e objetivo',
        isActive: true,
      },
    });

    const autoPreco = await prisma.automationRule.upsert({
      where: { id: `${company.id}-auto-preco` },
      update: { isActive: true },
      create: {
        id: `${company.id}-auto-preco`,
        companyId: company.id,
        name: 'Mensagem com preço → acionar IA',
        trigger: 'MESSAGE_RECEIVED',
        isActive: true,
        runOrder: 10,
      },
    });
    await prisma.automationCondition.deleteMany({ where: { ruleId: autoPreco.id } });
    await prisma.automationCondition.create({
      data: {
        ruleId: autoPreco.id,
        field: 'message.body',
        operator: 'regex',
        value: 'preço|preco|orçamento|orcamento|quanto custa',
      },
    });
    await prisma.automationAction.deleteMany({ where: { ruleId: autoPreco.id } });
    await prisma.automationAction.create({
      data: {
        ruleId: autoPreco.id,
        type: 'RUN_AI_AGENT',
        position: 0,
        config: {},
      },
    });

    const autoQual = await prisma.automationRule.upsert({
      where: { id: `${company.id}-auto-qual` },
      update: { isActive: true },
      create: {
        id: `${company.id}-auto-qual`,
        companyId: company.id,
        name: 'Orçamento → mover para Qualificação',
        trigger: 'MESSAGE_RECEIVED',
        isActive: true,
        runOrder: 20,
      },
    });
    await prisma.automationCondition.deleteMany({ where: { ruleId: autoQual.id } });
    await prisma.automationCondition.create({
      data: {
        ruleId: autoQual.id,
        field: 'message.body',
        operator: 'contains',
        value: 'orçamento',
      },
    });
    await prisma.automationAction.deleteMany({ where: { ruleId: autoQual.id } });
    await prisma.automationAction.create({
      data: {
        ruleId: autoQual.id,
        type: 'MOVE_STAGE',
        position: 0,
        config: { stageName: 'Qualificação' },
      },
    });

    const autoAgendar = await prisma.automationRule.upsert({
      where: { id: `${company.id}-auto-agendar` },
      update: { isActive: true },
      create: {
        id: `${company.id}-auto-agendar`,
        companyId: company.id,
        name: 'Pedido de agendamento → IA',
        trigger: 'MESSAGE_RECEIVED',
        isActive: true,
        runOrder: 15,
      },
    });
    await prisma.automationCondition.deleteMany({ where: { ruleId: autoAgendar.id } });
    await prisma.automationCondition.create({
      data: {
        ruleId: autoAgendar.id,
        field: 'message.body',
        operator: 'regex',
        value: 'agendar|marcar|horario|horário|reunião|reuniao|demo|visita',
      },
    });
    await prisma.automationAction.deleteMany({ where: { ruleId: autoAgendar.id } });
    await prisma.automationAction.create({
      data: {
        ruleId: autoAgendar.id,
        type: 'RUN_AI_AGENT',
        position: 0,
        config: {},
      },
    });

    console.log('Demo account ready → demo@leadflow.ai / demo1234');
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
