import type { DatabaseEngine } from '../db/engine';
import { tenureMonths, tenureYears, isInProbation } from '../formula';

// ── Types ──

/** All variables available for template substitution. */
export interface TemplateVariables {
  [key: string]: string | number | boolean | null | undefined;
}

/** Context needed for data lookups and formula bridge. */
export interface TemplateContext {
  /** Target employee email — used for data lookups. */
  email: string;
  /** Database engine — used for data lookups (leave balance, etc.). */
  db: DatabaseEngine;
  /** Extra variables beyond the standard member fields. */
  extraVariables?: TemplateVariables;
}

/** Result of a template merge. */
export interface MergeResult {
  content: string;
  variables: TemplateVariables;
}

// ── Member row for variable extraction ──

interface MemberLookupRow {
  [key: string]: unknown;
  email: string;
  name: string;
  designation: string;
  group_id: string | null;
  member_type_id: string;
  role: string;
  phone: string;
  emergency_contact: string;
  joining_date: string;
  location: string;
  timezone: string;
  pan_number: string;
  aadhaar_number: string;
  uan_number: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  ac_parentage: string;
  basic_salary: number;
  da: number;
  reports_to: string;
  position_id: string | null;
}

interface GroupLookupRow {
  [key: string]: unknown;
  id: string;
  name: string;
}

interface PositionLookupRow {
  [key: string]: unknown;
  id: string;
  title: string;
}

// ── Safe expression evaluation ──

/**
 * Token types for the expression parser.
 * We only support: numbers, strings, identifiers (variable names),
 * comparison operators (>, <, >=, <=, ==, !=), and boolean operators (&&, ||).
 * NO function calls, NO property access, NO assignment.
 */
type TokenType = 'number' | 'string' | 'identifier' | 'operator' | 'end';

interface Token {
  type: TokenType;
  value: string | number;
}

