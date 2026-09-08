# @flowdown/react-presets

Preset render and slot plugins with shared React rendering infrastructure for Flowdown.

```ts
import { BaseReactRenderPlugin, BaseSlotPlugin, SlotsContext } from "@flowdown/react-presets/base";
import { PRESET_RENDER_PLUGINS } from "@flowdown/react-presets/render";
import { PRESET_SLOT_PLUGINS } from "@flowdown/react-presets/slot";
```

`/base` exports the shared render and slot types, classes, contexts, components, and hooks. `/render` and `/slot` export the plugins and their preset lists. There is no root export.
