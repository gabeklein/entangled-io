import { serve } from '@entangled/express';
import * as MODULE_EXPORTS from '.';

serve(MODULE_EXPORTS);

console.log("Server started.");