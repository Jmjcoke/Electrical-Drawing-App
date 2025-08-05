// Mock for file-type module to handle ES module issues in tests
module.exports = {
  fileTypeFromBuffer: async (buffer) => {
    // Simple mock that checks for PDF header
    const bufferString = buffer.toString('binary', 0, 4);
    if (bufferString.startsWith('%PDF')) {
      return {
        mime: 'application/pdf',
        ext: 'pdf'
      };
    }
    
    // Check for common text formats
    if (buffer.toString().includes('This is not a PDF') || buffer.toString().includes('small file')) {
      return null; // Cannot determine file type
    }
    
    return null;
  }
};