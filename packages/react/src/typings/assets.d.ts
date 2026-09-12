declare module '*.module.scss' {
  const classes: Record<string, string>;

  export default classes;
}

declare module '*.module.less' {
  const classes: Record<string, string>;

  export default classes;
}

declare module '*.css';

declare module '*.svg?react' {
  import type { FunctionComponent, SVGProps } from 'react';

  const Component: FunctionComponent<SVGProps<SVGSVGElement>>;

  export default Component;
}
