import { createServer, Plugin, UserConfig } from 'vite';
import express from 'express';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Custom plugin to transform server code
function customTransformPlugin(): Plugin {
  return {
    name: 'custom-transform',
    transform(code, id, options) {
      if (this.environment.name === 'server' && id.endsWith('.js')) {
        return {
          code: `console.log('Module ${id} loaded');\n${code}`,
          map: null,
        };
      }
      return null;
    },
  };
}

// Vite configuration
const viteConfig: UserConfig = {
  environments: {
    server: {
      resolve: {
        conditions: ['node'], // Node.js-specific module resolution
      },
      dev: {
        // createEnvironment: (name, config) => {
        //   return {
        //     name,
        //     config,
        //     async transformRequest(url) {
        //       return await config.server.transformRequest(url, { ssr: true });
        //     },
        //   };
        // },
      },
      build: {
        outDir: 'dist/server',
        ssr: true,
        rollupOptions: {
          input: '/server/index.js',
          output: {
            format: 'esm',
          },
        },
      },
    },
  },
  plugins: [
    nodePolyfills(),
    customTransformPlugin()
  ],
  appType: 'custom',
  server: {
    middlewareMode: true,
  },
};

// Start the dev server
async function startDevServer() {
  const app = express();

  // Create Vite dev server with inline config
  const vite = await createServer(viteConfig);

  // Use Vite's middlewares for HMR and module transformation
  app.use(vite.middlewares);

  // Dynamically import and reload the server code
  let serverModule = await vite.ssrLoadModule('/server/index.js');

  // Start the Express server
  const port = 3000;
  const server = app.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });

  // HMR handling
  vite.watcher.on('change', async (path) => {
    if (path.startsWith('./server/')) {
      console.log(`HMR: Reloading ${path}`);
      try {
        // Clear module cache
        vite.moduleGraph.invalidateAll();
        // Reload the server module
        serverModule = await vite.ssrLoadModule('/server/index.js');
        // Restart the server
        server.close(() => {
          app.listen(port, () => {
            console.log(`Server restarted at http://localhost:${port}`);
          });
        });
      } catch (err) {
        console.error('HMR error:', err);
      }
    }
  });
}

startDevServer().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});