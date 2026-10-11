# Third-Party Notices

Tempo Flow ships under the Business Source License 1.1 (see `LICENSE`).
The distributed application bundles the third-party packages listed below.
Each entry names the package, the version in `bun.lock` at the time of writing,
its SPDX license identifier, and where the full license text lives.

MIT and ISC licenses require this copyright notice to travel with the software.
Apache-2.0 additionally requires the license text and a statement of changes —
we vendor these packages unmodified unless a `Modifications` note says otherwise.

Full license texts ship inside each package's directory in the installed
`node_modules` tree (`LICENSE`/`LICENSE.md`) and at the linked upstream source.

Maintenance rule: `bun run check:notices` fails CI when a runtime dependency
appears in any workspace `package.json` without a matching `### <package>`
section here. Add the entry in the same PR that adds the dependency.

---

### @ai-sdk/provider-utils

- Version: 3.0.14
- License: Apache-2.0
- Source: https://github.com/vercel/ai
- Used by: package.json

### @auth/core

- Version: 0.37.4
- License: ISC
- Source: https://github.com/nextauthjs/next-auth
- Used by: package.json (convex/auth.ts Resend magic-link provider)

### @convex-dev/agent

- Version: 0.3.2
- License: Apache-2.0
- Source: https://github.com/get-convex/agent
- Used by: package.json

### @convex-dev/auth

- Version: 0.0.91
- License: Apache-2.0
- Source: https://labs.convex.dev/auth
- Used by: package.json, apps/web/package.json, apps/mobile/package.json

### @expo/cli

- Version: 54.0.23
- License: MIT
- Source: https://github.com/expo/expo/tree/main/packages/@expo/cli
- Used by: apps/mobile/package.json

### @expo/metro-runtime

- Version: 6.1.2
- License: MIT
- Source: https://github.com/expo/expo/tree/main/packages/@expo/metro-runtime
- Used by: apps/mobile/package.json

### @expo/vector-icons

- Version: 15.1.1
- License: MIT
- Source: https://expo.github.io/vector-icons
- Used by: apps/mobile/package.json

### @polar-sh/nextjs

- Version: 0.9.4
- License: Apache-2.0
- Source: https://www.npmjs.com/package/@polar-sh/nextjs
- Note: No `license` field in package.json; the published package ships an Apache-2.0 LICENSE file.
- Used by: apps/web/package.json

### @radix-ui/react-accordion

- Version: 1.2.12
- License: MIT
- Source: https://radix-ui.com/primitives
- Used by: apps/web/package.json

### @radix-ui/react-dialog

- Version: 1.1.15
- License: MIT
- Source: https://radix-ui.com/primitives
- Used by: apps/web/package.json

### @radix-ui/react-icons

- Version: 1.3.2
- License: MIT
- Source: https://www.npmjs.com/package/@radix-ui/react-icons
- Used by: apps/web/package.json

### @radix-ui/react-label

- Version: 2.1.8
- License: MIT
- Source: https://radix-ui.com/primitives
- Used by: apps/web/package.json

### @radix-ui/react-slot

- Version: 1.2.4
- License: MIT
- Source: https://radix-ui.com/primitives
- Used by: apps/web/package.json

### @react-native-async-storage/async-storage

- Version: 2.2.0
- License: MIT
- Source: https://github.com/react-native-async-storage/async-storage#readme
- Used by: apps/mobile/package.json

### @react-navigation/native

- Version: 7.1.33
- License: MIT
- Source: https://reactnavigation.org
- Used by: apps/mobile/package.json

### @rn-primitives/slot

- Version: 1.2.0
- License: MIT
- Source: https://www.npmjs.com/package/@rn-primitives/slot
- Used by: apps/mobile/package.json

### @rn-primitives/types

- Version: 1.2.0
- License: MIT
- Source: https://www.npmjs.com/package/@rn-primitives/types
- Used by: apps/mobile/package.json

### ai

- Version: 5.0.82
- License: Apache-2.0
- Source: https://github.com/vercel/ai
- Used by: package.json

### class-variance-authority

- Version: 0.7.1
- License: Apache-2.0
- Source: https://github.com/joe-bell/cva#readme
- Used by: apps/web/package.json, apps/mobile/package.json

### clsx

- Version: 2.1.1
- License: MIT
- Source: https://github.com/lukeed/clsx
- Used by: apps/web/package.json, apps/mobile/package.json

### compression

- Version: 1.8.1
- License: MIT
- Source: https://github.com/expressjs/compression
- Used by: apps/mobile/package.json

### convex

