import type { Employee, OrganizationLocation } from '../types';
import { getCompanyProfile, type CompanyProfileInput } from './settingsService';

type PdfDocument = InstanceType<typeof import('jspdf').jsPDF>;
type LetterCompany = Omit<CompanyProfileInput, 'address'>;
type Segment = { text: string; bold?: boolean; underline?: boolean };

export const APPOINTMENT_LETTER_COMPANY: LetterCompany = {
  name: 'M/s. SHREEJI CARETAKER COMPANY',
  registeredAddress: 'N-33, GOVIND NAGAR, R.H.B. COLONY, KANKROLI\nDistt :-Rajsamand , Pin :-313342 ( Rajasthan )',
  phone: '9784785808',
  email: 'shreejicaretaker2007@gmail.com',
};

const MARGIN = 15;
const BODY_SIZE = 10.5;
const LINE = 5;

function formatDate(value?: string | null) {
  if (!value) return '';
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDate && value.length === 10) return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function letterCompanyName(name: string) {
  return name.replace(/^m\/s\.?\s*/i, 'M/s. ');
}

function shortCompanyName(name: string) {
  return name
    .replace(/^m\/s\.?\s*/i, '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function positionOf(employee: Employee, location: OrganizationLocation) {
  const title = (employee.jobTitle || employee.designation || location.designation || 'Employee').trim();
  const skill = employee.skillCategory?.trim();
  return skill && !title.toLowerCase().includes(skill.toLowerCase()) ? `${title} ( ${skill} )` : title;
}

function jobTitleOf(employee: Employee, position: string) {
  const department = employee.department?.trim();
  if (!department) return position;
  return /department/i.test(department) ? `${position} ${department}` : `${position} ${department} Department`;
}

function jobLocationOf(employee: Employee, location: OrganizationLocation) {
  const organization = employee.organizationName?.trim();
  const site = (location.address || location.name || '').replace(/\s*\n\s*/g, ', ').trim();
  if (!organization) return site;
  if (!site) return organization;
  return `${organization}${/[.,]$/.test(organization) ? ' ' : ', '}${site}`;
}

function salaryOf(employee: Employee) {
  if (employee.dailySalary > 0) {
    const amount = employee.dailySalary.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `Rs. ${amount} per day (as per Central Govt. minimum Wage Act)`;
  }
  return 'As per Central Govt. minimum Wage Act. ("C" Class City)';
}

function setFont(pdf: PdfDocument, bold = false, size = BODY_SIZE) {
  pdf.setFont('times', bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
}

/** Lays out mixed bold/normal text with word wrapping; returns the y below the last line. */
function writeRich(pdf: PdfDocument, segments: Segment[], x: number, y: number, maxWidth: number) {
  const words = segments.flatMap((segment) => segment.text
    .split(/(\s+)/)
    .filter((part) => part.length > 0)
    .map((part) => ({ ...segment, text: part })));
  let cursorX = x;
  let cursorY = y;

  words.forEach((word) => {
    setFont(pdf, word.bold);
    const isSpace = /^\s+$/.test(word.text);
    const width = pdf.getTextWidth(word.text);
    if (!isSpace && cursorX + width > x + maxWidth && cursorX > x) {
      cursorX = x;
      cursorY += LINE;
    }
    if (isSpace && cursorX === x) return;
    pdf.text(word.text, cursorX, cursorY);
    if (word.underline && !isSpace) pdf.line(cursorX, cursorY + 0.8, cursorX + width, cursorY + 0.8);
    cursorX += width;
  });

  setFont(pdf);
  return cursorY + LINE;
}

function writeDetail(pdf: PdfDocument, label: string, value: Segment[], y: number, width: number) {
  return writeRich(pdf, [{ text: `${label}:-`, bold: true }, ...value], MARGIN, y, width) + 2.2;
}

function addAppointmentLetter(
  pdf: PdfDocument,
  company: LetterCompany,
  employee: Employee,
  location: OrganizationLocation,
  index: number,
) {
  if (index > 0) pdf.addPage();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const center = pageWidth / 2;
  const textWidth = pageWidth - MARGIN * 2;
  const position = positionOf(employee, location);
  const name = employee.name.trim().toUpperCase();
  const shortName = shortCompanyName(company.name) || 'Shreeji Caretaker Company';
  const reference = location.opNumber?.trim() || String(index + 1).padStart(2, '0');

  pdf.setTextColor(20, 20, 20);
  pdf.setDrawColor(40, 40, 40);

  setFont(pdf, true, 19);
  const title = letterCompanyName(company.name);
  const titleSize = Math.min(19, (19 * textWidth) / Math.max(pdf.getTextWidth(title), 1));
  setFont(pdf, true, titleSize);
  pdf.text(title, center, 22, { align: 'center' });

  let y = 29;
  setFont(pdf, false, 10.5);
  const addressLines = company.registeredAddress.split('\n').map((line) => line.trim()).filter(Boolean);
  addressLines.forEach((line, lineIndex) => {
    let text = lineIndex === 0 ? `Registered address:-${line}` : line;
    if (lineIndex === addressLines.length - 1 && company.phone.trim()) text += ` Mob-${company.phone.trim()}`;
    const wrapped = pdf.splitTextToSize(text, textWidth) as string[];
    pdf.text(wrapped, center, y, { align: 'center' });
    y += wrapped.length * 5;
  });
  if (addressLines.length === 0 && company.phone.trim()) {
    pdf.text(`Mob-${company.phone.trim()}`, center, y, { align: 'center' });
    y += 5;
  }
  if (company.email.trim()) {
    setFont(pdf, false, 11.5);
    pdf.text(`Mail to:- ${company.email.trim()}`, center, y + 0.5, { align: 'center' });
    y += 5.5;
  }

  y += 0.5;
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN - 3, y, pageWidth - MARGIN + 3, y);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN - 3, y + 1, pageWidth - MARGIN + 3, y + 1);

  y += 6;
  setFont(pdf, false, 9.5);
  pdf.text(`Ref: SCC/Appointment/${reference}`, MARGIN, y);
  pdf.text(`Date: ${formatDate(new Date().toISOString())}`, pageWidth - MARGIN, y, { align: 'right' });

  y += 9;
  setFont(pdf, true, 11);
  pdf.text('APPOINTMENT LETTER', center, y, { align: 'center' });
  const headingWidth = pdf.getTextWidth('APPOINTMENT LETTER');
  pdf.setLineWidth(0.3);
  pdf.line(center - headingWidth / 2, y + 1, center + headingWidth / 2, y + 1);

  y += 11;
  setFont(pdf);
  pdf.text('To,', MARGIN, y);
  y += LINE + 1;
  y = writeRich(pdf, [{ text: 'Sh. ' }, { text: name, bold: true }], MARGIN, y, textWidth);
  employee.address
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, textWidth * 0.62) as string[];
      pdf.text(wrapped, MARGIN, y);
      y += wrapped.length * LINE;
    });

  y += 5;
  y = writeRich(pdf, [{ text: 'Subject:- Appointment for ' }, { text: position, bold: true }], MARGIN, y, textWidth);
  y += 4;
  y = writeRich(pdf, [{ text: 'Dear Sh. ' }, { text: name, bold: true }], MARGIN, y, textWidth);
  y += 4;
  y = writeRich(pdf, [
    { text: 'We are pleased to offer you the position of ' },
    { text: position, bold: true },
    { text: ` with ${shortName} on the following terms and conditions.` },
  ], MARGIN, y, textWidth);

  y += 8;
  const joiningDate = formatDate(employee.dateOfJoining) || formatDate(employee.locationAssignedAt) || 'To be confirmed';
  y = writeDetail(pdf, 'Date of Joining', [{ text: joiningDate, underline: true }], y, textWidth);
  y = writeDetail(pdf, 'Job Title', [{ text: ` ${jobTitleOf(employee, position)}`, bold: true }], y, textWidth);
  y = writeDetail(pdf, 'Salary', [{ text: ` ${salaryOf(employee)}` }], y, textWidth);
  y = writeDetail(pdf, 'Job Location', [{ text: ` ${jobLocationOf(employee, location) || 'As assigned by the employer'}` }], y, textWidth);
  y = writeDetail(pdf, 'Working Hours', [{ text: ' 8 Hrs. as per requirement' }], y, textWidth);
  y = writeDetail(pdf, 'Leave Policy', [{ text: ' Weekly off & Govt. Holidays' }], y, textWidth);

  y += 3;
  setFont(pdf);
  pdf.text('Terms and Conditions', MARGIN, y);
  y += LINE + 2;
  [
    'Please sign the duly copy of the appointment letter signifying your acceptance.',
    'We welcome you to your and look forward to fruitful collaboration.',
    'This appointment letter is valid on Consent of terms & condition by employer.',
  ].forEach((term, termIndex) => {
    pdf.text(`${termIndex + 1}.`, MARGIN + 7, y);
    y = writeRich(pdf, [{ text: term }], MARGIN + 13, y, textWidth - 13) + 0.5;
  });

  const signatureY = Math.max(y + 18, 222);
  pdf.text('With best Wishes,', MARGIN, signatureY);
  pdf.text(`For:- ${shortName}`, MARGIN, signatureY + 10);
  pdf.text('Authorized signatory', MARGIN, signatureY + 28);
}

