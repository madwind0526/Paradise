# Paradise 코드 리뷰

> 리뷰 대상: 저장소 전체 (`src/`, `shared/`, `server/`, `desktop/`, `scripts/`, `android/`, `public/`, 설정 파일)
> 리뷰 일자: 2026-11-09
> 검증: `npm test` 9/9 통과, `npx tsc --noEmit` 오류 없음 (lint 스크립트는 없음)

---

## 처리 결과 (2026-11-09)

- **수정함:** H-1(재생/일시정지 아이콘·라벨), H-3(복원 뒤 셔플/반복 재동기화), H-4(추가 지도 파일을 `data/maps/added`로), M-1(모달 리스너 누수), M-2(설정 필드 검증·옛 키 제거), M-6(데스크톱 두 번째 인스턴스), L-1(죽은 코드: `swatch`, `IconNode`; `tilt`는 `snapshot()`이 쓰므로 유지), L-2(저장 지도 수를 `.json` 개수로), L-4(`normalize`가 옛 키 제거), L-6.
- **문제 아님/보류:** H-2(기본 목록 ID는 YouTube oEmbed가 정상 응답함, 실기기 재생은 미확인), M-3, M-4, M-5, L-3, L-5(별도 작업으로 남김).

---

## 0. 한눈에 보는 요약

전체적으로 **구조가 깔끔하고 안전 장치가 잘 갖춰진 코드**입니다. 지도 검증기(`shared/spec.mjs`)를 앱·스튜디오·서버·테스트가 **공유**하는 점, 정적 파일 경로 탈출 방어, CSRF 성격의 쓰기 요청 가드(`Sec-Fetch-Site`), 텍스처/GPU 메모리 해제(`dispose`) 등은 모범적입니다.

다만 **사용자에게 바로 보이는 기능 버그 몇 개**와, **설정 복원/저장 경계의 일관성 문제**가 눈에 띕니다. 아래 우선순위대로 고치면 체감 품질이 크게 올라갑니다.

| 심각도 | 개수 | 핵심 |
|---|---|---|
| 🔴 높음 | 4 | 재생 아이콘 미갱신, 기본 유튜브 목록 ID 의심, shuffle/repeat 복원 후 불일치, 데스크톱 저장 위치 |
| 🟠 중간 | 6 | 모달 리스너 누수, 설정 필드 미검증, 유튜브 반복 동작, 정적 파일 통짜 읽기, 저장 용량 한도, 단일 인스턴스 |
| 🟡 낮음 | 6 | 죽은 코드, 파일 수 제한 off-by, 구버전 키 잔재, 접근성 등 |

---

## 1. 🔴 높음 (먼저 고칠 것)

### H-1. 재생/일시정지 버튼 아이콘이 절대 바뀌지 않음
- 위치: `src/main.ts:85`
- 문제: `musicBtn`은 항상 `Play` 아이콘으로 생성되고, 이후 어디에서도 아이콘을 갱신하지 않습니다. 실제로는 `sound.setMusic(!sound.musicOn)`로 재생/정지를 토글하지만 화면은 계속 "재생" 아이콘입니다.
- 추가 악화: `src/audio.ts:204` (반복 꺼짐 + 목록 끝)와 `:82` (트랙 연속 실패)에서 `musicOn`을 **코드가 직접 false로** 바꾸는데, 이때도 UI가 전혀 갱신되지 않습니다.
- 영향: 사용자는 지금 음악이 켜졌는지 꺼졌는지 알 수 없고, 흔들림(sway) 상태도 `musicOn`에 묶여 있어 혼란을 줍니다.
- 제안: `refreshMusic()`를 만들고 `setMusic`, `ended`, `error`, `advance` 시점에 아이콘(`Play`↔`Pause`)과 `aria-label`을 갱신하세요.

```ts
function refreshMusic() {
  musicBtn.replaceChildren(ic(sound.musicOn ? Pause : Play));
  musicBtn.title = musicBtn.ariaLabel = sound.musicOn ? "일시정지" : "재생";
}
```

