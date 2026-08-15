import type { StatePack } from './types';

export const tnPack: StatePack = {
  code: 'TN',
  label: 'Tamil Nadu',
  categories: [
    { code: 'OC', label: 'Open Competition' },
    { code: 'BC', label: 'Backward Class' },
    { code: 'BCM', label: 'Backward Class Muslim' },
    { code: 'MBC', label: 'Most Backward Class' },
    { code: 'DNC', label: 'Denotified Communities' },
    { code: 'SC', label: 'Scheduled Caste' },
    { code: 'SCA', label: 'Scheduled Caste Arunthathiyar' },
    { code: 'ST', label: 'Scheduled Tribe' },
  ],
  studentIdField: {
    label: 'EMIS',
    pattern: '^\\d{8}$',
  },
  gradeSchemes: [
    {
      board: 'TNBSE',
      labels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E'],
    },
  ],
  scripts: ['taml'],
};
