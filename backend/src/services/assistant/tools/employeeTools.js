const mongoose = require('mongoose');
const Employee = require('../../../models/Employee');
const { registerTool } = require('../assistantToolRegistry');

function scopeFilter(user) {
  return user.role === 'admin'
    ? { organizationId: { $ne: null } }
    : { organizationId: new mongoose.Types.ObjectId(user.id) };
}

function maskSensitive(value) {
  if (value == null || value === '') return value ?? null;
  const raw = String(value).replace(/\s+/g, '');
  if (!raw) return null;
  if (raw.length <= 4) return '****';
  return `**** ${raw.slice(-4)}`;
}

/** Admin sees full sensitive fields; non-admin gets last-4 mask (payroll parity). */
function formatEmployee(employee, user = null) {
  const unmasked = !user || user.role === 'admin';
  const phone = employee.phone || null;
  const uan = employee.uan || null;
  const esic = employee.esic || employee.esicNumber || null;
  const account = employee.bankAccountNumber || null;
  const aadhaar = employee.aadhaar || employee.aadhaarNumber || null;
  return {
    id: String(employee._id),
    name: employee.name || '',
    employeeCode: employee.employeeCode || employee.code || null,
    status: employee.status || 'active',
    organizationId: employee.organizationId ? String(employee.organizationId) : null,
    locationId: employee.locationId ? String(employee.locationId) : null,
    designation: employee.designation || employee.post || null,
    joiningDate: employee.joiningDate || null,
    phone: unmasked ? phone : maskSensitive(phone),
    uan: unmasked ? uan : maskSensitive(uan),
    esic: unmasked ? esic : maskSensitive(esic),
    bankName: employee.bankName || null,
    ifsc: employee.ifsc || employee.bankRoutingCode || null,
    bankAccountNumber: unmasked ? account : maskSensitive(account),
    aadhaar: unmasked ? aadhaar : maskSensitive(aadhaar),
    basic: employee.basic ?? null,
    da: employee.da ?? null,
    hra: employee.hra ?? null,
  };
}