### H-2. 기본 유튜브 재생목록 ID가 잘린 값으로 보임
- 위치: `src/config.ts:2`
- 값: `https://www.youtube.com/watch?v=1t39vq3LdRs&list=PLCqwmfitbQCY`
- 문제: `list=PLCqwmfitbQCY`는 13자입니다. 일반적인 YouTube 재생목록 ID는 34자(`PL...`)입니다. 값이 잘렸거나 임의 문자열이면 플레이어가 `onError`를 내고 `nextVideo()`만 반복하다 조용히 무음이 됩니다.
- 영향: 신규 사용자가 아무 음악도 설정하지 않았을 때 **기본 음악이 재생되지 않을 가능성이 큼**.
- 제안: 실제 재생 가능한 재생목록/영상 ID로 교체 후 실기기에서 확인. 또한 `onError`가 반복될 때 콘솔 경고 또는 UI 안내를 추가.

### H-3. `shuffle`/`repeat`는 서버 설정 복원 전에 적용되어 불일치 가능
- 위치: `src/main.ts:100-102` (동기 실행) vs `src/main.ts:561-570` (`restore()`는 비동기)
- 문제:
  1. 모듈 로드 시 `localStorage` 값으로 `sound.shuffle`, `sound.repeat`, `refreshModes()`를 적용합니다.
  2. 이후 `loadBuiltins().then(...)`에서 `await restore(s)`가 **서버 설정을 `s`에 덮어쓰고** `normalize`합니다.
  3. 하지만 `Sound` 객체와 `refreshModes()`는 **다시 동기화되지 않습니다**. `apply()`도 shuffle/repeat는 건드리지 않습니다.
- 영향: localStorage와 서버 설정이 다르면(기기 변경, 백업 복원 등) 버튼 표시와 실제 재생 모드가 어긋납니다.
- 제안: `restore` 이후 `sound.setShuffle(s.shuffle); sound.setRepeat(s.repeat); refreshModes();`를 `apply()` 안에서 호출.

### H-4. 데스크톱에서 "추가한 지도" 파일이 설치 폴더에 저장됨
- 위치: `server/index.mjs:12-14`, `:144`
- 문제: `settings.json`은 `PARADISE_DATA`(=`%APPDATA%` 아래 userData)에 저장되지만, 추가 지도/카드 그림은 `addedDir = PUB/maps/added`에 저장됩니다. 데스크톱에서는 `PARADISE_WWW = desktop-www`(설치 디렉터리)라서 **설치 폴더 안에 사용자 데이터가 기록**됩니다.
- 영향:
  - 재설치/업데이트 시 추가 지도 파일이 사라짐(설정에는 남아 있어 흔적이 어긋남).
  - 관리자 권한/읽기 전용 위치에 설치되면 저장이 실패.
  - 데스크톱의 `PUB === DIST`(둘 다 `desktop-www`)라 의도가 모호함.
- 제안: 추가 지도 보관 위치는 `PARADISE_DATA`(예: `DATA/maps/added`)로 옮기거나, 최소한 읽기 전용 시 우아하게 실패 처리.

---

## 2. 🟠 중간

### M-1. `closeTop()`이 keydown 리스너를 정리하지 않음 (리스너 누수)
- 위치: `src/main.ts:326` (`closeTop`), 등록은 `src/main.ts:166`
- 문제: `openModal`이 `keydown` 리스너를 등록하고 정상 `close()`에서만 제거합니다. `closeTop()`은 `.modal` DOM만 지우므로 리스너가 남습니다. 탐색기(`openExplorer`)를 열고 항목을 선택할 때마다 누적됩니다.
- 영향: 메모리/이벤트 누수, 닫힌 모달의 stale 클로저가 Escape에 반응.
- 제안: 모달 인스턴스에 `close()`를 보관해 `closeTop`에서 호출하거나, `openModal`이 `close` 핸들을 반환하도록 변경.

### M-2. `normalize()`가 많은 설정 필드를 검증하지 않음
- 위치: `src/state.ts:35-48`
- 문제: 검증되는 것은 `cycle`, `eq`, `maps`, `pictures`, `playlist`, `lastSky`뿐입니다. `name`, `figure`, `tz`, `musicVol`, `ambientVol`, `critters`, `shuffle`, `repeat`, `musicKind`, `musicPath`은 타입을 신뢰합니다.
- 영향: 손상/구버전 데이터로 `musicVol = NaN`이면 오디오 볼륨이 NaN이 되고, `name`이 문자열이 아니면 서버 PUT이 400으로 조용히 거부되어 저장이 안 됩니다.
- 제안: 각 필드에 타입/범위 보정(예: `clamp(Number(...)||default)`), 그리고 알 수 없는 키(`body`, `animation` 등) 제거.

