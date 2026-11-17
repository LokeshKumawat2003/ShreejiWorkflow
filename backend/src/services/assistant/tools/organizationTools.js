const User = require('../../../models/User');
const Location = require('../../../models/Location');
const Employee = require('../../../models/Employee');
const { registerTool } = require('../assistantToolRegistry');

function registerOrganizationTools() {
  registerTool({
    name: 'organization.list',
    description: 'List organizations with optional employee/location counts.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      status: { type: 'enum', values: ['active', 'disabled', 'all'], default: 'active' },
      includeCounts: { type: 'boolean', default: true },
    },
    async execute({ args }) {
      const filter = { role: 'organization' };
      if (args.status === 'active') filter.status = { $ne: 'disabled' };
      else if (args.status === 'disabled') filter.status = 'disabled';
      const orgs = await User.find(filter).select('name email status organizationName').sort({ name: 1 }).lean();
      const items = [];
      for (const org of orgs) {
        const id = String(org._id);
        let locationCount = null;
        let employeeCount = null;
        if (args.includeCounts !== false) {
          [locationCount, employeeCount] = await Promise.all([
            Location.countDocuments({ organizationId: org._id }),
            Employee.countDocuments({ organizationId: org._id, status: { $ne: 'disabled' } }),
          ]);
        }
        items.push({
          id,
          name: org.organizationName || org.name || org.email,
          email: org.email,
          status: org.status || 'active',
          locationCount,
          employeeCount,
        });
      }
      return { total: items.length, items };
    },
    formatResult(result, lang = 'hi') {
      if (result.total === 0) return lang === 'en' ? 'No organizations found.' : 'कोई organization नहीं मिली।';
      const lines = result.items.map((item, i) => {
        const counts = item.locationCount != null
          ? ` — ${item.locationCount} locations, ${item.employeeCount} employees`
          : '';
        return `${i + 1}. ${item.name}${counts}`;
      });
      return `${lang === 'en' ? 'Organizations' : 'Organizations'}: ${result.total}\n${lines.join('\n')}`;
    },
  });

  registerTool({
    name: 'organization.getDetails',
    description: 'Get details for one organization including locations and employee count.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      organizationId: { type: 'objectId', required: true },
    },
    async execute({ args }) {
      const org = await User.findOne({ _id: args.organizationId, role: 'organization' })
        .select('name email status organizationName phone')
        .lean();
      if (!org) return { found: false };
      const [locations, employeeCount] = await Promise.all([
        Location.find({ organizationId: org._id }).select('name workName status').sort({ workName: 1 }).lean(),
        Employee.countDocuments({ organizationId: org._id, status: { $ne: 'disabled' } }),
      ]);
      return {
        found: true,
        organization: {
          id: String(org._id),
          name: org.organizationName || org.name || org.email,
          email: org.email,
          phone: org.phone || null,
          status: org.status || 'active',
          employeeCount,
          locations: locations.map((loc) => ({
            id: String(loc._id),
            name: loc.workName || loc.name,
            siteName: loc.name,
            status: loc.status || 'active',
          })),
        },
      };
    },
    formatResult(result, lang = 'hi') {
      if (!result.found) return lang === 'en' ? 'Organization not found.' : 'Organization नहीं मिली।';
      const o = result.organization;
      const locLines = o.locations.map((loc) => `• ${loc.name}`).join('\n');
      return [
        o.name,
        `Status: ${o.status}`,
        `Employees: ${o.employeeCount}`,
        `Locations (${o.locations.length}):`,
        locLines || (lang === 'en' ? '(none)' : '(कोई नहीं)'),
      ].join('\n');
    },
  });
}

module.exports = { registerOrganizationTools };
