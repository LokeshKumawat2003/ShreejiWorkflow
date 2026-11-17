const Location = require('../../../models/Location');
const Employee = require('../../../models/Employee');
const { registerTool } = require('../assistantToolRegistry');

function registerLocationTools() {
  registerTool({
    name: 'location.list',
    description: 'List locations with optional organization filter and employee counts.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      organizationId: { type: 'objectId' },
      status: { type: 'enum', values: ['active', 'disabled', 'all'], default: 'active' },
      page: { type: 'integer', min: 1, max: 1000, default: 1 },
      pageSize: { type: 'integer', min: 1, max: 100, default: 40 },
    },
    async execute({ args }) {
      const filter = {};
      if (args.organizationId) filter.organizationId = args.organizationId;
      if (args.status === 'active') filter.status = { $ne: 'disabled' };
      else if (args.status === 'disabled') filter.status = 'disabled';
      const page = args.page || 1;
      const pageSize = args.pageSize || 40;
      const [total, rows] = await Promise.all([
        Location.countDocuments(filter),
        Location.find(filter)
          .select('name workName status organizationId opNumber address')
          .sort({ workName: 1, name: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
      ]);
      const counts = await Employee.aggregate([
        { $match: { locationId: { $in: rows.map((r) => r._id) }, status: { $ne: 'disabled' } } },
        { $group: { _id: '$locationId', count: { $sum: 1 } } },
      ]);
      const byLoc = new Map(counts.map((row) => [String(row._id), row.count]));
      return {
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        items: rows.map((row) => ({
          id: String(row._id),
          name: row.workName || row.name,
          siteName: row.name,
          opNumber: row.opNumber || '',
          address: row.address || '',
          status: row.status || 'active',
          organizationId: row.organizationId ? String(row.organizationId) : null,
          employeeCount: byLoc.get(String(row._id)) || 0,
        })),
      };
    },
    formatResult(result, lang = 'hi') {
      const header = lang === 'en'
        ? `Showing ${result.items.length} of ${result.total} locations (page ${result.page}).`
        : `${result.total} में से ${result.items.length} locations (पेज ${result.page}).`;
      const lines = result.items.map((item, i) => `${(result.page - 1) * result.pageSize + i + 1}. ${item.name} — ${item.employeeCount} employees`);
      const more = result.hasMore ? (lang === 'en' ? '\nAsk for the next page for more.' : '\nअगला पेज भी माँग सकते हैं।') : '';
      return `${header}\n${lines.join('\n')}${more}`;
    },
  });

  registerTool({
    name: 'location.getDetails',
    description: 'Get details for one location including employee count.',
    mutates: false,
    roles: ['admin'],
    inputSchema: {
      locationId: { type: 'objectId', required: true },
    },
    async execute({ args }) {
      const location = await Location.findById(args.locationId).lean();
      if (!location) return { found: false };
      const employeeCount = await Employee.countDocuments({
        locationId: location._id,
        status: { $ne: 'disabled' },
      });
      return {
        found: true,
        location: {
          id: String(location._id),
          name: location.workName || location.name,
          siteName: location.name,
          opNumber: location.opNumber || '',
          address: location.address || '',
          status: location.status || 'active',
          organizationId: location.organizationId ? String(location.organizationId) : null,
          employeeCount,
        },
      };
    },
    formatResult(result, lang = 'hi') {
      if (!result.found) return lang === 'en' ? 'Location not found.' : 'Location नहीं मिली।';
      const loc = result.location;
      return [
        loc.name,
        loc.siteName && loc.siteName !== loc.name ? `Site: ${loc.siteName}` : null,
        loc.opNumber ? `PO number: ${loc.opNumber}` : null,
        loc.address ? `Address: ${loc.address}` : null,
        `Status: ${loc.status}`,
        `Active employees: ${loc.employeeCount}`,
      ].filter(Boolean).join('\n');
    },
  });
}

module.exports = { registerLocationTools };
