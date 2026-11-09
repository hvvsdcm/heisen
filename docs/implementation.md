# Heisen 0.5 구현 구조

Heisen은 Electron 45 / Chromium 156을 포함하는 macOS·Windows 앱이다. Chromium 소스 포크가 아니며 외부 Chrome·Aside 프로세스나 확장에 의존하지 않는다. 설치·사용법, 측정값, 실행된 검사와 미검증 항목은 [README](../README.md)에 기록한다.

## 프로세스와 모듈

메인 프로세스가 프로필·창·웹 세션·인증·작업·MCP 서버를 소유한다. 로컬 React UI는 상태를 받아 표시하고 제한된 RPC를 호출한다. 웹 탭은 별도의 `WebContentsView`이며 UI의 preload와 웹 세션의 preload는 분리되어 있다.

아래 파일은 모두 `src/` 아래에 있다.

| 모듈 | 책임 |
|---|---|
| `main.ts` | 앱 이름·프로필 설정, 격리 프로필의 mock keychain, 원격 디버깅 거부, 단일 인스턴스, Own 이관, 서비스 생성·연결, 기본 RPC·상태 집계, 인터넷 사용 기록 삭제, 대화 삭제, 창 생성·종료 |
| `rpc.ts` | `registerRpc`, `registerState`, `collectState`, `installRpc`; 중복 등록 거부와 UI 호출자 검증 |
| `menu.ts` | macOS·Windows 메뉴, CmdOrCtrl 기반 단축키, 새 창·탭, Windows Alt 메뉴와 F11/F12 |
| `browser.ts` | 창별 탭·뷰·지연 로드·복원·재우기, 탐색·경고 화면·읽기 뷰 연결, 외부 앱 확인·팝업, 작업 탭과 사용자 탭 조작, 로그인·가입 채움, 출력 가림 |
| `browser-util.ts` | 주소창·외부 스킴·blob 판정, 탭 선택·이동·순환, 파일 이름·다운로드 출처 메타데이터, 배율·팝업 크기 |
| `context-menu.ts` | 페이지·링크·이미지·선택 텍스트·편집 필드의 네이티브 우클릭 메뉴. 링크·이미지의 다른 이름으로 저장은 저장 위치를 묻는 경로 사용 |
| `gestures.ts` | 웹 세션 preload 등록, 스와이프 IPC 검증, 화살표 오버레이와 뒤로/앞으로 이동 |
| `page-preload.ts` | 격리된 웹 프레임에서 휠·로그인 필드(새 비밀번호 필드 구분)·제출 이벤트 관찰. 앱 API를 페이지에 노출하지 않음 |
| `input.ts` | CDP 마우스·키보드·휠 입력, 포인터 이동·입력 간격, debugger 연결·해제 |
| `page-scripts.ts` | 격리 world에서 실행할 비밀번호 필드 추적(`sensitiveSetup`), 관찰·요소 참조 검증·Markdown·스크린샷 검사·로그인 채움·가입 양식 탐색과 규칙 소스 수집(`signupScanScript`)·가입 채움(`fillSignupScript`)·파일 입력·선택 목록 스크립트 |
| `identity.ts` | Chromium 버전에 맞춘 Chrome 형식 UA와 선호 언어 헤더 설정 |
| `permissions.ts` | 공유 세션 권한 검사, 요청 출처+최상위 출처별 허용/차단, 창별 요청 표시·정리·재설정 |
| `passwords.ts` | 암호화 보관함, 출처별 계정 매칭, 가져오기·추가/갱신 동기화(비밀번호 관리자가 꺼져 있으면 정지)·CSV·확인 후 복사, 삭제 실행취소와 삭제 기록, 가입 비밀번호 즉시 기록(`record`)·제출 시 사용자 이름 채움(`adoptUsername`), 비밀을 제외한 UI 상태 |
| `importer.ts` | 지원 브라우저·프로필 탐지, 복사한 SQLite와 북마크 읽기, 쿠키·비밀번호 변환(비밀번호 변경 시각 포함), CSV 파싱·계정 병합 |
| `chromium-crypto.ts` | Chromium 암호문 복호화, macOS 키체인 키 유도·Windows v10 AES-GCM, app-bound v20 거부 |
| `autofill.ts` | 비밀번호 관리자 켜기/끄기(`vault.toggle`, `browser.vaultEnabled`), 로그인 IPC 발신자 검증, 네이티브 계정 선택 메뉴, 새 비밀번호 필드의 **강력한 비밀번호 사용**, 저장·업데이트 제안, 채우거나 입력한 비밀번호를 탭의 가림 목록에 등록, 에이전트 조작 중 제안 억제 |
| `signup.ts` | 자동 회원가입 설정(`signup.save`)·비밀번호 세트(`signup.presetAdd/presetDelete`, 상태 `signupPresets`)·첫 실행 설정 완료(`onboarding.done`), 에이전트 가입용 `SignupProvider`(`browser.signup`) |
| `password-rules.ts` | 사이트 비밀번호 조건 파싱(`passwordrules` → 속성 → 안내 문구), Chrome식 생성기, 조건 검사·부족 조건 문구, `+태그` 이메일 |
| `migrate.ts` | Own 실행 여부·이관 필요 여부 확인, 제외 목록에 따른 복사, 작업 폴더 경로 변경, 비밀 재암호화, 실패 시 재시도/건너뛰기, 이관 결과 기록 |
| `agent-api.ts` | 토큰 인증 loopback HTTP 서버, MCP 브라우저 도구, 작업 REST 경로, 설정 복사·재시작 복원·토큰 교체 |
| `engine.ts` | 작업 상태·취소·삭제·승인·실행 기록, 웹·파일 도구, 네트워크 차단 Docker 실행, 완료 근거 확인 |
| `models.ts` | `HeisenEngine`, 제공자별 모델 호출·도구 루프, 대화 이어가기, 심층 모드, SDK 지연 로드 |
| `auth.ts` | pi-ai OAuth(Claude Pro/Max, ChatGPT Plus/Pro, GitHub Copilot), API 키, 연결 상태·모델 목록 |
| `beta.ts`, `beta-util.ts` | Heisen Google 로그인·접근 게이트, 시스템 브라우저 OAuth와 loopback 콜백, PKCE 교환·세션 검증 |
| `data.ts` | `Data.open`으로 봉인 이관·설정 병합, 원자적 저장, `launch.json`, OS 보안 저장소 기반 `Secrets` |
| `preload.ts` | 로컬 UI에만 `window.heisen.call`, `onChange`, `onShortcut` 노출 |
| `routines.ts` | cron·시간대 예약, 중복 실행 방지, 새 작업 또는 기존 대화 Heartbeat 실행 |
| `store.ts` | SQLite 작업·이벤트·도구 저널·감사, payload 봉인·이관·작업 삭제 |
| `files.ts`, `protocol.ts` | 작업 폴더 경계·파일 처리와 해시, 공통 작업 형식·출처/입력 검증 |
| `platform.ts`, `platform-app.ts` | OS 경로·CLI/helper 위치·프로세스 종료·DPAPI·다운로드 출처 기록, 창 장식·http/https 기본 브라우저 |
| `sealed.ts` | AES-256-GCM 봉인·인증·원자적 파일 교체·평문 이관 |
| `sessions.ts`, `windows.ts` | 일반/시크릿 웹 세션·다운로드 공유, 창 레지스트리·전역 탭 ID·호출 창 문맥 |
| `sleeper.ts`, `sleep-util.ts` | 탭 재우기 적격성·시간/배터리/열 임계·메모리 예산 LRU·증가 감시·샘플 정리 |
| `shield.ts`, `privacy-util.ts` | webRequest 단일 소유, 네트워크 필터·쿠키·헤더·매개변수 정책·사이트 예외 |
| `reader.ts`, `readable.ts`, `readable-probe.ts` | 기사 판정·Readability/DOMPurify 추출·읽기 뷰·전역 설정 반영 |
| `https-first.ts`, `safebrowsing.ts` | HTTPS 업그레이드·인증서 차단, 로컬 위험 호스트 DB·목록 갱신·탭 한정 우회 |
| `downloads-guard.ts` | 위험 확장자 판정. 보류·허용·폐기는 `sessions.ts` |
| `tray.ts`, `updater.ts`, `release-key.ts` | 트레이, Ed25519 매니페스트 검증·설치·복구, 고정 공개키 |
| `importer-apple.ts` | Safari 북마크·기록, Firefox 북마크·기록·쿠키, 전체 디스크 접근 안내 |
| `audit-view.ts` | 에이전트 활동 조회에 내보낼 필드 제한 |
| `control-protocol.ts`, `control.ts` | 줄 단위 JSON-RPC·한도, 로컬 토큰 인증 제어 서버·작업 스트림·공유 도구 호출 |
| `cli/client.ts`, `cli/main.ts`, `cli/install.ts`, `cli/repl.ts`, `cli/mcp.ts` | 소켓/SSH 클라이언트·명령·설치·REPL·stdio MCP |
| `memory.ts`, `completion.ts` | 봉인된 파일 메모리·리비전·되돌리기·Dreaming, 도구 없는 모델 단발 호출 |
| `skills.ts` | SKILL.md 파싱·폴더/ZIP/Git 설치·검토·해시 검증·첨부·스크립트 준비 |
| `computer.ts` | 허용 앱·승인·helper 수명·중지 키·정리된 로그 |

