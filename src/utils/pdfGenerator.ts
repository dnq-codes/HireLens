import { jsPDF } from "jspdf";
import { cleanTailoredResume } from "./cleanMarkdown";

/**
 * Parses tailored markdown resume text and compiles it into a high-quality,
 * professional PDF document using jsPDF. Supports multi-page overflows,
 * bullet formatting, horizontal dividers, and correct typography hierarchy.
 */
export function generateResumePDF(markdownText: string, jobTitle: string, company: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // A4 dimensions: 210mm x 297mm
  const leftMargin = 20;
  const rightMargin = 20;
  const printableWidth = 170; // 210 - 20 - 20
  let y = 22; // Start position

  // Helper to check and handle page overflows
  const checkPageOverflow = (neededHeight: number) => {
    if (y + neededHeight > 275) {
      doc.addPage();
      y = 22; // Reset top margin for new page
      return true;
    }
    return false;
  };

  // Clean raw and escaped syntax, standardise typography
  const cleanedText = cleanTailoredResume(markdownText);

  // Split markdown into lines
  const lines = cleanedText.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Skip empty lines but add small vertical spacing
    if (!trimmed) {
      y += 2.5;
      return;
    }

    // 1. Candidate Name (H1)
    if (trimmed.startsWith("# ")) {
      const name = trimmed.replace(/^#\s+/, "").replace(/\*\*/g, "");
      checkPageOverflow(12);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(name, 105, y, { align: "center" });
      
      y += 8.5;
      return;
    }

    // 2. Section Headings (H2)
    if (trimmed.startsWith("## ")) {
      const heading = trimmed.replace(/^##\s+/, "").replace(/\*\*/g, "").toUpperCase();
      
      // Ensure we have space for heading + divider + at least 1 line of content
      checkPageOverflow(18);
      
      y += 4; // Extra margin before new section
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(26, 54, 93); // Deep corporate navy
      doc.text(heading, leftMargin, y);

      // Draw a neat, modern horizontal rule line under the section header
      doc.setDrawColor(226, 232, 240); // border slate-200
      doc.setLineWidth(0.35);
      doc.line(leftMargin, y + 2, 210 - rightMargin, y + 2);

      y += 7.5;
      return;
    }

    // 3. Subheadings / Job Title & Company (H3)
    if (trimmed.startsWith("### ")) {
      const subHeading = trimmed.replace(/^###\s+/, "").replace(/\*\*/g, "");
      checkPageOverflow(9);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(subHeading, leftMargin, y);
      
      y += 5;
      return;
    }

    // 4. Horizontal Dividers
    if (trimmed === "---" || trimmed === "***") {
      checkPageOverflow(6);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, y, 210 - rightMargin, y);
      y += 4;
      return;
    }

    // 5. Contact Info Line (Matches emails, phones, or vertical bars)
    if (trimmed.includes("|") || trimmed.includes("@") || trimmed.includes(":") && y < 45) {
      const contactInfo = trimmed.replace(/\*\*/g, "");
      checkPageOverflow(7);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(contactInfo, 105, y, { align: "center" });
      
      y += 5.5;
      return;
    }

    // 6. Bullet Points / List Items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      // Extract bullet item content and clean markdown bold notation
      const rawText = trimmed.replace(/^[\-\*]\s+/, "");
      
      // Parse out inline bold markers to keep text clean, or render simply
      const cleanText = rawText.replace(/\*\*/g, "");

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // slate-600

      // Wrap list text to account for bullet indentation
      const bulletIndent = 6;
      const wrappedLines = doc.splitTextToSize(cleanText, printableWidth - bulletIndent);

      wrappedLines.forEach((wLine: string, idx: number) => {
        checkPageOverflow(5);
        if (idx === 0) {
          // Draw standard bullet icon
          doc.text("•", leftMargin + 1, y);
        }
        doc.text(wLine, leftMargin + bulletIndent, y);
        y += 4.5;
      });
      return;
    }

    // 7. Standard Paragraph Text
    const cleanParaText = trimmed.replace(/\*\*/g, "");
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600

    const wrappedParaLines = doc.splitTextToSize(cleanParaText, printableWidth);
    wrappedParaLines.forEach((wLine: string) => {
      checkPageOverflow(5);
      doc.text(wLine, leftMargin, y);
      y += 4.5;
    });
  });

  // Save the document to the user's browser download folder
  const formattedTitle = jobTitle.toLowerCase().replace(/\s+/g, "_");
  const formattedCompany = company.toLowerCase().replace(/\s+/g, "_");
  doc.save(`${formattedCompany}_${formattedTitle}_tailored_resume.pdf`);
}
