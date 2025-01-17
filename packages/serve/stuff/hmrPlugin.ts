// hmr-transform.ts
import { Plugin } from 'vite'
import { transform } from '@babel/core'
import * as t from '@babel/types'
import { resolve } from 'path'

const HMR_REGISTRY = resolve(__dirname, './hmr')
const spec = (name: string) => t.importSpecifier(t.identifier(name), t.identifier(name))

export function hmrTransformPlugin(): Plugin {
  return {
    name: 'hmr-transform',
    transform(code, id) {
      // Skip virtual modules and non-TS/JS files
      if (id.startsWith('\0') || !id.match(/\.[jt]sx?$/))
        return null;

      // Transform the AST
      const result = transform(code, {
        ast: true,
        plugins: [{
          visitor: {
            ExportNamedDeclaration(path) {
              const { declaration } = path.node

              // Only transform function declarations for now
              if (!t.isFunctionDeclaration(declaration))
                return;

              const funcName = declaration.id!.name
                
              // Create registry for this module
              path.insertBefore(
                t.importDeclaration(
                  [spec('createRegistry'), spec('createProxy')],
                  t.stringLiteral(HMR_REGISTRY)
                )
              )

              // Replace export with proxied version
              path.replaceWithMultiple([
                declaration,
                t.exportNamedDeclaration(
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                      t.identifier(funcName),
                      t.callExpression(
                        t.identifier('createProxy'),
                        [
                          t.stringLiteral(id),
                          t.stringLiteral(funcName),
                          t.identifier(funcName)
                        ]
                      )
                    )
                  ])
                )
              ])
            }
          }
        }]
      })

      return {
        code: result!.code!,
        map: result!.map
      }
    }
  }
}