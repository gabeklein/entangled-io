import path from 'path';

import { getSchemaFromSource } from './scanner';
import { ReplacedModule } from './types';

export function generateServiceAgent(target: ReplacedModule, agent: string){
  const { sourceFile, location, name } = target;
  let { output, endpoint } = getSchemaFromSource(sourceFile!, name);
  
  const filename = path.join(location!, "service_agent.js");
  const data = JSON.stringify(output);

  if(/^[/A-Z]+$/.test(endpoint))
    endpoint = `process.env.${endpoint}`;

  const content =
    `module.exports = require("${agent}")(${data}, ${endpoint})`;

  return {
    filename,
    content
  }
}