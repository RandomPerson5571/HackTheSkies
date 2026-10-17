# @repo/ui

Shared React components for the Next.js web app. Import components directly:

```tsx
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Code } from "@repo/ui/code";
```

Add components in `src/`. Consumers transpile the TypeScript source directly;
Next.js enables this through `transpilePackages`.

These components use browser elements. Build native mobile screens with React
Native components in `apps/mobile`.
