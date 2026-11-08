const Employee = require('../models/Employee');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');

function exactPattern(value) {
	return new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');
}

function sameText(left, right) {
	return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function dailySalaryFor(basicPay, dearnessAllowance = 0, otherAllowanceAmount = 0) {
	return Math.round((basicPay + dearnessAllowance + otherAllowanceAmount) * 100) / 100;
}

/** Throws unless the organization has the government type and area that employee salaries depend on. */
function requireSalarySchedule(organization) {
	if (!organization.governmentType || !organization.area) {
		throw httpError(400, `Set the government type and area of ${organization.organizationName} first. Employee salaries depend on them.`);
	}
}

/**
 * Returns the master data rate of a category of skill for an organization's government type and area.
 * Throws when the organization, its government type or area is missing, or no rate is set for that combination.
 */
async function findSkillRate(skillCategory, organizationId) {
	const item = await MasterData.findOne({ type: 'skillCategory', code: String(skillCategory).trim().toLowerCase() }).select('name rates').lean();
	if (!item) return null;
	if (!organizationId) {
		throw httpError(400, 'Assign the employee to an organization first. The salary depends on the organization\'s government type and area.');
	}
	const organization = await User.findOne({ _id: organizationId, role: 'organization' }).select('organizationName governmentType area').lean();
	if (!organization) throw httpError(404, 'Organization not found.');
	requireSalarySchedule(organization);
	const rate = (item.rates || []).find((entry) => sameText(entry.governmentType, organization.governmentType) && sameText(entry.area, organization.area));
	if (!rate) {
		throw httpError(400, `No salary is set for ${item.name} under ${organization.governmentType} · ${organization.area}. Add it in Settings → Master data → Category of skill.`);
	}
	return rate.salary;
}

/** Re-applies the fixed basic pay of each employee's category of skill for their organization's government type and area. */
async function recalculateEmployeeSalaries(employeeFilter = {}) {
	const [skills, organizations] = await Promise.all([
		MasterData.find({ type: 'skillCategory' }).select('name rates').lean(),
		User.find({ role: 'organization', governmentType: { $nin: ['', null] }, area: { $nin: ['', null] } }).select('governmentType area').lean(),
	]);
	const updates = [];
	for (const skill of skills) {
		for (const { governmentType, area, salary } of skill.rates || []) {
			const organizationIds = organizations
				.filter((organization) => sameText(organization.governmentType, governmentType) && sameText(organization.area, area))
				.map(({ _id }) => _id);
			if (organizationIds.length === 0) continue;
			updates.push(Employee.updateMany(
				{ $and: [employeeFilter, { skillCategory: exactPattern(skill.name), organizationId: { $in: organizationIds } }] },
				[{
					$set: {
						basicPay: salary,
						dailySalary: {
							$round: [{ $add: [salary, { $ifNull: ['$dearnessAllowance', 0] }, { $ifNull: ['$otherAllowanceAmount', 0] }] }, 2],
						},
					},
				}],
				{ updatePipeline: true },
			));
		}
	}
	await Promise.all(updates);
}

module.exports = { dailySalaryFor, findSkillRate, recalculateEmployeeSalaries, requireSalarySchedule };