/** Tokenize a simple comparison expression. */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    // Whitespace
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }

    // Number (integer or decimal)
    if (s[i] >= '0' && s[i] <= '9') {
      let num = '';
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        num += s[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // String literal (single or double quoted)
    if (s[i] === "'" || s[i] === '"') {
      const quote = s[i++];
      let str = '';
      while (i < s.length && s[i] !== quote) {
        str += s[i++];
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Operators
    if (s[i] === '>' || s[i] === '<' || s[i] === '!' || s[i] === '=') {
      let op = s[i++];
      if (i < s.length && s[i] === '=') {
        op += s[i++];
      }
      tokens.push({ type: 'operator', value: op });
      continue;
    }

    if (s[i] === '&' && i + 1 < s.length && s[i + 1] === '&') {
      tokens.push({ type: 'operator', value: '&&' });
      i += 2;
      continue;
    }

    if (s[i] === '|' && i + 1 < s.length && s[i + 1] === '|') {
      tokens.push({ type: 'operator', value: '||' });
      i += 2;
      continue;
    }

    // Identifier (variable name — letters, digits, underscores)
    if ((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z') || s[i] === '_') {
      let ident = '';
      while (
        i < s.length &&
        ((s[i] >= 'a' && s[i] <= 'z') ||
          (s[i] >= 'A' && s[i] <= 'Z') ||
          (s[i] >= '0' && s[i] <= '9') ||
          s[i] === '_')
      ) {
        ident += s[i++];
      }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: 'end', value: '' });
  return tokens;
}

/**
 * Evaluate a simple conditional expression against provided variables.
 * Supports: variable comparisons (>, <, >=, <=, ==, !=), && and ||.
 * Does NOT support function calls, property access, or arbitrary code.
 *
 * Examples:
 *   "tenure_years > 5"
 *   "designation == 'Manager'"
 *   "tenure_years > 3 && department == 'Engineering'"
 */
function evaluateExpression(expr: string, vars: TemplateVariables): boolean {
  const tokens = tokenize(expr);
  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function resolveValue(token: Token): string | number | boolean | null {
    if (token.type === 'number') return token.value as number;
    if (token.type === 'string') return token.value as string;
    if (token.type === 'identifier') {
      const val = vars[token.value as string];
      if (val === undefined || val === null) return null;
      return val;
    }
    return null;
  }

  function parseComparison(): boolean {
    const leftToken = advance();
    const left = resolveValue(leftToken);

    if (current().type === 'end' || current().value === '&&' || current().value === '||') {
      // Bare truthy check
      return !!left;
    }

    const op = advance();
    if (op.type !== 'operator') return !!left;

    const rightToken = advance();
    const right = resolveValue(rightToken);

    // Coerce for comparison
    const leftNum = typeof left === 'number' ? left : Number(left);
    const rightNum = typeof right === 'number' ? right : Number(right);
    const useNumeric = !isNaN(leftNum) && !isNaN(rightNum);

    switch (op.value) {
      case '>':
        return useNumeric ? leftNum > rightNum : String(left) > String(right);
      case '<':
        return useNumeric ? leftNum < rightNum : String(left) < String(right);
      case '>=':
        return useNumeric ? leftNum >= rightNum : String(left) >= String(right);
      case '<=':
        return useNumeric ? leftNum <= rightNum : String(left) <= String(right);
      case '==':
        return String(left) === String(right);
      case '!=':
        return String(left) !== String(right);
      default:
        return false;
    }
  }

  function parseOr(): boolean {
    let result = parseAnd();
    while (current().type === 'operator' && current().value === '||') {
      advance(); // consume ||
      const right = parseAnd();
      result = result || right;
    }
    return result;
  }

  function parseAnd(): boolean {
    let result = parseComparison();
    while (current().type === 'operator' && current().value === '&&') {
      advance(); // consume &&
      const right = parseComparison();
      result = result && right;
    }
    return result;
  }

  return parseOr();
}

// ── Standard variable names ──

/** The ~30 standard variables extracted from member + group + position data. */
const STANDARD_VARIABLE_NAMES = [
  'employee_name',
  'employee_email',
  'designation',
  'department',
  'department_id',
  'member_type',
  'role',
  'phone',
  'emergency_contact',
  'joining_date',
  'location',
  'timezone',
  'pan_number',
  'aadhaar_number',
  'uan_number',
  'bank_account_number',
  'bank_ifsc',
  'bank_name',
  'ac_parentage',
  'basic_salary',
  'da',
  'reports_to',
  'position_title',
  'position_id',
  'tenure_months',
  'tenure_years',
  'is_probation',
  'current_date',
  'current_year',
  'company_name',
] as const;

export type StandardVariableName = (typeof STANDARD_VARIABLE_NAMES)[number];

// ── Template Engine ──

/**
 * Template engine for document generation.
 *
 * Supported syntax:
 *   {{variable_name}}                        — simple substitution
 *   {{formula:tenure:joining_date}}           — formula bridge (calls formula engine)
 *   {{leave_balance:Casual}}                  — data lookup (queries DB)
 *   {{if:expression}}content{{/if}}           — conditional block
 *   {{if:expression}}yes{{else}}no{{/if}}     — conditional with else
 *
 * Expression parser supports: >, <, >=, <=, ==, !=, &&, ||.
 * No arbitrary code execution — the tokenizer only recognizes numbers,
 * strings, identifiers, and comparison/boolean operators.
 */
export class TemplateEngine {
  /**
   * Merge a template string with context data.
   * 1. Loads member variables from DB
   * 2. Processes conditionals ({{if:...}}...{{/if}})
   * 3. Processes formula bridge ({{formula:...}})
   * 4. Processes data lookups ({{leave_balance:...}})
   * 5. Substitutes remaining {{variables}}
   *
   * Returns the merged content + the full variable map used.
   */
  async merge(template: string, context: TemplateContext): Promise<MergeResult> {
    const variables = await this.buildVariables(context);

    let content = template;

    // Phase 1: Process conditionals (may be nested, process outer first)
    content = this.processConditionals(content, variables);

    // Phase 2: Process formula bridge tags
    content = this.processFormulas(content, variables);

    // Phase 3: Process data lookups
    content = await this.processLookups(content, context);

    // Phase 4: Substitute simple variables
    content = this.substituteVariables(content, variables);

    return { content, variables };
  }

  /** Get all standard variable names (for template builder UI). */
  getAvailableVariables(): readonly string[] {
    return STANDARD_VARIABLE_NAMES;
  }

  // ── Variable building ──

  /** Load member, group, position, and company data to build the variable map. */
  private async buildVariables(context: TemplateContext): Promise<TemplateVariables> {
    const vars: TemplateVariables = {};
    const now = new Date();

    // Current date/year always available
    vars.current_date = now.toISOString().slice(0, 10);
    vars.current_year = now.getFullYear();

    // Load member data
    const member = await context.db.get<MemberLookupRow>(
      `SELECT email, name, designation, group_id, member_type_id, role, phone,
              emergency_contact, joining_date, location, timezone,
              pan_number, aadhaar_number, uan_number, bank_account_number,
              bank_ifsc, bank_name, ac_parentage, basic_salary, da,
              reports_to, position_id
       FROM members WHERE email = ?`,
      [context.email],
    );

    if (member) {
      vars.employee_name = member.name;
      vars.employee_email = member.email;
      vars.designation = member.designation;
      vars.department_id = member.group_id ?? '';
      vars.member_type = member.member_type_id;
      vars.role = member.role;
      vars.phone = member.phone;
      vars.emergency_contact = member.emergency_contact;
      vars.joining_date = member.joining_date;
      vars.location = member.location;
      vars.timezone = member.timezone;
      vars.pan_number = member.pan_number;
      vars.aadhaar_number = member.aadhaar_number;
      vars.uan_number = member.uan_number;
      vars.bank_account_number = member.bank_account_number;
      vars.bank_ifsc = member.bank_ifsc;
      vars.bank_name = member.bank_name;
      vars.ac_parentage = member.ac_parentage;
      vars.basic_salary = member.basic_salary;
      vars.da = member.da;
      vars.reports_to = member.reports_to;
      vars.position_id = member.position_id ?? '';

      // Group name
      if (member.group_id) {
        const group = await context.db.get<GroupLookupRow>(
          'SELECT id, name FROM groups WHERE id = ?',
          [member.group_id],
        );
        vars.department = group?.name ?? '';
      } else {
        vars.department = '';
      }

      // Position title
      if (member.position_id) {
        const position = await context.db.get<PositionLookupRow>(
          'SELECT id, title FROM org_positions WHERE id = ?',
          [member.position_id],
        );
        vars.position_title = position?.title ?? '';
      } else {
        vars.position_title = '';
      }

      // Tenure calculations
      if (member.joining_date) {
        vars.tenure_months = tenureMonths(member.joining_date);
        vars.tenure_years = tenureYears(member.joining_date);
        vars.is_probation = isInProbation(member.joining_date, 6);
      } else {
        vars.tenure_months = 0;
        vars.tenure_years = 0;
        vars.is_probation = false;
      }
    }

    // Company name from branding
    const branding = await context.db.get<{ company_name: string; [key: string]: unknown }>(
      'SELECT company_name FROM branding WHERE id = 1',
    );
    vars.company_name = branding?.company_name ?? '';

    // Merge extra variables (override standard ones if provided)
    if (context.extraVariables) {
      for (const [key, val] of Object.entries(context.extraVariables)) {
        vars[key] = val;
      }
    }

    return vars;
  }

  // ── Conditional processing ──

  /**
   * Process {{if:expression}}content{{/if}} and {{if:expression}}yes{{else}}no{{/if}}.
   * Handles nested conditionals by processing innermost first.
   */
  private processConditionals(content: string, vars: TemplateVariables): string {
    // Regex matches innermost {{if:...}}...{{/if}} (no nested {{if inside)
    const ifElsePattern =
      /\{\{if:([^}]+)\}\}((?:(?!\{\{if:)[\s\S])*?)\{\{else\}\}((?:(?!\{\{if:)[\s\S])*?)\{\{\/if\}\}/;
    const ifPattern = /\{\{if:([^}]+)\}\}((?:(?!\{\{if:)[\s\S])*?)\{\{\/if\}\}/;

    let result = content;
    let safety = 0;
    const maxIterations = 100;

    // Process if/else first, then plain if
    while (safety++ < maxIterations) {
      const elseMatch = ifElsePattern.exec(result);
      if (elseMatch) {
        const expression = elseMatch[1].trim();
        const trueBlock = elseMatch[2];
        const falseBlock = elseMatch[3];
        const condition = evaluateExpression(expression, vars);
        result = result.replace(elseMatch[0], condition ? trueBlock : falseBlock);
        continue;
      }

      const ifMatch = ifPattern.exec(result);
      if (ifMatch) {
        const expression = ifMatch[1].trim();
        const trueBlock = ifMatch[2];
        const condition = evaluateExpression(expression, vars);
        result = result.replace(ifMatch[0], condition ? trueBlock : '');
        continue;
      }

      break;
    }

    return result;
  }

  // ── Formula bridge ──

  /**
   * Process {{formula:formula_name:arg}} tags.
   * Supported formulas:
   *   {{formula:tenure:joining_date}}    → tenureYears from joining_date variable
   *   {{formula:tenure_months:joining_date}} → tenureMonths
   *   {{formula:probation:joining_date}} → "Yes" or "No"
   */
  private processFormulas(content: string, vars: TemplateVariables): string {
    const formulaPattern = /\{\{formula:([^:}]+):([^}]+)\}\}/g;
    let result = content;
    let match: RegExpExecArray | null;

    // Collect all matches first (avoid mutation during iteration)
    const replacements: { full: string; value: string }[] = [];
    while ((match = formulaPattern.exec(content)) !== null) {
      const formulaName = match[1].trim();
      const argName = match[2].trim();
      const argValue = String(vars[argName] ?? '');

      let value = '';
      switch (formulaName) {
        case 'tenure':
          value = argValue ? String(tenureYears(argValue)) : '0';
          break;
        case 'tenure_months':
          value = argValue ? String(tenureMonths(argValue)) : '0';
          break;
        case 'probation':
          value = argValue ? (isInProbation(argValue, 6) ? 'Yes' : 'No') : 'N/A';
          break;
        default:
          value = `[Unknown formula: ${formulaName}]`;
      }
      replacements.push({ full: match[0], value });
    }

    for (const rep of replacements) {
      result = result.replace(rep.full, rep.value);
    }

    return result;
  }

  // ── Data lookups ──

  /**
   * Process {{leave_balance:LeaveType}} tags.
   * Queries pto_balances for the current year and returns (accrued + carry_forward - used).
   */
  private async processLookups(content: string, context: TemplateContext): Promise<string> {
    const lookupPattern = /\{\{leave_balance:([^}]+)\}\}/g;
    let result = content;
    let match: RegExpExecArray | null;

    const replacements: { full: string; value: string }[] = [];
    while ((match = lookupPattern.exec(content)) !== null) {
      const leaveType = match[1].trim();
      const currentYear = new Date().getFullYear();

      const row = await context.db.get<{
        accrued: number;
        used: number;
        carry_forward: number;
        [key: string]: unknown;
      }>(
        'SELECT accrued, used, carry_forward FROM pto_balances WHERE email = ? AND leave_type = ? AND year = ?',
        [context.email, leaveType, currentYear],
      );

      let balance = 0;
      if (row) {
        balance = row.accrued + row.carry_forward - row.used;
      }
      replacements.push({ full: match[0], value: String(balance) });
    }

    for (const rep of replacements) {
      result = result.replace(rep.full, rep.value);
    }

    return result;
  }

  // ── Variable substitution ──

  /** Replace all remaining {{variable}} tags with their values. */
  private substituteVariables(content: string, vars: TemplateVariables): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
      const key = varName.trim();
      const val = vars[key];
      if (val === undefined || val === null) return '';
      return String(val);
    });
  }
}
