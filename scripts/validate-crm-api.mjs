/**
 * Valida endpoints CRM (contacts, deals, tasks, pipelines).
 * Uso: node scripts/validate-crm-api.mjs
 * Requer API em http://localhost:3001 e conta demo seedada.
 */
const API = process.env.API_URL ?? 'http://localhost:3001';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@leadflow.ai';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

let token = '';
let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}: ${detail}`);
}

async function req(method, path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nValidando CRM API em ${API}\n`);

  const login = await req('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (login.status !== 201 && login.status !== 200) {
    fail('login', `${login.status} ${JSON.stringify(login.data)}`);
    process.exit(1);
  }
  token = login.data.accessToken;
  ok('login');

  const pipelines = await req('GET', '/pipelines');
  if (pipelines.status !== 200 || !Array.isArray(pipelines.data) || pipelines.data.length === 0) {
    fail('GET /pipelines', JSON.stringify(pipelines.data));
  } else {
    ok(`GET /pipelines (${pipelines.data.length} funil)`);
  }

  const pipeline = pipelines.data[0];
  const firstStage = pipeline.stages?.find((s) => !s.isWon && !s.isLost) ?? pipeline.stages?.[0];

  const contactsList = await req('GET', '/contacts?take=10');
  if (contactsList.status !== 200 || !contactsList.data?.items) {
    fail('GET /contacts', JSON.stringify(contactsList.data));
  } else {
    ok(`GET /contacts (${contactsList.data.total} total)`);
  }

  const phone = `5511999${String(Date.now()).slice(-7)}`;
  const contactCreate = await req('POST', '/contacts', {
    phone,
    name: 'Contato Validação',
    origin: 'script',
  });
  if (contactCreate.status !== 201 && contactCreate.status !== 200) {
    fail('POST /contacts', `${contactCreate.status} ${JSON.stringify(contactCreate.data)}`);
  } else {
    ok('POST /contacts');
  }

  const contactId = contactCreate.data?.id;
  const contactGet = await req('GET', `/contacts/${contactId}`);
  if (contactGet.status !== 200) fail('GET /contacts/:id', contactGet.status);
  else ok('GET /contacts/:id');

  const contactPatch = await req('PATCH', `/contacts/${contactId}`, { notes: 'teste' });
  if (contactPatch.status !== 200) fail('PATCH /contacts/:id', contactPatch.status);
  else ok('PATCH /contacts/:id');

  const dealCreate = await req('POST', '/deals', {
    pipelineId: pipeline.id,
    stageId: firstStage.id,
    contactId,
    title: 'Deal validação',
    valueCents: 150000,
    temperature: 'WARM',
  });
  if (dealCreate.status !== 201 && dealCreate.status !== 200) {
    fail('POST /deals', `${dealCreate.status} ${JSON.stringify(dealCreate.data)}`);
  } else {
    ok('POST /deals');
  }

  const dealId = dealCreate.data?.id;
  const secondStage = pipeline.stages?.find((s) => s.id !== firstStage.id && !s.isWon && !s.isLost);

  const dealsList = await req('GET', `/deals?pipelineId=${pipeline.id}&take=20`);
  if (dealsList.status !== 200 || !dealsList.data?.items) {
    fail('GET /deals', JSON.stringify(dealsList.data));
  } else {
    ok(`GET /deals (${dealsList.data.total} total)`);
  }

  if (secondStage) {
    const move = await req('POST', `/deals/${dealId}/move`, { stageId: secondStage.id });
    if (move.status !== 201 && move.status !== 200) {
      fail('POST /deals/:id/move', `${move.status} ${JSON.stringify(move.data)}`);
    } else {
      ok('POST /deals/:id/move');
    }
  }

  const taskCreate = await req('POST', '/tasks', {
    title: 'Follow-up validação',
    dealId,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  if (taskCreate.status !== 201 && taskCreate.status !== 200) {
    fail('POST /tasks', `${taskCreate.status} ${JSON.stringify(taskCreate.data)}`);
  } else {
    ok('POST /tasks');
  }

  const taskId = taskCreate.data?.id;
  const tasksList = await req('GET', '/tasks?take=20');
  if (tasksList.status !== 200 || !tasksList.data?.items) {
    fail('GET /tasks', JSON.stringify(tasksList.data));
  } else {
    ok(`GET /tasks (${tasksList.data.total} total)`);
  }

  const taskPatch = await req('PATCH', `/tasks/${taskId}`, { status: 'DONE' });
  if (taskPatch.status !== 200) fail('PATCH /tasks/:id', taskPatch.status);
  else ok('PATCH /tasks/:id');

  const dealDelete = await req('DELETE', `/deals/${dealId}`);
  if (dealDelete.status !== 200) fail('DELETE /deals/:id', dealDelete.status);
  else ok('DELETE /deals/:id');

  const taskDelete = await req('DELETE', `/tasks/${taskId}`);
  if (taskDelete.status !== 200) fail('DELETE /tasks/:id', taskDelete.status);
  else ok('DELETE /tasks/:id');

  console.log(`\nResultado: ${passed} ok, ${failed} falhas\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
