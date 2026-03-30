import { onMount } from 'solid-js';
import { Minus, Square, X } from 'lucide-solid';

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
        <div class="w-34.5"></div>
        
        {/* Center Title */}
        <div class="absolute inset-0 flex justify-center items-center text-[13px] font-semibold text-[#a0a0a0] pointer-events-none">
          Haven
        </div>
        
        {/* Controls */}
        <div class="flex h-full" style={{ "-webkit-app-region": "no-drag" }}>
          <button id="min-btn" class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10">
            <Minus size={14} stroke-width={2} aria-hidden="true" />
          </button>
          <button id="max-btn" class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10">
            <Square size={12} stroke-width={2} aria-hidden="true" />
          </button>
          <button id="close-btn" class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[#e81123] hover:text-white">
            <X size={14} stroke-width={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="flex-1"></div>
    </div>
  );
}
