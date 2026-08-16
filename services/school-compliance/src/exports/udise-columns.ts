/**
 * VERIFY AGAINST CURRENT SDMS TEMPLATE — column order for UDISE+ SDMS CSV export.
 * Statutory templates change; keep this array as the single source of truth.
 */
export const UDISE_COLUMNS = [
  'name',
  'dob',
  'gender',
  'admission_no',
  'admission_date',
  'class',
  'section',
  'category',
  'mother_name',
  'contact',
  'apaar_id',
  'is_cwsn',
  'cwsn_category',
  'cwsn_disability',
  'cwsn_certificate',
  'is_rte',
] as const;

export type UdiseColumn = (typeof UDISE_COLUMNS)[number];
