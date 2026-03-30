import { render } from 'solid-js/web';
import App from './App';
import './style.css';

// Declare standard TS types for the window.electronAPI object we defined in preload
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

const root = document.getElementById('app');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

render(() => <App />, root!);

