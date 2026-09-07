# @flowdown/core-presets

Headless preset mapper, remark, rehype, and repair plugins for Flowdown.

Import each plugin type through its own entry point:

```ts
import { PRESET_MAPPER_PLUGINS } from "@flowdown/core-presets/mapper";
import { PRESET_REHYPE_PLUGINS } from "@flowdown/core-presets/rehype";
import { PRESET_REMARK_PLUGINS } from "@flowdown/core-presets/remark";
import { PRESET_REPAIR_PLUGINS } from "@flowdown/core-presets/repair";
```

The package has no root export. Each entry point exports its plugins, configuration types, and shared base classes. The mapper entry point also exports the smooth ticker and scheduler modules.
