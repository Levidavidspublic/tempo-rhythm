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

### @codemirror/commands

- Version: 6.11.1
- License: MIT
- Source: https://github.com/codemirror/commands
- Used by: apps/web/package.json
- Notes: Undo history and the default key bindings for the v3 page editor.

### @codemirror/lang-markdown

- Version: 6.5.2
- License: MIT
- Source: https://github.com/codemirror/lang-markdown
- Used by: apps/web/package.json
- Notes: Markdown (CommonMark + GFM) parsing for the live preview. Pulls in @codemirror/lang-html, @codemirror/autocomplete and their language packages transitively, all MIT.

### @codemirror/language

- Version: 6.12.4
- License: MIT
- Source: https://github.com/codemirror/language
- Used by: apps/web/package.json
- Notes: Syntax tree access and highlighting for the live preview.

### @codemirror/state

- Version: 6.7.6
- License: MIT
- Source: https://github.com/codemirror/state
- Used by: apps/web/package.json
- Notes: Editor state. The document is the exact notes.body text (line separator pinned to \n, so saves are byte-exact).

### @codemirror/view

- Version: 6.43.13
- License: MIT
- Source: https://github.com/codemirror/view
- Used by: apps/web/package.json
- Notes: Editor view and the Obsidian-style live preview decorations.

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

### @json-render/core

- Version: 0.21.0
- License: Apache-2.0
- Source: https://github.com/vercel-labs/json-render
- Used by: packages/ui/package.json

### @json-render/react

- Version: 0.21.0
- License: Apache-2.0
- Source: https://github.com/vercel-labs/json-render
- Used by: packages/ui/package.json

### @openuidev/react-lang

- Version: 1.0.1
- License: MIT
- Source: https://github.com/thesysdev/openui
- Used by: apps/web/package.json
- Note: brings @openuidev/lang-core, @openuidev/observability and @openuidev/devtools (all MIT, same repository). Runtime usage reports are opt-in and off; lang-core's install report is a postinstall script, which Bun does not run for dependencies.

### @lezer/highlight

- Version: 1.2.5
- License: MIT
- Source: https://github.com/lezer-parser/highlight
- Used by: apps/web/package.json
- Notes: Highlight tags for the Markdown syntax tree.

### @lezer/markdown

- Version: 1.7.2
- License: MIT
- Source: https://github.com/lezer-parser/markdown
- Used by: apps/web/package.json
- Notes: Markdown grammar with the GFM extensions (tables, task lists, strikethrough).

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

### mammoth

- Version: 1.13.0
- License: BSD-2-Clause
- Source: https://github.com/mwilliamson/mammoth.js
- Used by: apps/web/package.json
- Notes: IngestSheet reads the raw text of Word .docx files with `extractRawText` (its browser build, through the package's `browser` field), loaded with `import()` only when a .docx is picked. Owner-approved 2026-10-18. Transitive: jszip (dual MIT OR GPL-3.0-or-later; used under MIT), pako (MIT AND Zlib), @xmldom/xmldom, underscore, xmlbuilder, base64-js, lie, immediate, setimmediate, readable-stream (MIT), lop, option, dingbat-to-unicode (BSD-2-Clause); argparse and sprintf-js only serve its command-line tool.

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

### panelui-web (copied source, not a dependency)

- Version: 0.2.0 (shadcn registry items kpi and day-grid, https://panelui.dev/r/web/)
- License: MIT, (c) Khalid Abdi
- Source: https://github.com/panel-ui/PanelUI
- Used by: apps/web/components/panelui/kpi.tsx, apps/web/components/panelui/day-grid.tsx (each file keeps the attribution header)

### pdfjs-dist

- Version: 6.4.299
- License: Apache-2.0
- Source: https://github.com/mozilla/pdf.js
- Used by: apps/web/package.json
- Notes: IngestSheet reads a PDF's text layer with the legacy build (`pdfjs-dist/legacy/build/pdf.mjs` and its worker, served from this app's own build), loaded with `import()` only when a PDF is picked. Unmodified. Owner-approved 2026-10-18. No runtime dependencies (its optional @napi-rs/canvas is for Node only).

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

### react-markdown

- Version: 10.1.0
- License: MIT
- Source: https://github.com/remarkjs/react-markdown
- Used by: apps/web/package.json
- Notes: the unified, remark, micromark, hast and unist packages it pulls in transitively are all MIT. Raw HTML stays disabled (no rehype-raw installed).

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

### remark-gfm

- Version: 4.0.1
- License: MIT
- Source: https://github.com/remarkjs/remark-gfm
- Used by: apps/web/package.json
- Notes: GFM (tables, task lists, strikethrough, autolinks) for the read view (OVERNIGHT-RUN.md decision 2).

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

### tailwind-variants

- Version: 3.3.1
- License: MIT
- Source: https://github.com/heroui-inc/tailwind-variants
- Used by: apps/web/package.json (PanelUI's KPI and Day Grid, apps/web/components/panelui)

### tesseract.js

- Version: 7.0.0
- License: Apache-2.0
- Source: https://github.com/naptha/tesseract.js
- Used by: apps/web/package.json
- Notes: IngestSheet reads text in photos on the device (English and Hebrew), loaded with `import()` only when a photo is picked. Unmodified. Owner-approved 2026-10-18. At runtime it fetches its worker, its WASM core (tesseract.js-core 7.0.0, Apache-2.0) and the English and Hebrew language data (@tesseract.js-data, Apache-2.0, from Tesseract's tessdata) from cdn.jsdelivr.net; no user data is sent. Transitive: idb-keyval and wasm-feature-detect (Apache-2.0), bmp-js, is-url, node-fetch, regenerator-runtime, zlibjs, opencollective-postinstall (MIT).

### zod

- Version: 4.3.6
- License: MIT
- Source: https://github.com/colinhacks/zod
- Used by: package.json, packages/ui/package.json, packages/utils/package.json
