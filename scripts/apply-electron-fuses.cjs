const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('node:path');

const fs = require('fs');

exports.default = async function(context) {
  const appOutDir = context.appOutDir;

  const productName =
    (context.packager.appInfo && (context.packager.appInfo.productFilename || context.packager.appInfo.productName)) ||
    "Haven";

  const candidates = [];
  
  if (context.electronPlatformName === 'darwin') {
    candidates.push(path.join(appOutDir, `${productName}.app/Contents/MacOS/${productName}`));
    candidates.push(path.join(appOutDir, 'Haven.app/Contents/MacOS/Haven'));
  } else if (context.electronPlatformName === 'win32') {
    candidates.push(path.join(appOutDir, `${productName}.exe`));
    candidates.push(path.join(appOutDir, 'Haven.exe'));
  } else {
    candidates.push(path.join(appOutDir, productName));
    candidates.push(path.join(appOutDir, productName.toLowerCase()));
    candidates.push(path.join(appOutDir, 'Haven'));
    candidates.push(path.join(appOutDir, 'haven'));
  }

  const electronExecutablePath = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());

  if (!electronExecutablePath) {
    console.log("afterPack appOutDir:", appOutDir);
    console.log("dir listing:", fs.readdirSync(appOutDir));
    throw new Error(
      `Could not find Electron executable to fuse. Looked in: ${candidates.join(", ")} (appOutDir=${appOutDir})`
    );
  }

  console.log('Flipping Fuses for:', electronExecutablePath);

  await flipFuses(electronExecutablePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false
  });
};
