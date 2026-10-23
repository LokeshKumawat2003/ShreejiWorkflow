const mongoose = require('mongoose');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { normalizeEmail, publicUser } = require('../utils/user');
const { escapeRegex, validateEmail } = require('../utils/validation');

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

  const user = await User.create({ name, organizationName, email, password, role: 'organization', status, ...details });
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
  if (status !== undefined) updates.status = status;
  const organization = await User.findOneAndUpdate(
    { _id: id, role: 'organization' },
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!organization) {
    throw httpError(404, 'Organization not found.');
  }
  return publicUser(organization);
}

module.exports = {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
};