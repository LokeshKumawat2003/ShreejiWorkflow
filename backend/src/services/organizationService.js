const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { normalizeEmail, publicUser } = require('../utils/user');
const { escapeRegex, validateEmail } = require('../utils/validation');
const { findWorkName, resolveMasterValue } = require('./masterDataService');
const { recalculateEmployeeSalaries } = require('./salaryService');

const MAX_POSTS = 50;
const MAX_POST_DESIGNATIONS = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

// Work names and designations already saved on the organization stay valid even if they were
// disabled or removed from the work name in master data later.
async function getOrganizationPosts(input, currentPosts = []) {
  if (!Array.isArray(input)) throw httpError(400, 'Posts must be a list.');
  if (input.length > MAX_POSTS) throw httpError(400, `An organization can have at most ${MAX_POSTS} work names.`);

  const currentByWorkName = new Map(currentPosts.map((post) => [post.workName.toLowerCase(), post]));
  const posts = [];
  for (const post of input) {
    const requestedName = normalizeText(post?.workName);
    if (!requestedName) throw httpError(400, 'Every post needs a work name.');
    if (posts.some((item) => item.workName.toLowerCase() === requestedName.toLowerCase())) {
      throw httpError(400, `The work name "${requestedName}" is selected more than once.`);
    }

    const current = currentByWorkName.get(requestedName.toLowerCase());
    const master = await findWorkName(requestedName);
    if (!current && (!master || master.status === 'disabled')) {
      throw httpError(400, `Select a valid work name from Settings → Master data ("${requestedName}" is not available).`);
    }
    const workName = master?.name || current.workName;
    const allowed = new Map();
    for (const name of [...(current?.designations || []), ...(master?.designations || [])]) allowed.set(name.toLowerCase(), name);

    const submitted = Array.isArray(post.designations) ? post.designations : [];
    if (submitted.length > MAX_POST_DESIGNATIONS) throw httpError(400, `Select at most ${MAX_POST_DESIGNATIONS} designations for "${workName}".`);
    const designations = [];
    for (const value of submitted) {
      const designation = allowed.get(normalizeText(value).toLowerCase());
      if (!designation) throw httpError(400, `"${normalizeText(value)}" is not a designation of the work name "${workName}".`);
      if (!designations.includes(designation)) designations.push(designation);
    }
    if (designations.length === 0) throw httpError(400, `Select at least one designation for "${workName}".`);
    posts.push({ workName, designations });
  }
  return posts;
}

// The government type and area already saved on the organization stay valid even if disabled later.
async function getSalaryScheduleValue(type, value, current = '') {
  const name = normalizeText(value);
  if (!name) return '';
  if (current && current.toLowerCase() === name.toLowerCase()) return current;
  return resolveMasterValue(type, name);
}

function requireAreaWithGovernmentType(governmentType, area) {
  if (governmentType && !area) throw httpError(400, 'Select the area (A, B or C) for this government type.');
  if (area && !governmentType) throw httpError(400, 'Select the government type before the area.');
}

function getOrganizationDetails(input, partial = false) {
  const details = {};
  for (const [field, maxLength] of Object.entries({ phone: 30, address: 500, about: 1000, website: 200, industry: 100 })) {
    if (partial && input[field] === undefined) continue;
    details[field] = typeof input[field] === 'string' ? input[field].trim() : '';
    if (details[field].length > maxLength) {
      throw httpError(400, 'Organization details exceed the allowed length.');
    }
  }

  if (details.phone && !/^\+?[0-9(). -]{7,30}$/.test(details.phone)) {
    throw httpError(400, 'Enter a valid organization phone number.');
  }
  if (details.website) {
    let websiteUrl;
    try {
      websiteUrl = new URL(details.website);
    } catch {
      throw httpError(400, 'Enter a valid website URL.');
    }
    if (!['http:', 'https:'].includes(websiteUrl.protocol)) {
      throw httpError(400, 'Website URLs must use HTTP or HTTPS.');
    }
  }

  return details;
}

async function createOrganization(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const organizationName = typeof input.organizationName === 'string'
    ? input.organizationName.trim()
    : '';
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const status = input.status === undefined ? 'active' : input.status;
  const details = getOrganizationDetails(input);

  if (!name || !organizationName || !email || !password) {
    throw httpError(400, 'Name, organization name, email, and password are required.');
  }
  if (!validateEmail(email)) {
    throw httpError(400, 'Enter a valid email address.');
  }
  if (password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters long.');
  }
  if (!['active', 'disabled'].includes(status)) {
    throw httpError(400, 'Status must be active or disabled.');
  }

  const posts = input.posts === undefined ? [] : await getOrganizationPosts(input.posts);
  const governmentType = await getSalaryScheduleValue('governmentType', input.governmentType);
  const area = await getSalaryScheduleValue('area', input.area);
  requireAreaWithGovernmentType(governmentType, area);

  const user = await User.create({ name, organizationName, email, password, role: 'organization', status, posts, governmentType, area, ...details });
  return { organization: publicUser(user) };
}

