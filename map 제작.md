# Paradise 맵 제작 지침서

이 문서를 LLM(ChatGPT, Claude 등)에게 통째로 주고 **"○○ 느낌의 맵을 만들어줘"** 라고 말하면, 앱에 바로 넣을 수 있는 맵(JSON 한 개)이 나옵니다. 앱 설정의 맵 목록에서 **+ 카드**를 눌러 그 JSON을 `.json` 파일로 저장해 불러오면 됩니다. PC에서는 `/studio.html`에서 JSON을 고치면서 바로 미리 볼 수 있습니다.

> 맵은 "풍경 그림 한 장 + 하늘과 소리 설정"입니다. LLM은 **이미 들어 있는 풍경 그림 중에서 고르고**, 하늘과 소리를 조절합니다. 새 풍경 그림이 필요하면 10장의 "새 풍경 그림 만들기"를 보세요.

---

## 1. LLM에게 (규칙 — 반드시 지킬 것)

너는 Paradise(애니 풍 휴양지 힐링 앱)의 맵 제작 도우미다. 사용자가 원하는 분위기를 듣고 아래 규칙대로 **맵 JSON 하나**를 만든다.

1. 답은 ` ```json ` 코드 블록 **하나**만 쓴다. 코드 블록 밖에는 한두 줄 설명(이 맵의 분위기, 어울리는 시간대)만 쓴다.
2. 아래 "필드 표"에 있는 키만 쓴다. 다른 키(`id`, `thumb`, `horizon`, `ground`, `mountains` 등)는 넣지 않는다. JSON에는 주석을 쓸 수 없다.
3. `schema`는 항상 `"paradise.map/1"`, `name`은 40자 이내(한글 가능).
4. 색은 `#rrggbb` 형식(6자리 hex)만 쓴다. 숫자 필드는 0 ~ 1 사이 소수(`sky.hour`만 0 ~ 24).
5. `scenery.photo`는 **"3. 풍경 그림 목록"에 있는 경로만** 쓴다. 목록에 없는 경로를 지어내지 않는다. 그림에 맞는 `scenery.stand` 값도 같은 목록에서 그대로 가져온다.
6. `sky.picture`는 쓰지 않는다(하늘은 앱이 낮/밤/오로라 그림 중에서 알아서 고른다).
7. 모르는 값은 생략한다(기본값이 들어간다).
8. 아래 "5. 분위기별 레시피"와 "6. 샘플"의 값을 출발점으로 삼아 조금씩 바꾼다. 극단값은 피한다.

## 2. 필드 표

`schema`, `name` 말고는 모두 생략할 수 있다.

| 필드 | 값 | 기본값 | 보이는 모습 |
|---|---|---|---|
| `schema` | `"paradise.map/1"` | 필수 | 고정 |
| `name` | 40자 이하 | 필수 | 카드에 표시되는 이름 |
| `author` | 30자 이하 | 없음 | 만든 사람 |
| `scenery.photo` | 풍경 그림 경로 | (없음) | 뒤에 펼쳐지는 풍경. 하늘 부분은 투명이라 실제 하늘, 해, 달, 별이 풍경 뒤에 보인다. 생략하면 구름 바다 위에 앉는다 |
| `scenery.stand` | 0~1 | 0.85 | 풍경 그림에서 **캐릭터가 서는 모래 위치**(위에서부터 그림 높이의 몇 %). 이 값에 맞춰 풍경이 위아래로 움직여 캐릭터가 바다 안에 서지 않게 한다. 3번 표의 값을 그대로 쓴다 |
| `scenery.cloud` | `#rrggbb` | `#f3f8ff` | 구름 바다의 색. **`scenery.photo`를 쓰지 않을 때만** 보인다 |
| `sky.clouds` | 0~1 | 0.5 | 구름 양 (0 = 없음, 1 = 가득). 하늘 그림 대신 실제 하늘이 보이는 낮에 영향이 크다 |
| `sky.haze` | 0~1 | 0.2 | 대기의 뿌연 정도(높을수록 하늘이 우윳빛). 맑은 날은 0.1 이하, 안개 낀 날은 0.3 이상 |
| `sky.blue` | 0~1 | 0.5 | 낮 하늘의 푸른 정도 |
| `sky.stars` | 0~1 | 1 | 밤의 별 밝기 |
| `sky.nightPhotos` | `night` / `aurora` | `night` | 밤하늘 그림 종류. `night` 은하수와 성운, `aurora` 오로라. 다른 이름은 쓰지 않는다 |
| `sky.hour` | 0 ~ 24 | (시계를 따름) | 하루 중 한 시각에 **고정**한다. 17.9 = 노을, 22 = 달이 오른쪽 위로 뜬 밤, 0 = 달이 가장 높은 한밤. 달은 18시에 오른쪽에서 떠서 자정에 가장 높고 6시에 왼쪽으로 진다 |
| `ambience.wind` | 0~1 | 0.4 | 바람 소리와 구름의 움직임 (약함 0.2 / 보통 0.4 / 강함 0.8) |
| `ambience.birds` | 0~1 | 0.4 | 낮의 새소리 (거의 없음 0.05 / 가끔 0.2 / 많음 0.6) |
| `ambience.insects` | 0~1 | 0.4 | 밤의 풀벌레 소리 (거의 없음 0 / 조금 0.2 / 가득 0.6) |

