const API = process.env.API_URL ?? 'http://localhost:3001';

async function check(path) {
  const res = await fetch(`${API}${path}`);
  const ok = res.ok;
  console.log(`${ok ? 'OK' : 'FAIL'} ${path} → ${res.status}`);
  return ok;
}

async function main() {
  let ok = true;
  ok &&= await check('/health');
  ok &&= await check('/health/ready');
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@leadflow.ai', password: 'demo1234' }),
  });
  console.log(`${login.ok ? 'OK' : 'FAIL'} POST /api/auth/login → ${login.status}`);
  ok &&= login.ok;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