async function listOrganizations(options = {}) {
  const normalizedSearch = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
  const status = ['active', 'disabled'].includes(options.status) ? options.status : 'all';
  const sortOrder = ['name-asc', 'name-desc', 'newest', 'oldest'].includes(options.sort)
    ? options.sort
    : 'newest';
  const requestedPage = Number(options.page);
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLimit = Number(options.limit);
  const limit = Math.min(Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 10, 100);
  const filter = { role: 'organization' };

  if (status !== 'all') filter.status = status;

  const designation = typeof options.designation === 'string' ? options.designation.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  if (designation) filter['posts.designations'] = new RegExp(`^${escapeRegex(designation)}$`, 'i');

  if (normalizedSearch) {
    const pattern = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [
      { organizationName: pattern },
      { name: pattern },
      { email: pattern },
    ];
  }

  const [total, allOrganizations, active, pending, inactive] = await Promise.all([
    User.countDocuments(filter),
    User.countDocuments({ role: 'organization' }),
    User.countDocuments({ role: 'organization', status: 'active' }),
    User.countDocuments({ role: 'organization', status: 'pending' }),
    User.countDocuments({ role: 'organization', status: 'disabled' }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pageNumber, totalPages);
  const sort = {
    'name-asc': { organizationName: 1, _id: 1 },
    'name-desc': { organizationName: -1, _id: -1 },
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
  }[sortOrder];
  const organizations = await User.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    organizations: organizations.map(publicUser),
    pagination: { page, limit, total, totalPages },
    stats: { total: allOrganizations, active, pending, inactive },
  };
}

async function getOrganization(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(400, 'Invalid organization id.');
  }

  const organization = await User.findOne({ _id: id, role: 'organization' });
  if (!organization) {
    throw httpError(404, 'Organization not found.');
  }
  return publicUser(organization);
}

async function deleteOrganization(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(400, 'Invalid organization id.');
  }

  const organization = await User.findOneAndDelete({ _id: id, role: 'organization' });
  if (!organization) {
    throw httpError(404, 'Organization not found.');
  }
  return publicUser(organization);
}

async function updateOrganization(id, input) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(400, 'Invalid organization id.');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const organizationName = typeof input.organizationName === 'string'
    ? input.organizationName.trim()
    : '';
  const email = normalizeEmail(input.email);
  const status = input.status;
  const details = getOrganizationDetails(input, true);

  if (!name || !organizationName || !email) {
    throw httpError(400, 'Name, organization name, and email are required.');
  }
  if (name.length > 100 || organizationName.length > 150 || email.length > 254) {
    throw httpError(400, 'One or more fields exceed the maximum length.');
  }
  if (!validateEmail(email)) {
    throw httpError(400, 'Enter a valid email address.');
  }
  if (status !== undefined && !['active', 'disabled'].includes(status)) {
    throw httpError(400, 'Status must be active or disabled.');
  }

  const updates = { name, organizationName, email, ...details };
  const removals = {};
  if (status !== undefined) updates.status = status;
  const current = await User.findOne({ _id: id, role: 'organization' }).select('posts governmentType area');
  if (!current) throw httpError(404, 'Organization not found.');
  if (input.posts !== undefined) updates.posts = await getOrganizationPosts(input.posts, current.posts);
  if (input.governmentType !== undefined) {
    updates.governmentType = await getSalaryScheduleValue('governmentType', input.governmentType, current.governmentType);
  }
  if (input.area !== undefined) updates.area = await getSalaryScheduleValue('area', input.area, current.area);
  const scheduleChanged = (updates.governmentType ?? current.governmentType ?? '') !== (current.governmentType || '')
    || (updates.area ?? current.area ?? '') !== (current.area || '');
  if (scheduleChanged) requireAreaWithGovernmentType(updates.governmentType ?? current.governmentType, updates.area ?? current.area);
  if (input.password !== undefined && input.password !== '') {
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
      throw httpError(400, 'Password must be between 8 and 128 characters long.');
    }
    updates.password = await bcrypt.hash(input.password, 12);
    updates.passwordChangedAt = new Date();
    removals.passwordResetTokenHash = '';
    removals.passwordResetExpires = '';
  }
  const organization = await User.findOneAndUpdate(
    { _id: id, role: 'organization' },
    Object.keys(removals).length ? { $set: updates, $unset: removals } : { $set: updates },
    { new: true, runValidators: true },
  );
  if (!organization) {
    throw httpError(404, 'Organization not found.');
  }
  if (scheduleChanged) await recalculateEmployeeSalaries({ organizationId: organization._id });
  return publicUser(organization);
}

module.exports = {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
};