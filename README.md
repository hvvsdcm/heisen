# Heisen 0.5

Heisen은 Electron 45 / Chromium 156을 포함한 macOS·Windows용 브라우저입니다. 외부 Chrome이나 Aside를 실행하지 않고 자체 창·탭·프로필을 사용합니다. **Chromium 소스 포크가 아니라 Electron 내장 Chromium을 사용하는 앱**입니다.

## 면책 고지 / Disclaimer

> [!WARNING]
> 이 소프트웨어는 [MIT 라이선스](LICENSE)로 공개되며 **있는 그대로(AS IS)** 제공됩니다. 상품성, 특정 목적 적합성, 권리 비침해를 포함한 어떠한 명시적·묵시적 보증도 하지 않습니다.
>
> **설치·빌드·수정·배포·사용에 따르는 모든 위험과 책임은 전적으로 사용자에게 있습니다.** 작성자와 기여자는 이 소프트웨어로 인해 생긴 어떠한 손해에도 책임지지 않습니다. 여기에는 데이터·비밀번호·쿠키의 손실이나 유출, 계정 정지·제한, AI 제공자 이용 요금, 기기·시스템 문제, 제3자와의 분쟁이 포함되며 이에 한정되지 않습니다.
>
> 특히 다음 기능은 위험을 이해한 뒤 스스로 판단해 사용하세요.
>
> - 다른 브라우저의 비밀번호·쿠키 가져오기, 비밀번호 관리자, 자동 회원가입
> - AI 에이전트의 웹 조작, MCP·CLI 제어, 컴퓨터 제어(Computer Use)
> - Claude·ChatGPT·GitHub Copilot 등 구독 계정 로그인. 각 서비스 약관이 서드파티 앱 사용을 제한할 수 있으며 계정 제재 위험은 사용자에게 있습니다.
> - 서명·공증되지 않은 빌드 실행
>
> 이 프로젝트는 Anthropic, OpenAI, GitHub, Google 및 문서에 언급된 다른 브라우저·서비스와 관련이 없고 그들의 보증을 받지 않았습니다.
>
> This software is provided "AS IS", without warranty of any kind, express or implied. **You use it entirely at your own risk.** In no event shall the authors or contributors be liable for any claim, damages, or other liability (including data or credential loss, account suspension, provider charges, or system damage) arising from the use of this software. Not affiliated with or endorsed by any company or service mentioned.

## 설치와 실행

버전은 `0.5.2`, bundle id는 `com.heisen.browser`입니다. macOS는 Apple Silicon·Intel용 DMG, Windows는 x64·arm64용 Setup.exe를 만듭니다. macOS 앱은 응용 프로그램 폴더로 옮겨 실행하고 Windows는 설치 프로그램을 실행합니다. 서명·공증 자동화는 준비되어 있지만 Developer ID·Authenticode 자격을 적용한 공개 배포판의 검증과는 별개입니다.

소스에서 실행하려면 프로젝트 폴더에서 다음 명령을 실행합니다. 개발·테스트에는 Node.js 24 이상을 사용합니다. 설치된 앱을 제어하는 독립 CLI는 시스템 Node.js 22 이상이 필요합니다.

```sh
npm ci
npm run build
npm start
```

코드 실행 기능에는 실행 중인 Docker와 `runtime-images.json`에 지정된 이미지가 필요합니다. 일반 웹 탐색에는 Docker가 필요하지 않습니다. 이미지 준비 명령은 다음과 같습니다.

```sh
node -e 'for (const v of Object.values(require("./runtime-images.json"))) console.log(v)' | while IFS= read -r image; do docker pull "$image"; done
```

계정·API 키·로그인 쿠키·기존 브라우저 데이터는 배포본에 포함하지 않습니다.

오픈소스 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 설정 › Heisen 정보 › 오픈소스 라이선스에서 볼 수 있습니다. 의존성·에셋 변경 후 `node scripts/notices.mjs`로 갱신합니다.

### 패키지 빌드

먼저 `npm run build`로 소스를 빌드합니다. 패키징은 macOS Apple silicon(`arm64`)과 Intel(`x64`) 앱을 모두 만들며, 각 앱의 서명 검증을 마친 뒤 설치용 DMG를 생성합니다.

| 명령 | 출력 | 용도 |
|---|---|---|
| `npm run package` | `release/Heisen-darwin-{arm64,x64}/Heisen.app`, `release/Heisen-<version>-mac-{arm64,x64}.dmg` | 배포용. Electron 퓨즈를 바꾸고 hardened runtime으로 서명 |
| `HEISEN_UNFUSED=1 npm run package` | `release-test/Heisen-darwin-{arm64,x64}/Heisen.app`, `release-test/Heisen-<version>-mac-{arm64,x64}.dmg` | 패키지 E2E용. 퓨즈만 Electron 기본값이고 나머지 과정은 같음 |
| `npm run package:win` | `release/Heisen-win32-{x64,arm64}/Heisen.exe`, `release/Heisen-<version>-win-{x64,arm64}-Setup.exe` | Windows Squirrel 설치 프로그램. Windows에서 실행 |

`{arm64,x64}`는 아키텍처별 출력, `<version>`은 `package.json`의 버전입니다. 현재 macOS DMG는 `Heisen-0.5.2-mac-arm64.dmg`, `Heisen-0.5.2-mac-x64.dmg`입니다. DMG의 `Heisen.app`을 `Applications` 링크로 옮깁니다. 각 설치 파일의 SHA-256은 출력 폴더의 `SHA256SUMS.txt`에 기록됩니다. macOS에서는 그 폴더에서 `shasum -a 256 -c SHA256SUMS.txt`로 확인합니다. Windows 테스트 패키지도 `HEISEN_UNFUSED=1`이면 `release-test/`에 생성됩니다.

배포용 빌드의 설정은 다음과 같습니다.

- 퓨즈: `RunAsNode`, `NODE_OPTIONS` 환경 변수, `--inspect` 계열 인수를 끕니다. ASAR 무결성 검사, ASAR에서만 앱 로드, 쿠키 암호화를 켭니다.
- macOS 서명: 안쪽 Mach-O 파일부터 앱 번들까지 hardened runtime으로 서명하고 `codesign --verify --deep --strict`로 확인합니다. Developer ID용 entitlements는 JIT·카메라·마이크·위치이며 로컬/ad-hoc 서명에만 라이브러리 검증 해제를 추가합니다.
- 서명 인증서: `~/Library/Keychains/heisen-signing.keychain-db`에 자체 서명 인증서 **Heisen Local Signing**이 있으면 그것으로 서명합니다(키체인 암호는 `~/.heisen-signing/keychain-password`). 서명 요구 조건이 `bundle id + 인증서`로 고정되므로, 키체인의 **Heisen Safe Storage** 접근을 한 번 **항상 허용**하면 다시 빌드해도 묻지 않습니다. 인증서가 없으면 ad-hoc으로 서명하며, 이때는 빌드할 때마다 해시가 바뀌어 키체인이 다시 묻습니다. 인증서는 `openssl req -x509`(extendedKeyUsage=codeSigning)로 만들어 전용 키체인에 `security import … -T /usr/bin/codesign`과 `security set-key-partition-list -S apple-tool:,apple:,codesign:`로 넣습니다.
- Claude Code 실행 파일을 포함하지 않습니다. 구독 인증과 모델 호출은 pi-ai를 사용합니다.
- Chromium UI 로캘은 `en`, `ko`, `Base`만 남깁니다.
- 패키지 앱을 기본 프로필로 실행할 때 `--remote-debugging-port` 또는 `--remote-debugging-pipe` 스위치가 있으면 바로 종료합니다. `HEISEN_DATA_DIR`로 지정한 격리 프로필에서는 허용합니다.
- `HEISEN_DATA_DIR`는 격리 프로필입니다. macOS에서는 로그인 키체인 대신 Chromium mock keychain을 사용하므로 `secrets.json`과 그 키로 봉인한 데이터도 실제 키체인으로 보호되지 않습니다. 테스트 전용으로 사용하세요.
- `HEISEN_DATA_DIR` 격리 프로필은 macOS 창 복원(`ApplePersistenceIgnoreState`, 해당 프로세스에만 적용)을 끕니다. 실행 직후 비정상 종료한 앱을 다음에 실행하면 macOS가 `ready` 전에 "창을 다시 열까요?" 경고창을 띄우는데, 자동화 실행에서는 아무도 누르지 않아 창 없이 멈추기 때문입니다. Heisen은 탭을 자체 복원하므로 이 설정으로 잃는 것이 없습니다. 기본 프로필 실행은 그대로이며, 같은 bundle id를 쓰므로 테스트 중 비정상 종료가 있으면 다음 사용자 실행에서 이 경고창이 한 번 뜰 수 있습니다.

배포용 `release/`는 `--inspect`가 막혀 Playwright로 제어할 수 없습니다. 패키지 E2E는 테스트 빌드로 실행합니다.

```sh
npm run build
HEISEN_UNFUSED=1 npm run package
HEISEN_EXECUTABLE=release-test/Heisen-darwin-arm64/Heisen.app/Contents/MacOS/Heisen npm run test:e2e
```

E2E는 기본으로 `HEISEN_TEST_BACKGROUND=1`을 설정합니다. macOS에서는 Dock 아이콘 없이 투명하고 클릭을 가로채지 않는 창을 비활성 상태로 표시하며 페이지 렌더링·스크린샷·자동 입력은 유지됩니다. 네이티브 전체 화면 전환과 창 포커스·포커스된 창의 메뉴 전달 검사는 백그라운드에서 `SKIP (visible-only)`로 표시합니다. 이 검사와 화면 디버깅은 `HEISEN_TEST_VISIBLE=1 npm run test:e2e`로 실행합니다. 백그라운드 모드는 개발 실행과 `release-test/`에서만 허용되고 배포용 `release/`에서는 무시됩니다. 패키징은 기존 `dist/`를 사용하므로 소스나 로그인 화면을 바꾼 뒤에는 위 순서대로 먼저 `npm run build`를 실행해야 합니다.

