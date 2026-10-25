import type { Employee, OrganizationLocation } from '../types';
import { fitInto, loadSignatureImage } from '../pages/Payroll/utils/wageRegisterExport';
import { finishPdf, type PdfAction } from '../utils/pdfOutput';
import { loadDocumentSettings, type AppointmentLetterSettings } from './settingsService';

type PdfDocument = InstanceType<typeof import('jspdf').jsPDF>;
type Segment = { text: string; bold?: boolean; underline?: boolean };

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

const SKILL_IN_TITLE = /\(?\s*\b(?:un|semi|highly)?[\s-]*skilled\b\s*\)?/gi;

function titleCaseSkill(skill: string) {
  return skill
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^(un|semi|highly) (?=skilled)/i, '$1-')
    .replace(/[a-z]+/gi, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function titleOf(employee: Employee, location: OrganizationLocation) {
  return (employee.jobTitle || employee.designation || location.designation || 'Employee').replace(/\s+/g, ' ').trim();
}

function positionOf(employee: Employee, location: OrganizationLocation) {
  const rawTitle = titleOf(employee, location);
  const skill = titleCaseSkill(employee.skillCategory?.trim() || '');
  if (!skill) return rawTitle;
  const title = rawTitle.replace(SKILL_IN_TITLE, ' ').replace(/\s+/g, ' ').trim();
  return title ? `${title} ( ${skill})` : rawTitle;
}

function jobTitleOf(employee: Employee, location: OrganizationLocation) {
  return [positionOf(employee, location), employee.department?.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' ');
}

function jobLocationOf(location: OrganizationLocation) {
  return (location.address || '').replace(/\s*\n\s*/g, ', ').trim();
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
  settings: AppointmentLetterSettings,
  signature: Awaited<ReturnType<typeof loadSignatureImage>>,
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
  const shortName = settings.shortName.trim();
  const reference = location.opNumber?.trim() || String(index + 1).padStart(2, '0');
  const assignedDate = formatDate(employee.locationAssignedAt);

  pdf.setTextColor(20, 20, 20);
  pdf.setDrawColor(40, 40, 40);

  const companyName = settings.companyName.trim();
  setFont(pdf, true, 19);
  setFont(pdf, true, Math.min(19, (19 * textWidth) / Math.max(pdf.getTextWidth(companyName), 1)));
  pdf.text(companyName, center, 22, { align: 'center' });

  let y = 29;
  setFont(pdf, false, 10.5);
  const phone = settings.phone.trim();
  const addressLines = settings.registeredAddress.split('\n').map((line) => line.trim()).filter(Boolean);
  addressLines.forEach((line, lineIndex) => {
    let text = lineIndex === 0 ? `Registered address:-${line}` : line;
    if (lineIndex === addressLines.length - 1 && phone) text += ` Mob-${phone}`;
    const wrapped = pdf.splitTextToSize(text, textWidth) as string[];
    pdf.text(wrapped, center, y, { align: 'center' });
    y += wrapped.length * 5;
  });
  if (addressLines.length === 0 && phone) {
    pdf.text(`Mob-${phone}`, center, y, { align: 'center' });
    y += 5;
  }
  if (settings.email.trim()) {
    setFont(pdf, false, 11.5);
    pdf.text(`Mail to:- ${settings.email.trim()}`, center, y + 0.5, { align: 'center' });
    y += 5.5;
  }

  y += 0.5;
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN - 3, y, pageWidth - MARGIN + 3, y);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN - 3, y + 1, pageWidth - MARGIN + 3, y + 1);

  y += 6;
  setFont(pdf, false, 9.5);
  pdf.text(`Ref: ${settings.refPrefix.trim()}${reference}`, MARGIN, y);
  pdf.text(`Date: ${assignedDate || formatDate(employee.dateOfJoining) || formatDate(new Date().toISOString())}`, pageWidth - MARGIN, y, { align: 'right' });

  y += 9;
  const title = settings.title.trim();
  setFont(pdf, true, 11);
  pdf.text(title, center, y, { align: 'center' });
  const headingWidth = pdf.getTextWidth(title);
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
    { text: titleOf(employee, location), bold: true },
    { text: `${shortName ? ` with ${shortName}` : ''} on the following terms and conditions.` },
  ], MARGIN, y, textWidth);

  y += 8;
  const joiningDate = assignedDate || formatDate(employee.dateOfJoining) || 'To be confirmed';
  const optionalRows: [string, string][] = [
    ['Salary', settings.salaryText.trim()],
    ['Job Location', jobLocationOf(location)],
    ['Working Hours', settings.workingHours.trim()],
    ['Leave Policy', settings.leavePolicy.trim()],
  ];
  y = writeDetail(pdf, 'Date of Joining', [{ text: joiningDate }], y, textWidth);
  y = writeDetail(pdf, 'Job Title', [{ text: ` ${jobTitleOf(employee, location)}`, bold: true }], y, textWidth);
  optionalRows
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      y = writeDetail(pdf, label, [{ text: ` ${value}` }], y, textWidth);
    });

  const terms = settings.terms.split('\n').map((term) => term.trim()).filter(Boolean);
  if (terms.length > 0) {
    y += 3;
    setFont(pdf);
    pdf.text('Terms and Conditions', MARGIN, y);
    y += LINE + 2;
    terms.forEach((term, termIndex) => {
      pdf.text(`${termIndex + 1}.`, MARGIN + 7, y);
      y = writeRich(pdf, [{ text: term }], MARGIN + 13, y, textWidth - 13) + 0.5;
    });
  }

  const signatureY = Math.max(y + 18, 222);
  if (settings.closing.trim()) pdf.text(settings.closing.trim(), MARGIN, signatureY);
  if (shortName) pdf.text(`For:- ${shortName}`, MARGIN, signatureY + 10);
  if (signature) {
    const fitted = fitInto(signature, 45, 13);
    pdf.addImage(signature.dataUrl, signature.format.toUpperCase(), MARGIN, signatureY + 24 - fitted.height, fitted.width, fitted.height);
  }
  if (settings.signatoryTitle.trim()) pdf.text(settings.signatoryTitle.trim(), MARGIN, signatureY + 28);
}

export async function createAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  if (employees.length === 0) return null;
  const [{ jsPDF }, settings] = await Promise.all([import('jspdf'), loadDocumentSettings('appointment-letter')]);
  const signature = await loadSignatureImage(settings.signatureImage);
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  employees.forEach((employee, index) => addAppointmentLetter(pdf, settings, signature, employee, location, index));
  return pdf;
}

function fileSlug(value: string, fallback: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

export async function downloadAppointmentLetters(employees: Employee[], location: OrganizationLocation, action: PdfAction = 'download') {
  const pdf = await createAppointmentLettersPdf(employees, location);
  if (!pdf) return;
  const name = employees.length === 1
    ? `appointment-letter-${fileSlug(employees[0].name, 'employee')}`
    : `appointment-letters-${fileSlug(location.opNumber || location.name || '', 'location')}`;
  finishPdf(pdf, `${name}.pdf`, action);
}

export async function createAppointmentLetterPdf(employee: Employee, location: OrganizationLocation) {
  const pdf = await createAppointmentLettersPdf([employee], location);
  return pdf!.output('blob');
}

export async function createCombinedAppointmentLettersPdf(employees: Employee[], location: OrganizationLocation) {
  const pdf = await createAppointmentLettersPdf(employees, location);
  return pdf?.output('blob') ?? null;
}
