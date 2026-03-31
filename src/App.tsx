import { createSignal, onCleanup, onMount } from 'solid-js';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-solid';

type WindowState = {
  isMaximized: boolean;
  isFullScreen: boolean;
};

const isTauriRuntime = '__TAURI_INTERNALS__' in globalThis;

export default function App() {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const appWindow = isTauriRuntime ? getCurrentWindow() : null;

  onMount(() => {
    if (!appWindow) {
      return;
    }

    const syncWindowState = async () => {
      const [isMaximized, isFullScreen] = await Promise.all([
        appWindow.isMaximized(),
        appWindow.isFullscreen(),
      ]);

      setIsExpanded(isMaximized || isFullScreen);
    };

    const unlistenTasks: Array<() => void> = [];

    Promise.all([
      listen<string>('show-external-link-warning', async (event) => {
        const url = event.payload;
        const userConfirmed = globalThis.confirm(
          `Warning: You are leaving Haven to visit an external website:\n\n${url}\n\nDo you want to continue?`,
        );

        if (userConfirmed) {
          await invoke('confirm_open_url', { url });
        }
      }),
      listen<WindowState>('window-state-changed', (event) => {
        setIsExpanded(event.payload.isMaximized || event.payload.isFullScreen);
      }),
    ]).then((unlisteners) => {
      unlistenTasks.push(...unlisteners);
    });

    void syncWindowState();

    onCleanup(() => {
      unlistenTasks.forEach((unlisten) => unlisten());
    });
  });

  return (
    <div class="flex flex-col h-screen w-full bg-[#272727] text-white">
      <div data-tauri-drag-region class="h-8 bg-[#1e1e1e] flex justify-between items-center select-none relative">
        <div class="w-34.5"></div>

        <div class="absolute inset-0 flex justify-center items-center text-[13px] font-semibold text-[#a0a0a0] pointer-events-none">
          Haven
        </div>

        <div class="flex h-full">
          <button
            id="min-btn"
            class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10"
            onClick={() => {
              if (appWindow) {
                void appWindow.minimize();
              }
            }}
          >
            <Minus size={14} stroke-width={2} aria-hidden="true" />
          </button>
          <button
            id="max-btn"
            class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-white/10"
            onClick={() => {
              if (appWindow) {
                void appWindow.toggleMaximize();
              }
            }}
          >
            {isExpanded() ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="1.5" y="3.5" width="7" height="7" stroke="currentColor" stroke-width="1.2" />
                <path d="M4 1.5H10.5V8" stroke="currentColor" stroke-width="1.2" />
              </svg>
            ) : (
              <Square size={12} stroke-width={2} aria-hidden="true" />
            )}
          </button>
          <button
            id="close-btn"
            class="w-11.5 h-full border-none bg-transparent text-[#b9bbbe] flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-[#e81123] hover:text-white"
            onClick={() => {
              if (appWindow) {
                void appWindow.close();
              }
            }}
          >
            <X size={14} stroke-width={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="flex-1"></div>
    </div>
  );
}
