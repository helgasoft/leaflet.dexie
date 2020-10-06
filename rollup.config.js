import buble from '@rollup/plugin-buble';
import { terser } from "rollup-plugin-terser";

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/leaflet.dexie.min.js',
    format: 'umd',
    name: 'LeafletDexie',
    globals: {
      leaflet: 'L',
      dexie: 'dexie',
    },
    plugins: [terser()]
  },
  plugins: [
    buble({
      objectAssign: true,
      transforms: {
        asyncAwait: false,
      },
    }),
  ],
  external: ['leaflet', 'dexie'],
};