### 릴리스에 필요한 사용자 준비

| 항목 | 준비 및 설정 |
|---|---|
| macOS 서명·공증 | Apple Developer ID Application 인증서를 설치하고 `HEISEN_SIGN_IDENTITY`에 인증서 이름을 지정합니다. `notarytool`에 저장한 키체인 프로필을 `HEISEN_NOTARY_PROFILE`로 지정합니다. 둘 다 있을 때 DMG 제출·공증 결과 확인·staple을 수행합니다 |
| Windows 서명 | Authenticode 인증서를 준비하고 `HEISEN_WIN_SIGN`에 **signtool 매개변수만** 지정합니다(예: `/tr http://timestamp.digicert.com /td sha256 /fd sha256 /sha1 <지문>`). `signtool sign` 명령 자체는 넣지 않습니다 |
| 업데이트 릴리스 키 백업 | Ed25519 개인키는 이 Mac 로그인 키체인의 서비스 `heisen-release-key`, 계정 `heisen`에 있습니다. 안전한 별도 위치에 백업해야 합니다. 공개키는 `src/release-key.ts`에 있으며 개인키 유실 시 기존 설치본이 새 키를 자동 신뢰하지 않습니다 |
| 공개 macOS 서명 인증서 백업 | 공증 없이 배포하는 macOS 앱은 **Heisen Local Signing**(`~/Library/Keychains/heisen-signing.keychain-db`, 암호 `~/.heisen-signing/keychain-password`)으로 서명합니다. 설치본의 키체인 허용은 이 인증서에 묶이므로 둘 다 백업해야 합니다. 잃으면 새 인증서로 낸 업데이트에서 사용자가 키체인 접근을 다시 허용해야 합니다 |
| DRM(선택) | castlabs Electron과 VMP 서명 자격이 필요합니다. 현재 DRM은 미지원이며 도입 여부·계약은 별도입니다 |

macOS 배포 예: `HEISEN_SIGN_IDENTITY='Developer ID Application: 이름 (TEAMID)' HEISEN_NOTARY_PROFILE=heisen-notary npm run package`. 자격이 없으면 로컬 자체 서명/ad-hoc 또는 Windows 무서명 설치 파일이며 Gatekeeper·SmartScreen 경고를 없앤 배포판으로 볼 수 없습니다. 서명 업데이트 매니페스트는 발행 후 **14일**에 만료됩니다(클라이언트 시계 오차 허용 5분). 새 버전이 없어도 만료 전에 재발행해야 합니다.

### Windows PC 작업

`scripts/pc.mjs`는 SSH/SCP로 별도 Windows 작업 폴더를 관리합니다. PC에는 Node.js 24 이상, Git, .NET Framework 4.6.2 이상이 필요합니다. 대화형 E2E에는 SSH 계정이 Windows 데스크톱에 로그인되어 있어야 하며, `tests/desktop.ts`의 컨테이너 구간에는 실행 중인 Docker Desktop과 런타임 이미지가 필요합니다.

```sh
node scripts/pc.mjs sync --host pc --dir heisen-ci
node scripts/pc.mjs install --host pc --dir heisen-ci
node scripts/pc.mjs test --host pc --dir heisen-ci
node scripts/pc.mjs package --host pc --dir heisen-ci
node scripts/pc.mjs e2e --host pc --dir heisen-ci
node scripts/pc.mjs fetch --host pc --dir heisen-ci
```

- `--dir`는 `%USERPROFILE%` 바로 아래의 전용 폴더 이름입니다. 기존 사용자 저장소·Desktop을 지정하지 않습니다. 스크립트가 소유 표식을 확인하고 `source/repo`와 실행 로그 폴더를 관리합니다.
- `sync`는 로컬 HEAD가 원격 `main`의 공개된 HEAD와 같을 때만 Git bundle로 옮깁니다. 미커밋 변경은 제외하며 스크립트가 push하지 않습니다. 원격 추적 파일의 변경이 있으면 덮어쓰지 않습니다.
- `install`은 `npm ci`, `test`는 typecheck·단위 테스트, `package`는 build·Windows 패키징, `e2e`는 대화형 예약 작업으로 `tests/desktop.ts`, `fetch`는 설치 파일·체크섬 수집입니다. `package`·`fetch`만 `--unfused`를 받습니다. 로그·스크린샷은 로컬 임시 폴더 `heisen-pc/<host>/<실행 ID>/`로 수집합니다.

## 로그인

Google 계정으로 로그인하면 누구나 사용할 수 있습니다. 초대 코드는 필요하지 않습니다. 유효한 세션이 없으면 **Heisen 로그인** 화면이 열리며, 로그인 전에는 탭 복원·루틴·MCP 서버와 첫 실행 설정이 시작되지 않습니다.

**Google 계정으로 계속**을 누르고 로그인하면 창이 닫히고 브라우저가 열립니다. 서버가 계정을 미승인으로 응답하는 경우에만 호환용 초대 코드 화면이 표시됩니다. 이후에는 시작할 때와 실행 중 6시간마다 서버에서 세션을 확인합니다.

- 서버에 연결할 수 없어도 마지막 확인 후 7일까지는 그대로 쓸 수 있습니다. 이때 **설정 > Heisen 정보**에 `오프라인 · 마지막 확인 <날짜>`가 표시됩니다. 7일이 지나면 **다시 시도**·**로그아웃** 화면이 나옵니다.
- 서버가 세션을 해지하거나 계정을 중지하면 다음 확인에서 로그인 화면으로 돌아갑니다. 열려 있던 탭은 다시 로그인하면 그대로 보입니다.
- 로그아웃은 **설정 > Heisen 정보 > 베타 계정 > 로그아웃**입니다. 서버의 세션도 해지합니다.
- 세션 토큰은 `secrets.json`에 암호화해 저장하며 로그와 화면 상태에 넣지 않습니다. Google이 앱 안 로그인 창을 막기 때문에 로그인은 시스템 기본 브라우저에서 하고, 결과는 `127.0.0.1`의 임시 포트로 앱에 돌아옵니다(10분 뒤 닫힘).
- 배포 빌드(`npm run package` → `release/`)는 항상 `https://heisen.dev`를 사용합니다. `HEISEN_BETA_URL` 환경 변수는 개발 실행(`npm start`)과 테스트 패키지(`HEISEN_UNFUSED=1` → `release-test/`)에서만 읽습니다. http(s) 주소면 그 서버(예: 로컬 `wrangler dev`)를 쓰고, `skip`이면 로그인 화면 없이 시작합니다. 기존 E2E는 `skip`으로 실행합니다.

```sh
HEISEN_BETA_URL=http://localhost:8787 npm start
```

## 첫 실행

### Own 데이터 이관

새 Heisen 프로필이 없고 기존 Own의 `library.json`이 있으면 이관을 시도합니다. Own이 실행 중이면 먼저 종료하라는 창이 나옵니다. **다시 확인**으로 계속하거나 **옮기지 않음**으로 건너뜁니다. 원본 Own 폴더는 수정하지 않습니다.

- 북마크·방문 기록·탭·메모리·루틴·작업 기록·작업 파일과 웹 탭 세션 폴더 `Partitions/browser/`(쿠키, Local Storage, IndexedDB 등)를 복사합니다.
- 캐시(`Cache`, `Code Cache`, `GPUCache`, `CacheStorage`, `blob_storage` 등)는 어느 위치에 있든 복사하지 않습니다. 앱 UI 세션이 쓰는 프로필 최상위 파일(`Cookies`, `Local Storage`, `IndexedDB`, `Local State`, `Preferences` 등)도 복사하지 않습니다.
- 웹 탭 쿠키를 복사해도 웹사이트 로그인이 유지된다고 보장하지 않습니다. 실제 Own 프로필로는 확인하지 않았습니다.
- 작업 기록에 저장된 작업 폴더 경로는 Heisen 프로필 경로로 바꿉니다.
- 비밀번호와 계정 연결은 별도 동의를 받은 뒤 기존 암호문을 읽어 Heisen용으로 다시 암호화합니다. 거부하거나 실패하면 기존 암호문을 `secrets.own.json`으로 보관하고 해당 연결 없이 시작합니다.
- 복사 중 오류가 나면 **다시 시도** 또는 **건너뛰기**를 묻습니다. 건너뛰면 일부만 복사된 `tasks.sqlite`를 지우고 이관하지 않은 것으로 기록합니다.
- 결과는 `migration.json`에 기록하며 완료하거나 건너뛴 이관을 다음 실행에서 반복하지 않습니다.

### 첫 실행 설정

처음 실행하면 **Heisen 시작** 창이 단계별로 열립니다. 이전 버전에서 쓰던 프로필에도 한 번 표시합니다. 각 단계의 선택은 **다음**·**가져오기**·**완료**를 누를 때 바로 적용됩니다. 닫기·Esc·**건너뛰기**는 남은 단계를 기본값으로 두고 끝냅니다.

1. **비밀번호**: **비밀번호 저장 및 자동 완성** 켜기/끄기(기본 켜짐).
2. **가져오기**: 감지된 브라우저 프로필과 **북마크**·**저장된 비밀번호**·**방문 기록**·**쿠키**(모두 기본 선택)를 골라 가져옵니다. 감지된 브라우저가 없거나 이전에 첫 실행 가져오기 창을 본 프로필에서는 생략합니다.
3. **자동 회원가입**: 기본 이메일과 비밀번호 방식(**자동 생성** 또는 **지정한 비밀번호 세트**). 1단계에서 비밀번호 저장을 끄면 생략합니다.

