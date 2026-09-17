const fs = require('fs');
const path = require('path');

// Patch multi-auth member lookups
{
  const f = 'backend/src/services/multi-auth-service.ts';
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(
    /'SELECT name FROM members WHERE email = \? AND active = 1',\r?\n(\s*)\[email\]/g,
    "'SELECT name FROM members WHERE tenant_id = ? AND email = ? AND active = 1',\n$1[this.tid(), email]",
  );
  c = c.replace(
    /'SELECT email, name FROM members WHERE email = \? AND active = 1',\r?\n(\s*)\[(email|normalized)\]/g,
    "'SELECT email, name FROM members WHERE tenant_id = ? AND email = ? AND active = 1',\n$1[this.tid(), $2]",
  );
  fs.writeFileSync(f, c);
  console.log('multi-auth members scoped');
}

// Patch settings-repository member methods
{
  const f = 'backend/src/repositories/settings-repository.ts';
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes("getTenantId")) {
    // already has getTenantId from earlier work
  }
  c = c.replace(
    "return this.db.all<MemberRow>('SELECT * FROM members ORDER BY name');",
    "return this.db.all<MemberRow>('SELECT * FROM members WHERE tenant_id = ? ORDER BY name', [getTenantId()]);",
  );
  c = c.replace(
    "return this.db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [id]);",
    "return this.db.get<MemberRow>('SELECT * FROM members WHERE tenant_id = ? AND id = ?', [getTenantId(), id]);",
  );
  c = c.replace(
    "return this.db.get<MemberRow>('SELECT * FROM members WHERE email = ?', [email]);",
    "return this.db.get<MemberRow>('SELECT * FROM members WHERE tenant_id = ? AND email = ?', [getTenantId(), email]);",
  );
  // INSERT INTO members — add tenant_id as first column
  if (!c.includes('INSERT INTO members (\n        tenant_id,')) {
    c = c.replace(
      `INSERT INTO members (
        id, email, name, group_id, member_type_id, role, designation,
        phone, joining_date, location, timezone,
        individual_shift_start, individual_shift_end, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      `INSERT INTO members (
        tenant_id, id, email, name, group_id, member_type_id, role, designation,
        phone, joining_date, location, timezone,
        individual_shift_start, individual_shift_end, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    c = c.replace(
      `[
        data.id,
        data.email,
        data.name,`,
      `[
        getTenantId(),
        data.id,
        data.email,
        data.name,`,
    );
  }
  fs.writeFileSync(f, c);
  console.log('settings-repository members scoped');
}
