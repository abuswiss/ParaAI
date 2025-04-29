import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '@/components/ui/Modal'; 
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea'; // Use Textarea for potentially longer inputs
import { Download, FileText, FileType, File } from 'lucide-react'; // Add specific file icons
import { Packer, Document, Paragraph, TextRun } from 'docx'; // Import docx components
import { saveAs } from 'file-saver'; // Utility for saving blobs
import jsPDF from 'jspdf'; // Import jsPDF
import html2canvas from 'html2canvas'; // Import html2canvas

interface FillTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateContent: string;
  onGenerate: (placeholderValues: Record<string, string>) => void;
}

// Regex to find placeholders like %%[Prompt Text Here]%%
const PLACEHOLDER_REGEX = /%%\s*\[(.*?)\]\s*%%/g;

const FillTemplateModal: React.FC<FillTemplateModalProps> = ({ 
  isOpen,
  onClose,
  templateContent,
  onGenerate
}) => {
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | 'txt' | null>(null); // Track export loading
  const pdfContentRef = useRef<HTMLDivElement>(null); // Ref for hidden div for PDF rendering

  // Parse placeholders from content only when content changes
  const placeholders = useMemo(() => {
    const found = new Set<string>();
    let match;
    while ((match = PLACEHOLDER_REGEX.exec(templateContent)) !== null) {
      // Extract the text inside the brackets
      const prompt = match[1]?.trim(); 
      if (prompt) {
        found.add(prompt);
      }
    }
    return Array.from(found);
  }, [templateContent]);

  // Determine if the generate button should be disabled
  const isGenerateDisabled = placeholders.length === 0;

  // Initialize state when modal opens or placeholders change
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, string> = {};
      placeholders.forEach(p => { initialValues[p] = ''; });
      setPlaceholderValues(initialValues);
      setError(null);
    }
  }, [isOpen, placeholders]);

  const handleInputChange = (prompt: string, value: string) => {
    setPlaceholderValues(prev => ({ ...prev, [prompt]: value }));
    if (error) setError(null); // Clear error on input
  };

  const handleGenerateClick = () => {
    // Basic validation: check if any field is empty
    const emptyFields = placeholders.filter(p => !placeholderValues[p]?.trim());
    if (emptyFields.length > 0) {
      setError(`Please fill in all placeholder fields: ${emptyFields.join(', ')}`);
      return;
    }
    setError(null);
    onGenerate(placeholderValues);
  };

  // --- Export Handlers --- 
  const performSubstitution = (): string => {
      let substitutedContent = templateContent;
      substitutedContent = substitutedContent.replaceAll(PLACEHOLDER_REGEX, (match, prompt) => {
          const trimmedPrompt = prompt?.trim();
          return trimmedPrompt && placeholderValues[trimmedPrompt] !== undefined 
              ? placeholderValues[trimmedPrompt] 
              : match; 
      });
      return substitutedContent;
  };

  const handleDownloadTxt = () => {
      const validationError = validatePlaceholders();
      if (validationError) {
          setError(validationError);
          return;
      }
      // Add loading state for TXT
      setIsExporting('txt'); 
      setError(null);
      try {
          const substitutedHtml = performSubstitution();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = substitutedHtml;
          const plainText = tempDiv.textContent || tempDiv.innerText || "";
          tempDiv.remove();
          
          // Use saveAs directly for text blob
          const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
          saveAs(blob, "template_export.txt");
      } catch (err) {
          console.error("Error generating TXT:", err);
          setError("Failed to generate TXT file.");
      } finally {
           setIsExporting(null); // Reset loading state
      }
  };

  const handleDownloadDocx = async () => {
      const validationError = validatePlaceholders();
      if (validationError) {
          setError(validationError);
          return;
      }
      setIsExporting('docx');
      setError(null);
      try {
          const substitutedHtml = performSubstitution();
          // Basic HTML to text conversion for DOCX
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = substitutedHtml;
          const plainText = tempDiv.textContent || tempDiv.innerText || "";
          tempDiv.remove();

          // Create DOCX content
          const doc = new Document({
              sections: [{
                  properties: {},
                  children: [
                      // Split text into paragraphs for basic structure
                      ...plainText.split('\n').map(line => 
                          new Paragraph({ 
                              children: [new TextRun(line)] 
                          })
                      )
                  ],
              }],
          });

          // Generate blob and save
          const blob = await Packer.toBlob(doc);
          saveAs(blob, "template_export.docx"); // Use file-saver

      } catch (err) {
          console.error("Error generating DOCX:", err);
          setError("Failed to generate DOCX file.");
      } finally {
          setIsExporting(null);
      }
  };

  const handleDownloadPdf = async () => {
      const validationError = validatePlaceholders();
      if (validationError) {
          setError(validationError);
          return;
      }
      setIsExporting('pdf');
      setError(null);

      // Ensure the hidden div is rendered and populated before capturing
      const substitutedHtml = performSubstitution();
      if (pdfContentRef.current) {
        pdfContentRef.current.innerHTML = substitutedHtml;
      } else {
          console.error("PDF content ref not available.");
          setError("Failed to prepare content for PDF generation.");
          setIsExporting(null);
          return;
      }

      // Allow a brief moment for rendering
      await new Promise(resolve => setTimeout(resolve, 100)); 

      try {
          const canvas = await html2canvas(pdfContentRef.current, {
              scale: 2, // Increase scale for better resolution
              useCORS: true, // If content includes external images
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
              orientation: 'p', // portrait
              unit: 'pt', // points, common for PDF
              format: 'a4' // standard A4 size
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const canvasAspectRatio = canvasWidth / canvasHeight;
          const pdfAspectRatio = pdfWidth / pdfHeight;

          let finalCanvasWidth, finalCanvasHeight;

          // Fit canvas image within PDF page dimensions, maintaining aspect ratio
          if (canvasAspectRatio > pdfAspectRatio) {
            // Wider than page aspect ratio -> fit to width
            finalCanvasWidth = pdfWidth;
            finalCanvasHeight = pdfWidth / canvasAspectRatio;
          } else {
            // Taller than page aspect ratio -> fit to height
            finalCanvasHeight = pdfHeight;
            finalCanvasWidth = pdfHeight * canvasAspectRatio;
          }
          
          // Center image if smaller than page
          const xPos = (pdfWidth - finalCanvasWidth) / 2;
          const yPos = 0; // Start at top, add pages if needed (more complex)

          pdf.addImage(imgData, 'PNG', xPos, yPos, finalCanvasWidth, finalCanvasHeight);
          pdf.save('template_export.pdf');

          // Clean up the hidden div content after generation
          if (pdfContentRef.current) {
              pdfContentRef.current.innerHTML = '';
          }

      } catch (err) {
          console.error("Error generating PDF:", err);
          setError("Failed to generate PDF file.");
      } finally {
          setIsExporting(null);
      }
  };

  const validatePlaceholders = (): string | null => {
      const emptyFields = placeholders.filter(p => !placeholderValues[p]?.trim());
      if (emptyFields.length > 0) {
          return `Please fill in all placeholder fields: ${emptyFields.join(', ')}`;
      }
      return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fill Template Placeholders" size="lg"> {/* Larger modal */}
      {/* Hidden div for PDF rendering */}
      <div ref={pdfContentRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px' }} className="prose dark:prose-invert"></div>
      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2 space-y-4"> {/* Scrollable, more space */}
        {placeholders.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10 italic">
            No placeholders (like <code>%%[Prompt]%%</code>) found in the template content.
          </p>
        ) : (
          placeholders.map((prompt) => (
            <div key={prompt}>
              <Label htmlFor={`placeholder-${prompt}`} className="font-medium text-gray-800 dark:text-gray-200">
                {prompt} 
              </Label>
              <Textarea
                id={`placeholder-${prompt}`}
                value={placeholderValues[prompt] || ''}
                onChange={(e) => handleInputChange(prompt, e.target.value)}
                placeholder={`Enter value for "${prompt}"`}
                rows={2} // Start with 2 rows, might expand
                className="mt-1 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y" // Allow vertical resize
              />
            </div>
          ))
        )}
         {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>
      <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Export Buttons Group */}
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTxt} disabled={isGenerateDisabled || !!isExporting} title="Download as Text File">
                {isExporting === 'txt' ? <Spinner size="sm" className="mr-1"/> : <FileText className="h-4 w-4 mr-1" />}
                .txt
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={isGenerateDisabled || !!isExporting} title="Download as Word Document">
                 {isExporting === 'docx' ? <Spinner size="sm" className="mr-1"/> : <File className="h-4 w-4 mr-1" />}
                .docx
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isGenerateDisabled || !!isExporting} title="Download as PDF">
                {isExporting === 'pdf' ? <Spinner size="sm" className="mr-1"/> : <FileType className="h-4 w-4 mr-1" />}
                .pdf
            </Button>
        </div>
        {/* Action Buttons Group */}
        <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={!!isExporting}>
                Cancel
            </Button>
            {/* Disable Generate button if no placeholders */}
            <Button onClick={handleGenerateClick} disabled={isGenerateDisabled || !!isExporting}>
               {isExporting ? 'Exporting...' : 'Generate Document'}
            </Button>
        </div>
      </div>
    </Modal>
  );
};

export default FillTemplateModal; 