### 북마크 및 설정 가져오기

첫 실행 설정의 **가져오기** 단계에서 가져올 수 있습니다. 나중에는 **설정 > 자동 완성 및 비밀번호 > 북마크 및 설정 가져오기** 또는 **북마크 > 북마크 및 설정 가져오기…**에서 열 수 있습니다.

- 브라우저·프로필을 고르고 **방문 기록**, **북마크**, **저장된 비밀번호**, **쿠키** 중 가져올 항목을 선택합니다.
- Chrome, Chromium, Brave, Microsoft Edge, Vivaldi, Arc, Dia, Comet, Aside, Helium, Opera의 로컬 프로필 탐지·읽기가 구현되어 있습니다. 실제 사용자 프로필 호환성을 모두 검증한 것은 아닙니다.
- 비밀번호·쿠키 복호화에 필요한 키를 읽을 때 macOS 키체인 창이 열릴 수 있습니다. 요청 앱이 Heisen이 아니라 **`security`**로 표시되며 로그인 암호를 요구할 수 있습니다. **항상 허용** 대신 **허용**을 권합니다. 항상 허용은 해당 키체인 항목에 대한 `security` 도구의 지속 접근을 허용합니다.
- 쿠키를 선택하면 Heisen에 있는 같은 이름·도메인·경로의 쿠키를 덮어쓸 수 있습니다. 가져온 쿠키만으로 모든 사이트의 로그인이 복원되는 것은 아닙니다.
- 비밀번호를 가져온 프로필은 이후 앱 시작 시 또는 **비밀번호 관리자**를 열 때 변경된 비밀번호를 추가·갱신합니다. 원본에서 삭제된 비밀번호를 Heisen에서 자동 삭제하지 않으며, 북마크·기록·쿠키를 계속 동기화하는 기능은 아닙니다.
- **CSV 파일에서 비밀번호 가져오기**도 지원합니다. Apple 암호 앱/Safari, Chrome, Firefox, 1Password, Bitwarden의 비밀번호 내보내기 형식을 읽습니다. CSV는 평문 파일이므로 보관·삭제에 주의하세요.
- Safari는 북마크·방문 기록, Firefox는 북마크·방문 기록·쿠키를 직접 가져옵니다. Safari 데이터 접근이 거부되면 macOS **전체 디스크 접근 권한** 안내를 따릅니다. Safari 쿠키·iCloud 키체인·Firefox 비밀번호는 직접 가져오지 않으며 비밀번호는 CSV를 사용합니다.
- Windows는 Chrome·Chromium·Brave·Edge·Vivaldi 프로필을 탐지합니다. DPAPI로 보호한 키와 v10 AES-GCM 데이터 읽기 경로가 있으며, app-bound v20 비밀번호는 우회하지 않고 CSV 가져오기를 안내합니다. 실제 사용자 DPAPI 가져오기는 미검증입니다.

로그인 필드를 클릭하거나 아래쪽 화살표 키를 누르면 저장된 계정 메뉴가 열립니다. 계정을 선택해야 채우며 페이지 로드만으로 입력하지 않습니다. 로그인 제출 뒤에는 비밀번호 저장·업데이트를 제안합니다.

가입·비밀번호 변경 양식의 새 비밀번호 필드를 클릭하면 메뉴 맨 위에 **강력한 비밀번호 사용**이 나옵니다. 양식 조건에 맞춰 Chrome 방식으로 만든 비밀번호를 모든 비밀번호 칸(확인 칸 포함)에 넣고 바로 저장합니다. 이어서 양식을 제출하면 저장 제안 없이 사용자 이름만 채웁니다.

**설정 > 자동 완성 및 비밀번호 > 비밀번호 저장 및 자동 완성**을 끄면 저장·업데이트 제안, 자동 완성 메뉴, 주소창 열쇠 아이콘, 가져온 프로필의 자동 동기화, 에이전트의 저장된 로그인·자동 회원가입이 멈춥니다. 저장된 비밀번호는 지우지 않으며 비밀번호 관리자에서 계속 보고 복사·삭제할 수 있습니다. 수동 가져오기와 CSV 가져오기는 꺼진 상태에서도 됩니다.

비밀번호 관리자에서 삭제한 비밀번호는 10초 동안 **실행취소**로 되돌릴 수 있습니다. 삭제한 계정은 출처·사용자 이름·삭제 시각만 암호화 저장소에 남겨, 이후 동기화·가져오기·CSV에서 다시 들어오지 않게 합니다. 원본 브라우저에서 삭제 이후 비밀번호를 바꾼 경우와 같은 계정을 직접 다시 저장한 경우에는 다시 추가합니다.

### 모델 연결

**설정 > AI 모델**에서 연결하고 사용할 제공자·모델을 선택합니다. Claude·OpenAI 행은 **API 연결**과 **구독제 연결**을 나눠 둡니다. **구독제 연결**이나 **로그인**을 누르면 연결할 계정을 먼저 고르고, 승인 페이지는 Heisen 탭에서 열립니다. 로그인과 동의는 사용자가 제공자의 화면에서 완료합니다.

| 연결 | 구현 방식 |
|---|---|
| OpenAI 구독제 (ChatGPT Plus/Pro) | pi-ai OAuth, openai-codex-responses |
| GitHub Copilot | pi-ai 기기 로그인과 구독 모델 |
| Claude 구독제 (Pro/Max) | pi-ai OAuth, Anthropic 모델 |
| Claude API / OpenAI / Google Gemini / OpenRouter | API 키 |
| Ollama / LM Studio | 이 컴퓨터의 loopback OpenAI 호환 API |

구독 로그인은 pi-ai OAuth를 사용하며 승인 페이지를 Heisen 탭에서 열어 가져온 로그인 세션을 재사용합니다. 모델 사용 가능 범위·요금·한도는 연결한 제공자와 계정에 따릅니다. 실계정 OAuth와 모델 추론은 미검증입니다. 모델을 연결하지 않은 상태에서 새 탭의 입력창은 검색으로 시작합니다.

## 기능

| 영역 | 구현 범위 |
|---|---|
| 탐색 | 탭, 주소·검색, 뒤로/앞으로, 새로고침, 닫은 탭 복원, 탭 검색·복제·고정, 북마크·방문 기록·다운로드 |
| 탭 조작 | 끌어서 순서 변경, 가운데 클릭으로 닫기, 우클릭 메뉴(새 탭(오른쪽에)·새 시크릿 탭·새로고침·복제·고정·탭 닫기·다른 탭 닫기·오른쪽 탭 닫기·닫은 탭 다시 열기). 고정 탭 묶음을 유지 |
| 시크릿 탭 | ⇧⌘N 또는 탭 우클릭으로 열기. 방문 기록·탭 복원 목록에 남기지 않으며 쿠키·사이트 데이터를 일반 탭과 분리하고 마지막 시크릿 탭을 닫으면 삭제. MCP·내장 에이전트는 접근하지 않음 |
| 페이지 조작 | 찾기, 인쇄, 페이지 저장, 우클릭 메뉴, 호스트별 페이지 배율, 핀치 줌, 스와이프 탐색 화살표 |
| 링크와 창 | ⌘N/Ctrl+N 새 창, 창별 탭·활성 탭, 공유 일반 웹 세션, 로그인용 자식 팝업, 외부 앱 링크 확인 |
| 북마크바 | 클릭은 현재 탭, ⌘-클릭·가운데 클릭은 백그라운드 탭. 들어가는 북마크만 표시하고 나머지는 **모든 북마크**에서 엶 |
| 다운로드 | 기본 다운로드 폴더·중복 이름 처리, 저장 위치 확인 설정, 위험 확장자는 임시 보관 후 사용자 허용/삭제, macOS quarantine·Windows MOTW 기록 경로 |
| 세션 | 저장 탭의 메타데이터 복원, 선택할 때 페이지 지연 로드. 창은 복원 탭 로딩을 기다리지 않고 표시 |
| 인터넷 사용 기록 삭제 | 기간·항목 선택. 사이트 데이터·캐시의 기간 제한은 아래 설명 참조 |
| 사이트 권한 | 위치·알림·카메라·마이크·클립보드 읽기 허용/차단을 요청 출처+최상위 출처별 저장, 외부 앱 **항상 허용**, 사이트별 재설정 |
| 첫 실행 설정 | 비밀번호 저장 켜기/끄기, 설치된 브라우저에서 가져오기, 자동 회원가입 기본값을 묻는 단계별 창 |
| 비밀번호 | 로컬 암호화 저장, 켜기/끄기, 브라우저/CSV 가져오기, 선택 후 채우기, 새 비밀번호 필드의 강력한 비밀번호 제안, 저장·업데이트 제안, 확인 후 복사, 삭제 실행취소 |
| 자동 회원가입 | 기본 이메일(+태그 선택)과 생성 비밀번호 또는 지정한 비밀번호 세트로 가입 양식 입력, 사용자 승인 후 비밀번호 관리자에 바로 저장. 에이전트는 비밀번호를 받지 않음 |
| 웹 작업 | 작업 전용 탭, 페이지 관찰·클릭·입력, 출처 수집, 승인 후 저장된 로그인 사용, 중단·실행 기록 |
| 대화·리서치 | 후속 질문, 파일·출처·기록을 포함한 이어가기, 심층 모드, 모든 대화 목록과 삭제. 실모델 리서치 품질은 미검증 |
| 코드 실행 | 작업 폴더 읽기·쓰기, 승인된 Python/JavaScript를 네트워크 차단 Docker에서 실행 |
| 루틴·Heartbeat | 로컬 cron·시간대 예약, 실행·일시 정지·편집·삭제, 중복 실행 방지, 기존 대화 이어가기 |
| 메모리 | 파일별 암호화 저장, 검색·편집, 변경 이력·차이·되돌리기, 선택적 모델 자동 정리(Dreaming) |
| 스킬 | SKILL.md 패키지 설치·권한 검토·무결성 검사, 선택/자동 첨부, 승인 후 Docker 스크립트 실행 |
| MCP·CLI | 토큰 인증 loopback MCP, 로컬 제어 소켓, `heisen` 명령·REPL·stdio MCP·SSH `--host` |
| 컴퓨터 제어 | 허용한 네이티브 앱의 화면·접근성 트리·입력, 사용자 승인·중지 표시기·전역 중지 단축키 |
| 탭 재우기 | 비활성 시간·배터리/열 상태·메모리 압박·지속 증가 감시, 탭 호버 상태 표시 |
| 추적 방지·읽기 도구 | 추적기·교차 사이트 쿠키·추적 매개변수 차단, 기사 읽기 뷰 |
| 보안 | HTTPS-First, 인증서 오류 차단, 로컬 위험 사이트 목록, 에이전트 사이트 정책·활동 기록 |
| 시스템 | 백그라운드·트레이, http/https 기본 브라우저 등록, 서명된 업데이트 확인·사용자 확인 후 설치 |

