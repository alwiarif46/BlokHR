-- 024_feature_flags: Feature toggle system. All features enabled by default.

CREATE TABLE IF NOT EXISTS feature_flags (
  feature_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all toggleable features (enabled by default)
INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category) VALUES
  ('face_recognition',  'Face Recognition Clock-In',    'Biometric clock-in via facial recognition',       'biometrics'),
  ('iris_scan',         'Iris Scan Clock-In',           'Biometric clock-in via iris scanning',             'biometrics'),
  ('geo_fencing',       'Geo-Fencing',                  'Location-based clock-in with zone enforcement',    'attendance'),
  ('live_chat',         'Shaavir Live Chat',            'Channels, DMs, and real-time feed',                'communication'),
  ('ai_chatbot',        'AI Chatbot',                   'AI-powered assistant with tool execution',         'intelligence'),
  ('time_tracking',     'Time Tracking',                'Client/project time logging and billing',          'productivity'),
  ('overtime',          'Overtime Management',          'OT detection, logging, and approval',              'attendance'),
  ('bd_meetings',       'BD Meeting Tracker',           'Business development meeting workflow',            'meetings'),
  ('tracked_meetings',  'Meeting Platform Integration', 'Teams/Zoom/Meet/Webex meeting tracking',          'meetings'),
  ('training_lms',      'Training & LMS',               'Course catalog, enrollment, and certifications',   'development'),
  ('org_chart',         'Org Chart & Succession',       'Position hierarchy and succession planning',       'organization'),
  ('document_mgmt',     'Document Management',          'Policy repository, templates, acknowledgments',    'compliance'),
  ('surveys',           'Employee Surveys',             'Pulse checks, eNPS, anonymous feedback',           'engagement'),
  ('asset_mgmt',        'Asset Management',             'Company asset tracking and assignment',            'operations'),
  ('visitor_mgmt',      'Visitor Management',           'Visitor registration, check-in, badges',           'operations'),
  ('workflows',         'Workflow Builder',             'Custom approval chains and automations',            'automation'),
  ('file_storage',      'File Storage',                 'Upload, download, and manage files',               'infrastructure'),
  ('analytics',         'Analytics & Reports',          'Attendance, leave, OT, and department reports',    'intelligence');
