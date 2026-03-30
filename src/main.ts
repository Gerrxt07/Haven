// Renderer entry point
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

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="titlebar">
    <!-- Spacer div to keep flex balance if you add a logo on the left later -->
    <div style="width: 138px;"></div>
    
    <div class="titlebar-drag-region">
      Haven
    </div>
    
    <div class="titlebar-controls">
      <button class="titlebar-btn" id="min-btn">
        <svg name="TitleBarMinimize" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"></rect></svg>
      </button>
      <button class="titlebar-btn" id="max-btn">
        <svg name="TitleBarMaximize" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"></rect></svg>
      </button>
      <button class="titlebar-btn titlebar-btn-close" id="close-btn">
        <svg name="TitleBarClose" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fill-rule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"></polygon></svg>
      </button>
    </div>
  </div>
  <div class="main-content">
    <!-- Blank canvas going forward -->
  </div>
`;

// Hook up the titlebar buttons to their respective IPC events
document.getElementById('min-btn')?.addEventListener('click', () => {
  window.electronAPI.minimize();
});

document.getElementById('max-btn')?.addEventListener('click', () => {
  window.electronAPI.maximize();
});

document.getElementById('close-btn')?.addEventListener('click', () => {
  window.electronAPI.close();
});

