-- 052_nav_feature_flags: Sidebar module flags — every nav item toggleable.
-- All enabled by default to preserve existing deployments.

INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category) VALUES
  ('dashboard',              'Dashboard',                  'Personal dashboard and overview widgets',              'core'),
  ('attendance',             'Attendance',                 'Clock in/out and team attendance board',                'core'),
  ('holidays',               'Holiday Calendar',           'Company holiday calendar',                             'core'),
  ('meetings',               'Meetings',                   'BD meetings and platform meeting integration',         'core'),
  ('my_preferences',         'My Preferences',             'Personal notification and display preferences',        'core'),
  ('leaves',                 'Leaves',                     'Leave requests, balances, and approvals',              'core'),
  ('regularizations',        'Regularizations',            'Attendance correction requests',                       'core'),
  ('profiles',               'Employee Profiles',          'Employee profile management',                          'core'),
  ('people',                 'People & Directory',         'Member directory and org membership',                  'admin'),
  ('leave_policies',         'Leave Policies',             'Leave policy rules and accrual configuration',       'admin'),
  ('audit_trail',            'Audit Trail',                'System audit log and entity history',                  'admin'),
  ('webhooks',               'Webhook Receivers',          'Inbound webhook logging and replay',                   'admin'),
  ('settings',               'HR Settings',                'Admin settings panel and tenant configuration',      'admin'),
  ('feature_flags',          'Feature Flags Admin',        'Toggle modules on and off for this tenant',            'admin'),
  ('capture_admin',          'Capture Admin',              'Biometric capture enrolment and device management',  'capture'),
  ('school_register',        'School Register',            'School attendance register (capture rollcall)',      'school'),
  ('school_students',        'Students',                   'Student roster and identity records',                  'school'),
  ('school_roll_call',       'Roll Call',                  'Classroom roll call and quick attendance',             'school'),
  ('school_attendance_admin','Attendance Admin',           'School-wide attendance administration',                'school'),
  ('school_academics',       'Academics',                  'Courses, curriculum, and academic structure',          'school'),
  ('school_hpc',             'HPC & Assessment',           'Holistic progress cards and assessments',              'school'),
  ('school_library',         'Library',                    'School library catalogue and circulation',             'school'),
  ('school_parent_surveys',  'Parents & Guardians',        'Parent/guardian surveys and engagement',               'school'),
  ('parent_hub',             'Parent Portal',              'Parent-facing portal shell entry',                     'school'),
  ('school_settings',        'School Settings',            'School-specific admin configuration',                  'school');

-- Admin-only visibility for sensitive modules
UPDATE feature_flags SET admin_only = 1 WHERE feature_key IN (
  'people',
  'leave_policies',
  'audit_trail',
  'webhooks',
  'settings',
  'feature_flags',
  'capture_admin',
  'school_register',
  'school_students',
  'school_roll_call',
  'school_attendance_admin',
  'school_academics',
  'school_hpc',
  'school_library',
  'school_parent_surveys',
  'school_settings'
);
