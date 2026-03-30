export interface IElectronAPI {
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onExternalLinkWarning: (callback: (url: string) => void) => void;
  confirmOpenUrl: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
