const fs = require('node:fs');
const path = require('node:path');
const bytenode = require('bytenode');
const v8 = require('node:v8');

v8.setFlagsFromString('--no-lazy');

const mainDir = path.resolve(__dirname, '../dist-electron');

if (fs.existsSync(mainDir)) {
  const files = fs.readdirSync(mainDir);
  
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(mainDir, file);
      const outputJsc = filePath.replace(/\.js$/, '.jsc');
      
      console.log(`Compiling ${file} to bytecode...`);
      bytenode.compileFile({
        filename: filePath,
        output: outputJsc,
        compileAsModule: true
      });
      
      // Replace the JS file content to just require the bytecode
      // Need a loader format since Vite/Electron runs this. 
      // Ensure 'bytenode' is required.
      const loaderCode = `require('bytenode');\nrequire('./${file.replace(/\.js$/, '.jsc')}');\n`;
      fs.writeFileSync(filePath, loaderCode);
    }
  });

  console.log('Bytecode compilation complete.');
} else {
  console.log('Main build directory not found. Please run the build script first.');
}
