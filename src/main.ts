// Renderer entry point
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Hello Electron 42.0.0-alpha.6!</h1>
    <p>Powered by Vite + Bun + TypeScript.</p>
    <p>We are using Node.js <span id="node-version"></span>,
       Chromium <span id="chrome-version"></span>,
       and Electron <span id="electron-version"></span>.</p>
  </div>
`;
