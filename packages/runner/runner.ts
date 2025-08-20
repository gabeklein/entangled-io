// Stubbed serve function for POC
function serve(moduleExports: any, options: { port: number; onReady: (port: number) => void }) {
  console.log('Module Exports:', moduleExports);
  options.onReady(options.port);
}

import * as MODULE_EXPORTS from './src';

serve(MODULE_EXPORTS, {
  port: 8080,
  onReady(port) {
    console.log('Server started on port', port);
  },
});