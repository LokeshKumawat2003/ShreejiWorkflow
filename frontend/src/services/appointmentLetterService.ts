import type { Employee, OrganizationLocation } from '../types';

function formatDate(value?: string) {
  if (!value) return 'Not specified';
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDate) return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not specified';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

type PdfDocument = InstanceType<typeof import('jspdf').jsPDF>;

function addWrappedText(
  document: PdfDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.5,
) {
  const lines = document.splitTextToSize(text || ' ', width) as string[];
  document.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawDetail(
  document: PdfDocument,
  label: string,
  value: string,
  x: number,
  valueX: number,
  y: number,
  pageWidth: number,
) {
  document.setFont('times', 'bold');
  document.text(`${label}:`, x, y);
  document.setFont('times', 'normal');
  const nextY = addWrappedText(document, value, valueX, y, pageWidth - valueX - x);
  return Math.max(y + 7.4, nextY + 2.5);
}

function addAppointmentLetter(
  document: PdfDocument,
  employee: Employee,
  location: OrganizationLocation,
  pageNumber: number,
) {
  if (pageNumber > 0) document.addPage();
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 8;
  const textWidth = pageWidth - margin * 2;
  const today = formatDate(new Date().toISOString());
  const position = employee.jobTitle || employee.designation || location.designation;
  const skillCategory = employee.skillCategory ? ` ${employee.skillCategory}` : '';
  const salary = employee.dailySalary > 0
    ? `${employee.currency || 'INR'} ${employee.dailySalary.toLocaleString()} per day (Central Govt. minimum wage rates)`
    : 'As per Central Govt. minimum Wage Act. ("C" Class City)';
  const reference = location.opNumber || `PGCIL/KNK/${String(pageNumber + 1).padStart(2, '0')}`;

  document.setFont('times', 'bold');
  document.setFontSize(15);
  document.text('M/s. SHREEJI CARETAKER COMPANY', pageWidth / 2, 21, { align: 'center' });
  document.setFont('times', 'normal');
  document.setFontSize(9.5);
  document.text('Registered address:-N-33, GOVIND NAGAR, R.H.B. COLONY, KANKROLI', pageWidth / 2, 27.5, { align: 'center' });
  document.text('Distt :-Rajsamand , Pin :-313342 ( Rajasthan ) Mob-9784785808', pageWidth / 2, 33, { align: 'center' });
  document.text('Mail to:- shreejicaretaker2007@gmail.com', pageWidth / 2, 38.5, { align: 'center' });
  document.setDrawColor(70, 70, 70);
  document.setLineWidth(0.25);
  document.line(margin, 42.5, pageWidth - margin, 42.5);

  document.setFontSize(9.5);
  document.text(`Ref: SCC/Appointment/${reference}`, margin, 49);
  document.text(`Date: ${today}`, pageWidth - margin, 49, { align: 'right' });
  document.setFont('times', 'bold');
  document.setFontSize(11);
  document.text('APPOINTMENT LETTER', pageWidth / 2, 59, { align: 'center' });
  document.setLineWidth(0.2);
  document.line(pageWidth / 2 - 19, 60, pageWidth / 2 + 19, 60);
  document.setFont('times', 'normal');
  document.setFontSize(10);

  let y = 68;
  document.text('To,', margin, y);
  y += 5;
  y = addWrappedText(document, `Sh. ${employee.name}`, margin, y, textWidth);
  y = addWrappedText(document, location.address || location.name, margin, y + 1, textWidth);
  y += 4;
  document.setFont('times', 'bold');
  y = addWrappedText(document, `Subject:- Appointment for ${position}`, margin, y, textWidth);
  document.setFont('times', 'normal');
  y += 4;
  y = addWrappedText(document, `Dear Sh. ${employee.name},`, margin, y, textWidth);
  y += 5;
  y = addWrappedText(
    document,
    `We are pleased to offer you the position of ${position} with Shreeji Caretaker Company on the following terms and conditions.`,
    margin,
    y,
    textWidth,
  );
  y += 7;

  const valueX = 35;
  y = drawDetail(document, 'Date of Joining', formatDate(employee.locationAssignedAt || employee.dateOfJoining), margin, valueX, y, pageWidth);
  y = drawDetail(document, 'Job Title', `${position}${skillCategory}`, margin, valueX, y, pageWidth);
  y = drawDetail(document, 'Salary', salary, margin, valueX, y, pageWidth);
  y = drawDetail(document, 'Job Location', location.address || location.name, margin, valueX, y, pageWidth);
  y = drawDetail(document, 'Working Hours', '8 Hrs. as per requirement', margin, valueX, y, pageWidth);
  y = drawDetail(document, 'Leave Policy', 'Weekly off & Govt. Holidays', margin, valueX, y, pageWidth);

  y += 3.5;
  document.setFont('times', 'bold');
  document.text('Terms and Conditions', margin, y);
  document.setFont('times', 'normal');
  y += 6;
  const terms = [
    'Please sing the duly copy of the appointment letter signifying your acceptance.',
    'We welcome you to your and look forward to fruitful collaboration.',
    'This appointment letter is valid on Consent of terms & condition by employer.',
  ];
  terms.forEach((term, index) => {
    y = addWrappedText(document, `${index + 1}.    ${term}`, margin + 6, y, textWidth - 6);
    y += 1.5;
  });

  const signatureY = Math.max(y + 15, 199);
  document.setFontSize(10);
  document.text('With best wishes,', margin, signatureY);
  document.text('For:- Shreeji Caretaker Company', margin, signatureY + 10);
  document.text('Authorized signatory', margin, signatureY + 24);
  document.line(margin, signatureY + 18, margin + 42, signatureY + 18);
}

export async function createAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  if (employees.length === 0) return null;
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ format: 'a4', unit: 'mm' });
  employees.forEach((employee, index) => addAppointmentLetter(document, employee, location, index));
  return document;
}

export async function downloadAppointmentLetters(employees: Employee[], location: OrganizationLocation) {
  const document = await createAppointmentLettersPdf(employees, location);
  if (!document) return;
  const filePart = (location.opNumber || location.name || 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  document.save(`appointment-letters-${filePart || 'location'}.pdf`);
}

export async function createAppointmentLetterPdf(employee: Employee, location: OrganizationLocation) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ format: 'a4', unit: 'mm' });
  addAppointmentLetter(document, employee, location, 0);
  return document.output('blob');
}

export async function createCombinedAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  const document = await createAppointmentLettersPdf(employees, location);
  return document?.output('blob') ?? null;
}