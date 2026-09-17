const fs = require('fs');
const path = require('path');

const services = [
  ['school-attendance', 'createAttendanceTenantPool', 'school-attendance.db'],
  ['school-identity', 'createIdentityTenantPool', 'school-identity.db'],
  ['school-fees', 'createFeesTenantPool', 'school-fees.db'],
  ['school-academics', 'createAcademicsTenantPool', 'school-academics.db'],
  ['school-timetable', 'createTimetableTenantPool', 'school-timetable.db'],
  ['school-assessment', 'createAssessmentTenantPool', 'school-assessment.db'],
  ['school-library', 'createLibraryTenantPool', 'school-library.db'],
  ['school-transport', 'createTransportTenantPool', 'school-transport.db'],
  ['school-engagement', 'createEngagementTenantPool', 'school-engagement.db'],
  ['school-compliance', 'createComplianceTenantPool', 'school-compliance.db'],
  ['school-family-ops', 'createFamilyOpsTenantPool', 'school-family-ops.db'],
  ['school-surveys', 'createSurveysTenantPool', 'school-surveys.db'],
];

const shared = fs.readFileSync(
  path.join('services', '_shared', 'tenant-sqlite.ts'),
  'utf8',
);

for (const [svc, poolFn, file] of services) {
  const dbPath = path.join('services', svc, 'src', 'db.ts');
  const dbSrc = fs.readFileSync(dbPath, 'utf8');
  const classM = dbSrc.match(/export class (\w+Sqlite)/);
  const migM = dbSrc.match(/export async function (run\w+Migrations)/);
  if (!classM || !migM) {
    console.error('missing exports', svc);
    process.exit(1);
  }
  const sqliteName = classM[1];
  const migrateName = migM[1];
  const out =
    shared +
    `

import { ${sqliteName}, ${migrateName} } from './db';

export function ${poolFn}(opts: {
  legacyPath: string;
  migrationsDir: string;
  env?: NodeJS.ProcessEnv;
}): TenantSqlitePool<${sqliteName}> {
  return new TenantSqlitePool({
    legacyPath: opts.legacyPath,
    serviceFile: '${file}',
    env: opts.env,
    create: (p) => ${sqliteName}.create(p),
    migrate: (db) => ${migrateName}(db, opts.migrationsDir),
  });
}
`;
  fs.writeFileSync(path.join('services', svc, 'src', 'tenant-db.ts'), out);
  console.log('wrote', svc, sqliteName, migrateName);
}
