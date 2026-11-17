const { registerTool } = require('../assistantToolRegistry');

function registerInvoiceTools() {
  registerTool({
    name: 'invoice.createClient',
    description: 'Create or reprint a client (location) invoice. Requires confirmation when saving a new invoice.',
    mutates: true,
    requiresConfirmation: true,
    roles: ['admin'],
    legacyPlanType: 'client_invoice',
    inputSchema: {
      month: { type: 'month', required: true },
      organizationId: { type: 'objectId', required: true },
      locationId: { type: 'objectId', required: true },
      format: { type: 'format', default: 'pdf' },
      latest: { type: 'boolean', default: false },
    },
    async execute({ args }) {
      return {
        legacyPlan: {
          type: 'client_invoice',
          month: args.month,
          organizationId: args.organizationId,
          locationId: args.locationId,
          format: args.format || 'pdf',
          latest: args.latest === true,
        },
        previewOnly: true,
      };
    },
  });

  registerTool({
    name: 'invoice.createBank',
    description: 'Prepare a bank invoice / NEFT run. Requires confirmation for multi-location batches.',
    mutates: true,
    requiresConfirmation: true,
    roles: ['admin'],
    legacyPlanType: 'bank_invoice',
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
          type: 'bank_invoice',
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
}

module.exports = { registerInvoiceTools };
