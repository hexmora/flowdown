declare module '*.scss';

declare module '*.png?no-inline' {
  const url: string;

  export default url;
}
