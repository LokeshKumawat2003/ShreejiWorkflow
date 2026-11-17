const assert = require('node:assert/strict');
const test = require('node:test');
const { requireRole } = require('../../src/middleware/auth');
const assistantRoutes = require('../../src/routes/assistantRoutes');

test('requireRole(admin) rejects organization and employee for assistant policy', () => {
  const guard = requireRole('admin');

  for (const role of ['organization', 'employee']) {
    let status = null;
    guard(
      { user: { id: '1', role } },
      {},
      (error) => {
        status = error?.statusCode || null;
      },
    );
    assert.equal(status, 403, `${role} should be forbidden`);
  }

  let continued = false;
  guard(
    { user: { id: '1', role: 'admin' } },
    {},
    (error) => {
      continued = error === undefined;
    },
  );
  assert.equal(continued, true);
});

test('assistant router mounts auth-protected admin routes', () => {
  const stack = assistantRoutes.stack || [];
  assert.ok(stack.length > 0);

  const paths = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    paths.push(layer.route.path);
    assert.ok(
      (layer.route.stack?.length || 0) >= 2,
      `Route ${layer.route.path} should include auth middleware`,
    );
  }

  assert.ok(paths.includes('/chat'));
  assert.ok(paths.includes('/session/:id'));
  assert.ok(paths.includes('/feedback'));
  assert.ok(paths.includes('/health'));
});

test('assistant route module exports an Express router', () => {
  assert.equal(typeof assistantRoutes, 'function');
  assert.ok(Array.isArray(assistantRoutes.stack));
});
