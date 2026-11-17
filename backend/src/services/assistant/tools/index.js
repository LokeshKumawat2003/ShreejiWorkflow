const { registerEmployeeTools } = require('./employeeTools');
const { registerOrganizationTools } = require('./organizationTools');
const { registerLocationTools } = require('./locationTools');
const { registerAttendanceTools } = require('./attendanceTools');
const { registerPayrollTools } = require('./payrollTools');
const { registerDocumentTools } = require('./documentTools');
const { registerInvoiceTools } = require('./invoiceTools');
const { registerDashboardTools } = require('./dashboardTools');

let registered = false;

function registerAllTools({ force = false } = {}) {
  if (registered && !force) return;
  registerEmployeeTools();
  registerOrganizationTools();
  registerLocationTools();
  registerAttendanceTools();
  registerPayrollTools();
  registerDocumentTools();
  registerInvoiceTools();
  registerDashboardTools();
  registered = true;
}

function resetToolRegistrationFlag() {
  registered = false;
}

module.exports = { registerAllTools, resetToolRegistrationFlag };
