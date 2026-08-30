# @flowdown/reactive

`@flowdown/reactive` provides headless reactive primitives for Flowdown streaming state.

It is framework-free and intended to sit below rendering packages such as `flowdown`. Keep React, DOM, Storybook, and UI-only dependencies out of this package.

## JSX descriptors

The package includes an automatic JSX runtime that turns state closure tags into descriptor tuples. It does not instantiate closures, render UI, or use a reconciler.

Enable it for descriptor-only TypeScript projects:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@flowdown/reactive",
    "moduleResolution": "Bundler"
  }
}
```

State closures can return JSX descriptors directly from `render()`:

```tsx
/** @jsxImportSource @flowdown/reactive */

import {
  BaseStateClosure,
  buildDescriptor,
  type IReactiveState,
  MutableState,
  S,
} from "@flowdown/reactive";

const source = MutableState.of("hello");

class TextStateClosure extends BaseStateClosure<string, { source: IReactiveState<string> }> {
  protected render() {
    return this.inputs.source;
  }
}

class DocumentStateClosure extends BaseStateClosure<string, { source: IReactiveState<string> }> {
  protected render() {
    return <TextStateClosure source={this.inputs.source} />;
  }
}

const descriptor = S<string>(<TextStateClosure source={source} />);

const textClosure = buildDescriptor(descriptor);

const sameTextClosure = buildDescriptor<string>(<TextStateClosure source={source} />);
```

JSX tags must be state closure classes callable with no arguments, or with an object first argument and only optional trailing arguments. Input properties are checked as recursive descriptor props; tuple descriptors and immediate values continue to use `S([...])` and `D(...)`.

TypeScript assigns every JSX expression the shared `JSX.Element` type. Tag props remain strict, but the root and nested output value types are erased. The generic in `S<T>(element)` and `buildDescriptor<T>(element)` is therefore a trusted annotation, not a runtime check.

Fragments are unsupported and throw at runtime. Use an array literal for array-valued props. JSX always supplies a props object, so `<Closure />` passes `{}` instead of invoking a default for the complete input object. The runtime declarations use TypeScript's `Bundler` module resolution.

## License

MIT
