export {};

declare global {
  interface Window {
    electronAPI?: {
      listPrinters: () => Promise<
        {
          name: string;
          displayName?: string;
          isDefault?: boolean;
          status?: number;
        }[]
      >;
      printHTML: (payload: {
        html: string;
        printerName?: string;
        widthMM: number;
        heightMM: number;
        columns?: number;
        landscape?: boolean;
        copies?: number;
      }) => Promise<{
        success: boolean;
        failureReason?: string;
      }>;
      platform?: string;
      version?: string;
    };
  }
}