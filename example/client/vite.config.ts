import Vite from 'vite';
import Entangle from '@entangled/vite';

export default <Vite.UserConfig> {
  plugins: [
    Entangle({
      include: /@example\/(\w+)/,
      baseUrl: "http://localhost:8080"
    })
  ]
}