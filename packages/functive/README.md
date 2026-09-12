**English** | [简体中文](./docs/README.zh-CN.md)

# functive

**Composable reactive state, independent of any UI framework.**

Build derived state from changing inputs and compose it into reusable units called **state closures**. Each closure exposes a current value, follows its dependencies, and manages the lifetime of its child computations.

`functive` powers [Fluxdown](../../README.md)'s core and can also be used independently for application state and data processing.

## Features

- **Framework-independent.** Use reactive state without React or a DOM environment.
- **Composable.** Declare computations with functions or classes, then connect them with `S` or JSX.
- **Lazy.** State flows initialize when their output is first accessed.
- **Efficient updates.** Use `memo` to skip equivalent inputs and suppress unchanged results.
- **Managed lifetimes.** Owned child closures and subscriptions are cleaned up when no longer needed, including when a root is destroyed.

## Quick start

### Install

```sh
npm install functive
```

### Create and observe derived state

```ts
import { MutableState, render, S } from "functive";

const Scale = ({ input, factor }: { input: number; factor: number }) => input * factor;

const input = MutableState.of(2);
const scaled = render(S([Scale, { input, factor: 3 }]));

const subscription = scaled.value.subscribe((value) => console.log(value)); // 6

input.next(4); // Logs 12
console.log(scaled.value.value); // 12

subscription.unsubscribe();
scaled.destroy();
input.destroy();
```

`S` describes a computation and its inputs; `render` creates a state closure from that description. A mapper such as `Scale` receives the current input values and runs again when they change.

The closure's `value` is a readable state: subscribe to it for updates, or read `value.value` for the current result. In this example, subscribing immediately logs the current result.

Destroy root closures when you are done with them. They release their owned children and subscriptions; external state sources such as `input` remain under your control and need their own cleanup.

## Choose a declaration

All three forms use the same `render(S([Scale, inputs]))` pattern:

| Form            | Use it for                                        | How it updates                                        |
| --------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Mapper function | Calculating a value from current inputs           | Runs again as inputs change                           |
| `once` function | Composing state flows and child closures          | Builds once; the resulting state flow handles updates |
| Class           | Computations with instance methods or local state | Builds once; the resulting state flow handles updates |

### Compose with `once`

Use `once` to connect reactive inputs and build a state flow. Here is the same `Scale` declared with `once`:

```ts
import { type IReadableClosure, once, useMap } from "functive";

const Scale = once(({ input, factor }: { input: IReadableClosure<number>; factor: number }) =>
  useMap(input, (value) => value * factor),
);
```

`once` runs on the first access to the closure's output. `useMap` derives a value from one input; `useCombineMap` combines several inputs, and `useCreate` builds a child closure. These helpers manage the resulting child closures for you.

### Use a class

Extend `BaseStateClosure` when a class fits your application better:

```ts
import { BaseStateClosure, type IReadableClosure } from "functive";

class Scale extends BaseStateClosure<number, { input: IReadableClosure<number>; factor: number }> {
  protected render() {
    const { input, factor } = this.inputs;

    return this.map(input, (value) => value * factor);
  }
}
```

Class methods such as `this.map`, `this.combineMap`, and `this.create` serve the same purpose as the corresponding `once` helpers. Use the `useMap`, `useCombineMap`, and `useCreate` hooks inside `once`; use instance methods inside classes.

### Pass reactive and static inputs

Mappers receive plain values. In `once` and class declarations, reactive inputs arrive as `IReadableClosure<T>`, while primitive constants such as `factor: 3` stay plain values.

Wrap static objects and ordinary callbacks in `D(value)` when passing them to `once` or a class. To provide a constant as a reactive input, use `ReactiveState.of(value)`.

## Optional JSX

JSX can describe the same computations as `S`. For TypeScript, set `jsx` to `"react-jsx"` and `jsxImportSource` to `"functive"` in your compiler options, then use a `.tsx` file:

```tsx
import { MutableState, render } from "functive";

const Scale = ({ input, factor }: { input: number; factor: number }) => input * factor;

const input = MutableState.of(2);
const scaled = render(<Scale input={input} factor={3} />);

console.log(scaled.value.value); // 6

scaled.destroy();
input.destroy();
```

This JSX describes reactive computations using `functive`'s own runtime. It does not require React.

## Contributing

Bug reports, documentation improvements, and pull requests are welcome. When [reporting a bug](https://github.com/hexmora/flowdown/issues), include a minimal reproduction with the input updates and expected result.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development commands and pull request guidelines.

## License

[MIT](../../LICENSE)
