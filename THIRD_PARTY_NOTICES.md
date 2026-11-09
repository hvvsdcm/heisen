# Heisen 0.5.2 — Third-party notices

Generated offline by `node scripts/notices.mjs` from `npm ls --omit=dev --all --long --json`, the lockfile, installed license/NOTICE files, and checked-in asset provenance. Regenerate after dependency or asset changes. Do not edit this generated file.

## Scope and licenses

The 137 installed production package instances below are a conservative superset of the JavaScript shipped in the main process, renderer, preloads, reader and CLI. Tree-shaken and type-only dependencies are also credited; their listing does not assert that their code is present. Nested installations and versions are kept distinct. Build-only tools are excluded. Electron is listed separately because its runtime ships even though it is a development dependency.

MIT, BSD, ISC, Apache-2.0, Unlicense and OFL permit redistribution and commercial use subject to their terms. No noncommercial or redistribution-prohibited license was found in this production closure. Ghostery/remusao modules carry file-level MPL-2.0 obligations; source locations and full texts follow. DOMPurify is distributed under its Apache-2.0 option. This document does not relicense Heisen or third-party works.

## Electron / Chromium runtime

Electron 45.2.3: MIT; Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc. Source: https://github.com/electron/electron/tree/v45.2.3.

The runtime includes Chromium, Node.js and other components with their own licenses. Their complete vendor-supplied notices are shipped alongside this file as `LICENSE` and `LICENSES.chromium.html`, rather than duplicated here. Locations: macOS `Heisen.app/Contents/Resources/`; Windows `resources/`. Packaging copies the packager's original texts into those directories before signing/installer creation. The stock macOS packager output places them beside, not inside, Heisen.app; copying the app alone would otherwise omit them.

## Fonts, icons and brand assets

- Geist variable font, package version 1.9.1, unmodified: SIL OFL-1.1; Copyright (c) 2023 Vercel, in collaboration with basement.studio. Source: https://github.com/vercel/geist-font ; package: https://www.npmjs.com/package/geist/v/1.9.1 . Full text: [Geist 1.9.1 — SIL OFL-1.1](#license-05d27e17d7bda00d). The font may be bundled commercially, but may not be sold on its own; derivatives must retain OFL terms.
- Lucide React 1.69.0: ISC, with MIT for Feather-derived icons. Copyright (c) 2026 Lucide Icons and Contributors; Copyright (c) 2013-present Cole Bemis. Source: https://github.com/lucide-icons/lucide . Both texts and the derived-icon inventory are included in the package section.
- Provider marks (Claude, OpenAI, GitHub Copilot, Gemini, OpenRouter, Ollama): unmodified @lobehub/icons-static-svg 1.102.0, MIT, Copyright (c) 2023 LobeHub. Source: https://github.com/lobehub/lobe-icons . Full provenance and text: [@lobehub/icons-static-svg 1.102.0 — MIT](#license-8c91e378199faba6). Trademarks remain property of their owners; the copyright license does not imply endorsement or a trademark license.
- Heisen wave-H mark (ui/brand/mark.png; assets/heisen.png and application icon derivatives): generated for Heisen, not a third-party stock asset, per ui/brand/SOURCE.md. No third-party copyright/license is asserted for this first-party brand asset.

## Bundled filter data

