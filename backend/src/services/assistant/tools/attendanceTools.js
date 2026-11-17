const mongoose = require('mongoose');
const Attendance = require('../../../models/Attendance');
const Employee = require('../../../models/Employee');
const { getAttendanceRegister } = require('../../attendanceService');
const { registerTool } = require('../assistantToolRegistry');

function todayIso(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function registerAttendanceTools() {
  registerTool({
    name: 'attendance.getSummary',
    description: 'Summarize attendance for a location and month (present/absent/leave counts).',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      organizationId: { type: 'objectId', required: true },
      locationId: { type: 'objectId', required: true },
      month: { type: 'month', required: true },
    },
    async execute({ user, args, timeZone }) {
      const register = await getAttendanceRegister(user, {
        organizationId: args.organizationId,
        locationId: args.locationId,
        month: args.month,
      });
      const today = todayIso(timeZone);
      const summary = { present: 0, absent: 0, leave: 0, holiday: 0, weeklyOff: 0, empty: 0, employees: register.employees?.length || 0 };
      for (const emp of register.employees || []) {
        for (const [date, status] of Object.entries(emp.days || {})) {
          if (!date.startsWith(args.month) || date > today) continue;
          if (!status) summary.empty += 1;
          else if (status === 'present' || status === 'half_day') summary.present += 1;
          else if (status === 'absent') summary.absent += 1;
          else if (String(status).includes('leave') || status === 'compensatory_off') summary.leave += 1;
          else if (status === 'holiday') summary.holiday += 1;
          else if (status === 'weekly_off') summary.weeklyOff += 1;
        }
      }
      return {
        month: args.month,
        organizationId: args.organizationId,
        locationId: args.locationId,
        locationName: register.location?.workName || register.location?.name || null,
        summary,
      };
    },
    formatResult(result, lang = 'hi') {
      const s = result.summary;
      const title = result.locationName || 'Location';
      if (lang === 'en') {
        return `${title} — ${result.month}\nEmployees: ${s.employees}\nPresent marks: ${s.present}\nAbsent: ${s.absent}\nLeave: ${s.leave}\nHoliday: ${s.holiday}\nWeekly off: ${s.weeklyOff}\nEmpty cells: ${s.empty}`;
      }
      return `${title} — ${result.month}\nकर्मचारी: ${s.employees}\nPresent: ${s.present}\nAbsent: ${s.absent}\nLeave: ${s.leave}\nHoliday: ${s.holiday}\nWeekly off: ${s.weeklyOff}\nखाली: ${s.empty}`;
    },
  });

  registerTool({
    name: 'attendance.getRegister',
    description: 'Get attendance register metadata for a location/month. Document download is separate.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      organizationId: { type: 'objectId', required: true },
      locationId: { type: 'objectId', required: true },
      month: { type: 'month', required: true },
    },
    async execute({ user, args }) {
      const register = await getAttendanceRegister(user, {
        organizationId: args.organizationId,
        locationId: args.locationId,
        month: args.month,
      });
      return {
        month: args.month,
        locationId: args.locationId,
        organizationId: args.organizationId,
        employeeCount: register.employees?.length || 0,
        employees: (register.employees || []).slice(0, 50).map((emp) => ({
          id: String(emp.id || emp._id || ''),
          name: emp.name,
        })),
      };
    },
    formatResult(result, lang = 'hi') {
      return lang === 'en'
        ? `Attendance register for ${result.month} has ${result.employeeCount} employees. You can download FORM XVI as PDF or Excel.`
        : `${result.month} की attendance register में ${result.employeeCount} कर्मचारी हैं। FORM XVI PDF/Excel में डाउनलोड कर सकते हैं।`;
    },
  });

  registerTool({
    name: 'attendance.employeeSummary',
    description: 'Attendance day counts for one employee in a month.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      employeeId: { type: 'objectId', required: true },
      month: { type: 'month', required: true },
      status: { type: 'status' },
    },
    async execute({ user, args }) {
      const scope = user.role === 'admin'
        ? { organizationId: { $ne: null } }
        : { organizationId: user.id };
      const employee = await Employee.findOne({ _id: args.employeeId, ...scope }).select('name').lean();
      if (!employee) return { found: false };
      const filter = {
        employeeId: new mongoose.Types.ObjectId(args.employeeId),
        date: { $gte: `${args.month}-01`, $lte: `${args.month}-31` },
      };
      if (args.status) filter.status = args.status;
      const rows = await Attendance.find(filter).select('date status').sort({ date: 1 }).lean();
      const byStatus = {};
      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      }
      return {
        found: true,
        employeeId: args.employeeId,
        employeeName: employee.name,
        month: args.month,
        total: rows.length,
        byStatus,
        dates: rows.map((row) => ({ date: row.date, status: row.status })),
      };
    },
    formatResult(result, lang = 'hi') {
      if (!result.found) return lang === 'en' ? 'Employee not found.' : 'कर्मचारी नहीं मिला।';
      const counts = Object.entries(result.byStatus).map(([status, count]) => `${status}: ${count}`).join(', ');
      return lang === 'en'
        ? `${result.employeeName} — ${result.month}: ${counts || 'no entries'}`
        : `${result.employeeName} — ${result.month}: ${counts || 'कोई entry नहीं'}`;
    },
  });

  // Write tools: they return a legacyPlan for the existing confirm/preview path.
  registerTool({
    name: 'attendance.mark',
    description: 'Mark empty attendance cells. Requires confirmation before writing.',
    mutates: true,
    requiresConfirmation: true,
    roles: ['admin'],
    legacyPlanType: 'mark_attendance',
    inputSchema: {
      organizationId: { type: 'objectId', required: true },
      locationId: { type: 'objectId', required: true },
      month: { type: 'month', required: true },
      status: { type: 'status', default: 'present' },
      employeeId: { type: 'objectId' },
    },
    async execute({ args }) {
      return {
        legacyPlan: {
          type: 'mark_attendance',
          organizationId: args.organizationId,
          locationId: args.locationId,
          month: args.month,
          status: args.status || 'present',
          employeeId: args.employeeId || null,
        },
        previewOnly: true,
      };
    },
  });

  registerTool({
    name: 'attendance.edit',
    description: 'Edit attendance for specific dates. Requires confirmation before writing.',
    mutates: true,
    requiresConfirmation: true,
    roles: ['admin'],
    legacyPlanType: 'edit_attendance',
    inputSchema: {
      organizationId: { type: 'objectId', required: true },
      locationId: { type: 'objectId', required: true },
      month: { type: 'month', required: true },
      status: { type: 'status', required: true },
      employeeId: { type: 'objectId' },
      dates: { type: 'dateArray' },
      count: { type: 'integer', min: 1, max: 31 },
      restStatus: { type: 'status' },
    },
    async execute({ args }) {
      return {
        legacyPlan: {
          type: 'edit_attendance',
          organizationId: args.organizationId,
          locationId: args.locationId,
          month: args.month,
          status: args.status,
          employeeId: args.employeeId || null,
          dates: args.dates || [],
          count: args.count || null,
          restStatus: args.restStatus || null,
        },
        previewOnly: true,
      };
    },
  });
}

module.exports = { registerAttendanceTools };
