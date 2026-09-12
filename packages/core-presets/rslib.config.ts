import { packageConfig } from '../../rslib.shared';

export default packageConfig({
  entry: {
    mapper: './src/mapper/index.ts',
    rehype: './src/rehype/index.ts',
    remark: './src/remark/index.ts',
    repair: './src/repair/index.ts',
  },
  jsxImportSource: 'functive',
});
