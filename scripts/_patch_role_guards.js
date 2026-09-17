const fs = require('fs');
const path = require('path');

const old = `if (!policy) {
      res.status(403).json({ error: 'no_policy' });
      return;
    }

    if (policy.internalOnly) {`;

const insert = `if (!policy) {
      res.status(403).json({ error: 'no_policy' });
      return;
    }

    // Defense in depth: path :tenantId must match gateway X-Blok-Tenant when both present.
    const pathTenant = String((req.params as { tenantId?: string }).tenantId ?? '')
      .trim()
      .toLowerCase();
    const headerTenant = String(req.headers['x-blok-tenant'] ?? '')
      .trim()
      .toLowerCase();
    if (pathTenant && headerTenant && pathTenant !== headerTenant) {
      res.status(403).json({ error: 'tenant_mismatch' });
      return;
    }

    if (policy.internalOnly) {`;

const services = fs
  .readdirSync('services')
  .filter(
    (d) =>
      d.startsWith('school-') ||
      d === 'directory' ||
      d === 'time-tracking' ||
      d === 'overtime',
  );

let n = 0;
for (const s of services) {
  const f = path.join('services', s, 'src', 'role-guard.ts');
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes("error: 'tenant_mismatch'")) {
    console.log('skip', s);
    continue;
  }
  if (!c.includes(old)) {
    console.log('pattern miss', s);
    continue;
  }
  c = c.replace(old, insert);
  fs.writeFileSync(f, c);
  n++;
  console.log('patched', s);
}
console.log('count', n);