네이티브 helper는 `helpers/computer/macos/main.swift`, `helpers/computer/windows/heisen-computer.ps1`, CLI 실행기는 `helpers/cli/`에 있다.

UI는 `ui/app.tsx`가 조립하며 `toolbar.tsx`, `tabstrip.tsx`, `findbar.tsx`, `sidebar.tsx`, `chat.tsx`, `library.tsx`, `memory.tsx`, `skills.tsx`, `settings.tsx`, `onboarding.tsx`, `common.tsx`로 나뉜다. UI는 파일·키체인·웹 세션을 직접 읽지 않는다. 탭 조작은 `tabstrip.tsx`, 메모리·스킬은 각 전용 화면, 에이전트 활동·대화 목록은 `library.tsx`, 기간 삭제·보안·CLI·컴퓨터 제어 설정은 `settings.tsx`가 담당한다.

## 시작·저장·종료

- `platform.dataRoot`로 macOS `~/Library/Application Support/Heisen/`, Windows `%APPDATA%\Heisen`을 선택한다. `HEISEN_DATA_DIR`는 격리 프로필이며 macOS에서는 `use-mock-keychain`을 사용한다. 이 테스트 프로필의 봉인 키는 실제 로그인 키체인 보호를 받지 않는다.
- 패키지 앱이 기본 프로필에서 `remote-debugging-port`/`remote-debugging-pipe` 스위치와 함께 시작되면 단일 인스턴스 잠금 전에 종료한다(Chrome 136의 기본 프로필 원격 디버깅 제한과 같은 방향).
- 새 프로필에 한해 `runMigration`이 기존 Own 이관을 처리한다. 실행 중인 Own은 먼저 종료하도록 묻는다.
  - 복사 제외: 캐시류(`Cache`, `Code Cache`, `GPUCache`, `CacheStorage`, `ScriptCache`, `blob_storage`, `Crashpad` 등)는 모든 깊이에서, 앱 UI 세션 파일(`Cookies`, `Local Storage`, `Session Storage`, `IndexedDB`, `Local State`, `Preferences` 등)과 `secrets.json`·`library.json`·`.runtime`은 프로필 최상위에서만 제외한다.
  - 따라서 웹 탭 세션 폴더 `Partitions/browser/`의 쿠키·Local Storage·IndexedDB는 복사된다. 웹사이트 로그인 유지 여부는 확인하지 않았다.
  - 복사한 `tasks.sqlite`의 작업 폴더 절대 경로를 Heisen 프로필 경로로 바꾼다.
  - 비밀 정보 이관 거절·실패 시 기존 암호문만 `secrets.own.json`으로 보관한다.
  - 복사 중 예외가 나면 **다시 시도**/**건너뛰기**를 묻는다. 건너뛰면 일부 복사된 `tasks.sqlite`(및 `-wal`, `-shm`)를 지우고 `declined`로 기록해, Heisen이 자기 `library.json`을 만들기 전에 실패가 조용히 묻히지 않게 한다.
- `Secrets` → `Data.open` → 봉인 codec을 사용하는 `Store` 순서로 저장소를 연다. `Sessions`·`Windows`는 웹 세션·창을, `MemoryStore`·`SkillStore`·엔진·루틴·Control·AgentApi·ComputerUse는 앱 전체 서비스를 소유한다. `launch.json`의 평문 MCP 실행 여부는 데이터 복호화 전 시작 설정에만 사용한다.
- `settings.onboarded`가 `false`면 UI가 다른 창이 없을 때 첫 실행 설정 창을 연다(기존 프로필 포함 한 번). 단계는 비밀번호 저장 켜기/끄기(`vault.toggle`) → 가져오기(`import.run`; `importOffered`가 `true`이거나 감지된 브라우저가 없으면 생략) → 자동 회원가입 기본값(`signup.save`, 세트 방식이면 `signup.presetAdd`; 비밀번호 저장을 끄면 생략)이다. 각 단계는 넘어갈 때 바로 적용하고, 완료·건너뛰기·닫기는 `onboarding.done`으로 `onboarded`와 `importOffered`를 `true`로 만든다.
- 로컬 UI를 연 뒤 저장 탭 복원을 시작하고, 활성 탭의 페이지 로딩을 기다리지 않고 창을 표시한다. 복원은 고정 탭을 앞으로 정렬한다. 비활성 탭은 메타데이터만 유지하고 선택·관찰 등 실제 사용 시 로드한다. 저장된 MCP 켜짐 상태도 복원한다.
- `settings.background` 기본값은 `true`다. 마지막 창을 닫아도 백그라운드 모드 또는 macOS이면 앱·루틴·MCP가 남는다. Windows에서 백그라운드를 끄면 마지막 창을 닫을 때 종료한다. 트레이·앱 활성화로 창을 다시 열 수 있다.
- 창이 0개가 되어도 저장 세션을 지우지 않고 다음 창에서 복원한다. 자동화의 창 생성은 비활성 표시를 사용한다. 작업은 시작 창에 고정하며 그 창이 닫히면 사용할 창에 다시 연결한다.
- 명시적 종료에서는 예약·소켓·MCP·helper를 정리하고 진행 중 작업을 취소한다. `Data.flush()`로 남은 변경을 저장한 뒤 종료한다.

`sealed.ts`는 `HSN1` 헤더·랜덤 IV·AES-256-GCM 태그를 사용하며 파일명 또는 레코드 식별자를 AAD로 묶는다. 랜덤 봉인 키는 `secrets.json`의 `sealKey`로 OS `safeStorage`에 보호한다(macOS Keychain·Windows DPAPI). OS 보안 저장소가 없을 때 평문 저장으로 전환하지 않는다.

`library.json`, 메모리 본문·이력·정리 보고서, `tasks.sqlite`의 작업/저널/감사 payload를 봉인한다. SQLite 자체·메타데이터, 스킬 패키지, `.workspace/` 작업 파일, 정리된 컴퓨터 제어 로그까지 전체 암호화하는 것은 아니다. 작업 파일은 Docker 마운트·사용자 파일 사용 때문에 평문이다.

기존 평문 파일은 `.v0`로 보관하고 봉인본을 만들며 이후 정상 시작에서 백업을 제거한다. `library.json` 인증 실패 시 남은 `.v0`를 복구에 사용하고, 없으면 손상본을 별도 이름으로 보관한다. 이전 앱으로의 롤백은 종료 후 이관 전 전체 프로필 백업을 복구하는 방식이다. `.v0`만 남았다면 현재 프로필을 보관한 복사본에서 대응 원래 이름으로 복구해야 하며 새 버전에서 추가한 데이터는 보존되지 않는다.

구독 로그인은 pi-ai OAuth로 처리하며 Heisen 탭에서 승인 페이지를 열어 가져온 세션을 재사용한다. 기존 Claude Code 비밀 정보와 이전 ChatGPT 인증 형식은 시작 시 제거하고, Claude 구독 설정·저장된 작업은 새 제공자 ID로 옮긴다.

Heisen 계정 로그인(`beta.ts`)은 Google의 내장 브라우저 차단을 피하도록 OS 기본 브라우저에서 진행한다. 앱은 `127.0.0.1`의 임의 포트에서 `GET /callback`만 받고, `/auth/start`에 `client=app`, 무작위 `state`, S256 PKCE challenge와 `redirect_port`를 보낸다. 서버는 로그인 결과를 이 포트로 돌려주며 앱은 state를 확인한 뒤 일회용 code와 verifier를 `/api/app/token`에서 교환한다. 성공 콜백은 브라우저를 쿼리 없는 `/auth/app/complete`로 보내고 앱 창을 포커스한다. 오류·state 불일치는 짧은 실패 안내만 표시한다. 콜백 수신·취소·앱 종료·새 로그인 시작 때 리스너를 닫고, 응답 없이 10분이 지나면 오류 없이 대기를 해제한다. Electron 로그인 창이나 완료 페이지 URL 가로채기 경로는 없다.

`tests/e2e-beta.ts`는 기존 Electron API spy 방식으로 테스트 프로세스의 `shell.openExternal` URL만 캡처한다. 실제 기본 브라우저를 열지 않고 `tests/beta-stub.ts`의 로그인 폼·loopback 리다이렉트·PKCE 교환을 HTTP로 끝까지 실행한다. 제품에 URL 캡처용 환경 변수나 별도 인증 우회 경로는 추가하지 않는다.

## UI RPC와 상태

호출 경로는 `window.heisen.call(method, args)` → `heisen:rpc` → 등록된 메서드다. `installRpc`는 발신 `webContents`, 메인 프레임, 정확한 로컬 UI URL을 확인한다. `Windows`의 호출자 문맥으로 창별 RPC를 처리하고 전역 탭 ID로 소유 창을 찾는다. 알 수 없는 메서드·잘못된 요청을 거부한다. 기능 모듈은 `registerRpc`로 추가하며 별도 UI IPC 호출 체계를 만들지 않는다.

| 등록 위치 | RPC·상태 예 |
|---|---|
| `main.ts` | `state`, `route`(`chats`, `activity` 포함), `task.*`, `browsing.clear`, `auth.*`, `routine.*`, `memory.*`, `skills.*`, `prefs.save`, `settings.security`, `cli.*`, `computer.*`, `background.toggle`, `defaultBrowser.*`, `audit.*` |
| `browser.ts` | `chrome.top`, 탭 다시 열기·선택·순환·복제·이동(`tab.move`)·메뉴(`tab.menu`)·배율, `find.*` |
| `permissions.ts` | `permission.decide/reset`; `permissionRequests`, `sitePermissions` |
| `passwords.ts` | `import.*`, `vault.*`(`vault.delete`, `vault.restore` 포함); `vault`, `importSources` |
| `autofill.ts` | `vault.toggle`, `password.prompt/menu`; `passwordPrompts`, `activePasswords` |
| `signup.ts` | `signup.save/presetAdd/presetDelete`, `onboarding.done`; `signupPresets` |
| `main.ts` + `agent-api.ts` | `mcp` 상태와 서버 켜기·끄기·복사·토큰 재발급 |

`state`는 기본 상태에 `collectState()` 결과를 합친다. `heisen:changed`는 상태 변경 알림이며 UI가 상태를 다시 가져온다. `heisen:shortcut`은 주소창·찾기·탭 검색·패널·가져오기·인터넷 사용 기록 삭제(`clear-data`) 같은 UI 동작을 전달한다. 메뉴에서 전달하기 전에 로컬 UI `webContents`를 포커스한다. 설정 화면이 메시지보다 늦게 마운트될 수 있으므로 `clear-data` 요청은 설정 화면이 받을 때까지 보류한다.

`browsing.clear`는 `range: hour/day/week/month/all`과 선택 항목을 받는다. 기록은 시각으로 걸러 지운다. 기간 지정 사이트 데이터는 삭제 전 기록에서 그 기간에 방문한 출처를 모아 처리하고, 쿠키는 등록 도메인 단위로 지운다. 전체 기간은 전체 사이트 저장소, HTTP 캐시는 기간과 무관하게 `clearCache()` 전체 삭제다. Electron에는 생성 시각별 사이트 저장소 삭제 API가 없어 정확한 시간 범위 데이터 삭제로 표현하지 않는다.

`task.delete`는 `Engine.delete`로 실행을 취소하고 메모리·`tasks.sqlite`(작업 행과 저널)에서 지운다. 진행 중이던 실행이 나중에 끝나도 `persist`가 삭제된 작업을 다시 쓰지 않는다. 이어서 작업 전용 탭을 닫고, 그 대화를 대상으로 하는 Heartbeat 루틴을 일시 정지하고, `.workspace/` 아래의 작업 폴더를 `shell.trashItem`으로 휴지통에 옮긴다.

일반 상태의 보관함과 비밀번호 제안에는 비밀번호가 없다. MCP 토큰도 일반 상태에 포함하지 않고 명시적인 설정 복사 경로에서 사용한다.

## 주소창·외부 앱·다운로드

- `omnibox(value)`는 `{url, fallback?}`를 돌려준다. 명시적 http(s) URL은 그대로, 다른 알려진 스킴(`mailto:`, `file:`, `javascript:` 등)은 오류다. 사용자 정보가 든 URL도 거부한다. `localhost`, `*.localhost`, IPv4, `[IPv6]`, 포트가 붙은 점 없는 이름은 `http://`, 알파벳 TLD(또는 `xn--`)가 있는 점 포함 호스트는 `https://`와 `http://` fallback, 나머지는 Google 검색이다.
- `HttpsFirst`가 공용 HTTP의 최상위 요청을 HTTPS로 올린다. 연결 실패 시 HTTP 경고 화면에서 사용자 동의를 받아 허용 호스트를 저장한다. 인증서 오류는 오류 화면만 표시하며 계속할 수 없다. HTTPS 실패를 곧바로 HTTP로 재시도하던 이전 경로는 제거했다.
- `heisen://<route>`는 UI(`toolbar.tsx`)가 처리한다. 앱 화면에서는 주소창에 이 형식을 표시하고, 입력하면 해당 화면으로 이동한다.
- 사용자 탭과 팝업의 `will-navigate`·`setWindowOpenHandler`는 http(s)와 같은 출처 `blob:`(http(s) 페이지가 만든 것)만 허용한다. 나머지 중 외부 앱 스킴(`externalScheme`이 웹·파일·스크립트·브라우저 내부 스킴을 제외한 것)은 `openExternal`로 넘긴다.
- `openExternal`은 사이트 권한의 `external:<scheme>`이 `allow`가 아니면 `열기`/`취소`(기본·취소 버튼 모두 `취소`)와 **항상 허용** 체크박스가 있는 메시지 상자를 띄운다. 체크하고 열면 출처별로 저장한다. 상자가 열린 동안 같은 `webContents`의 추가 요청은 버린다. 작업 전용 탭은 외부 스킴 이동을 막기만 하고 묻지 않는다.
- 다운로드는 공유 `Sessions`가 소유한다. 기본은 OS 다운로드 폴더·고유 파일 이름이며 `saveAs` 또는 `settings.downloads.askWhere`이면 위치를 묻는다. 위험 확장자는 `downloads-pending/<id>/`에 내려받기를 보류하고 사용자 허용 전 최종 경로로 옮기지 않는다. 빠르게 완료된 파일도 임시 보관에 남는다. 폐기 시 보관 파일을 지우며 완료 시 macOS quarantine/WhereFroms 또는 Windows MOTW를 기록한다.
- ⌘S(`menu.ts`)는 다운로드 폴더의 `<페이지 제목>.html`을 제안하는 저장 창을 띄우고 `savePage(…, 'HTMLComplete')`로 저장한다. 파일 이름에 쓸 수 없는 문자는 `_`로 바꾼다.

## 탭 순서

`Browser.tabs`의 `Map` 순서가 탭 목록 순서다.

- 새 탭 삽입 위치는 여는 탭 뒤(`insertAfterOpener`) 또는 지정 위치이며, 고정 탭은 고정 묶음 안으로, 일반 탭은 묶음 뒤로 제한한다.
- `moveTab`은 끌기 이동에서 같은 제한을 적용한다. 고정 전환은 고정 묶음의 끝 또는 일반 탭의 맨 앞으로 옮긴다.
- `closeSelection`은 활성 탭을 닫을 때 다음 탭을 고른다: 닫는 탭의 자식(오른쪽 우선) → 같은 여는 탭의 형제 → 여는 탭 → 오른쪽 → 왼쪽. 닫힌 탭의 자식은 닫힌 탭의 `openerId`를 물려받는다.
- 닫은 탭 목록은 고정 상태를 함께 저장해 다시 열 때 복원한다.
- `tabMenu`는 네이티브 탭 메뉴를 띄운다. 다른 탭/오른쪽 탭 닫기는 고정 탭과 작업 탭을 제외한다. 작업 탭에서는 메뉴의 고정 항목이 비활성이다.

## 웹 콘텐츠 격리와 입력

원격 페이지 뷰는 `sandbox: true`, `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true`를 유지하며 영구 `persist:browser` 세션을 공유한다. 페이지 메인 world에 `require`, `process`, `window.heisen`을 노출하지 않는다.

`Sessions`는 일반 세션과 메모리 내 시크릿 세션을 여러 창에 공유한다. 마지막 시크릿 탭이 닫히면 해당 세션 데이터를 정리한다. `web-contents-created` 전역 가드가 예상하지 않은 웹뷰·탐색·Bluetooth 선택을 막는다. Web Bluetooth는 기기 선택 UI가 없어 비활성이고 HID·Serial·USB 기기 허용 경로도 제한한다. USB 보호 클래스는 Chromium 기본값이며 보호 목록을 빈 배열로 덮어쓰지 않는다. 로컬 UI도 CSP를 적용한다.

`Shield`만 웹 세션의 `webRequest` 리스너를 설치한다. 위험 사이트·HTTPS 정책은 `Shield.rules`로 합성하므로 나중 리스너가 앞 리스너를 덮어쓰는 구조를 피한다. EasyPrivacy/EasyList는 번들 네트워크 필터이며 앱 런타임에 갱신하지 않는다. 교차 사이트 쿠키와 상세 Client Hints를 제거하고 교차 사이트 Referer를 출처로 줄인다. 사이트 쌍 쿠키 예외와 웹 권한의 출처 쌍 허용은 서로 다른 저장소다.

읽기 뷰는 Readability·DOMPurify로 정리한 `data:` 문서를 별도의 sandboxed `WebContentsView`로 표시한다. CSP로 스크립트·프레임을 막고 새 창을 거부하며 링크는 원본 탭 탐색으로 넘긴다. UI preload를 넣지 않고 에이전트는 원본 웹 탭만 조작한다. 설정 변경은 모든 창의 열린 읽기 뷰에 반영한다.

이 버전은 **웹 페이지 preload가 없는 구조가 아니다.** `gestures.ts`가 `page-preload.cjs`를 HTTP(S) 세션 프레임 preload로 등록한다. 이 preload는 격리 world의 `ipcRenderer`만 사용하고 `contextBridge`를 사용하지 않는다.

- `heisen:swipe`: 활성 사용자 탭의 메인 프레임인지 확인한 뒤 화살표 진행도와 탐색을 처리한다. 가로 스크롤 가능한 영역은 페이지 스크롤을 우선한다. 페이지 자체를 옆으로 움직이는 효과는 없다.
- `heisen:login-field`, `heisen:login-submit`: 사용자 탭의 메인 프레임·HTTP(S) 출처·메시지 형식을 검증한다. 로그인 필드 선택은 신뢰된 사용자 이벤트에서 시작하며 페이지 로드 자동 채움은 없다. 에이전트 조작 중에는 메뉴·저장 제안을 억제한다.
- 실제 로그인 채움 전에도 출처를 다시 확인한다. 비밀번호는 사이트 폼에 입력되지만 모델 도구 결과나 일반 UI 상태로 반환하지 않는다.
- 페이지 관찰은 격리 world에 최신 요소 참조를 보관한다. 이동·문서 변경 뒤 오래된 참조는 재관찰해야 한다. 파일 업로드와 로그인 채움도 전용 경로를 사용한다.
- `input.ts`의 CDP 입력과 `page-scripts.ts`의 페이지 관찰·검증을 구분한다. 기본 입력은 지연 없는 클릭·키·휠과 `Input.insertText` 한 번으로 처리한다. `settings.agent.humanize`(기본 `false`, 설정 > 보안 > 에이전트 사이트의 **사람처럼 천천히 입력**)를 켜면 이전 사람 흉내 타이밍을 사용한다. 동작 뒤 `settle`은 조용한 100 ms를 기다리되 최대 5초에 끝내고, 관찰에는 `loading`을 표시한다. 입력·스크린샷처럼 가시성이 필요한 동작은 대상 탭을 선택하지만 작업 창의 포커스를 가져오지 않는다. 처리할 수 없는 숨김 상태는 오류로 돌려준다.

UA는 Electron/Heisen 토큰이 없는 Chrome 형식이다. Client Hints의 Chromium 브랜드와 `navigator.languages` 순서 차이는 남아 있다. 신뢰된 입력 확인은 캡챠 감소·안티봇 우회 효과의 증명이 아니다.

## 에이전트 출력의 비밀번호 가림

페이지 쪽과 메인 프로세스 쪽 두 단계로 가린다.

- **페이지 쪽(격리 world 1001).** `sensitiveSetup`이 문서마다 한 번 `__heisenSecure`를 설치한다. 사용자 탭은 `dom-ready`에서, 모든 탭은 world 1001 스크립트를 실행하기 직전에 설치를 시도하며 먼저 설치된 것이 유지된다. `type` 속성 `MutationObserver`로 한 번이라도 `password`였던 입력을 기억한다. 그 밖에 `autocomplete`의 `current-password`/`new-password`, 이름·id의 password/passwd/passcode/pwd/pass/pw 형식 힌트로 비밀번호 필드를 판정하고 값 없는 입력 유형은 제외한다.
  - `snapshotScript`는 해당 필드를 역할 `password`, 값 없음으로 내보내고 본문·제목·URL·라벨·링크에서 해당 필드의 현재 값(4자 이상)을 가린다.
  - `markdownScript`도 같은 값을 가린다. `targetScript`의 `fill`은 비밀번호 필드를 거부한다.
- **메인 프로세스 쪽(`browser.ts`).** `secretsFor`는 페이지 출처에 저장된 비밀번호와 그 탭의 `filled` 목록을 4자 이상·긴 것 먼저로 합친다. `filled`에는 자동 완성·에이전트 로그인으로 채운 값과 사용자가 제출한 값이 들어간다. 탭이 다른 출처로 이동하거나 닫히면 지운다.
  - `redact`는 내장 작업의 `observe`와 MCP `agent()` 결과(스크린샷 제외), `list_tabs`의 제목·URL(`masked`)에서 모든 문자열을 검사해 해당 값을 `••••••••`로 바꾼다.
  - 비밀번호 원문은 페이지에 보내지 않는다.
- **스크린샷 검사.** 페이지의 `screenCheckScript`는 비밀번호 필드가 `password` 이외 유형으로 값이 보이는지, 해당 값이 본문에 있는지를 보고하고, 본문과 보이는 입력값을 메인 프로세스에 돌려준다. `screenGuard`는 그 결과나 알려진 비밀번호가 본문·입력값에 포함된 경우 캡처를 거부한다.

문자열 일치이므로 4자 미만, 일부 표시·변형된 값, 이미지·캔버스 속 글자는 대상이 아니다.

## 권한·비밀번호·가져오기

`Permissions`는 위치·알림·카메라·마이크·클립보드 읽기를 묻고 **요청 출처+최상위 출처**에 결정을 묶는다. 같은 제3자 출처라도 다른 임베딩 사이트로 승인을 옮기지 않는다. 전체 화면·정제된 클립보드 쓰기·포인터 잠금 등은 별도 자동 허용 정책이다. 작업 탭의 질문형 권한은 거부하며 이동·종료 시 대기 요청을 정리한다. 일반 탭으로 식별되지 않는 팝업에는 질문형 권한을 새로 승인하지 않는다. 외부 앱 **항상 허용**은 `permissions`의 `external:<scheme>` 키로 들어가며 사이트 재설정으로 지운다.

`Passwords`가 가져오기 동의와 암호화 보관함을 담당하고, `importer.ts`는 원본 DB가 아닌 임시 복사본을 읽는다. WAL·저널도 함께 복사하고 사용 뒤 지운다. 쿠키는 선택된 경우에만 Heisen 세션에 넣는다. 비밀번호는 출처·계정 기준으로 병합한다. 이후 동기화는 변경된 비밀번호의 추가·갱신만 처리하며 삭제 동기화는 하지 않는다. 키가 바뀌어 읽을 수 없으면 재인증이 필요한 상태로 전환한다.

비밀번호 삭제는 보관함에서 바로 지우고 `secrets.json`의 `vaultTombstones`에 출처·사용자 이름·삭제 시각을 남긴다. 지운 항목은 메인 프로세스 메모리에 10초 동안 보관하며 `vault.restore`로 되돌린다. 그 사이 같은 계정이 다시 저장되었으면 새 값을 유지한다. 브라우저 동기화·가져오기·CSV 병합은 삭제 기록이 있는 계정을 건너뛴다. 단, 원본의 비밀번호 변경 시각(`date_password_modified`, 없으면 생성 시각)이 삭제 이후면 가져온다. 보관함에 같은 계정이 다시 저장되면 해당 삭제 기록을 지운다.

비밀번호 관리자 끄기(`settings.vault=false`)는 저장·업데이트 제안, 자동 완성 메뉴, 주소창 열쇠 아이콘(`activePasswords` 0), 자동 동기화를 멈추고 `web_login`·`fill_login`·`web_signup`·`fill_signup`을 `비밀번호 관리자가 꺼져 있습니다.`로 실패시킨다. 저장된 데이터는 지우지 않으며 보관함 화면·수동 가져오기·CSV는 그대로 쓴다. 제출한 비밀번호를 에이전트 출력에서 가리는 동작은 꺼져 있어도 유지한다.

새 비밀번호 필드(`autocomplete=new-password`이거나 양식의 비밀번호 칸이 2개 이상, `current-password` 제외)의 메뉴에는 **강력한 비밀번호 사용**이 붙는다. 선택하면 `signupScanScript`로 양식 조건을 읽고 `generatePassword`로 만든 값을 world 1002에서 모든 비밀번호 칸에 넣은 뒤 사용자 이름 없이 보관함에 바로 기록한다. 이어지는 제출은 같은 비밀번호·빈 사용자 이름·가입 기록이 있는 항목을 찾아 저장 제안 없이 사용자 이름만 채운다(`adoptUsername`, 저장 안 함 목록 검사 뒤).

자동 회원가입(`web_signup`·`fill_signup`)은 다음 순서로 동작한다.

- `signupInfo`가 비밀번호 관리자 상태, 기본 이메일(`settings.signup.emails[0]`, `alias`면 첫 시도에만 `local+<호스트>@domain`), 그 이메일로 저장된 계정 여부를 승인 전에 확인한다. 내장 작업의 승인 해시는 `digest('signup:'+origin+':'+태그 없는 이메일)`, MCP는 서버 세션의 `'signup:'+origin` 키로 출처당 한 번 확인한다.
- `fillSignup`은 출처를 다시 확인하고 `signupScanScript`로 양식·조건 소스를 읽는다. 조건 우선순위는 `passwordrules` 속성 → `minlength`·`maxlength`·`pattern` 속성 → 비밀번호 칸 라벨·안내·오류 문구다(`parseRules`). 생성 방식은 Chromium `password_generator.cc` 규칙(15자, 혼동 글자 제외, 특수문자는 요구될 때만), 세트 방식은 아직 시도하지 않은 세트 중 조건을 만족하는 첫 세트이며 없으면 부족한 조건을 담은 오류로 실패한다.
- 채운 즉시 `rememberSecret`으로 가림 목록에 넣고 `Passwords.record`로 `signup:{by:'agent'}`와 함께 저장한다(제출 성공을 기다리지 않음). 비밀번호 칸이 없는 1단계 양식은 이메일만 넣고 시도로 세지 않는다.
- 탭·출처당 최대 3회이며 다른 출처로 이동하거나 탭을 닫으면 초기화한다. 재시도는 태그 없는 이메일을 쓰고 같은 계정 항목을 새 비밀번호로 덮어쓴다. 결과·이벤트·저널에는 이메일과 시도 횟수만 남는다.

macOS 키체인 조회는 `/usr/bin/security`를 호출하므로 확인 창에도 `security`가 요청자로 나타난다. Safari는 북마크·기록, Firefox는 북마크·기록·쿠키를 임시 DB 복사본에서 읽는다. iCloud 키체인·Safari 쿠키·Firefox 비밀번호는 직접 읽지 않으며 비밀번호 CSV 경로를 사용한다. Windows Chromium 계열은 DPAPI 키와 v10 AES-GCM을 읽고 app-bound v20은 우회하지 않는다. 실제 DPAPI 사용자 프로필 가져오기는 미검증이다.

## 내장 작업과 외부 MCP

내장 모델 작업은 `Engine`의 도구 카탈로그를 사용한다. 작업 소유 탭·출처·실행 세대와 취소 상태를 확인하고, 새 출처 접근·저장된 로그인 사용·자동 회원가입·코드 실행은 승인 경로를 거친다. 페이지와 파일 내용은 신뢰하지 않는 입력으로 취급한다. 코드 실행은 승인한 파일의 해시를 다시 확인한 뒤 작업 폴더를 마운트한 네트워크 차단 Docker에서 수행한다. 임의 호스트 셸을 모델에 제공하지 않는다.

내장 브라우저 동작 `web_click`·`web_fill`·`web_press`·`web_scroll`·`web_select`·`web_navigate`·`web_wait`은 동작 뒤 새 관찰과 다음 동작에 유효한 ref를 돌려준다. 관찰 본문은 2,000자까지만 전달하고 전체 Markdown은 `web_read`, 출처 저장은 `research_capture`를 사용한다. 같은 출처의 링크는 상대 경로로 줄이고 외부 출처 링크는 절대 URL로 유지한다. `web_navigate`도 새 출처에는 다시 승인을 받는다. 작업 탭의 CDP 디버거는 작업 수명 동안 유지하고 예기치 않은 해제는 오류로 처리한다.

`web_run`은 모델의 `page`·`tabs` 스크립트를 워커에서 한 번에 실행한다. 워커(`script-worker.ts`, 빌드 시 `dist/script-worker.cjs`)는 WASM으로 컴파일한 QuickJS realm을 만들고, 이 realm에는 Node·Electron·호스트 객체가 없다. 유일한 호스트 기능은 문자열을 받아 문자열을 돌려주는 브리지이며 결과와 오류도 문자열로만 나온다. QuickJS 메모리 256MB·스택 256KB, 워커 힙 256MB·네이티브 스택 16MB로 제한한다. 각 브라우저 호출은 기존 작업 도구를 거치므로 출처 승인·사이트 정책·감사 경로를 우회하지 않는다. 코드는 최대 60,000자, 호출은 200회, 무응답은 30초, 전체 실행은 10분으로 제한한다. 페이지 JavaScript·호스트 접근은 제공하지 않으며 작업을 취소하면 워커를 종료한다. 성공·실패 모두 로그를 남기고, 활동 화면에는 **스크립트 실행** 뒤에 내부 동작을 별도로 기록한다. 이는 승인된 작업 폴더 코드를 네트워크 차단 Docker에서 실행하는 `code_run`과 다른 경로다.

`models.ts`는 Claude 구독, ChatGPT 구독, Copilot, Gemini를 pi-ai `streamSimple`로 호출하며 앱의 승인·도구 실행 경계를 유지한다. 심층 모드는 다출처 비교·근거 저장 지시와 작업 한도를 달리하는 구현이지, Aside Ultrabrowse 알고리즘을 복제한 구현이 아니다.

`agent-api.ts`는 외부 에이전트가 **사용자 탭**을 조작하는 별도 경계다.

- loopback HTTP 서버이며 Bearer 토큰을 검사한다. 허용하지 않은 Host와 Origin 헤더가 있는 요청을 거부한다.
- `/mcp`는 POST 요청과 JSON 응답을 사용하는 MCP Streamable HTTP 경로다. `initialize`, `ping`, `tools/list`, `tools/call`을 처리한다.
- 탭 목록·열기·선택·닫기·이동, 관찰·입력·Markdown·스크린샷·로그인·가입·업로드·다운로드 목록·`wait_for`의 고정 도구 20개를 제공한다. 관찰·동작 결과의 압축 스냅샷은 `structuredContent`로도 돌려주며, 텍스트 스냅샷에는 로딩 중 `[loading] true`를 표시한다. HTTP/stdio MCP 카탈로그에는 임의 JavaScript 실행이 없다. 별도 제어 소켓의 `page.evaluate`만 설정·클라이언트 플래그의 이중 opt-in을 요구한다.
- 작업 전용 탭은 외부 MCP에서 제외하며 같은 사용자 탭의 에이전트 조작은 직렬화한다.
- 업로드, 저장된 로그인 입력, 자동 회원가입에는 사용자 확인이 필요하다. 확인 창은 `취소`/`허용`이며 기본 버튼과 취소 버튼이 모두 `취소`다.
- `fill_login`·`fill_signup`은 승인한 출처를 `Browser.agent(…,'login'|'signup',{origin})`로 넘긴다. `fillLogin`·`fillSignup`은 입력 직전에 탭의 현재 출처와 비교하고, 다르면 입력하지 않고 오류를 돌려준다. 두 도구 모두 비밀번호 관리자가 꺼져 있으면 확인 창 전에 실패하고 비밀번호를 응답에 넣지 않는다.
- `/tasks`, `/cancel`은 작업 목록·시작·취소용 REST 경로다. Slack·Telegram·Discord 연결을 구현한 채널이 아니다.
- `settings.agentApi`에 켜짐 상태·포트를 저장한다. 토큰 재발급은 기존 연결과 승인을 정리한다. 설정 화면의 복사 기능은 현재 주소·토큰으로 Claude Code 명령 또는 JSON 설정을 만든다.

MCP 도구 호출 분당 120회·HTTP 작업 시작 분당 10회, 확인창 직렬화·반복 거부 cooldown을 적용한다. 내장 작업·MCP·CLI가 에이전트 사이트 정책을 공유하며 활동은 `Store.audit` → `heisen://activity`로 조회한다. 감사 payload는 비밀번호·입력 원문을 담지 않도록 정리한 뒤 봉인한다. `models.ts`는 매 실행 nonce로 웹·파일·메모리·스킬·화면 자료를 비신뢰 구간에 묶고, 결제 민감 필드 입력은 도구 단계에서 거부한다. 프롬프트 경고는 완전한 인젝션 방어의 증거가 아니다.

## 탭 수명과 설정

재우기는 비활성·로드 완료·입력/캡처/소리/승인/팝업/작업/최근 에이전트 사용이 없는 탭에만 적용한다. 뷰를 닫고 URL·탐색 기록 등 복원 상태를 남기며 다시 사용하면 로드한다. 메모리 예산 초과는 적격 탭의 숨김 시각 순서로 처리하고 지속 증가 감시는 후보 판정에만 쓴다. 감시 샘플·폼 상태 확인은 수를 제한하고 재우거나 종료한 뷰의 상태를 정리한다. 공유 renderer의 사용량을 탭별 고유 메모리로 해석하지 않는다.

| 설정 키 | 기본값·범위 |
|---|---|
| `sleep` | `afterMin:30`, `afterMinOnBattery:10`, `budgetMiB:0`(자동: 전체 메모리의 1/4), `watchdog:true`, `leakFloorMiB:1024`, `leakRateMiBPerMin:50`. `afterMin:0`은 시간·배터리 재우기만 끔 |
| `energy` | `batterySaver:true`, `pauseHiddenVideo:true` |
| `privacy` | `trackers:true`, `ads:false`, `thirdPartyCookies:'block'`, `stripParams:true`, `clientHints:true` |
| `reader` | `size:18`, `theme:'auto'`; 밝게·세피아·어둡게 지원 |
| `https`, `safeBrowsing`, `downloads`, `agentSites` | HTTP 허용 목록 빈 배열, 위험 사이트 보호 켜짐, `askWhere:false`, 사이트 정책 빈 객체 |
| `agent` | `humanize:false`; 켜면 CDP 입력에 사람 흉내 타이밍 적용 |
| `cli`, `computer` | 소켓·페이지 스크립트·컴퓨터 제어 모두 꺼짐, 허용 앱 목록 비어 있음 |
| `dreaming` | 꺼짐, `cron:'0 4 * * *'`, 시스템 시간대 |
| `background` | 켜짐. 설정의 성능 및 에너지 > 시스템에서 변경 |

## 위험 사이트와 서명 업데이트

Safe Browsing은 Block List Project 5개(Unlicense)·Phishing.Database(MIT)를 내려받아 로컬 해시/목록 비트마스크 DB에 저장한다. 시작 15초 뒤·이후 매시간 확인하며 목록별 12시간 최신성 창과 ETag를 사용한다. 방문 URL을 원격 조회하지 않는다. 목록을 동봉하지 않아 첫 오프라인 실행에는 목록 기반 차단이 없고 갱신 실패 시 기존 목록을 유지한다. 측정된 DB는 6개 목록·3,407,700개 호스트 기준 283 MB에서 57 MB로 바뀌었다. 계속 허용은 일반 사용자 탭+호스트의 메인 프레임에만 적용하고 그 호스트를 떠나면 폐기한다. 하위 리소스·다른 탭·작업/시크릿 탭에 허용을 확장하지 않는다.

`Updater`는 `https://heisen.dev/dl/latest.json`의 정규화 JSON과 Ed25519 서명을 검증하고 이전 버전·만료된 매니페스트를 거부한다. 발행자는 발행 후 14일 만료를 넣고 만료 전에 재발행해야 한다. 클라이언트 시계 오차 허용은 5분이며 다운로드·설치 때도 만료를 확인한다. 설치 파일의 크기·SHA-256을 검증하고 사용자가 설치를 요청해야 교체한다.

macOS는 bundle ID·실행 파일·버전·codesign과 설치 앱의 Team ID를 확인한다. 설치 앱에 Team ID가 있으면 교체본도 같은 팀이어야 하며 로컬/ad-hoc 서명은 Team ID가 없다는 한계가 있다. 같은 파일시스템에서 앱을 `.old`로 옮기고 교체하며 실패하면 복구한다. 다음 정상 시작에서 이전 백업을 정리한다. Windows는 검증한 Setup.exe를 실행한다. 실제 자격을 사용한 배포·원격 설치 검증 여부는 README와 구분한다.

## 제어 소켓과 CLI

`control-protocol.ts`의 줄 단위 JSON-RPC를 앱과 시스템 Node CLI가 공유한다. `hello`에서 프로토콜·토큰·capability를 확인하고 이후 작업·메모리·스킬·루틴·`AgentApi.callTool`을 호출한다. 프레임·큐·속도·인증 대기 한도를 두며 연결 종료 시 구독·승인을 정리한다. 소켓은 기본 꺼짐이며 CLI 설치와 활성화는 별도다.

- POSIX: `<profile>/run/` 0700, `heisen.token`·`heisen.sock` 0600. 클라이언트는 uid·비공개 모드·파일 종류·심볼릭 링크·토큰 파일 교체를 확인한다. 토큰은 서버 시작마다 새로 만든다.
- `--profile`이 선택한 프로필로 경로를 계산하고 `--socket`은 그 경로와 일치해야 한다. 임의 소켓에 다른 프로필 토큰을 보내지 않는다.
- Windows: 정규화한 프로필 루트 SHA-256의 앞 32 hex로 named pipe를 구분한다. Node는 pipe peer 소유자·ACL을 검사하지 못한다. 사용자별 비공개 프로필의 상속 ACL을 전제로 하며 공유 프로필은 지원 전제가 아니다.
- `--host`는 `ssh -T <host> heisen --stdio`로 연결한다. 원격 CLI가 로컬 토큰을 넣고 중계하며 TCP 제어 서버를 공개하지 않는다. 원격 프로필/소켓 옵션 조합은 거부한다.
- CLI REPL과 내장 `web_run`은 `script-api.ts`의 `page`·`tabs` API(`SCRIPT_BOOTSTRAP` 하나)를 공유한다. `page.find(role,name)`은 최근 스냅샷의 ref를 찾고 `page.waitFor`는 조건을 기다린다. `structuredContent`가 있으면 구조화 스냅샷을 사용한다. REPL은 사용자 자신의 코드를 CLI 프로세스의 VM realm에서 실행하고 `require`·`process`를 노출하지 않는다. `vm`은 보안 경계가 아니므로 신뢰할 수 없는 코드를 안전하게 실행한다고 설명하지 않는다. 모델이 작성하는 `web_run`만 QuickJS(WASM) realm에서 실행한다.
- 페이지 JS는 `settings.cli.pageScripts`와 `--allow-page-js`로 요청한 연결 capability가 모두 있어야 한다. stdio MCP는 고정 브라우저 도구를 공유한다.
- CLI 실행기는 시스템 Node 22 이상을 사용한다. Windows `heisen.cmd`는 고정 Node 설치 위치만 탐색하고 CWD/PATH의 실행 파일을 사용하지 않는다.
- CLI는 `snapshot`·`click`·`type`·`key`·`scroll`·`select`·`go`·`read`·`shot`·`wait` 원샷 명령으로 같은 도구 경로를 호출한다. 에이전트 벤치는 백그라운드 로컬 fixture에서 `npm run bench:agent -- --out <파일>`로 실행한다. 원본은 [변경 전](evidence/bench-agent-before.json)과 [변경 후](evidence/bench-agent-after.json)에 둔다.

## 메모리 저장소

`MemoryStore`는 `memory/<name>.md`, `history/<revision>.json`, `dreams/<id>.json`을 봉인해 저장한다. 파일명·확장자는 평문 내용이라는 뜻이 아니다. 이름·크기·경로·파일 종류를 검사하고 변경은 직렬화한다. 이전 `Library.memory`는 이관 저널을 거쳐 파일로 옮긴 뒤 비운다.

리비전은 전후 내용·작성자·작업/정리 ID를 담는다. 되돌리기는 선택 리비전의 `before`로 새 변경을 만들며 원래 이력을 지우지 않는다. `Dreaming`은 도구 없는 `completion.ts` 호출로 변경 집합을 받고 스키마·이름·중복·최대 변경·과반 삭제·동시 수정 여부를 확인한다. 적용/거부/실패 보고서를 보관하며 자동 예약은 기본 꺼짐이다.

## 스킬 패키지

`SkillStore`는 SKILL.md의 YAML `name`, `description`, `allowed-tools`, `sites`와 본문을 읽는다. 폴더·ZIP·Git 설치는 경로 탈출·링크·특수 파일·크기·파일 수를 검사하고 검토한 바이트만 임시 staging에서 게시한다. 패키지 해시가 바뀌면 비활성화·재승인을 요구한다. Git 설치는 hook·사용자 설정 등 실행 표면을 제한한다.

활성·승인된 스킬만 선택·요청과의 단어 일치로 첨부한다. 본문·스크립트 사용 전 다시 무결성을 확인하고 Python/JavaScript를 작업 폴더로 준비한다. `code_run`은 그 파일의 승인·해시를 확인한 뒤 네트워크 차단 Docker에서 실행한다. 선언한 도구·사이트 목록은 사용자 검토 정보이며 기존 승인 경계를 해제하지 않는다. 패키지와 메타데이터는 평문이다.

## Computer Use

`ComputerUse`가 앱 허용 목록·작업 승인·helper stdio 수명·시간 초과·중지 표시기·전역 중지 키를 소유한다. macOS helper는 ScreenCaptureKit·AX·CGEvent, Windows helper는 PowerShell·UIA·SendInput을 사용한다. 비밀번호/보안 입력을 거부하고 앱을 벗어나는 키·붙여넣기는 추가 승인을 받는다. helper 중단·작업 취소·설정 끄기·중지 키에서 세션을 끝낸다. 중지 키 등록 실패 시 시작하지 않는다.

캡처·관찰 결과는 비신뢰 자료로 모델에 전달한다. `computer/log.jsonl`에는 입력 원문 대신 길이, 화면 픽셀 대신 동작 메타데이터를 남긴다. 허용 앱을 다룬다는 것이 OS 권한 경계를 우회한다는 뜻은 아니다. Windows 잠금/UAC 보안 데스크톱·고권한 앱은 별도 제약이며 실제 대화형 Computer Use는 미검증이다.

## 빌드·패키징과 검증 경계

`scripts/build.mjs`는 메인 ESM·동적 chunk·로컬 UI·UI/페이지 preload·CLI·읽기 도구 번들을 만들고 필터·CLI/helper 리소스를 준비한다. `scripts/package.mjs`는 macOS arm64/x64 DMG 또는 Windows x64/arm64 Squirrel Setup.exe를 생성한다.

- 출력 폴더: 기본은 `release/`, `HEISEN_UNFUSED=1`이면 `release-test/`.
- `en`·`ko`·`Base` 이외의 `.lproj`를 지운다.
- 기본 빌드에서만 `@electron/fuses`로 `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`를 끄고 `EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar`, `EnableCookieEncryption`을 켠다. `release-test/`는 이 단계만 건너뛴다.
- macOS는 안쪽 Mach-O → 중첩 앱/프레임워크 → 앱 번들 순서로 hardened runtime 서명한다. `HEISEN_SIGN_IDENTITY` Developer ID가 우선이며 없으면 로컬 자체 서명/ad-hoc을 쓴다. Developer ID용 entitlements에서 라이브러리 검증 해제를 빼고 로컬/ad-hoc에만 추가한다.
- `HEISEN_NOTARY_PROFILE`은 Developer ID와 함께 DMG 공증 제출·성공 확인·staple에 사용한다. Windows `HEISEN_WIN_SIGN`은 signtool 매개변수만 받아 실행 파일·설치 프로그램에 적용한다.
- CLI·네이티브 helper는 ASAR 밖 리소스에 포함한다. Claude Code 실행 파일은 포함하지 않는다. macOS 최종 서명은 `codesign --verify --deep --strict`로 확인한다.
- 릴리스 Ed25519 개인키는 로그인 키체인 서비스 `heisen-release-key`/계정 `heisen`에 보관하며 사용자 백업이 필요하다. 공개키 변경만으로 기존 설치본의 신뢰가 옮겨지지 않는다.

전후 성능 수치는 메인의 동일 조건 측정 후 [README 성능 절](../README.md#성능과-패키지-크기)에 넣는다. 이 문서는 속도·메모리·배터리 개선을 추정하지 않는다.

개발 전용 `HEISEN_LEGACY_DIR`, `HEISEN_TEST_KEYCHAIN`, `HEISEN_IMPORT_ROOT`는 임시 픽스처를 사용하기 위한 주입점이며 패키지에서는 무시한다. 그래서 패키지 E2E가 통과해도 개발 전용 가져오기·이관 검사가 패키지에서 실행되었다고 해석해서는 안 된다. 패키지 E2E는 Playwright가 `--inspect`를 써야 하므로 `release-test/`를 대상으로 하며, `HEISEN_DATA_DIR` 격리 프로필이라 원격 디버깅 거부 규칙에도 걸리지 않는다.

제공자 로고는 `ui/logos/`(lobe-icons, MIT)에 있고 `scripts/build.mjs`가 `dist/logos`로 복사한다.

`scripts/pc.mjs`는 Windows 전용 작업 폴더에 공개된 HEAD만 동기화하고 install/test/package/e2e/fetch를 수행한다. Node 24·Git·.NET 4.6.2 이상, 대화형 E2E에는 로그인된 데스크톱·컨테이너 구간용 Docker Desktop이 필요하다. Windows 10 x64의 build/package·단위 테스트 기록과 제목 표시줄 확인은 [README 검증 결과](../README.md#검증-결과)에 기록한다. arm64 기기 실행·실사용 DPAPI/MOTW·Windows 대화형 Computer Use, 실계정 OAuth·모델 추론은 별도 미검증이다.
