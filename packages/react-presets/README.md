# @fluxdown/react-presets

Preset render and slot plugins with shared React rendering infrastructure for Fluxdown.

```ts
import { BaseReactRenderPlugin, BaseSlotPlugin, SlotsContext } from "@fluxdown/react-presets/base";
import { PRESET_RENDER_PLUGINS } from "@fluxdown/react-presets/render";
import { PRESET_SLOT_PLUGINS } from "@fluxdown/react-presets/slot";
```

`/base` exports the shared render and slot types, classes, contexts, components, and hooks. `/render` and `/slot` export the plugins and their preset lists. There is no root export.
