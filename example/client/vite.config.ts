import Vite from 'vite';
import ClientPlugin from '@entangled/vite/src';

export default <Vite.UserConfig> {

  plugins: [
    ClientPlugin()
  ]
}