function registerEmployeeTools() {
  registerTool({
    name: 'employee.count',
    description: 'Count employees, optionally filtered by status, organization, or location.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      status: { type: 'enum', values: ['active', 'disabled', 'all'], default: 'active' },
      organizationId: { type: 'objectId' },
      locationId: { type: 'objectId' },
    },
    async execute({ user, args }) {
      const filter = { ...scopeFilter(user) };
      if (args.status === 'active') filter.status = { $ne: 'disabled' };
      else if (args.status === 'disabled') filter.status = 'disabled';
      if (args.organizationId) filter.organizationId = args.organizationId;
      if (args.locationId) filter.locationId = args.locationId;
      const count = await Employee.countDocuments(filter);
      return { count, filter: { status: args.status || 'active', organizationId: args.organizationId || null, locationId: args.locationId || null } };
    },
    formatResult(result, lang = 'hi') {
      const n = result.count;
      if (lang === 'en') return `There ${n === 1 ? 'is' : 'are'} ${n} employee${n === 1 ? '' : 's'}.`;
      return `${n} कर्मचारी ${n === 1 ? 'है' : 'हैं'}.`;
    },
  });

  registerTool({
    name: 'employee.list',
    description: 'List employees with pagination. Use for directories and detailed lists.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      status: { type: 'enum', values: ['active', 'disabled', 'all'], default: 'active' },
      organizationId: { type: 'objectId' },
      locationId: { type: 'objectId' },
      page: { type: 'integer', min: 1, max: 1000, default: 1 },
      pageSize: { type: 'integer', min: 1, max: 100, default: 25 },
      search: { type: 'string', max: 100 },
    },
    async execute({ user, args }) {
      const filter = { ...scopeFilter(user) };
      if (args.status === 'active') filter.status = { $ne: 'disabled' };
      else if (args.status === 'disabled') filter.status = 'disabled';
      if (args.organizationId) filter.organizationId = args.organizationId;
      if (args.locationId) filter.locationId = args.locationId;
      if (args.search) {
        filter.name = { $regex: args.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      }
      const page = args.page || 1;
      const pageSize = args.pageSize || 25;
      const [total, rows] = await Promise.all([
        Employee.countDocuments(filter),
        Employee.find(filter)
          .select('name employeeCode code status organizationId locationId designation post joiningDate phone')
          .sort({ name: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
      ]);
      return {
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        items: rows.map((row) => ({
          id: String(row._id),
          name: row.name,
          employeeCode: row.employeeCode || row.code || null,
          status: row.status || 'active',
          organizationId: row.organizationId ? String(row.organizationId) : null,
          locationId: row.locationId ? String(row.locationId) : null,
          designation: row.designation || row.post || null,
          joiningDate: row.joiningDate || null,
          phone: row.phone || null,
        })),
      };
    },
    formatResult(result, lang = 'hi') {
      const lines = result.items.map((item, index) => `${(result.page - 1) * result.pageSize + index + 1}. ${item.name}${item.designation ? ` (${item.designation})` : ''}`);
      const header = lang === 'en'
        ? `Showing ${result.items.length} of ${result.total} employees (page ${result.page}).`
        : `${result.total} में से ${result.items.length} कर्मचारी (पेज ${result.page}).`;
      const more = result.hasMore
        ? (lang === 'en' ? '\nAsk for the next page to see more.' : '\nअगला पेज भी माँग सकते हैं।')
        : '';
      return `${header}\n${lines.join('\n')}${more}`;
    },
  });

  registerTool({
    name: 'employee.search',
    description: 'Search employees by name and return matching profiles.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      name: { type: 'string', required: true, max: 100 },
      organizationId: { type: 'objectId' },
      locationId: { type: 'objectId' },
      limit: { type: 'integer', min: 1, max: 20, default: 10 },
    },
    async execute({ user, args }) {
      const filter = {
        ...scopeFilter(user),
        name: { $regex: args.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      };
      if (args.organizationId) filter.organizationId = args.organizationId;
      if (args.locationId) filter.locationId = args.locationId;
      const rows = await Employee.find(filter)
        .select('name employeeCode code status organizationId locationId designation post joiningDate phone basic da hra bankName ifsc bankAccountNumber aadhaar aadhaarNumber uan esic')
        .limit(args.limit || 10)
        .lean();
      return { items: rows.map(formatEmployee), total: rows.length, query: args.name };
    },
    formatResult(result, lang = 'hi') {
      if (result.items.length === 0) {
        return lang === 'en' ? `No employee found for "${result.query}".` : `"${result.query}" से कोई कर्मचारी नहीं मिला।`;
      }
      return result.items.map((item) => [
        item.name,
        item.status ? `Status: ${item.status}` : null,
        item.designation ? `Post: ${item.designation}` : null,
        item.phone ? `Phone: ${item.phone}` : null,
        item.joiningDate ? `Joining: ${item.joiningDate}` : null,
      ].filter(Boolean).join(' | ')).join('\n');
    },
  });

  registerTool({
    name: 'employee.getDetails',
    description: 'Get complete available details for one employee by id.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      employeeId: { type: 'objectId', required: true },
    },
    async execute({ user, args }) {
      const employee = await Employee.findOne({ _id: args.employeeId, ...scopeFilter(user) }).lean();
      if (!employee) return { found: false };
      return { found: true, employee: formatEmployee(employee, user) };
    },
    formatResult(result, lang = 'hi') {
      if (!result.found) return lang === 'en' ? 'Employee not found.' : 'कर्मचारी नहीं मिला।';
      const e = result.employee;
      const lines = [
        e.name,
        e.employeeCode ? `ID: ${e.employeeCode}` : null,
        `Status: ${e.status}`,
        e.designation ? `Designation: ${e.designation}` : null,
        e.joiningDate ? `Joining: ${e.joiningDate}` : null,
        e.phone ? `Phone: ${e.phone}` : null,
        e.uan ? `UAN: ${e.uan}` : null,
        e.esic ? `ESIC: ${e.esic}` : null,
        e.bankName ? `Bank: ${e.bankName}` : null,
        e.ifsc ? `IFSC: ${e.ifsc}` : null,
        e.bankAccountNumber ? `Account: ${e.bankAccountNumber}` : null,
        e.aadhaar ? `Aadhaar: ${e.aadhaar}` : null,
        e.basic != null ? `Basic: ${e.basic}` : null,
        e.da != null ? `DA: ${e.da}` : null,
        e.hra != null ? `HRA: ${e.hra}` : null,
      ].filter(Boolean);
      return lines.join('\n');
    },
  });
}

module.exports = { registerEmployeeTools, formatEmployee, maskSensitive };
