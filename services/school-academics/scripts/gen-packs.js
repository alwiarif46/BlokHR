const fs = require('fs');
const path = require('path');

function units(boardNote) {
  return [1, 2, 3, 4].map((i) => ({
    label: 'Sample Unit ' + i + ' (replace from official ' + boardNote + ')',
    planned_weeks: 2,
    topics: [1, 2, 3].map((j) => ({
      label: 'Sample Topic ' + i + '.' + j,
      estimated_periods: 2,
    })),
  }));
}

function course(subject, cls, boardNote) {
  return {
    subject_code: subject,
    class_label: String(cls),
    label: subject + ' ' + cls,
    units: units(boardNote),
  };
}

function mini(id, family, board, year, courses, extra = {}) {
  return {
    id,
    family,
    board,
    academic_year: year,
    label: id,
    status: 'sample',
    source_note: 'SAMPLE fixture',
    courses,
    ...extra,
  };
}

const root = path.join(__dirname, '..');
const cbse = {
  id: 'cbse-2026-27',
  family: 'cbse',
  board: 'cbse',
  academic_year: '2026-27',
  label: 'CBSE Secondary 2026-27 (sample)',
  status: 'sample',
  source_note:
    'SAMPLE ONLY — derive from cbseacademic.nic.in Secondary Curriculum 2026-27 before marking official',
  courses: ['Science', 'Mathematics'].flatMap((s) =>
    [8, 9, 10].map((c) => course(s, c, 'CBSE 2026-27 curriculum')),
  ),
};
const icse = {
  id: 'icse-2027',
  family: 'icse',
  board: 'icse',
  academic_year: '2027',
  label: 'ICSE 2027 (sample)',
  status: 'sample',
  source_note:
    'SAMPLE ONLY — derive from CISCE Regulations & Syllabuses 2027 before marking official',
  courses: ['Physics', 'Mathematics'].flatMap((s) =>
    [9, 10].map((c) => course(s, c, 'CISCE 2027')),
  ),
};
const mh = {
  id: 'state-MH-2026-27',
  family: 'state',
  state_code: 'MH',
  board: 'state',
  academic_year: '2026-27',
  label: 'Maharashtra SSC 2026-27 (sample)',
  status: 'sample',
  source_note:
    'SAMPLE ONLY — derive from Balbharati/MSBSHSE; Marathi labels required before official',
  courses: ['Science-I', 'Mathematics-I'].flatMap((s) =>
    [9, 10].map((c) => course(s, c, 'MSBSHSE 2026-27')),
  ),
};

fs.writeFileSync(path.join(root, 'packs/cbse-2026-27.json'), JSON.stringify(cbse, null, 2));
fs.writeFileSync(path.join(root, 'packs/icse-2027.json'), JSON.stringify(icse, null, 2));
fs.writeFileSync(path.join(root, 'packs/mh-ssc-2026-27.json'), JSON.stringify(mh, null, 2));

const one = [course('Sc', '8', 'fixture')];
const fx = path.join(root, 'tests/fixtures');
fs.writeFileSync(
  path.join(fx, 'packs-valid/ok.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', one), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-ib/ib.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'ib', '2026-27', one), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-bad-units/bad.json'),
  JSON.stringify(
    mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', [
      {
        subject_code: 'Sc',
        class_label: '8',
        label: 'Sc 8',
        units: [{ label: '', planned_weeks: 0, topics: [] }],
      },
    ]),
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(fx, 'packs-dup/a.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', one), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-dup/b.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', one), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-state-missing/st.json'),
  JSON.stringify(mini('state-2026-27', 'state', 'state', '2026-27', one), null, 2),
);
const installCourses = [
  course('Science', '8', 'install'),
  course('Science', '9', 'install'),
  course('Mathematics', '8', 'install'),
];
fs.writeFileSync(
  path.join(fx, 'packs-install/pack.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', installCourses), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-abort/pack.json'),
  JSON.stringify(
    mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', [
      course('Science', '8', 'abort'),
      course('Science', '9', 'abort'),
    ]),
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(fx, 'packs-update/old.json'),
  JSON.stringify(mini('cbse-2026-27', 'cbse', 'cbse', '2026-27', one), null, 2),
);
fs.writeFileSync(
  path.join(fx, 'packs-update/new.json'),
  JSON.stringify(mini('cbse-2027-28', 'cbse', 'cbse', '2027-28', one), null, 2),
);
console.log('packs written');
