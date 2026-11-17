const registry = new Map();

function registerTool(definition) {
  if (!definition || typeof definition.name !== 'string' || !definition.name.trim()) {
    throw new Error('Tool definition requires a name');
  }
  if (typeof definition.execute !== 'function') {
    throw new Error(`Tool ${definition.name} requires an execute handler`);
  }
  const tool = {
    name: definition.name.trim(),
    description: definition.description || '',
    mutates: definition.mutates === true,
    requiresConfirmation: definition.requiresConfirmation === true || definition.mutates === true,
    roles: Array.isArray(definition.roles) ? definition.roles : ['admin'],
    inputSchema: definition.inputSchema || {},
    validate: typeof definition.validate === 'function' ? definition.validate : null,
    execute: definition.execute,
    formatResult: typeof definition.formatResult === 'function' ? definition.formatResult : null,
    legacyPlanType: definition.legacyPlanType || null,
  };
  registry.set(tool.name, tool);
  return tool;
}

function getTool(name) {
  return registry.get(String(name || '')) || null;
}

function listTools({ role = 'admin', mutates } = {}) {
  return [...registry.values()].filter((tool) => {
    if (role && !tool.roles.includes(role) && !tool.roles.includes('*')) return false;
    if (mutates === true && !tool.mutates) return false;
    if (mutates === false && tool.mutates) return false;
    return true;
  });
}

function toolCatalogForPrompt(role = 'admin') {
  return listTools({ role }).map((tool) => ({
    name: tool.name,
    description: tool.description,
    mutates: tool.mutates,
    requiresConfirmation: tool.requiresConfirmation,
    parameters: Object.fromEntries(
      Object.entries(tool.inputSchema).map(([key, rule]) => [key, {
        type: rule.type,
        required: Boolean(rule.required),
        values: rule.values || undefined,
      }]),
    ),
  }));
}

function clearRegistry() {
  registry.clear();
}

module.exports = {
  registerTool,
  getTool,
  listTools,
  toolCatalogForPrompt,
  clearRegistry,
};