EasyList / EasyPrivacy, © The EasyList authors (https://easylist.to/). Upstream permits GPL-3.0-or-later OR CC-BY-SA-3.0-or-later; Heisen chooses **CC BY-SA 3.0 Unported**, not GPL. The compiled filter data remains CC BY-SA 3.0. Network filters are compiled with Ghostery; cosmetic filters are excluded, a transformation from the original text. Heisen's application code is not relicensed by this data attribution.

License/legal code: https://creativecommons.org/licenses/by-sa/3.0/ and https://creativecommons.org/licenses/by-sa/3.0/legalcode . Upstream licensing statement: https://easylist.to/pages/licence.html . Source lists: https://easylist.to/easylist/easylist.txt and https://easylist.to/easylist/easyprivacy.txt . Source repository: https://github.com/easylist/easylist . Full bundled attribution: [EasyList / EasyPrivacy — CC BY-SA 3.0 attribution](#license-3243eb9e11d15545).

| List | Version | Fetched at | Original source SHA-256 |
| --- | --- | --- | --- |
| easyprivacy | 202611061327 | 2026-11-06T13:48:07.955Z | 58d09ebf134e4c4608f7358343a2c4c511a8027707d92bd7dae9b1f0ca71bdce |
| easylist | 202611061327 | 2026-11-06T13:48:08.358Z | 8805047cc1c5e5e1151d6f9bc4600631dfd42b03185656c6f4d8051a39602b08 |

## Runtime-only dangerous-site lists

No feed snapshot is included in the installer. The local updater downloads Block List Project malware, phishing, scam, ransomware and fraud lists (Unlicense; public-domain dedication by the authors) and Phishing.Database active phishing domains (MIT; Copyright (c) 2018-2025 Mitchell Krog, Nissar Chababy and Phishing.Database Contributors). Versions are the runtime HTTP snapshots/ETags, not a fixed application release. Source repositories, exact feed URLs and full license texts: [Runtime dangerous-site feeds — Unlicense / MIT](#license-80fecce6af054964).

## Native helpers and external tools

The macOS heisen-computer binary is compiled from Heisen's helpers/computer/macos/main.swift against operating-system AppKit, ApplicationServices, Carbon and ScreenCaptureKit; no third-party helper executable is vendored. Windows ships Heisen's helpers/computer/windows/heisen-computer.ps1, using installed .NET/Windows UI Automation and operating-system DLLs rather than redistributing those libraries. CLI launchers are first-party source. Electron's helper apps, frameworks and native libraries are covered by the runtime notices above. Docker, container images, system Node.js and external MCP servers are not bundled in the installer and retain their own distribution terms.

## Production dependency inventory

### @anthropic-ai/sdk@1.5.0

- License: Apache-2.0
- Copyright: Copyright 2023 Anthropic, PBC.; Copyright (c) 2014, Nathan LaFreniere and other [contributors](https://github.com/puruvj/neoqs/graphs/contributors) All rights reserved.
- Source: https://github.com/anthropics/anthropic-sdk-typescript
- Published package: https://registry.npmjs.org/@anthropic-ai/sdk/-/sdk-1.5.0.tgz
- Integrity: sha512-AqB4Irlv4TLzTqsBCSpVyk5BLaPPfsTt5wUEju6X5a273nBsL143EM+4hxj67F9e0HpBlzdwUhVIPYM9OxD2oQ==
- Texts: [@anthropic-ai/sdk@1.5.0: LICENSE](#license-254d30170e964f2b); [@anthropic-ai/sdk@1.5.0: LICENSE-MIT](#license-afc09511b38a57e5); [@anthropic-ai/sdk@1.5.0: src/internal/qs/LICENSE.md](#license-ed1710a9953cb1df)

### @aws-sdk/client-bedrock-runtime@3.1162.0

- License: Apache-2.0
- Copyright: Copyright 2018-2023 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/client-bedrock-runtime/-/client-bedrock-runtime-3.1162.0.tgz
- Integrity: sha512-5JiQfVsvbQ4E/v7+E9dDF0VYp02OKdKceAJyBzK3H+Ia13ntMZFgD5YL/xpgNR2SuK89MxuwdU5ilAqiXbarKw==
- Texts: [@aws-sdk/client-bedrock-runtime@3.1162.0: LICENSE](#license-711cb7cff0da93b9)

### @aws-sdk/core@3.980.0

- License: Apache-2.0
- Copyright: Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/core/-/core-3.980.0.tgz
- Integrity: sha512-2RVSP/SsPS8HSPPzIPWNYFnSmlOdxx8VDlt5gDOuMaq9UiIi35pUyo6ZEuJcysjVCu0L8Lv5dJevLLpEkyF0/Q==
- Texts: [@aws-sdk/core@3.980.0: LICENSE](#license-edea91454b811f12)

### @aws-sdk/credential-provider-env@3.972.81

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-env/-/credential-provider-env-3.972.81.tgz
- Integrity: sha512-VD+EVZ9UHNZhSm4KtakXZAPzgfOw4mRx66dAXNUtHcdJUisbsE7kpi1PRZFMquvuqVfx52fCDBgJgYyOFT/4hQ==
- Texts: [@aws-sdk/credential-provider-env@3.972.81: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/credential-provider-http@3.972.83

- License: Apache-2.0
- Copyright: Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-http/-/credential-provider-http-3.972.83.tgz
- Integrity: sha512-NsLT02HXcWAQAgpuDJznoJDPIDH/Hh2LiQVlYc+1bVGsksEUZuYCMKa1E1L5qvzc5LLTphp7BP9LYVIhf+MbQA==
- Texts: [@aws-sdk/credential-provider-http@3.972.83: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE)](#license-edea91454b811f12)

### @aws-sdk/credential-provider-ini@3.973.26

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-ini/-/credential-provider-ini-3.973.26.tgz
- Integrity: sha512-vRydnN8wPqh5APe5R+/y4/UOts7QQQQP1UTczJq3fLcLzkQblbkYpLn+Srr8w9S/gzXU1pbiPKTv479unRawAA==
- Texts: [@aws-sdk/credential-provider-ini@3.973.26: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/credential-provider-login@3.972.88

- License: Apache-2.0
- Copyright: Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-login/-/credential-provider-login-3.972.88.tgz
- Integrity: sha512-J8IcBpuFj3j3RImHq/dVO5HtnUbFgvzg7JQvzLt5A42VmzLLgPLM+CUWN68jpIMdIPayu1bb1T+mJjDv9Sq1aA==
- Texts: [@aws-sdk/credential-provider-login@3.972.88: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE)](#license-edea91454b811f12)

### @aws-sdk/credential-provider-node@3.972.93

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-node/-/credential-provider-node-3.972.93.tgz
- Integrity: sha512-f5Grg1sgckk11ojxZ7NUYG1ZCOvcNhuuPngKWVxOKGuZokj8eOmo/75+GyR6qAQx4wAGytglZ53r4a3UPleAPQ==
- Texts: [@aws-sdk/credential-provider-node@3.972.93: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/credential-provider-process@3.972.81

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-process/-/credential-provider-process-3.972.81.tgz
- Integrity: sha512-6NBoFaNJbHB0YjcKW4WfrYIDmaMjtwbxlRreAf3MnXkD9WJX8XYu62pa78M0AQGgEt2TJmcNxqL3btAAjV67bA==
- Texts: [@aws-sdk/credential-provider-process@3.972.81: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/credential-provider-sso@3.973.25

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-sso/-/credential-provider-sso-3.973.25.tgz
- Integrity: sha512-p1fNaa3as6S2L0wrWqe1cEz1r4iGQa7GbW23KJE3rJy+ZZxhPr6pr9cyCAJ7fAnzoMELvQGZZAuv/rG1ogRuOQ==
- Texts: [@aws-sdk/credential-provider-sso@3.973.25: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/credential-provider-web-identity@3.972.87

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/credential-provider-web-identity/-/credential-provider-web-identity-3.972.87.tgz
- Integrity: sha512-O2P6CUfMP2qi8vgYB6UHYj/NYTEAAdTr2geEVdVchr3JBofK4Q6W917FiVr2sleA72R59YAXMEhrpzPwkX/xdA==
- Texts: [@aws-sdk/credential-provider-web-identity@3.972.87: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/eventstream-handler-node@3.972.40

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/eventstream-handler-node/-/eventstream-handler-node-3.972.40.tgz
- Integrity: sha512-LR2mRKFb9EMlGHmJNXMtuMPvVQqN1b9/v68A1UQaE72pb8pHqiHxTtS++vaab8844YesGVzBVrloAis7+EXq/w==
- Texts: [@aws-sdk/eventstream-handler-node@3.972.40: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/middleware-eventstream@3.972.36

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/middleware-eventstream/-/middleware-eventstream-3.972.36.tgz
- Integrity: sha512-OkV+alDzmJ3DOs2mRPLSM9FUVSul7G1wkpKrbO+tyxxGOT7qLMPZHOlj4Ipjw9OayRmU7nMVPSFo7hvUqOSeJg==
- Texts: [@aws-sdk/middleware-eventstream@3.972.36: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/middleware-websocket@3.972.63

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/middleware-websocket/-/middleware-websocket-3.972.63.tgz
- Integrity: sha512-fgY5UA9oeQYwxR5MyhIHUs9wGrXJGXLK71MQck1z3ArEb/GvQ0TmZm/RPs+cIbcaoKtIGqMb2u8AZ1rGFKYzKg==
- Texts: [@aws-sdk/middleware-websocket@3.972.63: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/nested-clients@3.998.0

- License: Apache-2.0
- Copyright: Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/nested-clients/-/nested-clients-3.998.0.tgz
- Integrity: sha512-aOD1oQVWG6UjOOEdp0MsrWE93vG8pPbvtymmeNtglGxAARplh1wzhHs4npqtY5JN5GBSrTaLbn1hQQ3W2Lk8ow==
- Texts: [@aws-sdk/nested-clients@3.998.0: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE)](#license-edea91454b811f12)

### @aws-sdk/signature-v4-multi-region@3.996.51

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/signature-v4-multi-region/-/signature-v4-multi-region-3.996.51.tgz
- Integrity: sha512-+aHvUugVBuMPXxgkPfWnTMyGdE/yWS8GHi5+qQ37HowS0YqzrbuaDLznj+Dtmtu5jgCdqz36gXmujOToUhNNWw==
- Texts: [@aws-sdk/signature-v4-multi-region@3.996.51: LICENSE](#license-2ef1e48ea743d9c8)

### @aws-sdk/token-providers@3.1162.0

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/token-providers/-/token-providers-3.1162.0.tgz
- Integrity: sha512-vOD6Ac0M43LtXaPu+/+wUMQCd27zIpKt/Le/a645qhx7T1MZeEK71PDhtIHGHgnQjGyNSfC6Z5RNud/hQb3veg==
- Texts: [@aws-sdk/token-providers@3.1162.0: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/types@3.975.0

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/types/-/types-3.975.0.tgz
- Integrity: sha512-WQlhs6juByzWOzj5fwxOx0mPJaEqMcG/sDpl3Id61B3XhKE63xY+0QWcnG+sWR/sCfprmreyUo1lM7IKZmHMzw==
- Texts: [@aws-sdk/types@3.975.0: LICENSE](#license-d82ceb8cbd004a2d)

### @aws-sdk/xml-builder@3.972.42

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/aws/aws-sdk-js-v3
- Published package: https://registry.npmjs.org/@aws-sdk/xml-builder/-/xml-builder-3.972.42.tgz
- Integrity: sha512-smX8/gNP8Kjq+CWTBMZQLQ912vOQjiWExzwzvMO+eujPB5RY8IbtF0AGdUUXHKN7KoDWK9dIcuW0WG269kiP6w==
- Texts: [@aws-sdk/xml-builder@3.972.42: LICENSE](#license-d82ceb8cbd004a2d)

### @aws/lambda-invoke-store@0.3.0

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Amazon Web Services.
- Source: https://github.com/awslabs/aws-lambda-invoke-store
- Published package: https://registry.npmjs.org/@aws/lambda-invoke-store/-/lambda-invoke-store-0.3.0.tgz
- Integrity: sha512-sl4Bm6yiMNYrZKkqqDFWN0UfnWhlS8ivKxrYl+6t0gCLrqr8y3B2IqZZbFRkfaVVp7C/baApyh71P+LeE1A2sQ==
- Texts: [@aws/lambda-invoke-store@0.3.0: LICENSE](#license-7fb46adff9025f55)

### @babel/runtime@7.29.13

- License: MIT
- Copyright: Copyright (c) 2014-present Sebastian McKenzie and other contributors
- Source: https://github.com/babel/babel
- Published package: https://registry.npmjs.org/@babel/runtime/-/runtime-7.29.13.tgz
- Integrity: sha512-v+oN26xP4YIlQsbQ/CbTH1WG5m/l/DjKKZNy/Kp3f/AFvbgt7Em/D0FeMM3O2hX0YzeN2M16W8lOpyhIkfCBcQ==
- Texts: [@babel/runtime@7.29.13: LICENSE](#license-8f08c824b2bb54ed)

### @ghostery/adblocker@2.20.3

- License: MPL-2.0
- Copyright: Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
- Source: https://github.com/ghostery/adblocker/tree/6f0610bf5eec1f31c4975ce0e707cdf47023e5b5
- Published package: https://registry.npmjs.org/@ghostery/adblocker/-/adblocker-2.20.3.tgz
- Integrity: sha512-Wxv+RiqfD+xYVij9gkudU6nDb+eqbfu2roDZa0rtqVw2qIm0ICxEnkrsgUyfZw7+L+3PfI2PszHZQeoCkR1CuA==
- Texts: [@ghostery/adblocker@2.20.3: LICENSE](#license-9e5119523ee0db94)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @ghostery/adblocker-content@2.20.3

- License: MPL-2.0
- Copyright: Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
- Source: https://github.com/ghostery/adblocker/tree/6f0610bf5eec1f31c4975ce0e707cdf47023e5b5
- Published package: https://registry.npmjs.org/@ghostery/adblocker-content/-/adblocker-content-2.20.3.tgz
- Integrity: sha512-tuV4T5wPbfVdcY6dnM1dfaXSazpStx7ZI54bd2l9r93yPZfZoVsHR1Uxf/A8ETBMXJPQ92JMDQzmV8hOgpyq+w==
- Texts: [@ghostery/adblocker-content@2.20.3: LICENSE](#license-9e5119523ee0db94)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @ghostery/adblocker-extended-selectors@2.20.3

- License: MPL-2.0
- Copyright: Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
- Source: https://github.com/ghostery/adblocker/tree/6f0610bf5eec1f31c4975ce0e707cdf47023e5b5
- Published package: https://registry.npmjs.org/@ghostery/adblocker-extended-selectors/-/adblocker-extended-selectors-2.20.3.tgz
- Integrity: sha512-cwloe8GXCoiLor685fOCsx3PyDFvsVnYdCO/MMAyZ4Dr5q8cgSHijqqYSU2fWgoWfz1Fhfepj7mGbQnrvUR37w==
- Texts: [@ghostery/adblocker-extended-selectors@2.20.3: LICENSE](#license-9e5119523ee0db94)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @ghostery/url-parser@1.3.1

- License: MPL-2.0
- Copyright: Copyright (c) 2017-2025 Ghostery GmbH. All rights reserved.
- Source: https://github.com/ghostery/url-parser/tree/v1.3.1
- Published package: https://registry.npmjs.org/@ghostery/url-parser/-/url-parser-1.3.1.tgz
- Integrity: sha512-QKqGi+7aDQ4RcyHyCwgEk6B9vWnsBP4Q7htaN0zPJV3ATqTKEQDtSTb9c/AN586oJUDs24YXKcwFYwNweY/YjQ==
- Texts: [@ghostery/url-parser@1.3.1: LICENSE](#license-8e5d2847aa13d3d7)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @google/genai@1.52.0

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license.
- Source: https://github.com/googleapis/js-genai
- Published package: https://registry.npmjs.org/@google/genai/-/genai-1.52.0.tgz
- Integrity: sha512-gwSvbpiN/17O9TbsqSsE/OzZcpv5Fo4RQjdngGgogtuB9RsyJ8ZHhX5KjHj1bp5N9snN2eK8LDGXSaWW2hof8Q==
- Texts: [@google/genai@1.52.0: LICENSE](#license-283ea6cc2997a1a7)

### @mariozechner/pi-ai@0.73.1

- License: MIT
- Copyright: Copyright (c) 2025 Mario Zechner
- Source: https://github.com/badlogic/pi-mono
- Published package: https://registry.npmjs.org/@mariozechner/pi-ai/-/pi-ai-0.73.1.tgz
- Integrity: sha512-Jh4lXawZYuC83HzSIYuVum9NBqJD49i4JOt3H96cGW/924cwJMOyUs1Mv/e4QPzTXnzrqMoGviNQnvGgSu1LSg==
- Texts: [@mariozechner/pi-ai@0.73.1: https://raw.githubusercontent.com/badlogic/pi-mono/v0.73.1/LICENSE](#license-0457f5bcec3b3b21)

### @anthropic-ai/sdk@0.91.1

- License: MIT
- Copyright: Copyright 2023 Anthropic, PBC.
- Source: https://github.com/anthropics/anthropic-sdk-typescript
- Published package: https://registry.npmjs.org/@anthropic-ai/sdk/-/sdk-0.91.1.tgz
- Integrity: sha512-LAmu761tSN9r66ixvmciswUj/ZC+1Q4iAfpedTfSVLeswRwnY3n2Nb6Tsk+cLPP28aLOPWeMgIuTuCcMC6W/iw==
- Texts: [@anthropic-ai/sdk@0.91.1: LICENSE](#license-d298496454d461ef)

### openai@6.26.0

- License: Apache-2.0
- Copyright: Copyright 2026 OpenAI; Copyright (c) 2020, Stefan Terdell; Copyright (c) 2014, Nathan LaFreniere and other [contributors](https://github.com/puruvj/neoqs/graphs/contributors) All rights reserved.
- Source: https://github.com/openai/openai-node
- Published package: https://registry.npmjs.org/openai/-/openai-6.26.0.tgz
- Integrity: sha512-zd23dbWTjiJ6sSAX6s0HrCZi41JwTA1bQVs0wLQPZ2/5o2gxOJA5wh7yOAUgwYybfhDXyhwlpeQf7Mlgx8EOCA==
- Texts: [openai@6.26.0: LICENSE](#license-7d52eae0c2f08865); [openai@6.26.0: src/_vendor/zod-to-json-schema/LICENSE](#license-80d3168ad2f70f6f); [openai@6.26.0: src/internal/qs/LICENSE.md](#license-ed1710a9953cb1df)

### @mistralai/mistralai@2.7.0

- License: Apache-2.0
- Copyright: Copyright 2024 Mistral AI
- Source: https://github.com/mistralai/client-ts
- Published package: https://registry.npmjs.org/@mistralai/mistralai/-/mistralai-2.7.0.tgz
- Integrity: sha512-zCrx6MtNpcz+EL/Nqvg55QubSgmfwJfBmd3d3wSYfJGfnvlNnWcJYlxEW5xQpS3KR6A5qK9KUyRBwMDIWnyVGA==
- Texts: [@mistralai/mistralai@2.7.0: LICENSE](#license-2ada3435165b8ecf)

### @mozilla/readability@0.6.0

- License: Apache-2.0
- Copyright: Copyright (c) 2010 Arc90 Inc
- Source: https://github.com/mozilla/readability
- Published package: https://registry.npmjs.org/@mozilla/readability/-/readability-0.6.0.tgz
- Integrity: sha512-juG5VWh4qAivzTAeMzvY9xs9HY5rAcr2E4I7tiSSCokRFi7XIZCAu92ZkSTsIj1OPceCifL3cpfteP3pDT9/QQ==
- Texts: [@mozilla/readability@0.6.0: LICENSE.md](#license-4862adf2fcecd2ca)

### @opentelemetry/api@1.10.0

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: OpenTelemetry Authors.
- Source: https://github.com/open-telemetry/opentelemetry-js/tree/12a5817ad147c186a0e45a6637abd5abf423727a
- Published package: https://registry.npmjs.org/@opentelemetry/api/-/api-1.10.0.tgz
- Integrity: sha512-lMkyes8iHrG+mk6WH7X70MdCLI2RS0FwNBY1PyQ8UemaijE2m5mv5A0Niy3HtbYTFrgkUEQjFMXmSAk2hQDuPQ==
- Texts: [@opentelemetry/api@1.10.0: LICENSE](#license-283ea6cc2997a1a7)

### @opentelemetry/semantic-conventions@1.44.0

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: OpenTelemetry Authors.
- Source: https://github.com/open-telemetry/opentelemetry-js/tree/70253d9c560f2a5d431e404365d4b3d25ddfc464
- Published package: https://registry.npmjs.org/@opentelemetry/semantic-conventions/-/semantic-conventions-1.44.0.tgz
- Integrity: sha512-E3JkOlMBi3N8OGGkbl7tFyqk2MAS6/lySRZBK3Mu7AzjF1fT8oIChH9ChE48SUWzDn9Kdwta+G/p5LJ4xW4CLQ==
- Texts: [@opentelemetry/semantic-conventions@1.44.0: LICENSE](#license-283ea6cc2997a1a7)

### @protobufjs/aspromise@1.1.2

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/aspromise/-/aspromise-1.1.2.tgz
- Integrity: sha512-j+gKExEuLmKwvz3OgROXtrJ2UG2x8Ch2YZUxahh+s1F2HZ+wAceUNLkvy6zKCPVRkU++ZWQrdxsUeQXmcg4uoQ==
- Texts: [@protobufjs/aspromise@1.1.2: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/base64@1.1.2

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/base64/-/base64-1.1.2.tgz
- Integrity: sha512-AZkcAA5vnN/v4PDqKyMR5lx7hZttPDgClv83E//FMNhR2TMcLUhfRUBHCmSl0oi9zMgDDqRUJkSxO3wm85+XLg==
- Texts: [@protobufjs/base64@1.1.2: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/codegen@2.0.5

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/codegen/-/codegen-2.0.5.tgz
- Integrity: sha512-zgXFLzW3Ap33e6d0Wlj4MGIm6Ce8O89n/apUaGNB/jx+hw+ruWEp7EwGUshdLKVRCxZW12fp9r40E1mQrf/34g==
- Texts: [@protobufjs/codegen@2.0.5: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/eventemitter@1.1.1

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/eventemitter/-/eventemitter-1.1.1.tgz
- Integrity: sha512-vW1GmwMZNnL+gMRaovlh9yZX74kc+TTU3FObkkurpMaRtBfLP3ldjS9KQWlwZgraRE0+dheEEoAxdzcJQ8eXZg==
- Texts: [@protobufjs/eventemitter@1.1.1: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/fetch@1.1.1

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/fetch/-/fetch-1.1.1.tgz
- Integrity: sha512-GpptLrs57adMSuHi3VNj0mAF8dwh36LMaYF6XyJ6JMWlVsc+t42tm1HSEDmOs3A8fC9yyeisgLhsTVQokOZ0zw==
- Texts: [@protobufjs/fetch@1.1.1: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/float@1.0.2

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/float/-/float-1.0.2.tgz
- Integrity: sha512-Ddb+kVXlXst9d+R9PfTIxh1EdNkgoRe5tOX6t01f1lYWOvJnSPDBlG241QLzcyPdoNTsblLUdujGSE4RzrTZGQ==
- Texts: [@protobufjs/float@1.0.2: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/path@1.1.2

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/path/-/path-1.1.2.tgz
- Integrity: sha512-6JOcJ5Tm08dOHAbdR3GrvP+yUUfkjG5ePsHYczMFLq3ZmMkAD98cDgcT2iA1lJ9NVwFd4tH/iSSoe44YWkltEA==
- Texts: [@protobufjs/path@1.1.2: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/pool@1.1.0

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/dcodeIO/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/pool/-/pool-1.1.0.tgz
- Integrity: sha512-0kELaGSIDBKvcgS4zkjz1PeddatrjYcmMWOlAuAPwAeccUrPHdUqo/J6LiymHHEiJT5NrF1UVwxY14f+fy4WQw==
- Texts: [@protobufjs/pool@1.1.0: LICENSE](#license-56c9299ed8fb2684)

### @protobufjs/utf8@1.1.2

- License: BSD-3-Clause
- Copyright: Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/protobufjs/protobuf.js
- Published package: https://registry.npmjs.org/@protobufjs/utf8/-/utf8-1.1.2.tgz
- Integrity: sha512-b1UQwcEZ4yCnMCD8DAL1VlbvBJE9/IX4FTIp7BG1xYpf29SLazLSrqUkj4w7Y5y7cCVP6E5tcqqcI0xemPkHug==
- Texts: [@protobufjs/utf8@1.1.2: LICENSE](#license-56c9299ed8fb2684)

### @remusao/guess-url-type@2.1.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/guess-url-type/-/guess-url-type-2.1.0.tgz
- Integrity: sha512-zI3dlTUxpjvx2GCxp9nLOSK5yEIqDCpxlAVGwb2Y49RKkS72oeNaxxo+VWS5+XQ5+Mf8Zfp9ZXIlk+G5eoEN8A==
- Texts: [@remusao/guess-url-type@2.1.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @remusao/small@2.1.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/small/-/small-2.1.0.tgz
- Integrity: sha512-Y1kyjZp7JU7dXdyOdxHVNfoTr1XLZJTyQP36/esZUU/WRWq9XY0PV2HsE3CsIHuaTf4pvgWv2pvzvnZ//UHIJQ==
- Texts: [@remusao/small@2.1.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @remusao/smaz@2.2.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/smaz/-/smaz-2.2.0.tgz
- Integrity: sha512-eSd3Qs0ELP/e7tU1SI5RWXcCn9KjDgvBY+KtWbL4i2QvvHhJOfdIt4v0AA3S5BbLWAr5dCEC7C4LUfogDm6q/Q==
- Texts: [@remusao/smaz@2.2.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @remusao/smaz-compress@2.2.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/smaz-compress/-/smaz-compress-2.2.0.tgz
- Integrity: sha512-TXpTPgILRUYOt2rEe0+9PC12xULPvBqeMpmipzB9A7oM4fa9Ztvy9lLYzPTd7tiQEeoNa1pmxihpKfJtsxnM/w==
- Texts: [@remusao/smaz-compress@2.2.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @remusao/smaz-decompress@2.2.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/smaz-decompress/-/smaz-decompress-2.2.0.tgz
- Integrity: sha512-ERAPwxPaA0/yg4hkNU7T2S+lnp9jj1sApcQMtOyROvOQyo+Zuh6Hn/oRcXr8mmjlYzyRaC7E6r3mT1nrdHR6pg==
- Texts: [@remusao/smaz-decompress@2.2.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @remusao/trie@2.1.0

- License: MPL-2.0
- Copyright: No separate copyright line in supplied license; package author: Rémi Berson <remi@cliqz.com>.
- Source: https://github.com/remusao/mono/tree/27c72bf6f12f8e500b19509eef5eb14445e6e2d5
- Published package: https://registry.npmjs.org/@remusao/trie/-/trie-2.1.0.tgz
- Integrity: sha512-Er3Q8q0/2OcCJPQYJOPLmCuqO0wu7cav3SPtpjlxSbjFi1x+A1pZkkLD6c9q2rGEkGW/tkrRzfrhNMt8VQjzXg==
- Texts: [@remusao/trie@2.1.0: LICENSE](#license-4b89d4518bd135ab)
- MPL-covered source is available at the source URL above, under MPL-2.0. Heisen uses the published package without source modifications; bundling/minification is executable-form distribution. This notice does not restrict your rights in that source.

### @smithy/core@3.39.0

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/core/-/core-3.39.0.tgz
- Integrity: sha512-JJ/46AWQ4ipS1N2eZmUj7yzIhH8NhQIfAE+dce7NSB6dmFh+7hvD4pbofcoT4I0Xzfy/LNhZx3V2QhwYyAiqdg==
- Texts: [@smithy/core@3.39.0: LICENSE](#license-2ef1e48ea743d9c8)

### @smithy/credential-provider-imds@4.5.2

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/credential-provider-imds/-/credential-provider-imds-4.5.2.tgz
- Integrity: sha512-A9uSdn72ozbRUSit0eib0TW7nXuNPlaeM0zcGkJ+nE6tFcSDbnmtwoxbTCFBukVQcszDAyvsd7+rTduPTXpygg==
- Texts: [@smithy/credential-provider-imds@4.5.2: LICENSE](#license-d82ceb8cbd004a2d)

### @smithy/fetch-http-handler@5.8.0

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/fetch-http-handler/-/fetch-http-handler-5.8.0.tgz
- Integrity: sha512-ycSJu3tFAQ4v04CBB0agqFMVsSQ1iG3yw+SpgxRqKfaURpQD4CZ8Wn0zPMmSnOuTpTh65Vz+EA0rMrw089wvkA==
- Texts: [@smithy/fetch-http-handler@5.8.0: LICENSE](#license-d82ceb8cbd004a2d)

### @smithy/node-http-handler@4.14.2

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/node-http-handler/-/node-http-handler-4.14.2.tgz
- Integrity: sha512-i1uORV1v3qBqP43ayRKzIdm1q5x14tf8N4Dd06/QUX1Szm6VxHMrTsu20X5E63UFsaNZCRjI4SXG0jDmqYa+3w==
- Texts: [@smithy/node-http-handler@4.14.2: LICENSE](#license-d82ceb8cbd004a2d)

### @smithy/signature-v4@5.7.5

- License: Apache-2.0
- Copyright: Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/signature-v4/-/signature-v4-5.7.5.tgz
- Integrity: sha512-WPjdr5oWOk1LArpI4pavu+fSo+/evi0Re1olxGvqwuZopd4gYR1UGCi+Soyn/IjmafqbWs+ZC+3AKxJS3ZpwUg==
- Texts: [@smithy/signature-v4@5.7.5: LICENSE](#license-d82ceb8cbd004a2d)

### @smithy/types@4.20.0

- License: Apache-2.0
- Copyright: Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- Source: https://github.com/smithy-lang/smithy-typescript
- Published package: https://registry.npmjs.org/@smithy/types/-/types-4.20.0.tgz
- Integrity: sha512-lCA6QG22dPk9ecHbv91jDQZsmtPUjdS1aE2Il6NNPqe7DrYc0dZQi6DhcESk2KYXH2sp5xbAcGdYMZDFnuzA2A==
- Texts: [@smithy/types@4.20.0: LICENSE](#license-2ef1e48ea743d9c8)

### @stablelib/base64@1.0.1

- License: MIT
- Copyright: Copyright (C) 2016 Dmitry Chestnykh
- Source: https://github.com/StableLib/stablelib/tree/03dadf27703120d54e6be8436525228ee1c4299b
- Published package: https://registry.npmjs.org/@stablelib/base64/-/base64-1.0.1.tgz
- Integrity: sha512-1bnPQqSxSuc3Ii6MhBysoWCg58j97aUjuCSZrGSmDxNqtytIi0k8utUenAwTZN4V5mXXYGsVUI9zeBqy+jBOSQ==
- Texts: [@stablelib/base64@1.0.1: LICENSE](#license-fe1812441c6de74f)

### @tootallnate/quickjs-emscripten@0.23.0

- License: MIT
- Copyright: quickjs-emscripten copyright (c) 2019 Jake Teton-Landis
- Source: https://github.com/justjake/quickjs-emscripten
- Published package: https://registry.npmjs.org/@tootallnate/quickjs-emscripten/-/quickjs-emscripten-0.23.0.tgz
- Integrity: sha512-C5Mc6rdnsaJDjO3UpGW/CQTHtCKaYlScZTly4JIu97Jxo/odCiH0ITnDXSJPTOrEKk/ycSZ0AOgTmkDtkOsvIA==
- Texts: [@tootallnate/quickjs-emscripten@0.23.0: LICENSE](#license-9aa16b4c94b03354)

### @types/node@26.6.6

- License: MIT
- Copyright: Copyright (c) Microsoft Corporation.
- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Published package: https://registry.npmjs.org/@types/node/-/node-26.6.6.tgz
- Integrity: sha512-MzQj+8Kx3XI40OmUAE6Qoh58ZMNstNNMwn2nfd3qWsfe7nDNSqJNzes4njhz6AHwrSHOffSLwXU6yb474Q4aog==
- Texts: [@types/node@26.6.6: LICENSE](#license-ff82c90f84945c60)

### @types/react@19.3.0

- License: MIT
- Copyright: Copyright (c) Microsoft Corporation.
- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Published package: https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz
- Integrity: sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==
- Texts: [@types/react@19.3.0: LICENSE](#license-ff82c90f84945c60)

### @types/retry@0.12.0

- License: MIT
- Copyright: Copyright (c) Microsoft Corporation. All rights reserved.
- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Published package: https://registry.npmjs.org/@types/retry/-/retry-0.12.0.tgz
- Integrity: sha512-wWKOClTTiizcZhXnPY4wikVAwmdYHp8q6DmC+EJUzAMsycb7HB32Kh9RN4+0gExjmPmZSAQjgURXIGATPegAvA==
- Texts: [@types/retry@0.12.0: LICENSE](#license-8e1c6bd583a7e67b)

### @types/trusted-types@2.0.7

- License: MIT
- Copyright: Copyright (c) Microsoft Corporation.
- Source: https://github.com/DefinitelyTyped/DefinitelyTyped
- Published package: https://registry.npmjs.org/@types/trusted-types/-/trusted-types-2.0.7.tgz
- Integrity: sha512-ScaPdn1dQczgbl0QFTeTOmVHFULt394XJgOQNoyVhZ6r2vLnMLJfBPd53SB52T/3G36VI1/g2MZaX0cwDuXsfw==
- Texts: [@types/trusted-types@2.0.7: LICENSE](#license-ff82c90f84945c60)

### agent-base@7.1.4

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/agent-base/-/agent-base-7.1.4.tgz
- Integrity: sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ==
- Texts: [agent-base@7.1.4: LICENSE](#license-8d8c55319c7729d5)

### ast-types@0.13.4

- License: MIT
- Copyright: Copyright (c) 2013 Ben Newman <bn@cs.stanford.edu>
- Source: https://github.com/benjamn/ast-types
- Published package: https://registry.npmjs.org/ast-types/-/ast-types-0.13.4.tgz
- Integrity: sha512-x1FCFnFifvYDDzTaLII71vG5uvDwgtmDTEVWAxrgeiR8VjMONcCXJx7E+USjDtHlwFmt9MysbqgF9b9Vjr6w+w==
- Texts: [ast-types@0.13.4: LICENSE](#license-1d8ce38662b90ac2)

### base64-js@1.5.1

- License: MIT
- Copyright: Copyright (c) 2014 Jameson Little
- Source: https://github.com/beatgammit/base64-js
- Published package: https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz
- Integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==
- Texts: [base64-js@1.5.1: LICENSE](#license-ce471b4b8188bf22)

### basic-ftp@6.2.6

- License: MIT
- Copyright: Copyright (c) 2019 Patrick Juchli
- Source: https://github.com/patrickjuchli/basic-ftp
- Published package: https://registry.npmjs.org/basic-ftp/-/basic-ftp-6.2.6.tgz
- Integrity: sha512-0EjZCaodOz6yiokv2JA1VyKGNdGxULZ+GGlPgG9tm4d+T/bHtX1hUch8CumDneBfpIbiSdn7TaCGwpM+gwsOlw==
- Texts: [basic-ftp@6.2.6: LICENSE.txt](#license-5b417c1f5ee99687)

### bignumber.js@9.3.1

- License: MIT
- Copyright: Copyright © `<2025>` `Michael Mclaughlin`
- Source: https://github.com/MikeMcl/bignumber.js
- Published package: https://registry.npmjs.org/bignumber.js/-/bignumber.js-9.3.1.tgz
- Integrity: sha512-Ko0uX15oIUS7wJ3Rb30Fs6SkVbLmPBAKdlm7q9+ak9bbIeFf0MwuBsQV6z7+X768/cHsfg+WlysDWJcmthjsjQ==
- Texts: [bignumber.js@9.3.1: LICENCE.md](#license-7ed7c157c4174119)

### bowser@2.15.0

- License: MIT
- Copyright: Copyright 2015, Dustin Diaz (the "Original Author")
- Source: https://github.com/bowser-js/bowser
- Published package: https://registry.npmjs.org/bowser/-/bowser-2.15.0.tgz
- Integrity: sha512-xic6KSZglg/I4ymp45fdM4GWfYpBK79Fxd/TOvJktlaPgQqqDxvmGwOPZl2V0dyeS3Lj5c180bLhXF43iyAjZQ==
- Texts: [bowser@2.15.0: LICENSE](#license-0139f2c14d4ec161)

### buffer-equal-constant-time@1.0.1

- License: BSD-3-Clause
- Copyright: Copyright (c) 2013, GoInstant Inc., a salesforce.com company
- Source: https://github.com/git@github.com:goinstant/buffer-equal-constant-time
- Published package: https://registry.npmjs.org/buffer-equal-constant-time/-/buffer-equal-constant-time-1.0.1.tgz
- Integrity: sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==
- Texts: [buffer-equal-constant-time@1.0.1: LICENSE.txt](#license-2c44cee9bf9dfda2)

### chalk@5.6.2

- License: MIT
- Copyright: Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
- Source: https://github.com/chalk/chalk
- Published package: https://registry.npmjs.org/chalk/-/chalk-5.6.2.tgz
- Integrity: sha512-7NzBL0rN6fMUW+f7A6Io4h40qQlG+xGmtMxfbnH/K7TAtt8JQWVQK+6g0UXKMeVJoyV5EkkNsErQ8pVD3bLHbA==
- Texts: [chalk@5.6.2: license](#license-1529f88b36750950)

### cron-parser@5.10.3

- License: MIT
- Copyright: Copyright (c) 2014-2023 Harri Siirak
- Source: https://github.com/harrisiirak/cron-parser
- Published package: https://registry.npmjs.org/cron-parser/-/cron-parser-5.10.3.tgz
- Integrity: sha512-Fwlmlgiyoj5e7XDCy5T3ueFd3imgt714k7xjAzhkOBUrUgQxWtsjS7kWSEN3efDX34bebxBJAmPoCSisHvjlpw==
- Texts: [cron-parser@5.10.3: LICENSE](#license-9a08965c44ca16aa)

### csstype@3.2.3

- License: MIT
- Copyright: Copyright (c) 2017-2018 Fredrik Nicol
- Source: https://github.com/frenic/csstype
- Published package: https://registry.npmjs.org/csstype/-/csstype-3.2.3.tgz
- Integrity: sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==
- Texts: [csstype@3.2.3: LICENSE](#license-6a972b33787e1430)

### data-uri-to-buffer@4.0.1

- License: MIT
- Copyright: Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/node-data-uri-to-buffer
- Published package: https://registry.npmjs.org/data-uri-to-buffer/-/data-uri-to-buffer-4.0.1.tgz
- Integrity: sha512-0R9ikRb668HB7QDxT1vkpuUBtqc53YyAwMwGeUFKRojY/NWKvdZ+9UYtRfGmhqNbRkTSVpMbmyhXipFFv2cb/A==
- Texts: [data-uri-to-buffer@4.0.1: README.md — License](#license-29308c08926e2139)

### debug@4.4.3

- License: MIT
- Copyright: Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca>; Copyright (c) 2018-2021 Josh Junon
- Source: https://github.com/debug-js/debug
- Published package: https://registry.npmjs.org/debug/-/debug-4.4.3.tgz
- Integrity: sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==
- Texts: [debug@4.4.3: LICENSE](#license-d9e5aa2747f30eae)

### degenerator@5.0.1

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/degenerator/-/degenerator-5.0.1.tgz
- Integrity: sha512-TllpMR/t0M5sqCXfj85i4XaAzxmS5tVA16dqvdkMwGmzI+dXLXnw3J+3Vdv7VKw+ThlTMboK6i9rnZ6Nntj5CQ==
- Texts: [degenerator@5.0.1: https://raw.githubusercontent.com/TooTallNate/proxy-agents/84e41e433b422cbe9f073952d8e16052eb9b0251/packages/degenerator/LICENSE](#license-8d8c55319c7729d5)

### diff@9.0.0

- License: BSD-3-Clause
- Copyright: Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>
- Source: https://github.com/kpdecker/jsdiff
- Published package: https://registry.npmjs.org/diff/-/diff-9.0.0.tgz
- Integrity: sha512-svtcdpS8CgJyqAjEQIXdb3OjhFVVYjzGAPO8WGCmRbrml64SPw/jJD4GoE98aR7r25A0XcgrK3F02yw9R/vhQw==
- Texts: [diff@9.0.0: LICENSE](#license-ef7eb99d9a97cb70)

### dompurify@3.4.17

- License: Apache-2.0 (chosen from MPL-2.0 OR Apache-2.0)
- Copyright: No separate copyright line in supplied license; package author: Dr.-Ing. Mario Heiderich, Cure53 <mario@cure53.de> (https://cure53.de/).
- Source: https://github.com/cure53/DOMPurify
- Published package: https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz
- Integrity: sha512-B/pSlYVHQ58kqISD/yDjuJ1yfzI34m1gF4lAod2bwSRhiN4K5Cl3H8Af7hqB2PmTL911tdEudnnXn5FnhRoz0w==
- Texts: [dompurify@3.4.17: LICENSE](#license-283ea6cc2997a1a7); [dompurify@3.4.17: LICENSE-MPL](#license-c76f740d1521b9be); [dompurify@3.4.17: src/license_header](#license-8cd07c535061d09c)

### ecdsa-sig-formatter@1.0.11

- License: Apache-2.0
- Copyright: Copyright 2015 D2L Corporation
- Source: https://github.com/Brightspace/node-ecdsa-sig-formatter
- Published package: https://registry.npmjs.org/ecdsa-sig-formatter/-/ecdsa-sig-formatter-1.0.11.tgz
- Integrity: sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==
- Texts: [ecdsa-sig-formatter@1.0.11: LICENSE](#license-50640bbffc177e09)

### escodegen@2.1.0

- License: BSD-2-Clause
- Copyright: Copyright (C) 2012 Yusuke Suzuki (twitter: @Constellation) and other contributors.
- Source: https://github.com/estools/escodegen
- Published package: https://registry.npmjs.org/escodegen/-/escodegen-2.1.0.tgz
- Integrity: sha512-2NlIDTwUWJN0mRPQOdtQBzbUHvdGY2P1VXSyU83Q3xKxM7WHX2Ql8dKq782Q9TgQUNOLEzEYu9bzLNj1q88I5w==
- Texts: [escodegen@2.1.0: LICENSE.BSD](#license-7e01abe3636c5b46)

### esprima@4.0.1

- License: BSD-2-Clause
- Copyright: No separate copyright line in supplied license; package author: Ariya Hidayat.
- Source: https://github.com/jquery/esprima
- Published package: https://registry.npmjs.org/esprima/-/esprima-4.0.1.tgz
- Integrity: sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A==
- Texts: [esprima@4.0.1: LICENSE.BSD](#license-a2cca9d62545047a)

### estraverse@5.3.0

- License: BSD-2-Clause
- Copyright: No separate copyright line in supplied license.
- Source: https://github.com/estools/estraverse
- Published package: https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz
- Integrity: sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==
- Texts: [estraverse@5.3.0: LICENSE.BSD](#license-d0b1e75b0f84d904)

### esutils@2.0.3

- License: BSD-2-Clause
- Copyright: No separate copyright line in supplied license.
- Source: https://github.com/estools/esutils
- Published package: https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz
- Integrity: sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==
- Texts: [esutils@2.0.3: LICENSE.BSD](#license-d0b1e75b0f84d904)

### extend@3.0.2

- License: MIT
- Copyright: Copyright (c) 2014 Stefan Thomas
- Source: https://github.com/justmoon/node-extend
- Published package: https://registry.npmjs.org/extend/-/extend-3.0.2.tgz
- Integrity: sha512-fjquC59cD7CyW6urNXK0FBufkZcoiGG80wTuPujX590cB5Ttln20E2UB4S/WARVqhXffZl2LNgS+gQdPIIim/g==
- Texts: [extend@3.0.2: LICENSE](#license-b079b743d39aa524)

### fast-sha256@1.3.0

- License: Unlicense
- Copyright: No separate copyright line in supplied license; package author: Dmitry Chestnykh.
- Source: https://github.com/dchest/fast-sha256-js
- Published package: https://registry.npmjs.org/fast-sha256/-/fast-sha256-1.3.0.tgz
- Integrity: sha512-n11RGP/lrWEFI/bWdygLxhI+pVeo1ZYIVwvvPkW7azl/rOy+F3HYRZ2K5zeE9mmkhQppyv9sQFx0JM9UabnpPQ==
- Texts: [fast-sha256@1.3.0: LICENSE](#license-79d0fc44716007dd)

### fetch-blob@3.2.0

- License: MIT
- Copyright: Copyright (c) 2019 David Frank
- Source: https://github.com/node-fetch/fetch-blob
- Published package: https://registry.npmjs.org/fetch-blob/-/fetch-blob-3.2.0.tgz
- Integrity: sha512-7yAQpD2UMJzLi1Dqv7qFYnPbaPx7ZfFK6PiIxQ4PfkGPyNyl2Ugx+a/umUonmKqjhM4DnfbMvdX6otXq83soQQ==
- Texts: [fetch-blob@3.2.0: LICENSE](#license-da98afd61ac876b4)

### formdata-polyfill@4.0.10

- License: MIT
- Copyright: Copyright (c) 2016 Jimmy Karl Roland Wärting
- Source: https://jimmywarting@github.com/jimmywarting/FormData
- Published package: https://registry.npmjs.org/formdata-polyfill/-/formdata-polyfill-4.0.10.tgz
- Integrity: sha512-buewHzMvYL29jdeQTVILecSaZKnt/RJWjoZCF5OW60Z67/GmSLBkOFM7qh1PI3zFNtJbaZL5eQu1vLfazOwj4g==
- Texts: [formdata-polyfill@4.0.10: LICENSE](#license-95b423fd389e2fa9)

### gaxios@7.3.1

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Google, LLC.
- Source: https://github.com/googleapis/google-cloud-node
- Published package: https://registry.npmjs.org/gaxios/-/gaxios-7.3.1.tgz
- Integrity: sha512-kB3rzJV7d9juLZh8/56QTXCwQfxyhdOMdyYk1HdQKFtF8TJTDTZQJtixWIwXdE9Jji91mC41DUNpjleo4L4eAQ==
- Texts: [gaxios@7.3.1: LICENSE](#license-283ea6cc2997a1a7)

### gcp-metadata@8.1.2

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Google LLC.
- Source: https://github.com/googleapis/google-cloud-node-core
- Published package: https://registry.npmjs.org/gcp-metadata/-/gcp-metadata-8.1.2.tgz
- Integrity: sha512-zV/5HKTfCeKWnxG0Dmrw51hEWFGfcF2xiXqcA3+J90WDuP0SvoiSO5ORvcBsifmx/FoIjgQN3oNOGaQ5PhLFkg==
- Texts: [gcp-metadata@8.1.2: LICENSE](#license-283ea6cc2997a1a7)

### get-uri@6.0.5

- License: MIT
- Copyright: Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/get-uri/-/get-uri-6.0.5.tgz
- Integrity: sha512-b1O07XYq8eRuVzBNgJLstU6FYc1tS6wnMtF1I1D9lE8LxZSOGZ7LhxN54yPP6mGw5f2CkXY2BQUL9Fx41qvcIg==
- Texts: [get-uri@6.0.5: LICENSE](#license-29308c08926e2139)

### data-uri-to-buffer@6.0.2

- License: MIT
- Copyright: Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/data-uri-to-buffer/-/data-uri-to-buffer-6.0.2.tgz
- Integrity: sha512-7hvf7/GW8e86rW0ptuwS3OcBGDjIi6SZva7hCyWC0yYry2cOPmLIjXAUHI6DK2HsnwJd9ifmt57i8eV2n4YNpw==
- Texts: [data-uri-to-buffer@6.0.2: LICENSE](#license-29308c08926e2139)

### google-auth-library@10.9.1

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Google Inc..
- Source: https://github.com/googleapis/google-cloud-node
- Published package: https://registry.npmjs.org/google-auth-library/-/google-auth-library-10.9.1.tgz
- Integrity: sha512-i1ydyHrqcIxXkWh/uBmVkzCvIuq5yiK2ATndIe5XxKholrG/MTYP9xGYka4sQhrbIAgGjL2B6NOE7rFaiF3fXw==
- Texts: [google-auth-library@10.9.1: LICENSE](#license-283ea6cc2997a1a7)

### google-logging-utils@1.1.3

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Google API Authors.
- Source: https://github.com/googleapis/google-cloud-node-core
- Published package: https://registry.npmjs.org/google-logging-utils/-/google-logging-utils-1.1.3.tgz
- Integrity: sha512-eAmLkjDjAFCVXg7A1unxHsLf961m6y17QFqXqAXGj/gVkKFrEICfStRfwUlGNfeCEjNRa32JEWOUTlYXPyyKvA==
- Texts: [google-logging-utils@1.1.3: LICENSE](#license-283ea6cc2997a1a7)

### http-proxy-agent@7.0.2

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/http-proxy-agent/-/http-proxy-agent-7.0.2.tgz
- Integrity: sha512-T1gkAiYYDWYx3V5Bmyu7HcfcvL7mUrTWiM6yOfa3PIphViJ/gFPbvidQ+veqSOHci/PxBcDabeUNCzpOODJZig==
- Texts: [http-proxy-agent@7.0.2: LICENSE](#license-8d8c55319c7729d5)

### https-proxy-agent@7.0.6

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-7.0.6.tgz
- Integrity: sha512-vK9P5/iUfdl95AI+JVyUuIcVtd4ofvtrOr3HNtM2yxC9bnMbEdp3x01OhQNnjb8IJYi38VlTE3mBXwcfvywuSw==
- Texts: [https-proxy-agent@7.0.6: LICENSE](#license-8d8c55319c7729d5)

### ip-address@10.7.6

- License: MIT
- Copyright: Copyright (C) 2011 by Beau Gunderson
- Source: https://github.com/beaugunderson/ip-address
- Published package: https://registry.npmjs.org/ip-address/-/ip-address-10.7.6.tgz
- Integrity: sha512-00LYkM6byILa9eQIx6qoaXCM40xTLd56AZ4vyaPW3YTyb49VZYPo5xsiAq4tuQ54GH4R7gVdYScJ1B7B77PuTg==
- Texts: [ip-address@10.7.6: LICENSE](#license-02d42589c6442c04)

### json-bigint@1.0.0

- License: MIT
- Copyright: Copyright (c) 2013 Andrey Sidorov
- Source: https://github.com/git@github.com:sidorares/json-bigint
- Published package: https://registry.npmjs.org/json-bigint/-/json-bigint-1.0.0.tgz
- Integrity: sha512-SiPv/8VpZuWbvLSMtTDU8hEfrZWg/mH/nV/b4o0CYbSxu1UIQPLdwKOCIyLQX+VIPO5vrLX3i8qtqFyhdPSUSQ==
- Texts: [json-bigint@1.0.0: LICENSE](#license-faa1180b6bfee49c)

### json-schema-to-ts@3.1.1

- License: MIT
- Copyright: Copyright (c) 2020 Thomas Aribart
- Source: https://github.com/ThomasAribart/json-schema-to-ts
- Published package: https://registry.npmjs.org/json-schema-to-ts/-/json-schema-to-ts-3.1.1.tgz
- Integrity: sha512-+DWg8jCJG2TEnpy7kOm/7/AxaYoaRbjVB4LFZLySZlWn8exGs3A4OLJR966cVvU26N7X9TWxl+Jsw7dzAqKT6g==
- Texts: [json-schema-to-ts@3.1.1: LICENSE](#license-3d1a950648d86f21)

### jwa@2.0.1

- License: MIT
- Copyright: Copyright (c) 2013 Brian J. Brennan
- Source: https://github.com/brianloveswords/node-jwa
- Published package: https://registry.npmjs.org/jwa/-/jwa-2.0.1.tgz
- Integrity: sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==
- Texts: [jwa@2.0.1: LICENSE](#license-960502165e03cfa4)

### jws@4.0.1

- License: MIT
- Copyright: Copyright (c) 2013 Brian J. Brennan
- Source: https://github.com/brianloveswords/node-jws/tree/c0f6b27bcea5a2ad2e304d91c2e842e4076a6b03
- Published package: https://registry.npmjs.org/jws/-/jws-4.0.1.tgz
- Integrity: sha512-EKI/M/yqPncGUUh44xz0PxSidXFr/+r0pA70+gIYhjv+et7yxM+s29Y+VGDkovRofQem0fs7Uvf4+YmAdyRduA==
- Texts: [jws@4.0.1: LICENSE](#license-960502165e03cfa4)

### long@5.3.2

- License: Apache-2.0
- Copyright: No separate copyright line in supplied license; package author: Daniel Wirtz <dcode@dcode.io>.
- Source: https://github.com/dcodeIO/long.js
- Published package: https://registry.npmjs.org/long/-/long-5.3.2.tgz
- Integrity: sha512-mNAgZ1GmyNhD7AuqnTG3/VQ26o760+ZYBPKjPvugO8+nLbYfX6TVpJPseBvopbdY+qpZ/lKUnmEc1LeZYS3QAA==
- Texts: [long@5.3.2: LICENSE](#license-283ea6cc2997a1a7)

### lucide-react@1.69.0

- License: ISC; Feather-derived icons: MIT
- Copyright: Copyright (c) 2026 Lucide Icons and Contributors; Copyright (c) 2013-present Cole Bemis
- Source: https://github.com/lucide-icons/lucide
- Published package: https://registry.npmjs.org/lucide-react/-/lucide-react-1.69.0.tgz
- Integrity: sha512-UTFECm4yEgkgMN0kfLuxWcmlk+4u02Jrqehgk3ZXRx/Ud68OpP7hjkp67bvkBHmIpMaZCIveF1QDYeupO7XmYQ==
- Texts: [lucide-react@1.69.0: LICENSE](#license-ee35498e6684b30c)

### luxon@3.7.2

- License: MIT
- Copyright: Copyright 2019 JS Foundation and other contributors
- Source: https://github.com/moment/luxon
- Published package: https://registry.npmjs.org/luxon/-/luxon-3.7.2.tgz
- Integrity: sha512-vtEhXh/gNjI9Yg1u4jX/0YVPMvxzHuGgCm6tC5kZyb08yjGWGnqAjGJvcXbqQR2P3MyMEFnRbpcdFS6PBcLqew==
- Texts: [luxon@3.7.2: LICENSE.md](#license-f8f62778c92d145b)

### marked@18.1.3

- License: MIT
- Copyright: Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/); Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/); Copyright © 2004, John Gruber
- Source: https://github.com/markedjs/marked
- Published package: https://registry.npmjs.org/marked/-/marked-18.1.3.tgz
- Integrity: sha512-9ChMH8EVVgjgID49nsL6IWxWk5c6GtAsq/xw7U1ggkjkU5AGuv68oLTVlFRtvcUYZtpbNyjyvGo3YDu0fGapiw==
- Texts: [marked@18.1.3: LICENSE](#license-dd923de9769808b2)

### ms@2.1.3

- License: MIT
- Copyright: Copyright (c) 2020 Vercel, Inc.
- Source: https://github.com/vercel/ms
- Published package: https://registry.npmjs.org/ms/-/ms-2.1.3.tgz
- Integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==
- Texts: [ms@2.1.3: license.md](#license-e91069c31b4e4dae)

### netmask@2.1.1

- License: MIT
- Copyright: Copyright (c) 2011 Olivier Poitrey rs@rhapsodyk.net
- Source: https://github.com/rs/node-netmask
- Published package: https://registry.npmjs.org/netmask/-/netmask-2.1.1.tgz
- Integrity: sha512-eonl3sLUha+S1GzTPxychyhnUzKyeQkZ7jLjKrBagJgPla13F+uQ71HgpFefyHgqrjEbCPkDArxYsjY8/+gLKA==
- Texts: [netmask@2.1.1: LICENSE.md](#license-723718aa866c767e)

### node-domexception@1.0.0

- License: MIT
- Copyright: Copyright (c) 2021 Jimmy Wärting
- Source: https://github.com/jimmywarting/node-domexception
- Published package: https://registry.npmjs.org/node-domexception/-/node-domexception-1.0.0.tgz
- Integrity: sha512-/jKZoMpw0F8GRwl4/eLROPA3cfcXtLApP0QzLmUT/HuPCZWyB7IY9ZrMeKw2O/nFIqPQB3PVM9aYm0F312AXDQ==
- Texts: [node-domexception@1.0.0: LICENSE](#license-8c46e0985782a28a)

### node-fetch@3.3.2

- License: MIT
- Copyright: Copyright (c) 2016 - 2020 Node Fetch Team
- Source: https://github.com/node-fetch/node-fetch
- Published package: https://registry.npmjs.org/node-fetch/-/node-fetch-3.3.2.tgz
- Integrity: sha512-dRB78srN/l6gqWulah9SrxeYnxeddIG30+GOqK/9OlLVyLg3HPnr6SqOWTWOXKRwC2eGYCkZ59NNuSgvSrpgOA==
- Texts: [node-fetch@3.3.2: LICENSE.md](#license-399cbcc4b8a2e0e6)

### openai@7.51.0

- License: Apache-2.0
- Copyright: Copyright 2026 OpenAI; Copyright (c) 2023 Promplate Dev Team; Copyright (c) 2020, Stefan Terdell; Copyright (c) 2014, Nathan LaFreniere and other [contributors](https://github.com/puruvj/neoqs/graphs/contributors) All rights reserved.
- Source: https://github.com/openai/openai-node
- Published package: https://registry.npmjs.org/openai/-/openai-7.51.0.tgz
- Integrity: sha512-Ibu1d3ilmMbXRS8Y3WUPNTKk96p0rg1/BSlqASnvKy6i8efKjliUZGSfUTTCRcZJNGQ3xXMdita2REQOlH68JA==
- Texts: [openai@7.51.0: LICENSE](#license-7d52eae0c2f08865); [openai@7.51.0: src/_vendor/partial-json-parser/LICENSE](#license-b72c84b52e8fcbda); [openai@7.51.0: src/_vendor/zod-to-json-schema/LICENSE](#license-80d3168ad2f70f6f); [openai@7.51.0: src/internal/qs/LICENSE.md](#license-ed1710a9953cb1df)

### p-retry@4.6.2

- License: MIT
- Copyright: Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
- Source: https://github.com/sindresorhus/p-retry
- Published package: https://registry.npmjs.org/p-retry/-/p-retry-4.6.2.tgz
- Integrity: sha512-312Id396EbJdvRONlngUx0NydfrIQ5lsYu0znKVUzVvArzEIt08V1qhtyESbGVd1FGX7UKtiFp5uwKZdM8wIuQ==
- Texts: [p-retry@4.6.2: license](#license-c9808a775260db56)

### pac-proxy-agent@7.2.0

- License: MIT
- Copyright: Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/pac-proxy-agent/-/pac-proxy-agent-7.2.0.tgz
- Integrity: sha512-TEB8ESquiLMc0lV8vcd5Ql/JAKAoyzHFXaStwjkzpOpC5Yv+pIzLfHvjTSdf3vpa2bMiUQrg9i6276yn8666aA==
- Texts: [pac-proxy-agent@7.2.0: LICENSE](#license-29308c08926e2139)

### pac-resolver@7.0.1

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/pac-resolver/-/pac-resolver-7.0.1.tgz
- Integrity: sha512-5NPgf87AT2STgwa2ntRMr45jTKrYBGkVU36yT0ig/n/GMAa3oPqhZfIQ2kMEimReg0+t9kZViDVZ83qfVUlckg==
- Texts: [pac-resolver@7.0.1: LICENSE](#license-8d8c55319c7729d5)

### partial-json@0.1.7

- License: MIT
- Copyright: Copyright (c) 2023 Promplate Dev Team
- Source: https://github.com/promplate/partial-json-parser-js
- Published package: https://registry.npmjs.org/partial-json/-/partial-json-0.1.7.tgz
- Integrity: sha512-Njv/59hHaokb/hRUjce3Hdv12wd60MtM9Z5Olmn+nehe0QDAsRtRbJPvJ0Z91TusF0SuZRIvnM+S4l6EIP8leA==
- Texts: [partial-json@0.1.7: LICENSE](#license-b72c84b52e8fcbda)

### protobufjs@7.6.6

- License: BSD-3-Clause
- Copyright: Copyright 2014, Google Inc.  All rights reserved.; Copyright (c) 2016, Daniel Wirtz  All rights reserved.
- Source: https://github.com/protobufjs/protobuf.js
- Published package: https://registry.npmjs.org/protobufjs/-/protobufjs-7.6.6.tgz
- Integrity: sha512-dYDWdjSl5RNb7SgPxGQcRU+GtvP7s2fpkrY0r432PcOIaZ0/rBcxEZnQN67iJhFuQiVw754JDoPruPCNdGsbjg==
- Texts: [protobufjs@7.6.6: google/LICENSE](#license-8de25314f46efde7); [protobufjs@7.6.6: LICENSE](#license-79157668b3601926)

### proxy-agent@6.5.0

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/proxy-agent/-/proxy-agent-6.5.0.tgz
- Integrity: sha512-TmatMXdr2KlRiA2CyDu8GqR8EjahTG3aY3nXjdzFyoZbmB8hrBsTyMezhULIXKnC0jpfjlmiZ3+EaCzoInSu/A==
- Texts: [proxy-agent@6.5.0: LICENSE](#license-8d8c55319c7729d5)

### lru-cache@7.18.3

- License: ISC
- Copyright: Copyright (c) 2010-2023 Isaac Z. Schlueter and Contributors
- Source: https://github.com/isaacs/node-lru-cache
- Published package: https://registry.npmjs.org/lru-cache/-/lru-cache-7.18.3.tgz
- Integrity: sha512-jumlc0BIUrS3qJGgIkWZsyfAM7NCWiBcCDhnd+3NNM5KbBmLTgHVfWBcg6W+rLUsIpzpERPsvwUP7CckAQSOoA==
- Texts: [lru-cache@7.18.3: LICENSE](#license-9647e3a9f36678c1)

### proxy-from-env@1.1.0

- License: MIT
- Copyright: Copyright (C) 2016-2018 Rob Wu <rob@robwu.nl>
- Source: https://github.com/Rob--W/proxy-from-env
- Published package: https://registry.npmjs.org/proxy-from-env/-/proxy-from-env-1.1.0.tgz
- Integrity: sha512-D+zkORCbA9f1tdWRK0RaCR3GPv50cMxcrz4X8k5LTSUD1Dkw47mKJEZQNunItRTkWwgtaUSo1RVFRIG9ZXiFYg==
- Texts: [proxy-from-env@1.1.0: LICENSE](#license-6e2ce8b28e108ee2)

### react@19.3.1

- License: MIT
- Copyright: Copyright (c) Meta Platforms, Inc. and affiliates.
- Source: https://github.com/react/react
- Published package: https://registry.npmjs.org/react/-/react-19.3.1.tgz
- Integrity: sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw==
- Texts: [react@19.3.1: LICENSE](#license-cf9b17822d1fcd4f)

### react-dom@19.3.1

- License: MIT
- Copyright: Copyright (c) Meta Platforms, Inc. and affiliates.
- Source: https://github.com/react/react
- Published package: https://registry.npmjs.org/react-dom/-/react-dom-19.3.1.tgz
- Integrity: sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQPtKQ==
- Texts: [react-dom@19.3.1: LICENSE](#license-cf9b17822d1fcd4f)

### retry@0.13.1

- License: MIT
- Copyright: Copyright (c) 2011:
- Source: https://github.com/tim-kos/node-retry
- Published package: https://registry.npmjs.org/retry/-/retry-0.13.1.tgz
- Integrity: sha512-XQBQ3I8W1Cge0Seh+6gjj03LbmRFWuoszgK9ooCpwYIrhhoO80pfq4cUkU5DkknwfOfFteRwlZ56PYOGYyFWdg==
- Texts: [retry@0.13.1: License](#license-1418710b026fba5a)

### safe-buffer@5.2.1

- License: MIT
- Copyright: Copyright (c) Feross Aboukhadijeh
- Source: https://github.com/feross/safe-buffer
- Published package: https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz
- Integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==
- Texts: [safe-buffer@5.2.1: LICENSE](#license-dff1a84cb7036527)

### scheduler@0.28.0

- License: MIT
- Copyright: Copyright (c) Meta Platforms, Inc. and affiliates.
- Source: https://github.com/react/react
- Published package: https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz
- Integrity: sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw==
- Texts: [scheduler@0.28.0: LICENSE](#license-cf9b17822d1fcd4f)

### smart-buffer@4.2.0

- License: MIT
- Copyright: Copyright (c) 2013-2017 Josh Glazebrook
- Source: https://github.com/JoshGlazebrook/smart-buffer
- Published package: https://registry.npmjs.org/smart-buffer/-/smart-buffer-4.2.0.tgz
- Integrity: sha512-94hK0Hh8rPqQl2xXc3HsaBoOXKV20MToPkcXvwbISWLEs+64sBq5kFgn2kJDHb1Pry9yrP0dxrCI9RRci7RXKg==
- Texts: [smart-buffer@4.2.0: LICENSE](#license-3065255dab8c2013)

### socks@2.8.10

- License: MIT
- Copyright: Copyright (c) 2013 Josh Glazebrook
- Source: https://github.com/JoshGlazebrook/socks
- Published package: https://registry.npmjs.org/socks/-/socks-2.8.10.tgz
- Integrity: sha512-e0VyvkVTwVYViNovRkZ9aodhxVlyoMn7eJhVUPxZ+eK9P/7CBkxvvsBOHqFPEH416726W8tLXXXjKwqgTErrCQ==
- Texts: [socks@2.8.10: LICENSE](#license-6830463c2795eced)

### socks-proxy-agent@8.0.5

- License: MIT
- Copyright: Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
- Source: https://github.com/TooTallNate/proxy-agents
- Published package: https://registry.npmjs.org/socks-proxy-agent/-/socks-proxy-agent-8.0.5.tgz
- Integrity: sha512-HehCEsotFqbPW9sJ8WVYB6UbmIMv7kUUORIF2Nncq4VQvBfNBLibW9YZR5dlYCSUhwcD628pRllm7n+E+YTzJw==
- Texts: [socks-proxy-agent@8.0.5: LICENSE](#license-8d8c55319c7729d5)

### source-map@0.6.1

- License: BSD-3-Clause
- Copyright: Copyright (c) 2009-2011, Mozilla Foundation and contributors
- Source: https://github.com/mozilla/source-map
- Published package: https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz
- Integrity: sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==
- Texts: [source-map@0.6.1: LICENSE](#license-6ead954f96723337)

### standardwebhooks@1.1.1

- License: MIT
- Copyright: Copyright (c) 2023 Svix (https://www.svix.com)
- Source: https://github.com/standard-webhooks/standard-webhooks
- Published package: https://registry.npmjs.org/standardwebhooks/-/standardwebhooks-1.1.1.tgz
- Integrity: sha512-bCbX9ZEyFkWPsRz7Bl3NuQUJohmwGSev/yhr7vhaGPlc4AfIrspIRa6cPTBuI1ItmrTDJ4d/S2hCsfe4+vQGnQ==
- Texts: [standardwebhooks@1.1.1: https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/ab6844147ce9cdb0d2dbf2e60d1ea85001fd2554/libraries/LICENSE](#license-a75b82e8d3d568f9)

### tldts@7.4.19

- License: MIT
- Copyright: Copyright (c) 2017 Thomas Parisot, 2018 Rémi Berson
- Source: https://github.com/remusao/tldts/tree/4ecabd1690a72c8e30dbaeb24502f7355908830b
- Published package: https://registry.npmjs.org/tldts/-/tldts-7.4.19.tgz
- Integrity: sha512-48dH6aSpQnpbzDUc4vIQZ1VjB8tkK+e8c1yx05/SZK+rkssgjEOlxDd/yU8/a4vGYQ9vRgJr9dwMq9TJ0b3X2Q==
- Texts: [tldts@7.4.19: LICENSE](#license-417c6c9f11c44a2e)

### tldts-core@7.4.20

- License: MIT
- Copyright: Copyright (c) 2017 Thomas Parisot, 2018 Rémi Berson
- Source: https://github.com/remusao/tldts/tree/8eeda26721202c74b924559359f743bd44fb7593
- Published package: https://registry.npmjs.org/tldts-core/-/tldts-core-7.4.20.tgz
- Integrity: sha512-C630TWXZCZmLq0F2bW4QqwnaaxCQ/svpAqvJwnC4JvgEM5ohhBnGsEzTLSOXcN+xjz+kEaHS5uoWIw2klnqd0A==
- Texts: [tldts-core@7.4.20: LICENSE](#license-417c6c9f11c44a2e)

### tldts-experimental@7.4.19

- License: MIT
- Copyright: Copyright (c) 2017 Thomas Parisot, 2018 Rémi Berson
- Source: https://github.com/remusao/tldts/tree/4ecabd1690a72c8e30dbaeb24502f7355908830b
- Published package: https://registry.npmjs.org/tldts-experimental/-/tldts-experimental-7.4.19.tgz
- Integrity: sha512-GaXrBbI3uP7tpIi+HGuD+pQXILEAQqk+z+uqc4xRt/d0hm6mP/eG6QkdruZjCWVEh8ZVCJVtWJoBLZLAji0Z1Q==
- Texts: [tldts-experimental@7.4.19: LICENSE](#license-417c6c9f11c44a2e)

### ts-algebra@2.0.0

- License: MIT
- Copyright: Copyright (c) 2020 Thomas Aribart
- Source: https://github.com/ThomasAribart/ts-algebra
- Published package: https://registry.npmjs.org/ts-algebra/-/ts-algebra-2.0.0.tgz
- Integrity: sha512-FPAhNPFMrkwz76P7cdjdmiShwMynZYN6SgOujD1urY4oNm80Ou9oMdmbR45LotcKOXoy7wSmHkRFE6Mxbrhefw==
- Texts: [ts-algebra@2.0.0: LICENSE](#license-3d1a950648d86f21)

### tslib@2.9.1

- License: 0BSD
- Copyright: Copyright (c) Microsoft Corporation.
- Source: https://github.com/Microsoft/tslib
- Published package: https://registry.npmjs.org/tslib/-/tslib-2.9.1.tgz
- Integrity: sha512-a4Ux9VKuIMHsOS7ENbEq6hK2ZGYIT27Rtl0E4eD9KqwxhKiQeMZE/9xb3IdYwWaSOyIBQLExhQgXDTYoiCxnWA==
- Texts: [tslib@2.9.1: LICENSE.txt](#license-0e8d2550baea17eb)

### typebox@1.4.4

- License: MIT
- Copyright: Copyright (c) 2017-2026 Haydn Paterson
- Source: https://github.com/sinclairzx81/typebox
- Published package: https://registry.npmjs.org/typebox/-/typebox-1.4.4.tgz
- Integrity: sha512-ctPyL8BZibv6HYU6cE3ldDtfCTh7nXM7WPuL3KQVyRRhMnZEzU3o2yLVywxEEFmKEx+8EdeqG1/uTNzazRbxLA==
- Texts: [typebox@1.4.4: license](#license-e8a7cc256941a26b)

### undici@7.30.2

- License: MIT
- Copyright: Copyright (c) 2020 Ethan Arrowood; Copyright (c) Matteo Collina and Undici contributors
- Source: https://github.com/nodejs/undici
- Published package: https://registry.npmjs.org/undici/-/undici-7.30.2.tgz
- Integrity: sha512-mLyPQnHwUxaM/rideoK/+KL8DaAJLRl4aBCfmX444aCSLnIaomqPLtNRe2jdCYcsk5wZzXrDIQC8ZeYNRAYyIA==
- Texts: [undici@7.30.2: lib/web/fetch/LICENSE](#license-128272029be15e88); [undici@7.30.2: LICENSE](#license-fe64958bfaef10b1)

### undici-types@8.9.0

- License: MIT
- Copyright: Copyright (c) Matteo Collina and Undici contributors
- Source: https://github.com/nodejs/undici
- Published package: https://registry.npmjs.org/undici-types/-/undici-types-8.9.0.tgz
- Integrity: sha512-KTDyRTYX8sWmKXAikPHHSyc63CRPETMctyjKFupcC6OBLXT3xsN0e9aF7m+mIXutFWpUXuedtowG7iLOzp0kQg==
- Texts: [undici-types@8.9.0: LICENSE](#license-fe64958bfaef10b1)

### web-streams-polyfill@3.3.3

- License: MIT
- Copyright: Copyright (c) 2024 Mattias Buelens; Copyright (c) 2016 Diwank Singh Tomer
- Source: https://github.com/MattiasBuelens/web-streams-polyfill
- Published package: https://registry.npmjs.org/web-streams-polyfill/-/web-streams-polyfill-3.3.3.tgz
- Integrity: sha512-d2JWLCivmZYTSIoge9MsgFCZrt571BikcWGYkjC1khllbTeDlGqZ2D8vD8E/lJa8WGWbb7Plm8/XJYV7IJHZZw==
- Texts: [web-streams-polyfill@3.3.3: LICENSE](#license-fda0e18e4dc72fbc)

### ws@8.22.1

- License: MIT
- Copyright: Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com>; Copyright (c) 2013 Arnout Kazemier and contributors; Copyright (c) 2016 Luigi Pinca and contributors
- Source: https://github.com/websockets/ws
- Published package: https://registry.npmjs.org/ws/-/ws-8.22.1.tgz
- Integrity: sha512-oyL6OPYme/CmiFvNuGzeoxCJ4nOrZE2O1FwM9MWM1AsGri6nLXB2pg+lNA8aLeXMSav0J6eIVS1j6vUPzUtK9g==
- Texts: [ws@8.22.1: LICENSE](#license-7adebaeee45b60d9)

### yaml@2.9.1

- License: ISC
- Copyright: No separate copyright line in supplied license; package author: Eemeli Aro <eemeli@gmail.com>.
- Source: https://github.com/eemeli/yaml
- Published package: https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz
- Integrity: sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==
- Texts: [yaml@2.9.1: LICENSE](#license-cf12d35c36bad4b2)

### zod@4.6.7

- License: MIT
- Copyright: Copyright (c) 2025 Colin McDonnell
- Source: https://github.com/colinhacks/zod
- Published package: https://registry.npmjs.org/zod/-/zod-4.6.7.tgz
- Integrity: sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==
- Texts: [zod@4.6.7: LICENSE](#license-f61cacc2acb8b71a)

### zod-to-json-schema@3.25.2

- License: ISC
- Copyright: Copyright (c) 2020, Stefan Terdell
- Source: https://github.com/StefanTerdell/zod-to-json-schema
- Published package: https://registry.npmjs.org/zod-to-json-schema/-/zod-to-json-schema-3.25.2.tgz
- Integrity: sha512-O/PgfnpT1xKSDeQYSCfRI5Gy3hPf91mKVDuYLUHZJMiDFptvP41MSnWofm8dnCm0256ZNfZIM7DSzuSMAFnjHA==
- Texts: [zod-to-json-schema@3.25.2: LICENSE](#license-80d3168ad2f70f6f)

## Full license and attribution texts

<a id="license-254d30170e964f2b"></a>

### @anthropic-ai/sdk@1.5.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2023 Anthropic, PBC.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-afc09511b38a57e5"></a>

### @anthropic-ai/sdk@1.5.0: LICENSE-MIT

```text
This repository changed its license from the MIT License to the Apache License, Version 2.0 (see LICENSE) in version 1.0.0 of the @anthropic-ai/sdk package. The MIT License below still applies to every version published under it, and to third-party contributions merged into this repository before the change.

--------------------------------------------------------------------------------

Copyright 2023 Anthropic, PBC.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-ed1710a9953cb1df"></a>

### @anthropic-ai/sdk@1.5.0: src/internal/qs/LICENSE.md; openai@6.26.0: src/internal/qs/LICENSE.md; openai@7.51.0: src/internal/qs/LICENSE.md

```text
BSD 3-Clause License

Copyright (c) 2014, Nathan LaFreniere and other [contributors](https://github.com/puruvj/neoqs/graphs/contributors) All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-711cb7cff0da93b9"></a>

### @aws-sdk/client-bedrock-runtime@3.1162.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "{}"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2018-2023 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-edea91454b811f12"></a>

### @aws-sdk/core@3.980.0: LICENSE; @aws-sdk/credential-provider-http@3.972.83: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE); @aws-sdk/credential-provider-login@3.972.88: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE); @aws-sdk/nested-clients@3.998.0: Apache-2.0 (same AWS SDK repository; @aws-sdk/core/LICENSE)

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-d82ceb8cbd004a2d"></a>

### @aws-sdk/credential-provider-env@3.972.81: LICENSE; @aws-sdk/credential-provider-ini@3.973.26: LICENSE; @aws-sdk/credential-provider-node@3.972.93: LICENSE; @aws-sdk/middleware-eventstream@3.972.36: LICENSE; @aws-sdk/token-providers@3.1162.0: LICENSE; @aws-sdk/types@3.975.0: LICENSE; @aws-sdk/xml-builder@3.972.42: LICENSE; @smithy/credential-provider-imds@4.5.2: LICENSE; @smithy/fetch-http-handler@5.8.0: LICENSE; @smithy/node-http-handler@4.14.2: LICENSE; @smithy/signature-v4@5.7.5: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "{}"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-2ef1e48ea743d9c8"></a>

### @aws-sdk/credential-provider-process@3.972.81: LICENSE; @aws-sdk/credential-provider-sso@3.973.25: LICENSE; @aws-sdk/credential-provider-web-identity@3.972.87: LICENSE; @aws-sdk/eventstream-handler-node@3.972.40: LICENSE; @aws-sdk/middleware-websocket@3.972.63: LICENSE; @aws-sdk/signature-v4-multi-region@3.996.51: LICENSE; @smithy/core@3.39.0: LICENSE; @smithy/types@4.20.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "{}"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-7fb46adff9025f55"></a>

### @aws/lambda-invoke-store@0.3.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.
```

<a id="license-8f08c824b2bb54ed"></a>

### @babel/runtime@7.29.13: LICENSE

```text
MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-9e5119523ee0db94"></a>

### @ghostery/adblocker@2.20.3: LICENSE; @ghostery/adblocker-content@2.20.3: LICENSE; @ghostery/adblocker-extended-selectors@2.20.3: LICENSE

```text
Copyright (c) 2017-present Ghostery GmbH. All rights reserved.

Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```

<a id="license-8e5d2847aa13d3d7"></a>

### @ghostery/url-parser@1.3.1: LICENSE

```text
Copyright (c) 2017-2025 Ghostery GmbH. All rights reserved.

Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```

<a id="license-283ea6cc2997a1a7"></a>

### @google/genai@1.52.0: LICENSE; @opentelemetry/api@1.10.0: LICENSE; @opentelemetry/semantic-conventions@1.44.0: LICENSE; dompurify@3.4.17: LICENSE; gaxios@7.3.1: LICENSE; gcp-metadata@8.1.2: LICENSE; google-auth-library@10.9.1: LICENSE; google-logging-utils@1.1.3: LICENSE; long@5.3.2: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-0457f5bcec3b3b21"></a>

### @mariozechner/pi-ai@0.73.1: https://raw.githubusercontent.com/badlogic/pi-mono/v0.73.1/LICENSE

```text
MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-d298496454d461ef"></a>

### @anthropic-ai/sdk@0.91.1: LICENSE

```text
Copyright 2023 Anthropic, PBC.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-7d52eae0c2f08865"></a>

### openai@6.26.0: LICENSE; openai@7.51.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2026 OpenAI

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-80d3168ad2f70f6f"></a>

### openai@6.26.0: src/_vendor/zod-to-json-schema/LICENSE; openai@7.51.0: src/_vendor/zod-to-json-schema/LICENSE; zod-to-json-schema@3.25.2: LICENSE

```text
ISC License

Copyright (c) 2020, Stefan Terdell

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

<a id="license-2ada3435165b8ecf"></a>

### @mistralai/mistralai@2.7.0: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2024 Mistral AI

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-4862adf2fcecd2ca"></a>

### @mozilla/readability@0.6.0: LICENSE.md

```text
Copyright (c) 2010 Arc90 Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

<a id="license-56c9299ed8fb2684"></a>

### @protobufjs/aspromise@1.1.2: LICENSE; @protobufjs/base64@1.1.2: LICENSE; @protobufjs/codegen@2.0.5: LICENSE; @protobufjs/eventemitter@1.1.1: LICENSE; @protobufjs/fetch@1.1.1: LICENSE; @protobufjs/float@1.0.2: LICENSE; @protobufjs/path@1.1.2: LICENSE; @protobufjs/pool@1.1.0: LICENSE; @protobufjs/utf8@1.1.2: LICENSE

```text
Copyright (c) 2016, Daniel Wirtz  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.
* Neither the name of its author, nor the names of its contributors
  may be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-4b89d4518bd135ab"></a>

### @remusao/guess-url-type@2.1.0: LICENSE; @remusao/small@2.1.0: LICENSE; @remusao/smaz@2.2.0: LICENSE; @remusao/smaz-compress@2.2.0: LICENSE; @remusao/smaz-decompress@2.2.0: LICENSE; @remusao/trie@2.1.0: LICENSE

```text
Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```

<a id="license-fe1812441c6de74f"></a>

### @stablelib/base64@1.0.1: LICENSE

```text
This software is licensed under the MIT license:

Copyright (C) 2016 Dmitry Chestnykh

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-9aa16b4c94b03354"></a>

### @tootallnate/quickjs-emscripten@0.23.0: LICENSE

```text
MIT License

quickjs-emscripten copyright (c) 2019 Jake Teton-Landis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-ff82c90f84945c60"></a>

### @types/node@26.6.6: LICENSE; @types/react@19.3.0: LICENSE; @types/trusted-types@2.0.7: LICENSE

```text
MIT License

    Copyright (c) Microsoft Corporation.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE
```

<a id="license-8e1c6bd583a7e67b"></a>

### @types/retry@0.12.0: LICENSE

```text
MIT License

    Copyright (c) Microsoft Corporation. All rights reserved.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE
```

<a id="license-8d8c55319c7729d5"></a>

### agent-base@7.1.4: LICENSE; degenerator@5.0.1: https://raw.githubusercontent.com/TooTallNate/proxy-agents/84e41e433b422cbe9f073952d8e16052eb9b0251/packages/degenerator/LICENSE; http-proxy-agent@7.0.2: LICENSE; https-proxy-agent@7.0.6: LICENSE; pac-resolver@7.0.1: LICENSE; proxy-agent@6.5.0: LICENSE; socks-proxy-agent@8.0.5: LICENSE

```text
(The MIT License)

Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-1d8ce38662b90ac2"></a>

### ast-types@0.13.4: LICENSE

```text
Copyright (c) 2013 Ben Newman <bn@cs.stanford.edu>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-ce471b4b8188bf22"></a>

### base64-js@1.5.1: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2014 Jameson Little

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

<a id="license-5b417c1f5ee99687"></a>

### basic-ftp@6.2.6: LICENSE.txt

```text
Copyright (c) 2019 Patrick Juchli

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-7ed7c157c4174119"></a>

### bignumber.js@9.3.1: LICENCE.md

```text
The MIT License (MIT)
=====================

Copyright © `<2025>` `Michael Mclaughlin`

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-0139f2c14d4ec161"></a>

### bowser@2.15.0: LICENSE

```text
Copyright 2015, Dustin Diaz (the "Original Author")
All rights reserved.

MIT License

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

Distributions of all or part of the Software intended to be used
by the recipients as they would use the unmodified Software,
containing modifications that substantially alter, remove, or
disable functionality of the Software, outside of the documented
configuration mechanisms provided by the Software, shall be
modified such that the Original Author's bug reporting email
addresses and urls are either replaced with the contact information
of the parties responsible for the changes, or removed entirely.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.


Except where noted, this license applies to any and all software
programs and associated documentation files created by the
Original Author, when distributed with the Software.
```

<a id="license-2c44cee9bf9dfda2"></a>

### buffer-equal-constant-time@1.0.1: LICENSE.txt

```text
Copyright (c) 2013, GoInstant Inc., a salesforce.com company
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

* Neither the name of salesforce.com, nor GoInstant, nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-1529f88b36750950"></a>

### chalk@5.6.2: license

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-9a08965c44ca16aa"></a>

### cron-parser@5.10.3: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2014-2023 Harri Siirak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-6a972b33787e1430"></a>

### csstype@3.2.3: LICENSE

```text
Copyright (c) 2017-2018 Fredrik Nicol

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-29308c08926e2139"></a>

### data-uri-to-buffer@4.0.1: README.md — License; get-uri@6.0.5: LICENSE; data-uri-to-buffer@6.0.2: LICENSE; pac-proxy-agent@7.2.0: LICENSE

```text
(The MIT License)

Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-d9e5aa2747f30eae"></a>

### debug@4.4.3: LICENSE

```text
(The MIT License)

Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca>
Copyright (c) 2018-2021 Josh Junon

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the 'Software'), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-ef7eb99d9a97cb70"></a>

### diff@9.0.0: LICENSE

```text
BSD 3-Clause License

Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-c76f740d1521b9be"></a>

### dompurify@3.4.17: LICENSE-MPL

```text
Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in 
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```

<a id="license-8cd07c535061d09c"></a>

### dompurify@3.4.17: src/license_header

```text
/*! @license DOMPurify VERSION | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/VERSION/LICENSE */
```

<a id="license-50640bbffc177e09"></a>

### ecdsa-sig-formatter@1.0.11: LICENSE

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "{}"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2015 D2L Corporation

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

<a id="license-7e01abe3636c5b46"></a>

### escodegen@2.1.0: LICENSE.BSD

```text
Copyright (C) 2012 Yusuke Suzuki (twitter: @Constellation) and other contributors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-a2cca9d62545047a"></a>

### esprima@4.0.1: LICENSE.BSD

```text
Copyright JS Foundation and other contributors, https://js.foundation/

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-d0b1e75b0f84d904"></a>

### estraverse@5.3.0: LICENSE.BSD; esutils@2.0.3: LICENSE.BSD

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-b079b743d39aa524"></a>

### extend@3.0.2: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2014 Stefan Thomas

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-79d0fc44716007dd"></a>

### fast-sha256@1.3.0: LICENSE

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org>
```

<a id="license-da98afd61ac876b4"></a>

### fetch-blob@3.2.0: LICENSE

```text
MIT License

Copyright (c) 2019 David Frank

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-95b423fd389e2fa9"></a>

### formdata-polyfill@4.0.10: LICENSE

```text
MIT License

Copyright (c) 2016 Jimmy Karl Roland Wärting

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-02d42589c6442c04"></a>

### ip-address@10.7.6: LICENSE

```text
Copyright (C) 2011 by Beau Gunderson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

<a id="license-faa1180b6bfee49c"></a>

### json-bigint@1.0.0: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2013 Andrey Sidorov

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-3d1a950648d86f21"></a>

### json-schema-to-ts@3.1.1: LICENSE; ts-algebra@2.0.0: LICENSE

```text
MIT License

Copyright (c) 2020 Thomas Aribart

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-960502165e03cfa4"></a>

### jwa@2.0.1: LICENSE; jws@4.0.1: LICENSE

```text
Copyright (c) 2013 Brian J. Brennan

Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to use, 
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the 
Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-ee35498e6684b30c"></a>

### lucide-react@1.69.0: LICENSE

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-f8f62778c92d145b"></a>

### luxon@3.7.2: LICENSE.md

```text
Copyright 2019 JS Foundation and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-dd923de9769808b2"></a>

### marked@18.1.3: LICENSE

```text
# License information

## Contribution License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## Marked

Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/)
Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Markdown

Copyright © 2004, John Gruber
http://daringfireball.net/
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name “Markdown” nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

This software is provided by the copyright holders and contributors “as is” and any express or implied warranties, including, but not limited to, the implied warranties of merchantability and fitness for a particular purpose are disclaimed. In no event shall the copyright owner or contributors be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute goods or services; loss of use, data, or profits; or business interruption) however caused and on any theory of liability, whether in contract, strict liability, or tort (including negligence or otherwise) arising in any way out of the use of this software, even if advised of the possibility of such damage.
```

<a id="license-e91069c31b4e4dae"></a>

### ms@2.1.3: license.md

```text
The MIT License (MIT)

Copyright (c) 2020 Vercel, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-723718aa866c767e"></a>

### netmask@2.1.1: LICENSE.md

```text
MIT License

Copyright (c) 2011 Olivier Poitrey rs@rhapsodyk.net

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-8c46e0985782a28a"></a>

### node-domexception@1.0.0: LICENSE

```text
MIT License

Copyright (c) 2021 Jimmy Wärting

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-399cbcc4b8a2e0e6"></a>

### node-fetch@3.3.2: LICENSE.md

```text
The MIT License (MIT)

Copyright (c) 2016 - 2020 Node Fetch Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-b72c84b52e8fcbda"></a>

### openai@7.51.0: src/_vendor/partial-json-parser/LICENSE; partial-json@0.1.7: LICENSE

```text
MIT License

Copyright (c) 2023 Promplate Dev Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-c9808a775260db56"></a>

### p-retry@4.6.2: license

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-8de25314f46efde7"></a>

### protobufjs@7.6.6: google/LICENSE

```text
Copyright 2014, Google Inc.  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
    * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-79157668b3601926"></a>

### protobufjs@7.6.6: LICENSE

```text
This license applies to all parts of protobuf.js except those files
either explicitly including or referencing a different license or
located in a directory containing a different LICENSE file.

---

Copyright (c) 2016, Daniel Wirtz  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

* Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.
* Neither the name of its author, nor the names of its contributors
  may be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

Code generated by the command line utilities is owned by the owner
of the input file used when generating it. This code is not
standalone and requires a support library to be linked with it. This
support library is itself covered by the above license.
```

<a id="license-9647e3a9f36678c1"></a>

### lru-cache@7.18.3: LICENSE

```text
The ISC License

Copyright (c) 2010-2023 Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

<a id="license-6e2ce8b28e108ee2"></a>

### proxy-from-env@1.1.0: LICENSE

```text
The MIT License

Copyright (C) 2016-2018 Rob Wu <rob@robwu.nl>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-cf9b17822d1fcd4f"></a>

### react@19.3.1: LICENSE; react-dom@19.3.1: LICENSE; scheduler@0.28.0: LICENSE

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-1418710b026fba5a"></a>

### retry@0.13.1: License

```text
Copyright (c) 2011:
Tim Koschützki (tim@debuggable.com)
Felix Geisendörfer (felix@debuggable.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
```

<a id="license-dff1a84cb7036527"></a>

### safe-buffer@5.2.1: LICENSE

```text
The MIT License (MIT)

Copyright (c) Feross Aboukhadijeh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

<a id="license-3065255dab8c2013"></a>

### smart-buffer@4.2.0: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2013-2017 Josh Glazebrook

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-6830463c2795eced"></a>

### socks@2.8.10: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2013 Josh Glazebrook

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-6ead954f96723337"></a>

### source-map@0.6.1: LICENSE

```text
Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

<a id="license-a75b82e8d3d568f9"></a>

### standardwebhooks@1.1.1: https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/ab6844147ce9cdb0d2dbf2e60d1ea85001fd2554/libraries/LICENSE

```text
The MIT License

Copyright (c) 2023 Svix (https://www.svix.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

<a id="license-417c6c9f11c44a2e"></a>

### tldts@7.4.19: LICENSE; tldts-core@7.4.20: LICENSE; tldts-experimental@7.4.19: LICENSE

```text
Copyright (c) 2017 Thomas Parisot, 2018 Rémi Berson

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-0e8d2550baea17eb"></a>

### tslib@2.9.1: LICENSE.txt

```text
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

<a id="license-e8a7cc256941a26b"></a>

### typebox@1.4.4: license

```text
TypeBox

The MIT License (MIT)

Copyright (c) 2017-2026 Haydn Paterson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

<a id="license-128272029be15e88"></a>

### undici@7.30.2: lib/web/fetch/LICENSE

```text
MIT License

Copyright (c) 2020 Ethan Arrowood

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-fe64958bfaef10b1"></a>

### undici@7.30.2: LICENSE; undici-types@8.9.0: LICENSE

```text
MIT License

Copyright (c) Matteo Collina and Undici contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-fda0e18e4dc72fbc"></a>

### web-streams-polyfill@3.3.3: LICENSE

```text
The MIT License (MIT)

Copyright (c) 2024 Mattias Buelens
Copyright (c) 2016 Diwank Singh Tomer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-7adebaeee45b60d9"></a>

### ws@8.22.1: LICENSE

```text
Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com>
Copyright (c) 2013 Arnout Kazemier and contributors
Copyright (c) 2016 Luigi Pinca and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

<a id="license-cf12d35c36bad4b2"></a>

### yaml@2.9.1: LICENSE

```text
Copyright Eemeli Aro <eemeli@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

<a id="license-f61cacc2acb8b71a"></a>

### zod@4.6.7: LICENSE

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-05d27e17d7bda00d"></a>

### Geist 1.9.1 — SIL OFL-1.1

```text
Copyright (c) 2023 Vercel, in collaboration with basement.studio

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

<a id="license-8c91e378199faba6"></a>

### @lobehub/icons-static-svg 1.102.0 — MIT

```text
# Provider logos

`claude-color.svg`, `openai.svg`, `githubcopilot.svg`, `gemini-color.svg`, `openrouter.svg`, `ollama.svg` are copied unmodified from `@lobehub/icons-static-svg@1.102.0` (`icons/`).
Upstream: https://github.com/lobehub/lobe-icons. The marks are trademarks of their owners.

MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-80fecce6af054964"></a>

### Runtime dangerous-site feeds — Unlicense / MIT

```text
Heisen dangerous-site protection — third-party list notices

The updater downloads the following public domain-name feeds. Visited URLs,
paths, query strings and browsing history are never sent to these services.
Lookup is local in safebrowsing/safebrowsing.sqlite. Lists are checked after
15 seconds and hourly thereafter, with a twelve-hour per-feed freshness window
and conditional ETag requests. Failed updates retain the last good list; first
launch offline has no list and does not block. Session exceptions do not persist.
No feed snapshot is bundled. This notice is shipped in dist/filters.

Sources verified 2026-11-07 (sizes are observations, not integrity assertions):
The Block List Project — Unlicense (NOT MIT)
https://github.com/blocklistproject/Lists
https://raw.githubusercontent.com/blocklistproject/Lists/master/LICENSE
https://blocklistproject.github.io/Lists/alt-version/malware-nl.txt — 50,910,539 bytes
https://blocklistproject.github.io/Lists/alt-version/phishing-nl.txt — 4,164,418 bytes
https://blocklistproject.github.io/Lists/alt-version/scam-nl.txt — 155,461 bytes
https://blocklistproject.github.io/Lists/alt-version/ransomware-nl.txt — 51,534 bytes
https://blocklistproject.github.io/Lists/alt-version/fraud-nl.txt — 5,657,997 bytes

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>

Phishing.Database — MIT License
https://github.com/Phishing-Database/Phishing.Database
https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/LICENSE
https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt — 11,023,128 bytes

MIT License

Copyright (c) 2018-2025 Mitchell Krog - github.com/mitchellkrogza
Copyright (c) 2018-2025 Nissar Chababy - github.com/funilrys
Copyright (c) 2018-2025 Phishing.Database Contributors - github.com/Phishing-Database

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<a id="license-3243eb9e11d15545"></a>

### EasyList / EasyPrivacy — CC BY-SA 3.0 attribution

```text
EasyList / EasyPrivacy — © The EasyList authors, https://easylist.to
CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/) (dual GPLv3).
Distributed here under CC BY-SA 3.0; the compiled filter data retains that license.
Unmodified lists compiled into Heisen's blocking engine on 2026-11-06.
Only network filters are compiled; cosmetic filters are excluded.
Sources: https://easylist.to/easylist/easyprivacy.txt
         https://easylist.to/easylist/easylist.txt
Licensing: https://easylist.to/pages/licence.html
Fetch dates, source versions, SHA-256 digests and sizes: VERSIONS.json.
Refresh manually with npm run filters; normal builds and runtime do not fetch lists.

@ghostery/adblocker — Ghostery — MPL-2.0, used without source modifications.
Source: https://github.com/ghostery/adblocker
License: https://www.mozilla.org/MPL/2.0/

tldts — Rémi Berson — MIT.
Source and license: https://github.com/remusao/tldts

@mozilla/readability — Mozilla — Apache-2.0.
Source: https://github.com/mozilla/readability
License: https://www.apache.org/licenses/LICENSE-2.0

yaml — Eemeli Aro — ISC.
Source and license: https://github.com/eemeli/yaml

diff — BSD-3-Clause.
Source and license: https://github.com/kpdecker/jsdiff

Bundled dependency license texts are included in THIRD_PARTY_NOTICES.txt.
```
