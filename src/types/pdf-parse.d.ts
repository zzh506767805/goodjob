declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      [key: string]: any;
    };
    metadata: any;
    version: string;
  }

  function parse(dataBuffer: Buffer | Uint8Array, options?: {
    pagerender?: (pageData: any) => string;
    max?: number;
  }): Promise<PDFData>;

  export = parse;
} 