import { packageConfig } from '../../rslib.shared';

export default packageConfig({
  entry: {
    index: './src/index.ts',
    'jsx-runtime': './src/jsx-runtime.ts',
  },
  jsxImportSource: 'functive',
});
