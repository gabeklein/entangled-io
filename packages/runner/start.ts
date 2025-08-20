import { join, resolve } from 'path';
import { build, createServer, defineConfig, Plugin } from 'vite';

const MODE: "dev" | "build" = 'dev';

function hmrPlugin(): Plugin {
  return {
    name: 'hmr-plugin',
    handleHotUpdate({ file, server }) {
      console.log(`HMR: Reloading ${file}`);
      const runnerModule = server.moduleGraph.getModuleById(join(process.cwd(), 'runner.ts'));

      if (runnerModule)
        server.moduleGraph.invalidateModule(runnerModule);
    },
  };
}

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

const viteConfig = defineConfig({
  environments: {
    ssr: {
      resolve: {
        conditions: ['node'],
      },
    },
  },
  appType: 'custom',
  plugins: [hmrPlugin(), customTransformPlugin()],
  build: {
    ssr: 'runner.ts', // Entry for build mode
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      output: {
        format: 'cjs', // CommonJS for Node.js
      },
    },
  },
  server: {
    middlewareMode: true,
  },
});

async function dev(){
  const server = await createServer({
    ...viteConfig,
    server: { hmr: true },
  });

  const load = () => server.ssrLoadModule(resolve('./runner.ts'));

  load();

  console.log('Runner loaded in dev mode');

  server.watcher.on('change', async (path) => {
    if (path.startsWith('./server/')) {
      console.log(`HMR: Reloading ${path}`);
      try {
        // Clear module cache
        server.moduleGraph.invalidateAll();
        // Reload the server module
        await load();
        // Restart the server
        // server.close(() => {
        //   app.listen(port, () => {
        //     console.log(`Server restarted at http://localhost:${port}`);
        //   });
        // });
      } catch (err) {
        console.error('HMR error:', err);
      }
    }
  });

  process.on('SIGINT', async () => {
    await server.close();
    process.exit();
  });
}

async function start() {
  switch (MODE) {
    case 'dev':
      await dev();
    break;

    case 'build':
      await build(viteConfig);
    break;

    default:
      throw new Error('Invalid MODE. Use "dev" or "build".');
  }
}

start().catch(console.error);