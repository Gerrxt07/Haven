const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

exports.default = async function(context) {
  const ext = {
    darwin: '.app',
    win32: '.exe',
    linux: ['']
  }[context.electronPlatformName];

  const electronExecutableFileName =
    context.electronPlatformName === 'darwin'
      ? 'Haven.app/Contents/MacOS/Haven'
      : `Haven${ext}`;
      
  const electronExecutablePath = path.join(
    context.appOutDir,
    electronExecutableFileName
  );

  console.log('Flipping Fuses for:', electronExecutablePath);

  await flipFuses(electronExecutablePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true
  });
};
