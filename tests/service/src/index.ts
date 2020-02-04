import { listen, serve } from '@entangled/express';
import * as bonjour from '@entangled/test-bonjour';

import * as greetings from './hello-world';

const api = serve({ greetings, bonjour });

listen(api, 8080);

export = api;