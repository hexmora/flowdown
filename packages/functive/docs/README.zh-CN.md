[English](../README.md) | **简体中文**

# functive

**可组合的响应式状态，独立于任何 UI 框架。**

从不断变化的输入派生状态，并将它们组合成可复用的**状态闭包（state closures）**。每个闭包提供当前值，跟随依赖变化，并管理子计算的生命周期。

`functive` 为 [Fluxdown](../../../docs/README.zh-CN.md) 的核心提供支持，也可以独立用于应用状态管理和数据处理。

## 特点

- **框架无关。** 无需 React 或 DOM 环境即可使用响应式状态。
- **可组合。** 用函数或类声明计算，再通过 `S` 或 JSX 将它们连接起来。
- **惰性初始化。** 状态流在首次读取输出时才初始化。
- **高效更新。** 使用 `memo` 跳过等价输入的计算，并避免重复通知未变化的结果。
- **生命周期管理。** 不再需要时，自动清理所管理的子闭包和订阅，销毁根闭包时也会一并清理。

## 快速上手

### 安装

```sh
npm install functive
```

### 创建并订阅派生状态

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

`S` 描述计算及其输入，`render` 根据描述创建状态闭包。像 `Scale` 这样的映射函数接收输入的当前值，并在输入变化时重新运行。

闭包的 `value` 是一个可读状态：可以订阅它来接收更新，也可以通过 `value.value` 读取当前结果。在这个示例中，订阅后会立即打印当前结果。

使用完毕后，请销毁根闭包。它会释放自己管理的子闭包和订阅；`input` 这样的外部状态源仍由你管理，需要单独清理。

## 选择声明方式

以下三种方式都使用相同的 `render(S([Scale, inputs]))` 调用方式：

| 形式        | 适用场景                     | 更新方式                           |
| ----------- | ---------------------------- | ---------------------------------- |
| 映射函数    | 根据当前输入计算结果         | 输入变化时重新运行                 |
| `once` 函数 | 组合状态流和子闭包           | 只构建一次，由返回的状态流处理更新 |
| 类          | 需要实例方法或局部状态的计算 | 只构建一次，由返回的状态流处理更新 |

### 使用 `once` 组合状态

使用 `once` 连接响应式输入并构建状态流。下面用 `once` 声明同样的 `Scale`：

```ts
import { type IReadableClosure, once, useMap } from "functive";

const Scale = once(({ input, factor }: { input: IReadableClosure<number>; factor: number }) =>
  useMap(input, (value) => value * factor),
);
```

`once` 在首次读取闭包输出时运行。`useMap` 从单个输入派生值，`useCombineMap` 组合多个输入，`useCreate` 创建子闭包。这些辅助函数会为你管理产生的子闭包。

### 使用类

如果类更适合你的应用，可以继承 `BaseStateClosure`：

```ts
import { BaseStateClosure, type IReadableClosure } from "functive";

class Scale extends BaseStateClosure<number, { input: IReadableClosure<number>; factor: number }> {
  protected render() {
    const { input, factor } = this.inputs;

    return this.map(input, (value) => value * factor);
  }
}
```

`this.map`、`this.combineMap` 和 `this.create` 等实例方法，与对应的 `once` 辅助函数用途相同。在 `once` 中使用 `useMap`、`useCombineMap` 和 `useCreate` 钩子，在类中使用实例方法。

### 传入响应式与静态输入

映射函数接收普通值。在 `once` 和类声明中，响应式输入以 `IReadableClosure<T>` 的形式传入，而 `factor: 3` 这样的基本类型常量仍是普通值。

向 `once` 或类传入静态对象和普通回调函数时，请用 `D(value)` 包装。要将常量作为响应式输入传入，可以使用 `ReactiveState.of(value)`。

## 可选的 JSX 写法

JSX 可以描述与 `S` 相同的计算。使用 TypeScript 时，在编译选项中将 `jsx` 设为 `"react-jsx"`，将 `jsxImportSource` 设为 `"functive"`，然后使用 `.tsx` 文件：

```tsx
import { MutableState, render } from "functive";

const Scale = ({ input, factor }: { input: number; factor: number }) => input * factor;

const input = MutableState.of(2);
const scaled = render(<Scale input={input} factor={3} />);

console.log(scaled.value.value); // 6

scaled.destroy();
input.destroy();
```

这里的 JSX 使用 `functive` 自身的运行时来描述响应式计算，无需 React。

## 参与贡献

欢迎报告问题、改进文档或提交 Pull Request。[报告问题](https://github.com/hexmora/flowdown/issues)时，请提供最小复现示例，包括输入的更新过程和预期结果。

开发命令和 Pull Request 指南见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)。

## 许可证

[MIT](../../../LICENSE)
