import path from 'path';

import { getSchemaFromSource } from './scanner';
import { Recursive, ReplacedModule } from './types';

export function generateServiceAgent(target: ReplacedModule, agent: string){
  const { sourceFile, location, name } = target;
  const { output, endpoint } = getSchemaFromSource(sourceFile!, name);
  
  const filename = path.join(location!, "service_agent.js");
  const content = generateServiceAgentContent(agent, endpoint, output);

  return {
    filename,
    content
  }
}

function generateServiceAgentContent(
  agent: string,
  endpoint: string,
  schema: Recursive){

  const data = JSON.stringify(schema);

  if(/^[/A-Z]+$/.test(endpoint))
    endpoint = `process.env.${endpoint}`;

  return `module.exports = require("${agent}")(${data}, ${endpoint})`
}