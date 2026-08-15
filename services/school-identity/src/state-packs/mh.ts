import type { StatePack } from './types';

export const mhPack: StatePack = {
  code: 'MH',
  label: 'Maharashtra',
  categories: [
    { code: 'GEN', label: 'General' },
    { code: 'SC', label: 'Scheduled Caste' },
    { code: 'ST', label: 'Scheduled Tribe' },
    { code: 'VJNT-A', label: 'VJNT-A' },
    { code: 'NT-B', label: 'NT-B' },
    { code: 'NT-C', label: 'NT-C' },
    { code: 'NT-D', label: 'NT-D' },
    { code: 'OBC', label: 'Other Backward Class' },
    { code: 'SBC', label: 'Special Backward Class' },
    { code: 'EWS', label: 'Economically Weaker Section' },
  ],
  gradeSchemes: [
    {
      board: 'MSBSHSE SSC',
      labels: ['A+', 'A', 'B', 'C', 'D', 'E'],
    },
    {
      board: 'MSBSHSE HSC',
      labels: ['Distinction', 'First', 'Second', 'Pass', 'Fail'],
    },
  ],
  scripts: ['deva'],
};