### M-3. YouTube 재생목록 모드에서 `repeat: "off"`가 실제로는 안 멈춤
- 위치: `src/audio.ts:150`, `:228`, `:163`
- 문제: 반복 꺼짐은 `setLoop(false)`만 호출합니다. YouTube 재생목록은 자체적으로 다음 영상으로 자동 진행하므로 "한 곡 후 정지"가 되지 않습니다.
- 영향: 반복 "끔"의 의미가 로컬 파일과 YouTube에서 다르게 동작.
- 제안: 문서화하거나, `onStateChange(ENDED)` + `repeat==="off"`일 때 `pauseVideo()`.

### M-4. 정적 파일을 `readFileSync`로 통째로 읽음 (성능/메모리)
- 위치: `server/index.mjs:233`
- 문제: 이미지/오디오/HTML 모두 `fs.readFileSync` 후 전송합니다. `/sounds/*.mp3|ogg` 같은 큰 파일도 매 요청마다 전체를 메모리에 올립니다. 범위 요청(Range)도 지원하지 않습니다.
- 대조: `/api/fs/file`은 `serveAudio`로 스트리밍 + Range를 지원.
- 제안: 정적 라우트도 `fs.createReadStream` + `Content-Length`/Range로 통일.

### M-5. 설정이 커지면 저장이 조용히 실패할 수 있음
- 위치: `src/state.ts:61-71`, `server/index.mjs:185-189`
- 문제: 설정에는 카드 그림(JPEG data URL, 최대 30장)과 지도가 포함되고, 서버 PUT 본문 한도는 1MB입니다.
  1. `localStorage.setItem`이 쿼터 초과로 throw → catch로 무시(세션 한정).
  2. 디바운스된 PUT이 1MB를 넘으면 서버가 400 → 역시 catch로 무시.
- 영향: 그림이 많아지면 "설정이 저장되는 것처럼 보이지만 다음 실행에 사라짐".
- 제안: 카드 그림은 IndexedDB/파일로 분리하거나, 저장 실패 시 사용자에게 1회 안내.

### M-6. 데스크톱 단일 인스턴스 처리에서 조기 반환 누락
- 위치: `desktop/main.cjs:12`
- 문제: `if (!app.requestSingleInstanceLock()) app.quit();` 이후에도 아래 코드가 계속 등록됩니다. `return`(또는 `else` 블록)이 없어 두 번째 인스턴스가 불필요한 환경변수/리스너를 설정합니다.
- 제안: `if (!app.requestSingleInstanceLock()) { app.quit(); } else { /* 나머지 등록 */ }` 구조로.

---

## 3. 🟡 낮음 / 정리

### L-1. 죽은 코드 / 미사용 심볼
- `src/ui.ts:22` `swatch()` 사용처 없음.
- `src/main.ts:10` `IconNode` import 미사용.
- `src/world.ts:280` `tilt` 항상 0 (고정 시점). `snapshot()`이 저장/복원하지만 값 변화 없음. 주석과 함께 정리 권장.

### L-2. 추가 지도 파일 수 제한이 주석과 불일치
- 위치: `server/index.mjs:23,152`
- `MAX_ADDED_MAPS = 200` 주석은 "지도 200개"인데 실제 검사는 `* 2`(약 400 파일). 지도+그림 2파일 가정이지만, 그림 없는 지도만 쌓이면 400개까지 허용됩니다. 의도 명확화 또는 정확한 카운트.

### L-3. 저장한 지도 `.json`/`.jpg`는 다시 읽히지 않음
- 위치: `server/index.mjs:142-174`
- 추가 지도는 설정(`settings.json`)으로만 복원되고, `maps/added/*.json`은 사람이 보는 백업일 뿐 앱이 재로딩하지 않습니다. "지도 복구"를 기대한다면 목록 API가 필요. 아니라면 주석으로 명확히.

