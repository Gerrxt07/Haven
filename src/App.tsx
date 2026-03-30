import { onMount } from 'solid-js';

export default function App() {
  onMount(() => {
    // Hook up the titlebar buttons to their respective IPC events
    document.getElementById('min-btn')?.addEventListener('click', () => {
      globalThis.electronAPI.minimize();
    });

    document.getElementById('max-btn')?.addEventListener('click', () => {
      globalThis.electronAPI.maximize();
    });

    document.getElementById('close-btn')?.addEventListener('click', () => {
      globalThis.electronAPI.close();
    });

    // Listen for external link clicks intercepted by Electron
    globalThis.electronAPI.onExternalLinkWarning((url) => {
      // TODO: Replace this native confirm with a beautifully styled SolidJS Modal / Dialog later
      console.log(`[Link Intercepted]: ${url}`);
      const userConfirmed = globalThis.confirm(
        `Warning: You are leaving Haven to visit an external website:\n\n${url}\n\nDo you want to continue?`
      );
      
      if (userConfirmed) {
        globalThis.electronAPI.confirmOpenUrl(url);
      }
    });
  });

  return (
    <div class="flex flex-col h-screen w-full bg-[#272727] text-white">
      {/* Titlebar */}
      <div class="h-8 bg-[#1e1e1e] flex justify-between items-center select-none relative" style={{ "-webkit-app-region": "drag" }}>
        
        {/* Spacer */}
        <div class="w-[138px]"></div>
        
        {/* Center Title */}
        <div class="absolute inset-0 flex justify-center items-center text-[13px] font-semibold text-[#a0a0a0] pointer-events-none">
          Haven
        </div>
        
        {/* Controls */}
        <div class="flex h-full" style={{ "-webkit-app-region": "no-drag" }}>
          <button id="min-btn" class="w-[46px] h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"></rect></svg>
          </button>
          <button id="max-btn" class="w-[46px] h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"></rect></svg>
          </button>
          <button id="close-btn" class="w-[46px] h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[#e81123] hover:text-white">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fill-rule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"></polygon></svg>
          </button>
        </div>
      </div>

      {/* Main Content Content */}
      <div class="flex-1 p-5">
        <p>Welcome to Haven with SolidJS + Tailwind v4!</p>
        
        {/* Placeholder link for testing the interception */}
        <div class="mt-4">
          <a href="https://github.com/Haven" target="_blank" class="text-blue-400 hover:text-blue-300 underline">
            Test External Link Interception
          </a>
        </div>
      </div>
    </div>
  );
}