## 3. 풍경 그림 목록

지금 들어 있는 6장입니다. `scenery.photo`와 `scenery.stand`는 **한 쌍**으로 씁니다.

| 이름 | `scenery.photo` | `scenery.stand` | 분위기 |
|---|---|---|---|
| 몰디브 | `/resorts/maldives.webp` | 0.83 | 투명한 터키석 바다, 흰 모래, 야자수와 해먹, 멀리 수상 방갈로 |
| 하와이 | `/resorts/hawaii.webp` | 0.85 | 파도치는 바다, 파도거품, 서핑보드와 파라솔, 멀리 푸른 산 |
| 발리 | `/resorts/bali.webp` | 0.80 | 야자수와 바나나잎 숲, 황금빛 모래, 멀리 화산, 노을빛 |
| 보라보라 | `/resorts/borabora.webp` | 0.92 | 초록 화산봉우리가 보이는 잔잔한 석호, 카누 |
| 태국 해변 | `/resorts/thai.webp` | 0.95 | 석회암 절벽과 정글, 롱테일 보트, 에메랄드 바다 |
| 하롱베이 | `/resorts/halong.webp` | 0.95 | 정글 덮인 바위섬, 붉은 돛의 배, 에메랄드 물 |

## 4. 캐릭터에 대하여

맵에는 캐릭터가 들어 있지 않습니다. 캐릭터(선베드, 구름, 양탄자, 드론, 열기구, 그네, 돛단배, 고래, 백조 튜브, 서핑보드)는 사용자가 프로필에서 고르고, 어떤 맵에서나 같은 자리(모래 위)에 놓입니다.

## 5. 분위기별 레시피

| 분위기 | 풍경 | 하늘 | 소리 |
|---|---|---|---|
| 맑은 한낮 | 몰디브, 하와이 | `clouds` 0.3, `haze` 0.1, `blue` 0.8 | `wind` 0.4, `birds` 0.4 |
| 포근한 아침 | 발리, 보라보라 | `clouds` 0.4, `haze` 0.25, `blue` 0.6 | `birds` 0.6, `wind` 0.3 |
| 끝나지 않는 노을 | 발리, 하와이 | `hour` 17.9, `clouds` 0.5, `haze` 0.2 | `wind` 0.3, `birds` 0.3 |
| 고요한 보름달 밤 | 몰디브, 보라보라 | `hour` 22, `stars` 1, `nightPhotos` `night` | `insects` 0.5, `wind` 0.2 |
| 오로라 밤 | 하롱베이 | `hour` 0, `nightPhotos` `aurora` | `insects` 0.3, `wind` 0.2 |
| 안개 낀 흐린 날 | 하롱베이, 태국 해변 | `clouds` 0.7, `haze` 0.4, `blue` 0.4 | `wind` 0.5, `birds` 0.2 |

## 6. 샘플

### 노을이 끝나지 않는 발리

```json
{
  "schema": "paradise.map/1",
  "name": "발리의 노을",
  "sky": { "hour": 17.9, "clouds": 0.5, "haze": 0.2, "blue": 0.7 },
  "scenery": { "photo": "/resorts/bali.webp", "stand": 0.8 },
  "ambience": { "wind": 0.3, "birds": 0.3, "insects": 0.2 }
}
```

### 보름달이 뜬 몰디브의 밤

```json
{
  "schema": "paradise.map/1",
  "name": "몰디브의 보름달",
  "sky": { "hour": 22, "stars": 1, "nightPhotos": "night" },
  "scenery": { "photo": "/resorts/maldives.webp", "stand": 0.83 },
  "ambience": { "wind": 0.2, "birds": 0.05, "insects": 0.5 }
}
```

### 오로라가 흐르는 하롱베이

