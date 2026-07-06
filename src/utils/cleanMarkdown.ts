/**
 * Helper utility to clean raw or escaped markdown syntax and enforce
 * corporate typography and standard sentence-case bullet point construction.
 */

export function cleanTailoredResume(text: string): string {
  if (!text) return "";

  // 1. Normalize line endings and convert any raw escaped strings like '\n*', '\n' back to normal spacing
  let cleaned = text
    .replace(/\\n\*/g, "\n*")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\/g, "") // strip stray escapes
    .replace(/\r\n/g, "\n");

  // Split into lines to do fine-grained cleaning
  const lines = cleaned.split("\n");
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    // Handle bullet points starting with '-' or '*'
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletChar = trimmed.startsWith("- ") ? "- " : "* ";
      let content = trimmed.substring(2).trim();

      // Clean stray markdown symbols or escapes from bullet text
      content = content
        .replace(/\\n/g, " ")
        .replace(/\\/g, "")
        .replace(/\s+/g, " ");

      // Ban all-caps formatting for full sentences
      if (content.length > 15 && content === content.toUpperCase() && /[A-Z]/.test(content)) {
        content = content.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());
      }

      // Professional Bullet Construction: Ensure single sentence starts with standard capitalization
      if (content.length > 0) {
        content = content.charAt(0).toUpperCase() + content.slice(1);
      }

      return bulletChar + content;
    }

    // Handle standard paragraph text blocks
    if (!trimmed.startsWith("#")) {
      let content = trimmed;
      // Ban all-caps formatting for full sentences/paragraphs
      if (content.length > 15 && content === content.toUpperCase() && /[A-Z]/.test(content)) {
        content = content.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());
      }
      return content;
    }

    // Keep headers as they are but strip all-caps on full sub-header sentences if any
    if (trimmed.startsWith("### ")) {
      const headerContent = trimmed.substring(4).trim();
      if (headerContent.length > 15 && headerContent === headerContent.toUpperCase() && /[A-Z]/.test(headerContent)) {
        return "### " + headerContent.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());
      }
    }

    return trimmed;
  });

  return processedLines.join("\n");
}
