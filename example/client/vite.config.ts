import apiPlugin from '@entangled/vite';
import jsxPlugin from '@expressive/vite-plugin';
import vite from 'vite';

export default <vite.UserConfig> {
  plugins: [
    jsxPlugin(),
    apiPlugin({
      include: /@example\/(\w+)/,
      baseUrl: "http://localhost:8080"
    })
  ]
}