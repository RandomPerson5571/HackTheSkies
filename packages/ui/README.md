# @repo/ui

Optional shared browser React components. The main Expo application uses React Native components in `apps/mobile`. Browser React consumers can import these directly:

```tsx
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Code } from "@repo/ui/code";
```

Add components in `src/`. Consumers transpile the TypeScript source directly;
Configure source transpilation in the consuming browser bundler.

These components use browser elements. Build native mobile screens with React
Native components in `apps/mobile`.
