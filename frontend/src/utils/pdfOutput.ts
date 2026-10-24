type PdfDocument = InstanceType<typeof import('jspdf').jsPDF>;

export type PdfAction = 'download' | 'print';

/** Opens the browser print dialog for a generated PDF, keeping its A4 page size. */
export function printPdf(doc: PdfDocument) {
  const url = URL.createObjectURL(doc.output('blob'));
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // The dialog is non-blocking in some browsers, so keep the frame alive long enough to print.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

export function finishPdf(doc: PdfDocument, fileName: string, action: PdfAction = 'download') {
  if (action === 'print') printPdf(doc);
  else doc.save(fileName);
}
