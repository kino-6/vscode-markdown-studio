declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    text: string;
    info: Record<string, unknown>;
  }
  interface PdfOptions {
    pagerender?: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => Promise<string>;
    max?: number;
  }
  function pdfParse(dataBuffer: Buffer, options?: PdfOptions): Promise<PdfData>;
  export = pdfParse;
}
