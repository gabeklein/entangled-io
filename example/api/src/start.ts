import { serve } from '@entangled/express/src';
import * as MODULE_EXPORTS from '.';

serve(MODULE_EXPORTS, {
  port: 8080,
  onReady(port){
    console.log("Server started on port", port);
  }
});