### L-4. 구버전(Voyager) 잔재 키
- 위치: (gitignore된) `data/settings.json`에 `body`, `animation`, `motion` 존재.
- `restore()`가 알 수 없는 키를 그대로 유지·재전송합니다. `normalize()`에서 화이트리스트로 정리하면 깔끔.

### L-5. 모달 접근성(focus 관리) 부재
- `openModal`(`src/main.ts:159`)이 포커스를 모달로 옮기지 않고 포커스 트랩도 없습니다. 키보드 사용자가 배경 HUD를 계속 탭할 수 있습니다. `role="dialog"`/`aria-modal`은 잘 지정되어 있으니, 최초 포커스 이동 + `Tab` 순환만 추가하면 좋습니다.

### L-6. 소소한 타입/캐스팅
- `src/main.ts:47` `validateMap(...) as any).value` — 실패 시 `.value`가 undefined지만 이 호출은 항상 성공하므로 실질 위험 낮음. 그래도 `r.ok` 확인이 안전.
- `src/main.ts:503` `curMap()`을 두 번 호출(미세 비용). 지역 변수로 한 번만.

---

## 4. 영역별 세부 메모

### `shared/spec.mjs` (지도 검증기) — 양호
- 정규식으로 `scenery.photo`, `sky.picture`, `nightPhotos`를 화이트리스트 검증 → 경로 탈출/외부 URL 차단. 테스트로도 확인됨.
- 값 clamp/기본값 채움 일관적.
- 제안: `author`도 길이 제한은 `text()`로 되지만, `sky.hour`가 `0..24`(24 포함)인데 렌더러는 24를 0과 동일 취급 → 문서에 명시하거나 `< 24`로.

### `server/index.mjs` — 대체로 견고
- 정적 경로는 `path.join`+`within(root)`로 `..` 탈출 방어, 테스트 있음. 좋음.
- 쓰기 요청은 local + `Sec-Fetch-Site` + JSON content-type 검사로 CSRF 방어. 좋음.
- `readBody` 초과 시 즉시 destroy + reject. 양호.
- `serveAudio`는 Range 지원. 좋음.
- 개선: 위 H-4(저장 위치), M-4(스트리밍), `send`가 헤더 전송 후 예외 시 대비(현재 try/catch는 있으나 응답 중복 가능성).

### `src/world.ts` — 설계 훌륭, 유지보수 포인트
- 텍스처 교체 시 이전 텍스처 `dispose()`, 로드 경합 가드(`photoUrl`, `figureUrl` 비교) 등 메모리/경합 처리가 꼼꼼함.
- `renderOrder`와 반투명/불투명 패스 구성이 의도적으로 설계됨.
- 주의: 셰이더 머티리얼(`nightMat`, `dayMat`, `deckMat`, `hazeMat`, `photoMat`, `figureMat`)이 **모듈 전역 공유**입니다. 현재 페이지당 `World` 1개라 문제없지만, 같은 페이지에서 두 개를 만들면 유니폼이 충돌합니다. (스튜디오/앱은 별도 페이지라 OK — 주석으로 명시 권장.)
- `snapshot()`은 같은 태스크에서 렌더 후 `drawImage`하므로 `preserveDrawingBuffer` 없이 동작. 다만 정오 프레임이 1프레임 깜빡일 수 있음(경미).

### `src/audio.ts` — 기능 풍부, 상태 동기화 주의
- EQ 경로(동일 출처/blob)와 plain 경로 분리, YouTube 폴백, 실패 트랙 스킵 등 견고.
- H-1/M-3 이슈 외에, `eqAvailable`가 `start()` 전에는 항상 false라 설정 화면의 "EQ 미적용" 안내가 로컬 음악에도 잠깐 표시될 수 있음(경미).
- `setInterval`(gust)는 정리되지 않지만 앱 수명과 동일하므로 허용.

### `src/main.ts` — 상태 흐름이 핵심 리스크
- `addMap`의 검증→저장→적용 흐름과 파일 저장(fire-and-forget)은 합리적.
- H-1/H-3/M-1 이슈가 모두 여기.
- `apply()`가 `setShuffle/setRepeat`를 빼먹은 점이 H-3의 원인.
- 지도 삭제 시 `void pickSky()` 미호출 → 하늘 사진이 잠깐 남을 수 있음(경미).