루틴은 Heisen 프로세스가 실행 중일 때 작동합니다. 백그라운드 실행은 기본 켜짐이며 **설정 > 성능 및 에너지 > 시스템 > 창을 모두 닫아도 계속 실행**에서 바꿉니다. 트레이에서 다시 열거나 종료할 수 있습니다. macOS는 이 설정과 별개로 마지막 창을 닫아도 앱이 남고 명시적으로 종료해야 합니다. 창이 하나도 없는 상태에서 다시 열면 저장 세션을 복원합니다. 루틴·MCP 자동화가 필요한 창은 비활성 상태로 열며, 입력·캡처를 위해 창 안의 대상 탭은 선택될 수 있습니다.

설정 탭은 **AI 모델**, **자동 완성 및 비밀번호**, **개인 정보 보호**, **보안**, **성능 및 에너지**, **MCP 서버**, **CLI**, **컴퓨터 제어**, **Heisen 정보**입니다. **개인 정보 보호 > 기본 브라우저**는 패키지 앱에서 http/https만 등록합니다. Windows에서는 시스템 기본 앱 설정을 열어 사용자가 선택합니다. `file:`/HTML 파일 연결은 등록하지 않습니다.

### 주소창

| 입력 | 처리 |
|---|---|
| `http://…`, `https://…` | 웹 주소로 처리. 공용 HTTP 호스트는 HTTPS-First 적용, 사용자 이름·비밀번호가 포함된 URL은 거부 |
| `localhost`, `*.localhost`, IPv4, `[IPv6]`, 점 없는 이름 + 포트(`devbox:8080`) | `http://`로 엶 |
| 점이 있는 호스트 이름(`example.com/path`) | HTTPS로 먼저 열고 연결 오류면 HTTP 경고 화면, 인증서 오류면 우회 불가능한 인증서 경고 화면 |
| `mailto:`, `file:`, `javascript:` 등 다른 스킴 | 주소창에서는 열지 않음 |
| `heisen://settings`, `heisen://history` 등 | 해당 앱 화면으로 이동. 앱 화면에서는 주소창에 이 형식으로 표시 |
| 그 밖의 입력 | Google 검색 |

### 외부 앱 링크