async function loadLetterCompany(): Promise<LetterCompany> {
  try {
    const company = await getCompanyProfile();
    return {
      name: company.name || APPOINTMENT_LETTER_COMPANY.name,
      registeredAddress: company.registeredAddress ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
    };
  } catch {
    return APPOINTMENT_LETTER_COMPANY;
  }
}

export async function createAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  if (employees.length === 0) return null;
  const [{ jsPDF }, company] = await Promise.all([import('jspdf'), loadLetterCompany()]);
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  employees.forEach((employee, index) => addAppointmentLetter(pdf, company, employee, location, index));
  return pdf;
}

function fileSlug(value: string, fallback: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

export async function downloadAppointmentLetters(employees: Employee[], location: OrganizationLocation) {
  const pdf = await createAppointmentLettersPdf(employees, location);
  if (!pdf) return;
  const name = employees.length === 1
    ? `appointment-letter-${fileSlug(employees[0].name, 'employee')}`
    : `appointment-letters-${fileSlug(location.opNumber || location.name || '', 'location')}`;
  pdf.save(`${name}.pdf`);
}

export async function createAppointmentLetterPdf(employee: Employee, location: OrganizationLocation) {
  const pdf = await createAppointmentLettersPdf([employee], location);
  return pdf!.output('blob');
}

export async function createCombinedAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  const pdf = await createAppointmentLettersPdf(employees, location);
  return pdf?.output('blob') ?? null;
}
