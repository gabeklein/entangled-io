import express from 'express';
import { router } from './router';

function serve(module: {}, baseUrl = "/api", port = 8080){
  const app = express();
  const api = router(module);

  app.use(baseUrl, api);

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  }) 
}

export { useContext } from './async_hook';

export {
  router as service,
  router,
  serve
};

export default serve;