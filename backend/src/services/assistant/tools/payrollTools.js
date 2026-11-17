const { listDocumentLocations, previewLocationsPayroll } = require('../../bankInvoiceService');
const { registerTool } = require('../assistantToolRegistry');

function registerPayrollTools() {
  registerTool({
    name: 'payroll.getSummary',
    description: 'Get payroll preview totals for locations in a month using existing payroll services.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      month: { type: 'month', required: true },
      organizationId: { type: 'objectId' },
      locationIds: { type: 'objectIdArray' },
    },
    async execute({ user, args }) {
      const listed = await listDocumentLocations(
        user,
        { month: args.month, organizationId: args.organizationId || undefined },
        'payroll',
      );
      let locationIds = args.locationIds || [];
      if (locationIds.length === 0) {
        locationIds = (listed.locations || listed || [])
          .map((item) => String(item.locationId || item.id || item._id || ''))
          .filter(Boolean)
          .slice(0, 50);
      }
      if (locationIds.length === 0) {
        return { month: args.month, locations: [], totals: null, note: 'No payroll locations found for this month.' };
      }
      const preview = await previewLocationsPayroll(user, {
        month: args.month,
        locationIds,
      });
      return {
        month: args.month,
        locationIds,
        preview,
      };
    },
    formatResult(result, lang = 'hi') {
      if (result.note) return result.note;
      const preview = result.preview || {};
      const net = preview.netAmount ?? preview.totalNet ?? preview.net ?? null;
      const gross = preview.grossAmount ?? preview.totalGross ?? preview.gross ?? null;
      if (lang === 'en') {
        return `Payroll summary for ${result.month}\nLocations: ${result.locationIds.length}${gross != null ? `\nGross: ₹${gross}` : ''}${net != null ? `\nNet: ₹${net}` : ''}`;
      }
      return `${result.month} का payroll सारांश\nLocations: ${result.locationIds.length}${gross != null ? `\nGross: ₹${gross}` : ''}${net != null ? `\nNet: ₹${net}` : ''}`;
    },
  });

  registerTool({
    name: 'payroll.preview',
    description: 'Prepare a payroll run preview (may create persistent batch on confirm via legacy path).',
    mutates: true,
    requiresConfirmation: true,
    roles: ['admin'],
    legacyPlanType: 'payroll_run',
    inputSchema: {
      month: { type: 'month', required: true },
      format: { type: 'format', default: 'pdf' },
      organizationId: { type: 'objectId' },
      locationIds: { type: 'objectIdArray' },
      employeeId: { type: 'objectId' },
    },
    async execute({ args }) {
      return {
        legacyPlan: {
          type: 'payroll_run',
          month: args.month,
          format: args.format || 'pdf',
          organizationId: args.organizationId || null,
          locationIds: args.locationIds || [],
          employeeId: args.employeeId || null,
        },
        previewOnly: true,
      };
    },
  });

  registerTool({
    name: 'payroll.runStatus',
    description: 'List which locations can still generate payroll / bank invoice for a month.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      month: { type: 'month', required: true },
      kind: { type: 'enum', values: ['payroll', 'bank'], default: 'payroll' },
      organizationId: { type: 'objectId' },
    },
    async execute({ user, args }) {
      const data = await listDocumentLocations(
        user,
        { month: args.month, organizationId: args.organizationId || undefined },
        args.kind || 'payroll',
      );
      return { month: args.month, kind: args.kind || 'payroll', data };
    },
    formatResult(result, lang = 'hi') {
      const locations = result.data?.locations || result.data || [];
      const pending = locations.filter((item) => !item.printed && item.canPrint !== false);
      const printed = locations.filter((item) => item.printed);
      if (lang === 'en') {
        return `${result.kind} status for ${result.month}\nPending: ${pending.length}\nAlready printed: ${printed.length}`;
      }
      return `${result.month} का ${result.kind} स्टेटस\nबाकी: ${pending.length}\nप्रिंट हो चुके: ${printed.length}`;
    },
  });
}

module.exports = { registerPayrollTools };
