const mongoose = require('mongoose');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_FORMATS = new Set(['pdf', 'excel']);
const ATTENDANCE_STATUSES = new Set([
  'present', 'absent', 'half_day', 'paid_leave', 'unpaid_leave', 'weekly_off', 'holiday', 'compensatory_off',
]);

function isObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function isMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

function isDate(value) {
  return typeof value === 'string' && DATE_RE.test(value);
}

function asString(value, max = 200) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asBoolean(value) {
  return value === true;
}

function asInteger(value, { min = 0, max = 10_000 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function asStringArray(value, { maxItems = 100, maxLen = 120 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function asObjectIdArray(value, { maxItems = 100 } = {}) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(isObjectId).slice(0, maxItems);
}

function sanitizeToolArguments(schema, raw = {}) {
  const errors = [];
  const out = {};
  const input = raw && typeof raw === 'object' ? raw : {};

  for (const [key, rule] of Object.entries(schema || {})) {
    const value = input[key];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (rule.required) errors.push(`Missing required parameter: ${key}`);
      else if (rule.default !== undefined) out[key] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'objectId':
        if (!isObjectId(String(value))) errors.push(`Invalid ObjectId: ${key}`);
        else out[key] = String(value);
        break;
      case 'objectIdArray':
        out[key] = asObjectIdArray(value, { maxItems: rule.maxItems || 100 });
        if (rule.required && out[key].length === 0) errors.push(`Missing required parameter: ${key}`);
        break;
      case 'string':
        out[key] = asString(value, rule.max || 200);
        if (rule.required && !out[key]) errors.push(`Missing required parameter: ${key}`);
        break;
      case 'month':
        if (!isMonth(String(value))) errors.push(`Invalid month: ${key}`);
        else out[key] = String(value);
        break;
      case 'date':
        if (!isDate(String(value))) errors.push(`Invalid date: ${key}`);
        else out[key] = String(value);
        break;
      case 'dateArray':
        out[key] = asStringArray(value).filter(isDate);
        break;
      case 'format':
        if (!ALLOWED_FORMATS.has(String(value))) errors.push(`Invalid format: ${key}`);
        else out[key] = String(value);
        break;
      case 'status':
        if (!ATTENDANCE_STATUSES.has(String(value))) errors.push(`Invalid status: ${key}`);
        else out[key] = String(value);
        break;
      case 'boolean':
        out[key] = asBoolean(value);
        break;
      case 'integer':
        out[key] = asInteger(value, { min: rule.min, max: rule.max });
        if (out[key] === null) errors.push(`Invalid integer: ${key}`);
        break;
      case 'enum':
        if (!Array.isArray(rule.values) || !rule.values.includes(value)) errors.push(`Invalid enum: ${key}`);
        else out[key] = value;
        break;
      default:
        errors.push(`Unsupported schema type for ${key}`);
    }
  }

  return { ok: errors.length === 0, errors, value: out };
}

const ALLOWED_INTENTS = new Set([
  'general_question',
  'database_read',
  'database_search',
  'database_aggregation',
  'employee_information',
  'attendance_information',
  'payroll_information',
  'document_request',
  'write_action',
  'edit_action',
  'delete_action',
  'follow_up',
  'clarification',
  'unsupported',
]);

function validatePlanContract(plan) {
  if (!plan || typeof plan !== 'object') {
    return {
      ok: false,
      errors: ['Plan must be an object'],
      value: null,
    };
  }

  const intent = asString(plan.intent, 80);
  if (!intent) {
    return {
      ok: false,
      errors: ['Missing intent'],
      value: null,
    };
  }
  if (!ALLOWED_INTENTS.has(intent)) {
    return {
      ok: false,
      errors: [`Unknown intent: ${intent}`],
      value: null,
    };
  }

  const confidence = Number(plan.confidence);
  const value = {
    intent,
    language: ['hi', 'en', 'hinglish'].includes(plan.language) ? plan.language : 'hi',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    tool: asString(plan.tool, 120),
    arguments: plan.arguments && typeof plan.arguments === 'object' && !Array.isArray(plan.arguments)
      ? plan.arguments
      : {},
    requiresClarification: plan.requiresClarification === true,
    clarificationQuestion: asString(plan.clarificationQuestion, 500),
    reply: asString(plan.reply, 1000),
  };

  // Reject obviously unsafe argument shapes (no raw query/code blobs).
  for (const [key, arg] of Object.entries(value.arguments)) {
    if (typeof arg === 'string' && /(;|--|\bdrop\b|\bdelete\b|\beval\b|\brequire\b)/i.test(arg) && key.toLowerCase().includes('query')) {
      return { ok: false, errors: [`Unsafe argument rejected: ${key}`], value: null };
    }
  }

  return { ok: true, errors: [], value };
}

module.exports = {
  isObjectId,
  isMonth,
  isDate,
  asString,
  asBoolean,
  asInteger,
  asStringArray,
  asObjectIdArray,
  sanitizeToolArguments,
  validatePlanContract,
  ATTENDANCE_STATUSES,
};
