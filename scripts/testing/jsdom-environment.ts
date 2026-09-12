import { TestEnvironment } from 'jest-environment-jsdom';

// These native web APIs are required by React SSR and theme tests but absent in jsdom.
const { structuredClone, TextDecoder, TextEncoder } = globalThis;

export default class FluxdownEnvironment extends TestEnvironment {
  override async setup(): Promise<void> {
    await super.setup();

    Object.assign(this.global, { structuredClone, TextDecoder, TextEncoder });
  }
}
