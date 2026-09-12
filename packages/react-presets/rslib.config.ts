import { packageConfig } from '../../rslib.shared';

export default packageConfig({
  entry: {
    base: './src/base/index.ts',
    render: './src/render/index.ts',
    slot: './src/slot/index.ts',
  },
  react: true,
});
