import type { StatePack } from './types';

export const kaPack: StatePack = {
  code: 'KA',
  label: 'Karnataka',
  categories: [
    { code: 'GEN', label: 'General' },
    { code: 'SC', label: 'Scheduled Caste' },
    { code: 'ST', label: 'Scheduled Tribe' },
    { code: 'OBC-1', label: 'OBC Category 1' },
    { code: 'OBC-2A', label: 'OBC Category 2A' },
    { code: 'OBC-2B', label: 'OBC Category 2B' },
    { code: 'OBC-3A', label: 'OBC Category 3A' },
    { code: 'OBC-3B', label: 'OBC Category 3B' },
    { code: 'EWS', label: 'Economically Weaker Section' },
  ],
  studentIdField: {
    label: 'SATS',
    pattern: '^\\d{6,14}$',
  },
  gradeSchemes: [
    {
      board: 'KSEAB',
      labels: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'],
    },
  ],
  scripts: ['knda'],
};