- Version: 1.32.0
- License: Apache-2.0
- Source: https://convex.dev
- Used by: package.json, apps/web/package.json, apps/mobile/package.json

### convex-test

- Version: 0.0.38
- License: Apache-2.0
- Source: https://github.com/get-convex/convex-test
- Used by: package.json

### convex-helpers

- Version: 0.1.104
- License: Apache-2.0
- Source: https://github.com/get-convex/convex-helpers
- Used by: package.json

### expo

- Version: 54.0.33
- License: MIT
- Source: https://github.com/expo/expo/tree/main/packages/expo
- Used by: apps/mobile/package.json

### expo-constants

- Version: 18.0.13
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/constants/
- Used by: apps/mobile/package.json

### expo-font

- Version: 14.0.11
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/font/
- Used by: apps/mobile/package.json

### expo-linear-gradient

- Version: 15.0.8
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/linear-gradient/
- Used by: apps/mobile/package.json

### expo-linking

- Version: 8.0.11
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/linking
- Used by: apps/mobile/package.json

### expo-localization

- Version: 17.0.8
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/localization/
- Used by: apps/mobile/package.json

### expo-router

- Version: 6.0.23
- License: MIT
- Source: https://docs.expo.dev/routing/introduction/
- Used by: apps/mobile/package.json

### expo-secure-store

- Version: 15.0.8
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/securestore/
- Used by: apps/mobile/package.json

### expo-splash-screen

- Version: 31.0.13
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/splash-screen/
- Used by: apps/mobile/package.json

### expo-status-bar

- Version: 3.0.9
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/status-bar/
- Used by: apps/mobile/package.json

### expo-updates

- Version: 29.0.16
- License: MIT
- Source: https://docs.expo.dev/versions/latest/sdk/updates/
- Used by: apps/mobile/package.json

### lucide-react

- Version: 0.546.0
- License: ISC
- Source: https://lucide.dev
- Used by: apps/web/package.json

### lucide-react-native

- Version: 0.546.0
- License: ISC
- Source: https://lucide.dev
- Used by: apps/mobile/package.json

### nativewind

- Version: 4.2.2
- License: MIT
- Source: https://nativewind.dev
- Used by: apps/mobile/package.json

### next

- Version: 16.2.4
- License: MIT
- Source: https://nextjs.org
- Used by: apps/web/package.json

### react

- Version: 19.1.0
- License: MIT
- Source: https://react.dev/
- Used by: apps/web/package.json, apps/mobile/package.json

### react-dom

- Version: 19.1.0
- License: MIT
- Source: https://react.dev/
- Used by: apps/web/package.json, apps/mobile/package.json

### react-native

- Version: 0.81.5
- License: MIT
- Source: https://reactnative.dev/
- Used by: apps/mobile/package.json

### react-native-purchases

- Version: 9.11.2
- License: MIT
- Source: https://github.com/revenuecat/react-native-purchases.git
- Used by: apps/mobile/package.json

### react-native-reanimated

- Version: 4.1.6
- License: MIT
- Source: https://docs.swmansion.com/react-native-reanimated
- Used by: apps/mobile/package.json

### react-native-safe-area-context

- Version: 5.6.2
- License: MIT
- Source: https://github.com/AppAndFlow/react-native-safe-area-context#readme
- Used by: apps/mobile/package.json

### react-native-screens

- Version: 4.16.0
- License: MIT
- Source: https://github.com/software-mansion/react-native-screens#readme
- Used by: apps/mobile/package.json

### react-native-svg

- Version: 15.12.1
- License: MIT
- Source: https://github.com/react-native-community/react-native-svg
- Used by: apps/mobile/package.json

### react-native-web

- Version: 0.21.2
- License: MIT
- Source: https://github.com/necolas/react-native-web.git
- Used by: apps/mobile/package.json

### react-native-webview

- Version: 13.15.0
- License: MIT
- Source: https://github.com/react-native-webview/react-native-webview#readme
- Used by: apps/mobile/package.json

### react-native-worklets

- Version: 0.5.1
- License: MIT
- Source: https://docs.swmansion.com/react-native-worklets
- Used by: apps/mobile/package.json

### styled-jsx

- Version: 5.1.7
- License: MIT
- Source: https://github.com/vercel/styled-jsx
- Used by: apps/web/package.json

### tailwind-merge

- Version: 3.5.0
- License: MIT
- Source: https://github.com/dcastil/tailwind-merge
- Used by: apps/web/package.json, apps/mobile/package.json

### zod

- Version: 4.3.6
- License: MIT
- Source: https://github.com/colinhacks/zod
- Used by: package.json, packages/utils/package.json
