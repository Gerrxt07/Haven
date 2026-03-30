export interface IElectronAPI {
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onExternalLinkWarning: (callback: (url: string) => void) => void;
  confirmOpenUrl: (url: string) => void;
}

declare global {
  var electronAPI: IElectronAPI;
  interface Window {
    electronAPI: IElectronAPI;
  }
}
