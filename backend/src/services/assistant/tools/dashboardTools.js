const Employee = require('../../../models/Employee');
const Location = require('../../../models/Location');
const User = require('../../../models/User');
const { registerTool } = require('../assistantToolRegistry');

function registerDashboardTools() {
  registerTool({
    name: 'dashboard.overview',
    description: 'High-level admin counts: organizations, locations, active employees.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {},
    async execute() {
      const [organizations, locations, activeEmployees, disabledEmployees] = await Promise.all([
        User.countDocuments({ role: 'organization', status: { $ne: 'disabled' } }),
        Location.countDocuments({ status: { $ne: 'disabled' } }),
        Employee.countDocuments({ organizationId: { $ne: null }, status: { $ne: 'disabled' } }),
        Employee.countDocuments({ organizationId: { $ne: null }, status: 'disabled' }),
      ]);
      return { organizations, locations, activeEmployees, disabledEmployees };
    },
    formatResult(result, lang = 'hi') {
      if (lang === 'en') {
        return `Overview\nOrganizations: ${result.organizations}\nLocations: ${result.locations}\nActive employees: ${result.activeEmployees}\nDisabled employees: ${result.disabledEmployees}`;
      }
      return `सारांश\nOrganizations: ${result.organizations}\nLocations: ${result.locations}\nActive employees: ${result.activeEmployees}\nDisabled employees: ${result.disabledEmployees}`;
    },
  });

  registerTool({
    name: 'general.help',
    description: 'Explain what Shreeji AI can do. Not a database mutation.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {},
    async execute() {
      return {
        capabilities: [
          'Employee counts, lists, and details',
          'Organization and location directories',
          'Attendance summaries and registers',
          'Payroll / bank invoice status and runs',
          'Salary slips, wage register, attendance register downloads',
          'Client invoices',
          'Mark / edit attendance with confirmation',
        ],
      };
    },
    formatResult(result, lang = 'hi') {
      const intro = lang === 'en'
        ? "I'm Shreeji AI — your Admin Assistant for Shreeji Workflow."
        : 'मैं Shreeji AI हूँ — Shreeji Workflow की Admin Assistant।';
      return `${intro}\n\n${result.capabilities.map((item) => `• ${item}`).join('\n')}`;
    },
  });
}

module.exports = { registerDashboardTools };