### `src/state.ts` — 경계 검증 보강 필요 (M-2)
- 저장(localStorage 즉시 + 서버 디바운스), 복원(서버 우선) 흐름은 명확.
- 필드별 검증/화이트리스트 추가 권장.

### 빌드 / 배포
- `scripts/build-app.mjs`, `build-desktop.mjs`가 스튜디오/추가지도 제외하고 복사하는 패턴 일관적.
- `pages.yml`: `make-index → build → rm dist/studio.html` 순서 양호. 다만 `studio` 청크 JS는 남으므로 완전 제거는 아님(경미).
- `index.html`의 Cloudflare 토큰은 **공개 사이트 분석용 토큰**(비밀 아님), github.io에서만 로드 — 적절.
- `index.html`의 `/manifest.webmanifest`, `/icon.svg`는 Vite base(`/Paradise/`) 처리에 의존하므로 Pages 배포에서 한 번 실제 확인 권장.

### Android (`FolderMusicPlugin.java`) — 양호
- API 29+/이하 분기, 권한 별칭, LIKE 이스케이프(`%`, `_`, `\`) 처리 등 세심함.
- 쿼리 인자는 바인딩(`?`)으로 SQL 인젝션 방지. 좋음.
- 참고: SAF로 고른 트리 경로를 MediaStore `RELATIVE_PATH` 접두사로 재해석하므로, SD카드 등 보조 볼륨에서는 경로가 어긋날 여지가 있음(엣지 케이스).

### CSS (`src/style.css`)
- `:has()` 사용(모던 브라우저 한정), `dvh`/safe-area, 세로 고정 회전 처리 등 모바일 앱 지향에 맞음.
- 데스크톱 스튜디오 레이아웃 분리 양호.

---

## 5. 테스트 / 검증

- `npm test` → 9개 전부 통과 (spec 5 + server 4).
- `npx tsc --noEmit` → 오류 없음.
- 좋은 커버리지: 검증기 규칙, 빌트인 지도 유효성/사진 존재, 가이드 문서 JSON 일치, 경로 탈출, 이미지 MIME, 쓰기 가드.
- 보강 제안:
  - `state.normalize()` 단위 테스트(손상 값 복구).
  - `addMap`/지도 파일 수 제한 테스트.
  - 정적 Range 처리(추가 시) 테스트.
  - 오디오 상태 전이(반복/셔플/실패 스킵) 단위 테스트는 DOM 의존이라 어렵다면 최소한 `buildOrder`/`advance` 로직 분리 후 테스트.

---

## 6. 잘한 점 (유지할 것)

1. **단일 진실 공급원**: `shared/spec.mjs`를 앱/스튜디오/서버/테스트가 공유 → 규칙 불일치 위험 최소화.
2. **보안 기본기**: 정적 경로 탈출 방어 + root 구분자 검사, local 전용 API, Host 검사(DNS 리바인딩 완화), `Sec-Fetch-Site`+JSON 검사(CSRF 완화).
3. **우아한 성능 저하**: `Promise.allSettled`로 지도 일부 실패 허용, 서버 없을 때 `app-index.json` 폴백 + `standalone` 클래스.
4. **리소스 관리**: 텍스처 `dispose()`, 로드 경합 가드, 전역 알림 이벤트 정리(정상 경로).
5. **문서화**: AGENTS.md/README/docs가 코드 구조와 규칙을 잘 안내.

---

## 7. 권장 조치 순서

1. **H-1** 재생 아이콘 상태 동기화 (사용자 체감 즉시 개선)
2. **H-2** 기본 유튜브 목록 ID 검증/교체
3. **H-3** `restore()` 이후 shuffle/repeat/모드 재동기화
4. **H-4** 데스크톱 사용자 데이터 저장 위치를 `PARADISE_DATA`로
5. **M-1** 모달 close 핸들 정리(리스너 누수)
6. **M-2** `normalize()` 필드별 화이트리스트/타입 보정
7. **M-4/M-5** 정적 파일 스트리밍 + 설정 용량 전략
8. 나머지 🟡 정리 및 테스트 보강