```json
{
  "schema": "paradise.map/1",
  "name": "하롱베이 오로라",
  "sky": { "hour": 0, "stars": 1, "nightPhotos": "aurora" },
  "scenery": { "photo": "/resorts/halong.webp", "stand": 0.95 },
  "ambience": { "wind": 0.2, "birds": 0.05, "insects": 0.3 }
}
```

### 맑은 한낮의 하와이

```json
{
  "schema": "paradise.map/1",
  "name": "하와이의 한낮",
  "sky": { "clouds": 0.3, "haze": 0.1, "blue": 0.8 },
  "scenery": { "photo": "/resorts/hawaii.webp", "stand": 0.85 },
  "ambience": { "wind": 0.4, "birds": 0.4, "insects": 0.2 }
}
```

### 풍경 그림 없이 구름 위에서

```json
{
  "schema": "paradise.map/1",
  "name": "구름 바다",
  "sky": { "clouds": 0.6, "haze": 0.15, "blue": 0.7 },
  "scenery": { "cloud": "#f6f9ff" },
  "ambience": { "wind": 0.5, "birds": 0.1, "insects": 0.1 }
}
```

## 7. 앱에 넣는 방법

1. LLM의 JSON을 메모장 등에 붙여 넣어 `이름.json`으로 저장한다.
2. 앱 설정의 맵 목록 맨 끝 **+ 카드**를 눌러 그 파일을 고른다. 맵은 모두 합쳐 9개까지 둘 수 있다(기본 6개 + 3개).
3. 불러온 맵은 `data/maps/added/`(설정 파일 옆 데이터 폴더)에도 파일로 남는다(카드 그림 `.jpg`와 함께). 앱에서 지워도 파일은 남는다.
4. PC에서는 `/studio.html`의 입력칸에 JSON을 붙여 넣으면 바로 미리 보인다. 오류가 있으면 입력칸 아래에 이유가 나온다.

## 8. 자주 나는 오류

| 메시지 | 이유 |
|---|---|
| `bad schema` | `schema`가 `"paradise.map/1"`이 아니다(옛 Voyager 맵 `voyager.map/1`은 쓸 수 없다) |
| `name required` | `name`이 없거나 비었다 |
| `scenery.photo is invalid` | 경로가 `/resorts/영문숫자-_.webp`(또는 png, jpg) 모양이 아니다 |
| `scenery.cloud must be #rrggbb` | 색이 6자리 hex가 아니다 |
| `sky.nightPhotos is invalid` | `night` 또는 `aurora`가 아니다 |

## 9. 알아둘 것

- 풍경 그림의 하늘은 투명이라서, 같은 맵이라도 시간대에 따라 하늘 그림(낮/밤/오로라)과 달, 별이 달라진다. `sky.hour`로 시각을 고정하면 항상 같은 장면이 된다.
- 하늘의 낮 그림 7장, 밤 그림 7장, 오로라 그림 7장은 맵이 아니라 앱이 갖고 있고, 하루가 시작될 때마다 무작위로 하나가 뽑힌다.
- 달은 밤마다 한 번 오른쪽에서 떠서 왼쪽으로 진다. 4번에 1번은 붉은 달이다.

## 10. 새 풍경 그림 만들기 (선택)

LLM이 아니라 사람이 하는 일입니다. 모든 그림은 로컬 ComfyUI에서 만듭니다(자세한 방법은 `docs/ASSETS.md`).

1. **그리기**: Krea 2 Turbo로 1792x768 애니 풍 풍경을 만든다. 양옆에 야자수, 가운데에 바다와 앞쪽 모래사장, 건물은 작게 멀리. 하늘은 단순하게.
2. **하늘 지우기**: Qwen Image Edit로 하늘 전체와 잎 사이 틈을 마젠타로 칠한다.
3. **투명으로**: `scripts/figures/3-cut-sky.py`로 마젠타를 투명 하늘로 바꾼다. 결과 WebP를 `public/resorts/이름.webp`에 둔다.
4. **카드 그림**: 풍경 한가운데를 정사각형으로 잘라 `public/resorts/이름-card.jpg`로 둔다.
5. **모래 위치 재기**: 그림 가운데 부분에서 모래가 시작하는 줄(위에서 몇 %)을 재고 0.06을 더한 값이 `scenery.stand`다.
6. **맵 파일**: `public/maps/이름.json`에 위의 형식으로 쓰고(`thumb`은 카드 그림 경로), 내장 맵으로 쓰려면 `src/main.ts`의 `BUILTIN_MAPS`와 `test/spec.test.mjs`의 목록에 이름을 추가한다.