페이지가 `mailto:`, `tel:`, `zoommtg:` 같은 외부 앱 스킴으로 이동하거나 창을 열면 **`<스킴> 앱을 여시겠습니까?`** 창을 표시합니다. 요청한 사이트의 출처를 함께 표시하고 **열기**/**취소** 중 기본 버튼은 **취소**입니다. **항상 허용**을 선택하면 그 출처·스킴 조합을 사이트 권한에 저장하며 **설정 > 개인 정보 보호 > 사이트 설정**에서 재설정할 수 있습니다. 확인 창이 열려 있는 동안 같은 페이지의 추가 요청은 무시합니다. `file:`·`javascript:` 등 웹·로컬 파일·브라우저 내부 스킴은 외부 앱으로 넘기지 않습니다. 작업 전용 탭은 외부 앱을 열지 않습니다.

사이트가 스스로 만든 같은 출처의 `blob:` 주소(예: 생성한 PDF)는 탭에서 이동하거나 새 창으로 열 수 있습니다.

### 탭 순서와 닫기

- 활성 탭을 닫으면 Chrome과 같은 순서로 다음 탭을 고릅니다. 닫은 탭이 연 탭(오른쪽 우선) → 같은 탭이 연 형제 탭 → 닫은 탭을 연 탭 → 오른쪽 탭 → 왼쪽 탭 순입니다. 닫은 탭이 연 탭들은 닫은 탭의 여는 탭을 물려받습니다.
- 고정하면 고정 묶음의 끝으로, 고정을 해제하면 고정되지 않은 탭의 맨 앞으로 옮깁니다. 끌기로도 고정 탭과 일반 탭의 경계를 넘을 수 없습니다. 닫은 탭을 다시 열면 고정 상태도 복원합니다.
- **다른 탭 닫기**와 **오른쪽 탭 닫기**는 고정 탭과 작업 전용 탭을 남깁니다.
- 탭 검색어가 입력된 동안에는 끌어서 순서를 바꿀 수 없습니다.

### 인터넷 사용 기록 삭제

⇧⌘Backspace/Ctrl+Shift+Backspace 또는 **방문 기록 > 인터넷 사용 기록 삭제…**는 **설정 > 개인 정보 보호**의 삭제 창을 엽니다. **지난 1시간·24시간·7일·4주·전체 기간**을 선택합니다.

| 항목 | 기본 선택 | 삭제 대상 |
|---|---|---|
| 방문 기록 | 선택 | `library.json`의 방문 기록 |
| 쿠키 및 기타 사이트 데이터 | 해제 | 선택 기간에 방문한 출처의 사이트 데이터, 해당 등록 도메인의 쿠키. 전체 기간이면 전체 사이트 데이터 |
| 캐시된 이미지 및 파일 | 선택 | 기간과 관계없이 웹 탭 세션의 HTTP 캐시 전체 |

Electron에는 시점별 사이트 저장소 삭제 API가 없어 **그 기간에 만들어진 데이터만 지우는 기능이 아닙니다.** 쿠키는 등록 도메인 단위이므로 같은 도메인의 다른 하위 사이트에도 영향을 줍니다. 다운로드 목록·저장된 비밀번호·사이트 권한은 이 창에서 지우지 않습니다.

### 탭 재우기와 메모리

- **설정 > 성능 및 에너지**에서 조정합니다. 기본 비활성 시간은 30분, 배터리 사용 또는 심한 열 상태에서는 절전 설정에 따라 10분입니다. **사용 안 함**은 시간·배터리 기반 재우기를 끄지만 메모리 압박 처리는 별개입니다.
- 활성·로딩 중·소리 재생·캡처·개발자 도구·입력 중 양식·승인 대기·열린 팝업·진행 중 작업·최근 에이전트 조작이 있는 탭은 재우지 않습니다.
- 예산 초과 때 적격 탭 중 오래 숨겨진 탭부터 재웁니다. 지속적인 메모리 증가 감시는 누수의 원인 증명이 아니라 재우기 후보 판정입니다. 탭 호버에는 메모리와 재움 상태를 표시합니다.
- 재우면 페이지 뷰를 닫고 탐색 기록 등 복원 정보를 남깁니다. 다시 선택하면 불러오므로 페이지의 모든 실행 상태를 보존하지는 않습니다. Chromium 메모리 캐시를 임의로 비우는 기능은 아닙니다.
- 배터리 절전·숨긴 동영상 일시 정지는 기본 켜짐입니다. 숨긴 동영상은 Chromium 자체 정책으로도 정지하므로 별도 성능 향상으로 계산하지 않습니다.

### 추적 방지

- 추적기 차단·교차 사이트 쿠키 차단·추적 매개변수 제거·기기 정보 제한은 기본 켜짐, 광고 차단은 기본 꺼짐입니다. 주소창 **사이트 정보**에서 차단 통계와 사이트별 보호를 보고 끄거나 다시 켭니다.
- EasyPrivacy/EasyList 네트워크 필터를 사용하며 요소 숨김 필터는 포함하지 않습니다. 목록은 CC BY-SA 3.0으로 배포합니다([고지](assets/filters/NOTICE.txt)). `npm run filters`로만 갱신하며 앱 실행·일반 빌드 중 목록을 내려받지 않습니다.
- 사이트 구분은 등록 도메인(eTLD+1), 없으면 호스트입니다. 교차 사이트 `Cookie`·`Set-Cookie`를 막고 로그인 팝업 종료·Storage Access 허용은 최상위 사이트와 제3자 사이트 쌍에 30일 예외를 둡니다. 시크릿 예외는 세션 안에만 둡니다. `top-level-storage-access`는 거부합니다.
- `utm_*`, `gclid`, `fbclid`, `msclkid` 등을 최상위 이동에서 제거합니다. 전체 목록은 `src/privacy-util.ts`의 `TRACKING_PARAMS`에 있습니다. 교차 사이트 Referer는 출처까지만 남기고 상세 Client Hints 헤더를 줄입니다. JavaScript API·캔버스 등 모든 지문 수집을 막는 기능은 아닙니다.

### 읽기 도구

기사로 판정된 사용자 탭은 주소창의 읽기 도구로 본문을 엽니다. Readability로 추출하고 DOMPurify로 정리한 별도 뷰이며 원본 페이지를 대체 저장하지 않습니다. 테마는 자동·밝게·세피아·어둡게, 기본 글자 크기는 18입니다. 주소창 또는 **설정 > 성능 및 에너지 > 읽기 도구**에서 바꿉니다. 스크립트·프레임을 실행하지 않고 링크는 원래 탭으로 엽니다. 에이전트·MCP는 읽기 뷰가 아닌 원본 페이지를 대상으로 합니다.

### 보안과 업데이트

- HTTPS-First는 공용 HTTP 호스트를 HTTPS로 올립니다. localhost·IP·사설 주소·명시적 비표준 포트 등은 제외합니다. 연결 실패 뒤 HTTP를 계속 쓸지는 사용자가 경고 화면에서 정하고 **설정 > 보안**에서 허용 목록을 지웁니다. 인증서 오류는 우회하지 않으며 HTTPS 문서의 평문 HTTP/WS 하위 리소스도 차단합니다.
- 위험 사이트 보호(Safe Browsing)는 Google 원격 조회가 아닌 로컬 호스트 목록입니다. Block List Project(Unlicense) 5개 목록과 Phishing.Database(MIT)를 사용합니다([고지](assets/filters/safebrowsing-NOTICE.txt)). 방문 URL을 조회 서버에 보내지 않습니다. 목록 스냅샷을 동봉하지 않으므로 첫 실행이 오프라인이면 목록 기반 차단은 작동하지 않으며, 갱신 실패 시 기존 목록을 유지합니다. 측정된 저장 크기는 6개 목록·3,407,700개 호스트 기준 압축 전 283 MB, 후 57 MB입니다.
- 위험 사이트의 **계속**은 일반 사용자 탭의 해당 호스트·메인 프레임에만 적용하며 다른 탭·하위 리소스에 적용하지 않습니다. 다른 호스트로 떠나면 끝납니다. 작업 탭·시크릿 탭에는 이 우회를 허용하지 않습니다.
- 위험 확장자 다운로드는 `downloads-pending/`에 보류하고 허용 전에는 최종 다운로드 경로에 놓지 않습니다. **설정 > 보안**에서 다운로드마다 저장 위치를 묻게 할 수 있습니다(기본 꺼짐). 확장자 판정은 백신 검사가 아닙니다.
- 권한 허용은 요청 출처와 최상위 출처의 조합으로 저장합니다. Web Bluetooth는 기기 선택 UI가 없어 비활성입니다. USB 보호 클래스는 Chromium 기본값을 유지합니다.
- **설정 > Heisen 정보**에서 업데이트 확인·다운로드·설치를 진행합니다. 패키지 앱은 시작 후와 주기적으로 업데이트를 확인하지만 설치는 사용자 확인을 받습니다. Ed25519 매니페스트 서명, 파일 크기·SHA-256, 만료를 검증합니다. macOS 교체 앱은 설치 앱의 Team ID와 일치해야 합니다(Team ID가 없는 로컬/ad-hoc 앱은 이 고정 검사의 대상이 아닙니다).
- macOS 교체 실패 시 이전 앱으로 되돌리며 다음 정상 시작까지 `Heisen.app.old`를 남깁니다. 시작하지 못하면 앱을 종료하고 남은 `.old`를 `Heisen.app`으로 복구합니다. Windows는 검증된 설치 프로그램을 실행합니다. 실제 서명·공증된 원격 업데이트 배포는 별도 검증이 필요합니다.

### 대화 목록

사이드바의 **대화** 옆 더보기 버튼은 모든 대화 목록(`heisen://chats`)을 엽니다. 검색과 삭제를 지원합니다. 대화를 삭제하면 다음을 함께 처리합니다.

- 진행 중인 실행을 취소하고 작업·실행 기록을 `tasks.sqlite`에서 지웁니다.
- 그 작업의 전용 탭을 닫습니다.
- 그 대화를 이어가던 Heartbeat 루틴을 일시 정지합니다.
- 작업 폴더(`.workspace/` 아래)를 OS 휴지통으로 옮깁니다.

### 에이전트 출력의 비밀번호 가림

내장 작업과 외부 MCP가 받는 페이지 관찰·Markdown·로그인 정보·탭 제목과 URL에서 비밀번호를 `••••••••`로 바꿉니다.

- 비밀번호 필드로 보는 입력: 문서가 열린 뒤 한 번이라도 `type=password`였던 필드(비밀번호 표시 버튼으로 바뀐 경우 포함), `autocomplete`가 `current-password`/`new-password`인 필드, 이름·id가 password·passwd·pwd·pw 형식인 필드. 사용자 탭에서는 에이전트 호출 전 문서 준비 시점부터 추적합니다. 일회용 코드 필드는 제외합니다.
- 이 필드는 관찰 결과에서 역할이 `password`이고 값이 없으며, 에이전트가 직접 입력할 수 없습니다.
- 페이지 출처에 저장된 비밀번호, 그 탭에 자동 완성·에이전트 로그인으로 채운 비밀번호, 사용자가 그 탭에서 입력해 제출한 비밀번호(저장 여부와 무관)를 가립니다. 채우거나 입력한 값은 탭이 다른 출처로 이동하거나 닫힐 때까지 기억합니다.
- 비밀번호 필드의 값이 화면에 보이거나 알려진 비밀번호가 페이지 텍스트·보이는 입력값에 있으면 스크린샷을 거부합니다.
- 문자열 일치 방식입니다. 4자 미만의 비밀번호, 일부만 표시되거나 변형된 값, 이미지·캔버스 안의 글자는 가리지 못합니다.

### 자동 회원가입

사용자가 계정 만들기를 요청하면 내장 작업은 `web_signup`, 외부 MCP 에이전트는 `fill_signup`으로 가입 양식에 기본 이메일과 비밀번호를 넣습니다. 비밀번호는 Heisen이 정해 비밀번호 관리자에 바로 저장하며 에이전트에게 돌려주지 않습니다. 이름·약관 동의·가입 버튼은 에이전트가 직접 처리합니다.

- **설정 > 자동 완성 및 비밀번호 > 자동 회원가입**에서 기본 이메일 목록(첫 번째가 기본), **사이트별 +태그 이메일 사용**(예: `me+examplecom@gmail.com`), 비밀번호 방식을 정합니다. 비밀번호 저장이 꺼져 있으면 이 영역이 보이지 않고 가입 도구는 실패합니다.
- **자동 생성**: Chrome 비밀번호 생성 규칙을 따릅니다. 기본 15자이고 혼동되는 글자(`l I 1 O 0 o`)를 쓰지 않으며, 특수문자(`-_.:!`)는 사이트가 요구할 때만 넣습니다.
- **지정한 비밀번호 세트**: 이름과 비밀번호로 여러 세트를 만들어 두면 사이트 조건을 만족하는 첫 세트를 씁니다. 맞는 세트가 없으면 부족한 조건을 알리고 실패하며 자동 생성으로 바꾸지 않습니다. 세트 비밀번호는 암호화 저장소에만 둡니다.
- 사이트 조건은 `passwordrules` 속성, `minlength`·`maxlength`·`pattern` 속성, 양식 주변 안내·오류 문구(한국어·영어) 순서로 읽습니다.
- 승인: 내장 작업은 작업마다 사이트·기본 이메일 기준으로 한 번, MCP는 서버 세션에서 출처마다 한 번 확인합니다. 그 이메일로 저장된 계정이 이미 있으면 승인 전에 거부합니다.
- 사이트가 비밀번호를 거부하면 에이전트가 다시 호출해 새 비밀번호(세트 방식은 다음 세트)를 넣습니다. 같은 탭·사이트에서 최대 3번이며 두 번째부터는 +태그 없는 이메일을 씁니다. 저장된 비밀번호는 마지막 시도 값으로 바뀝니다.
- 이메일 인증·전화번호·결제·캡챠는 처리하지 않으며, 에이전트에게 멈추고 사용자에게 알리도록 지시합니다.

## 단축키

[src/menu.ts](src/menu.ts)에 등록된 주요 동작입니다. 페이지 찾기·인쇄·저장·배율·개발자 도구는 웹 페이지가 활성화되어 있을 때 작동합니다. Windows 메뉴 모음은 Alt로 엽니다.

| 동작 | macOS | Windows |
|---|---|---|
| 새 탭 / 새 창 | ⌘T / ⌘N | Ctrl+T / Ctrl+N |
| 새 시크릿 탭 / 닫은 탭 다시 열기 | ⇧⌘N / ⇧⌘T | Ctrl+Shift+N / Ctrl+Shift+T |
| 탭 닫기 / 창 닫기 | ⌘W / ⇧⌘W | Ctrl+W / Ctrl+Shift+W |
| 주소창 | ⌘L | Ctrl+L |
| 다음 / 이전 탭 | ⌃Tab / ⌃⇧Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| 다음 / 이전 탭(대체) | ⌥⌘→ / ⌥⌘←, ⇧⌘] / ⇧⌘[ | Ctrl+Alt+→ / Ctrl+Alt+←, Ctrl+Shift+] / Ctrl+Shift+[ |
| 위치로 탭 선택 / 마지막 탭 | ⌘1–⌘8 / ⌘9 | Ctrl+1–Ctrl+8 / Ctrl+9 |
| 탭 검색 | ⇧⌘A | Ctrl+Shift+A |
| 뒤로 / 앞으로 / 홈 | ⌘[ / ⌘] / ⇧⌘H | Ctrl+[ / Ctrl+] / Ctrl+Shift+H |
| 새로고침 / 캐시 무시 새로고침 | ⌘R / ⇧⌘R | Ctrl+R / Ctrl+Shift+R |
| 찾기 / 다음 / 이전 | ⌘F / ⌘G / ⇧⌘G | Ctrl+F / Ctrl+G / Ctrl+Shift+G |
| 확대 / 축소 / 실제 크기 | ⌘+, ⌘= / ⌘− / ⌘0 | Ctrl++, Ctrl+= / Ctrl+− / Ctrl+0 |
| 페이지 저장 / 인쇄 / URL 복사 | ⌘S / ⌘P / ⇧⌘C | Ctrl+S / Ctrl+P / Ctrl+Shift+C |
| 북마크 추가 / 관리자 / 북마크바 | ⌘D / ⌥⌘B / ⇧⌘B | Ctrl+D / Ctrl+Alt+B / Ctrl+Shift+B |
| 방문 기록 / 사용 기록 삭제 | ⌘Y / ⇧⌘Backspace | Ctrl+Y / Ctrl+Shift+Backspace |
| 다운로드 | ⇧⌘J | Ctrl+Shift+J |
| 사이드바 표시·숨기기 | ⌃⌘S | Ctrl+Alt+S |
| 측면 패널 / 새 대화 | ⌘E / ⇧⌘E | Ctrl+E / Ctrl+Shift+E |
| 개발자 도구 / 전체 화면 | ⌥⌘I / ⌃⌘F | F12 / F11 |
| 설정 | ⌘, | Ctrl+, |
| 실행 취소 / 다시 실행 | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z |
| 잘라내기 / 복사 / 붙여넣기 / 모두 선택 | ⌘X / ⌘C / ⌘V / ⌘A | Ctrl+X / Ctrl+C / Ctrl+V / Ctrl+A |
| 붙여넣고 스타일 일치 | ⌥⇧⌘V | Ctrl+Alt+Shift+V |
| 최소화 | ⌘M | Ctrl+M |
| 숨기기 / 기타 숨기기 | ⌘H / ⌥⌘H | — |
| 컴퓨터 제어 중지 | ⌘⇧Esc | Ctrl+Shift+Esc(등록 실패 시 제어 시작 거부) |
| 앱 종료 | ⌘Q | Ctrl+Shift+Q |

창 닫기와 앱 종료는 다릅니다. 창이 없어도 백그라운드 실행 중이면 루틴·MCP가 남고, 명시적으로 종료하면 모두 멈춥니다.

## 내장 에이전트 웹 작업

내장 에이전트의 `web_click`·`web_fill`·`web_press`·`web_scroll`·`web_select`·`web_navigate`·`web_wait`은 실행 뒤 새 페이지 관찰과 다음 동작에 쓸 ref를 돌려줍니다. 본문은 처음 2,000자만 보여 주며 전체 내용은 `web_read`, 출처 저장은 `research_capture`로 처리합니다. 새 사이트로 이동하면 승인을 다시 받고 작업 창의 포커스를 가져오지 않습니다.

여러 단계를 한 번에 처리하는 `web_run`은 모델이 작성한 `page`·`tabs` 스크립트를 워커 안의 QuickJS(WASM) 격리 환경에서 실행합니다. 스크립트에는 Node·Electron 객체가 없고 문자열로만 주고받는 브리지만 있습니다. 안쪽 동작도 기존 승인·사이트 규칙·감사를 거쳐 활동 기록에 **스크립트 실행** 뒤 각각 남습니다. 페이지 JavaScript나 호스트 접근은 제공하지 않으며 작업 취소 시 실행을 멈춥니다.

## MCP 연결

- Heisen을 실행하고 **설정 > MCP 서버**를 엽니다.
- **켜기**를 누른 뒤 **Claude Code 명령 복사**를 누릅니다.
- Claude Code CLI를 사용할 수 있는 터미널에 복사한 명령을 붙여넣고 실행합니다. 앱이 현재 주소와 인증 토큰을 포함한 `claude mcp add --transport http heisen …` 명령을 만듭니다. 다른 클라이언트에는 **JSON 설정 복사**를 사용합니다.
- 연결 중에는 Heisen을 실행해 두어야 합니다. 켜짐 상태와 포트는 저장되며 재시작 때 복원합니다. 포트가 사용 중이면 주소가 바뀔 수 있으므로 다시 복사합니다.
- **토큰 재발급** 후에는 기존 토큰을 사용할 수 없습니다. 새 명령/설정을 복사해 클라이언트 설정을 갱신합니다. 복사한 명령에는 비밀 토큰이 있으므로 공유하지 마세요.

서버는 loopback에만 바인딩하며 Bearer 인증과 Host/Origin 검사를 합니다. 웹페이지에 공개하는 API나 메신저 봇이 아닙니다. 탭 목록·열기·이동·관찰·클릭·입력·스크롤·선택·대기(`wait_for`)·Markdown·스크린샷·다운로드 목록을 제공하고, 저장된 로그인 입력과 파일 업로드는 사용자 확인을 받습니다. 확인 창의 기본 버튼은 **취소**입니다. 저장된 로그인 입력은 승인한 출처를 함께 넘기며, 승인하는 동안 페이지가 다른 출처로 이동했으면 입력하지 않습니다. 내장 작업의 전용 탭은 외부 MCP가 조작하지 않습니다.

관찰과 동작 결과는 텍스트 스냅샷과 `structuredContent`(스냅샷 id·URL·제목·`loading`·요소별 ref)를 함께 반환합니다. 다음 동작에는 방금 받은 ref를 사용하고, 로딩이나 늦게 나타나는 텍스트는 `wait_for`로 기다립니다.

MCP 도구 호출은 분당 120회, HTTP 작업 시작은 분당 10회로 제한합니다. 확인 창은 한 번에 하나이며 10분 안에 3번 거부하면 10분간 추가 확인을 막습니다. **설정 > 보안**의 에이전트 사이트 허용/차단은 내장 작업·MCP·CLI 도구에 적용됩니다. **에이전트 활동**(`heisen://activity`)에서 출처·도구·시각·결과를 확인합니다. 입력 원문·비밀번호 대신 정리된 감사 정보를 저장합니다. 페이지·파일·메모리·스킬은 신뢰하지 않는 자료로 표시하며 결제 민감 필드 입력은 거부합니다. 이 조치가 프롬프트 인젝션의 완전한 방어를 보장하지는 않습니다.

**설정 > 보안 > 에이전트 사이트 > 사람처럼 천천히 입력**은 기본 꺼짐입니다. 기본은 CDP 즉시 클릭과 `Input.insertText` 한 번으로 입력하며, 이 설정을 켜면 이전 사람 흉내 입력 지연을 사용합니다.

## CLI

1. 시스템 Node.js 22 이상을 설치하고 Heisen을 실행합니다.
2. **설정 > CLI**에서 CLI를 설치하고 **로컬 소켓**을 켭니다. 소켓은 **기본 꺼짐**이며 CLI 설치만으로 켜지지 않습니다.
3. 새 터미널에서 `heisen status`를 실행합니다. 소스 빌드에서는 `node dist/cli.mjs install --user`로 설치할 수 있습니다. macOS는 `/usr/local/bin` 또는 `~/.local/bin`, Windows는 `%LOCALAPPDATA%\Heisen\bin\heisen.cmd`를 사용합니다.

| 명령 | 용도 |
|---|---|
| `heisen status` | 앱·탭·작업·연결 상태 |
| `heisen tabs list`, `tabs open <URL> [--active]`, `tabs select/close <id>` | 사용자 탭 목록·조작 |
| `heisen open <URL>` | 활성 탭으로 열기 |
| `heisen snapshot <탭> [--full]` | 요소와 ref 관찰. `--full`은 Markdown 본문도 이어서 출력 |
| `heisen click <탭> <ref>` | 요소 클릭 후 새 스냅샷 출력 |
| `heisen type <탭> <ref> <텍스트> [--submit]` | 입력값 교체 후 새 스냅샷 출력. `--submit`은 Enter 입력 |
| `heisen key <탭> <키>` | 현재 포커스에 키 입력 후 새 스냅샷 출력 |
| `heisen scroll <탭> up/down [px]` | 위·아래 스크롤 후 새 스냅샷 출력(기본 600px) |
| `heisen select <탭> <ref> <값>` | 선택 상자의 값 또는 표시 문구 선택 후 새 스냅샷 출력 |
| `heisen go <탭> <URL/back/forward>` | URL 이동 또는 방문 기록 이동 후 새 스냅샷 출력 |
| `heisen read <탭>` | 보이는 페이지의 Markdown 본문 |
| `heisen shot <탭> <파일.png>` | PNG 캡처 저장(새 파일 권한 0600) |
| `heisen wait <탭> [--for <텍스트>] [--load] [--timeout <초>]` | 로드 완료와 지정 텍스트를 기다린 뒤 새 스냅샷 출력(기본 10초, 최대 30초) |
| `heisen exec "<요청>" [--url <URL>] [--deep] [--skill <id>] [--memory <이름>] [--no-wait]` | 작업 시작. 기본은 이벤트와 종료 결과를 기다림 |
| `heisen tasks list/show/cancel/wait/continue` | 작업 조회·취소·대기·이어가기(`--help`에 인수 표시) |
| `heisen memory list/read/write/delete/search/history/revert/dream` | 파일 메모리·이력·정리. 쓰기는 `--text`, `--file` 또는 표준 입력 |
| `heisen skills list/install/remove/enable/disable/show` | 스킬 패키지 관리. 설치 권한 승인은 앱에서 수행 |
| `heisen routines list/run/toggle` | 루틴 조회·실행·일시 정지 전환 |
| `heisen repl [-e "<코드>"] [파일]` | Playwright와 비슷한 제한된 탭·페이지 API. 전체 Playwright API는 아님 |
| `heisen mcp` | 같은 브라우저 도구의 stdio MCP 브리지 |
| `heisen install [--user]`, `heisen uninstall` | CLI 실행 경로 설치·제거 |
| `heisen completion bash/zsh/fish/pwsh` | 지정 셸의 자동 완성 스크립트 출력(슬래시 중 하나를 선택) |

공통 옵션은 `--json`, `--host <SSH 호스트>`, `--profile <프로필 경로>`, `--socket <소켓 경로>`, `--timeout <초>`, `--allow-page-js`입니다. `--json`은 기계 판독 출력을 사용합니다. `--host`는 `ssh -T <호스트> heisen --stdio`로 원격 앱에 연결하므로 원격에도 Node·CLI·실행 중인 앱·켜진 소켓이 필요합니다. `--host`와 `--profile`/`--socket`은 함께 쓰지 않습니다. 별도의 네트워크 제어 포트를 공개하지 않습니다.

로컬 토큰은 `<프로필>/run/heisen.token`이며 서버를 시작할 때 새로 만듭니다. POSIX 소켓은 `run/heisen.sock`; 클라이언트는 소유 uid, 비공개 모드, 심볼릭 링크가 아닌지 검사합니다. `--socket`도 선택 프로필의 소켓과 일치해야 합니다. Windows named pipe 이름은 프로필 루트의 해시로 구분합니다. Node는 pipe 소유자·ACL을 검사할 수 없으므로 **사용자별 비공개 프로필만 사용하고 공유 폴더를 쓰지 마세요.** Windows `heisen.cmd`는 현재 폴더/PATH의 임의 `node.exe` 대신 고정 설치 위치(`ProgramFiles`, `ProgramFiles(x86)`, `LOCALAPPDATA\Programs\nodejs`, `APPDATA\npm`)에서만 Node를 찾습니다.

REPL 예: `heisen repl -e "const t=await tabs.open('https://example.com'); console.log((await t.snapshot()).title)"`. `require`·`process`를 노출하지 않지만 Node `vm`은 보안 샌드박스가 아니므로 신뢰할 수 없는 스크립트를 실행하지 마세요. `page.evaluate`는 **설정 > CLI > 페이지 스크립트 허용**과 실행 시 `--allow-page-js`를 둘 다 켠 연결에서만 허용합니다. 기본 브라우저 도구 사용에는 필요하지 않습니다. 앱 미실행·연결 실패는 종료 코드 4, 인수 오류는 64입니다.

폼 흐름 예(현재 페이지에 해당 요소가 있을 때): `heisen repl -e "await page.fill(await page.find('textbox','Entry'),'hi',{submit:true}); await page.click(await page.find('button','Increment')); await page.waitFor({text:'Clicked'}); console.log(await page.text())"`.

stdio MCP 설정 예(클라이언트 프로세스의 PATH에 `heisen`이 있어야 함):

```json
{"mcpServers":{"heisen":{"command":"heisen","args":["mcp"]}}}
```

## 메모리

**메모리** 화면에서 파일별 편집·검색·현재 페이지 저장·대화 첨부를 합니다. `memory/<이름>.md`는 확장자와 달리 봉인된 암호문이므로 외부 편집기로 직접 수정하지 말고 UI 또는 CLI를 사용합니다. `memory/history/`에는 변경 전후와 작성자(사용자·에이전트·정리), `memory/dreams/`에는 정리 보고서를 암호화해 저장합니다.

**기록**에서 차이를 보고 되돌리면 선택 리비전의 **변경 전** 내용으로 새 리비전을 만듭니다. 삭제도 되돌릴 수 있습니다. **정리**의 Dreaming은 기본 꺼짐이며 수동 실행 또는 cron·시간대 예약을 지원합니다(초기 예약식 `0 4 * * *`, 시스템 시간대). 선택한 모델로 메모리를 보내므로 연결·이용 요금이 필요합니다. 도구 없는 모델 응답을 검증한 뒤 반영하며 절반 초과 삭제·잘못된 변경은 거부합니다. 앱 종료 중에는 예약이 실행되지 않습니다.

## 스킬

**스킬 > 추가** 또는 `heisen skills install <소스>`로 로컬 폴더·ZIP·Git 저장소를 설치합니다. Git 소스에는 시스템 Git이 필요합니다. 패키지 루트의 `SKILL.md`는 다음 형식입니다.

```markdown
---
name: 기사 요약
description: 열린 기사의 근거를 정리한다
allowed-tools: [web_observe, research_capture]
sites: [https://example.com]
---
기사의 출처와 핵심 내용을 정리한다.
```

앱에서 도구·사이트·스크립트를 검토하고 승인해야 활성화됩니다. 파일 수·크기·경로·심볼릭 링크를 검사하고 승인한 바이트의 해시를 보관합니다. 변경된 패키지는 재검토가 필요합니다. 이름·설명과 요청이 맞는 승인된 스킬은 자동 첨부될 수 있습니다. 선언된 권한은 기존 사이트·실행 승인 절차를 우회하지 않습니다. `scripts/`의 Python/JavaScript는 작업 폴더에 준비한 뒤 별도 승인을 받고 네트워크 차단 Docker에서만 실행합니다. 설치만으로 호스트 스크립트를 실행하지 않습니다.

## 컴퓨터 제어

**설정 > 컴퓨터 제어**에서 켜고 허용 앱 목록을 지정합니다(기본 꺼짐, 목록 비어 있음). macOS helper는 화면 기록·손쉬운 사용 권한이 필요하며 ScreenCaptureKit·접근성 트리·CGEvent 입력을 사용합니다. Windows helper는 PowerShell·UI Automation·SendInput을 사용하고 로그인된 대화형 데스크톱이 필요합니다. 잠금 화면·UAC 보안 데스크톱·높은 권한 앱을 우회하는 도구가 아닙니다.

작업별 승인 후 허용 앱의 캡처·관찰·클릭·입력·스크롤을 제공합니다. 제어 중 표시기의 **중지**, macOS ⌘⇧Esc/Windows Ctrl+Shift+Esc, 설정 끄기로 중지합니다. 전역 중지 키를 등록할 수 없으면 시작하지 않습니다. 보안 입력 필드는 입력·캡처를 거부하고 위험한 단축키·붙여넣기는 추가 확인을 받습니다. `computer/log.jsonl`에는 작업·동작·결과를 기록하되 입력 텍스트는 길이만 남기고 화면 픽셀은 저장하지 않습니다. Windows 대화형 Computer Use는 미검증입니다.

## 데이터 위치

기본 프로필은 macOS `~/Library/Application Support/Heisen/`, Windows `%APPDATA%\Heisen\`입니다.

| 경로 | 내용 |
|---|---|
| `library.json` | AES-256-GCM 봉인된 북마크·방문 기록·탭·루틴·권한·설정·가져오기 상태 |
| `tasks.sqlite` | 작업 payload·실행 저널·감사 payload를 봉인. SQLite 구조·일부 인덱스 메타데이터는 평문 |
| `.workspace/` | 작업별 파일·수집 출처. Docker 마운트와 외부 파일 사용을 위해 평문 |
| `secrets.json` | OS `safeStorage`로 보호한 계정·비밀번호·삭제 기록·가져오기 키·MCP/베타 토큰·봉인 키. macOS Keychain, Windows DPAPI |
| `migration.json`, `secrets.own.json` | Own 이관 결과, 비밀 정보 이관을 건너뛰거나 실패했을 때 보관한 기존 암호문 |
| `Partitions/browser/` | 웹 탭의 영구 세션 데이터 |
| `launch.json` | 시작 전에 읽는 MCP 실행 여부만 평문 저장 |
| `library.json.v0`, `tasks.sqlite.v0` | 이전 평문 형식 이관 시 임시 백업. 이후 정상 시작에서 제거 |
| `memory/` | 봉인된 메모리·변경 이력(`history/`)·정리 보고서(`dreams/`) |
| `skills/` | 설치 패키지와 메타데이터. 평문이므로 비밀을 넣지 않음 |
| `run/` | 로컬 CLI 인증 토큰과 POSIX 제어 소켓 |
| `computer/log.jsonl` | 입력 원문·픽셀을 제외한 컴퓨터 제어 로그(평문) |
| `safebrowsing/` | 로컬 위험 호스트 목록 DB·갱신 상태 |
| `updates/` | 업데이트 상태와 다운로드 파일 |
| `downloads-pending/` | 사용자 결정을 기다리는 위험 다운로드 임시 보관 |

다운로드와 저장 페이지는 OS 다운로드 폴더에 저장하며 프로필과 별개입니다. 0.5 첫 시작에서 기존 평문 데이터를 봉인하고 `.v0` 백업을 잠시 남깁니다. 이전 버전으로 되돌리려면 먼저 앱을 종료하고 현재 프로필을 별도 보관한 뒤, 이관 전 전체 백업(또는 남은 `.v0`를 대응 파일로 복구한 복사본)을 사용하세요. 새 암호문을 이전 버전이 읽을 수 있다고 가정하지 마세요. 봉인 키를 포함한 `secrets.json`과 OS 보안 저장소 접근도 필요합니다. **전체 디스크·프로필 암호화는 아닙니다.** 파일명·웹 세션·작업 파일 등은 별도이며, 모델 호출 때 대화·페이지·선택 메모리는 해당 제공자로 전송됩니다.

## 네트워크

앱 자체 통신 경로는 아래와 같습니다. 제공자·SDK의 URL 문자열 존재만으로 실제 접속을 뜻하지 않으며, 모든 실행 연결을 캡처한 목록은 아닙니다. 사용자가 연 웹사이트와 하위 리소스 통신은 별도입니다.

| 분류 | 주소·항목 | 사용 범위 |
|---|---|---|
| pi-ai 구독 로그인 | `claude.ai`, `auth.openai.com`, GitHub | Heisen 탭의 승인 페이지와 제공자 인증 |
| 자체 코드의 제공자 호출 | `api.openai.com`, `openrouter.ai`, `localhost:11434` | 사용자가 연결한 제공자 호출·모델 목록 |
| 검색 | `www.google.com/search` | 주소창·우클릭 검색 |
| 번들 pi-ai·SDK 상수 | openrouter, vercel ai-gateway, bedrock, mistral, x.ai, groq, githubcopilot, moonshot, deepseek, googleapis/gstatic OAuth 인증서 등 | 모델 카탈로그·엔드포인트 상수. 사용자가 해당 제공자를 연결해 호출할 때 접속하며 문자열 존재만으로 접속을 뜻하지 않음 |
| 베타 서버 | `heisen.dev`(`/auth/start`, `/api/app/token`, `/api/me`, `/api/invite/redeem`, `/api/logout`) | 시스템 브라우저 로그인(`127.0.0.1` 임시 포트로 결과 수신), 초대 코드 확인, 시작할 때와 6시간마다 세션 확인, 로그아웃 |
| 위험 사이트 목록 | `blocklistproject.github.io`, `raw.githubusercontent.com` | 시작 15초 뒤·이후 매시간 갱신 여부 확인, 목록별 12시간 최신성 창·ETag 사용. 방문 URL 원격 조회는 하지 않음 |
| 업데이트 | `https://heisen.dev/dl/latest.json`, `/dl/<설치 파일>` | 패키지 앱에서 시작 2분 뒤·이후 6시간마다 확인, 사용자 다운로드·설치 |
| 추적/광고 필터 | `easylist.to` | 개발자가 `npm run filters`를 실행할 때만. 앱 런타임에는 요청하지 않음 |
| 스킬 Git 소스 | 사용자가 지정한 저장소 | 스킬 설치 시 Git 다운로드 |
| 텔레메트리·크래시 리포트 | — | 자체 전송 코드 없음 |

근거는 `src/auth.ts`, `models.ts`, `beta.ts`, `safebrowsing.ts`, `updater.ts`, `skills.ts`, `scripts/filters.mjs`입니다. 라이브러리 문서 링크·엔드포인트 상수와 실제 요청 코드를 구분해야 하며 이 표는 모든 외부 통신이 없다는 보장이 아닙니다.

## 성능과 패키지 크기

같은 Mac(Apple M5, 24 GiB, macOS 27.0, AC 전원)에서 `tests/performance-safari.ts`로 0.4(`2f58a26`)와 0.5 패키지를 3회씩 쟀습니다. 로컬 픽스처 탭 20개, 중앙값, RSS는 앱 전체 프로세스 합입니다. Chrome은 같은 실행에서 함께 잰 값입니다(전/후 실행 각각).

| 항목 | Chrome | Heisen 0.4 | Heisen 0.5 |
|---|---|---|---|
| 첫 실행 화면 표시 | 326 / 338 ms | 317 ms | 344 ms |
| 세션 복원 화면 표시 | 290 / 304 ms | 252 ms | 263 ms |
| 복원 직후 메모리 | 1,084 / 1,139 MiB | 604 MiB | 636 MiB |
| 20개 탭 모두 방문 뒤 | 2,406 / 2,406 MiB | 2,234 MiB | 2,306 MiB |
| 10분 유휴 뒤 | 2,369 / 2,372 MiB | 2,007 MiB | 612 MiB |
| 누수 페이지 3분 뒤 | 2,472 / 2,893 MiB | 2,305 MiB | 941 MiB |

- 유휴 단계는 0.5에만 있는 탭 재우기를 **5분으로 명시 설정**해 쟀습니다(기본값은 30분, 배터리 10분). 세 번 모두 배경 탭 19개가 잠들었습니다. 기본값으로는 30분이 지나야 같은 효과가 납니다.
- 누수 단계 수치는 유휴 단계에서 잠든 탭이 그대로 잠든 상태를 포함합니다. 누수 탭 자체는 3분 안에 감시 기준에 걸리지 않았습니다.
- 0.5는 첫 실행이 27 ms, 복원 직후 메모리가 32 MiB 늘었습니다(추적 필터·위험 사이트 목록 적재).
- 측정 중 화면이 잠겨 있었습니다. 두 빌드 모두 같은 조건이지만 화면을 켠 상태의 수치와 다를 수 있습니다. Safari 열은 `safaridriver`를 켜지 않아 비웠습니다.
- 위험 사이트 목록 저장소는 6개 목록 3,407,700개 호스트 기준 57 MB입니다(압축 전 283 MB).

하네스는 `tests/bench-lib.ts`, `tests/performance-chrome.ts`, `tests/performance-safari.ts`입니다. 전후 빌드·Chrome·Safari의 실행 조건, AC 전원·유휴 상태, 페이지와 프로필, 실행 실패·재시도, 프로세스 RSS 합산과 한계를 함께 기록해야 합니다. Safari 자동화에는 `sudo safaridriver --enable`이 필요하며 Safari 세션 복원은 비교 대상이 아닙니다. RSS는 공유 메모리를 중복 합산할 수 있고 작은 로컬 페이지 결과는 실사이트·배터리 수명을 대신하지 않습니다.

기존 측정 원본은 [performance-before.json](docs/evidence/performance-before.json), [performance-after.json](docs/evidence/performance-after.json)에 보관합니다. 이를 0.5 측정으로 재해석하지 않습니다.

## 검증 결과

- 0.5 최종 코드(`16ef569`)에서 typecheck, 단위 테스트 347 통과/0 실패/1 건너뜀, 개발 빌드 E2E 9개 파일(desktop, browser, data, agent, beta, perf, privacy, cli, security) 모두 통과했습니다. 패키지(`release-test/`) E2E 9개도 통과했습니다(`228d2b4`, 패키지 전용으로 막힌 개발용 주입 검사만 건너뜀).
- Windows 10 x64(`c3cfb44`)에서 `npm ci`, typecheck, build, x64·arm64 패키징, 단위 테스트 337/0/5가 통과했습니다. 대화형 desktop E2E는 컨테이너 구간 직전까지 통과했고, 그 구간은 Docker Desktop이 없어 멈췄습니다. 제목 표시줄은 화면으로 확인했습니다.
- 미검증: Windows arm64 기기 실행, 실제 DPAPI 가져오기·MOTW·Windows 대화형 Computer Use, 실계정 OAuth·모델 추론, 실제 서명·공증 배포와 서명된 업데이트 설치, 실제 트랙패드 스와이프.
- 패키지 E2E는 `--inspect`가 가능한 `release-test/` 전용입니다. 모델 픽스처 검사는 도구·승인·저장 흐름만 확인하며 리서치 품질을 증명하지 않습니다.

화면 캡처는 `docs/`에 있으며 테스트 통과가 Aside와의 기능 동등성을 뜻하지 않습니다.

## 한계

- 메신저 채널(Slack·Telegram·Discord)은 사용자 지시로 보류했습니다. 로컬 MCP·CLI는 메신저 연동이 아닙니다.
- 클라우드 동기화·Chrome 웹 스토어 확장은 이번 범위에서 제외했습니다. Electron의 일부 unpacked 확장 API 지원을 Web Store 설치·전체 Chrome 확장 호환으로 보지 않습니다.
- DRM은 미지원이며 castlabs 도입·서명 자격이 별도입니다. Developer ID·공증·Authenticode 자동화의 준비와 실제 자격을 사용한 공개 배포 검증은 구분합니다.
- Windows arm64 기기 실행, DPAPI 실제 가져오기·MOTW·대화형 Computer Use는 미검증입니다. Chrome/Edge app-bound v20은 CSV로 비밀번호를 가져와야 합니다.
- iCloud 키체인·Safari 쿠키·Firefox 비밀번호 직접 가져오기는 지원하지 않습니다. macOS 키체인 조회 요청자는 `security`로 표시됩니다.
- CLI는 시스템 Node가 필요하며 REPL `vm`은 적대적 코드의 보안 경계가 아닙니다. Windows 제어 소켓은 사용자별 비공개 프로필을 전제로 합니다.
- 추적 차단·헤더 축소는 모든 지문 API를 가리지 않습니다. 읽기 도구는 모든 페이지를 추출하지 못하며 메모리 감시도 Chromium 자체 누수의 근본 수정을 뜻하지 않습니다.
- 에이전트 비밀번호 가림은 문자열 일치 방식으로 4자 미만·변형된 값·이미지 속 글자를 가리지 못합니다. 네이티브 화면의 모든 민감 정보를 자동 판별하지도 못합니다.
- 자동 회원가입은 사이트의 속성·문구에서 규칙을 추론합니다. 채우는 순간 비밀번호를 저장하므로 가입 실패 뒤 항목이 남을 수 있습니다. 실제 사이트 가입과 실모델 리서치 품질은 미검증입니다.
- Client Hints 브랜드는 Chromium이며 Chrome과 같은 지문을 보장하지 않습니다. 스와이프는 화살표만 표시합니다. 캡챠 풀이·안티봇 우회·Aside Ultrabrowse 알고리즘 동등성을 제공하거나 검증하지 않았습니다.

구조와 보안 경계는 [구현 문서](docs/implementation.md)를 참고하세요.

## 라이선스

[MIT](LICENSE). 위 면책 고지가 함께 적용됩니다. 번들된 제3자 구성 요소와 데이터(EasyList/EasyPrivacy 필터는 CC BY-SA 3.0 등)는 각자의 라이선스를 따르며 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 정리되어 있습니다.
