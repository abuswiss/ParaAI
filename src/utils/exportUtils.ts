// Utility functions for exporting text as .txt, .docx, and .pdf

export const exportAsTxt = (text: string, filename: string) => {
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAsDocx = async (text: string, filename: string) => {
  // Use the docx library for proper .docx export
  const { Document, Packer, Paragraph } = await import('docx');
  // Split text into paragraphs (by double newlines or single newlines)
  const paragraphs = text.split(/\n{2,}|\r{2,}/).map(p => p.trim()).filter(Boolean);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.map(p => new Paragraph(p)),
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAsPdf = async (text: string, filename: string) => {
  try {
    const jsPDF = (window as any).jsPDF || (await import('jspdf')).jsPDF;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginLeft = 40;
    const marginTop = 60;
    const lineHeight = 18;
    const maxWidth = 515; // a4 width - margins
    // Add a title/header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Generated Document', marginLeft, marginTop);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    // Split text into lines that fit the page
    const lines = doc.splitTextToSize(text, maxWidth);
    let y = marginTop + 30;
    for (const line of lines) {
      if (y > 800) { // A4 page height in pt
        doc.addPage();
        y = marginTop;
      }
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const pageText = `Page ${i} of ${pageCount}`;
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(pageText, pageWidth / 2, 820, { align: 'center' });
    }
    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } catch (e) {
    exportAsTxt(text, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  }
}; 