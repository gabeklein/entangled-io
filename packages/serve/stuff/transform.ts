import * as t from '@babel/types';
import { _arrowFunction, _call, _export, _id, _new, _objectExpression, _return, _template, _var, parse, transform } from './babel';

interface TransformOptions {
  moduleId: string;
  source: string;
}

export function transformModuleForHMR({ moduleId, source }: TransformOptions): string {
  const exportedFunctions = new Set<string>();

  return transform(source, {
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;

      if(!t.isFunctionDeclaration(declaration) || !declaration.id)
        return;

      const funcName = declaration.id.name;

      exportedFunctions.add(funcName);
        
      path.replaceWithMultiple([
        declaration,
        _var(
          'const',
          `__wrapped_${funcName}`,
          _new('Proxy', [
            _id(funcName),
            _objectExpression({
              apply: _arrowFunction(
                ['target', 'thisArg', 'args'],
                [
                  _var('const', 'latest',
                    t.logicalExpression('||',
                      _call('__hmrRegistry.get', [
                        _template('', _id('__moduleId'), `:${funcName}`)
                      ]),
                      t.stringLiteral('target')
                    )
                  ),
                  _return(_call('latest.apply', ['thisArg', 'args']))
                ]
              )
            })
          ])
        ),
        t.expressionStatement(
          _call('__hmrRegistry.set', [
            _template('', _id('__moduleId'), `:${funcName}`),
            _id(funcName)
          ])
        ),
        _export(`__wrapped_${funcName}`, funcName)
      ]);
    },
    Program: {
      exit(path) {
        if (exportedFunctions.size === 0)
          return;

        const getRegistry = parse(`
          const __hmrRegistry = globalThis.__hmrRegistry || (globalThis.__hmrRegistry = new Map());
          const __moduleId = ${JSON.stringify(moduleId)};
        `);

        const hmrCode = parse(`
          if (import.meta.hot) {
            console.log('HMR enabled for ${moduleId}');
            import.meta.hot.accept(function(mod) {
              // Force module execution by accessing the exports
              console.log('HMR update received, new exports:', Object.keys(mod));
              ${Array.from(exportedFunctions).map(funcName => `
                __hmrRegistry.set(\`\${__moduleId}:${funcName}\`, mod.${funcName});
              `).join('\n')}
            });
          }
          else
            console.log('HMR not enabled for ${moduleId}');
        `);
          
        path.node.body.unshift(...getRegistry);
        path.node.body.push(...hmrCode);
      }
    }
  });
}