function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    organizationName: user.organizationName,
    phone: user.phone || '',
    address: user.address || '',
    about: user.about || '',
    website: user.website || '',
    industry: user.industry || '',
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

module.exports = { normalizeEmail, publicUser };