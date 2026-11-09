# Rules

> 이 프로젝트의 규칙과 컨벤션. 모든 sub-agent가 반드시 따라야 함.

## G-01: 코드 주석은 영어만 사용 (MANDATORY)

**규칙:** 모든 코드 주석(`//`, `/* */`, `///`)은 영어로 작성. 한글 주석 금지.
**이유:** 소스 파일 내 한글은 인코딩 문제 및 빌드 오류를 유발할 수 있음.
**적용 시점:** 코드 작성 또는 수정 시 항상. UI 텍스트(사용자에게 보이는 문자열)는 한국어 유지.

## 인라인 스크립트의 백슬래시 보존

**규칙:** PowerShell에서 Python/bash 인라인 문자열을 만들 때 `\r?\n` 같은 백슬래시를 제어 문자로 바꾸지 않는다. `chr(92)`로 조립하거나 파일 편집 도구를 사용한다.
**이유:** 의도한 정규식이나 텍스트가 줄바꿈 등으로 손상될 수 있다.
**적용 시점:** 셸에서 인라인 Python/bash 스크립트로 파일을 바꿀 때.

## 합성 오실레이터 효과음 금지

**규칙:** 앰비언스와 효과음은 오실레이터로 합성하지 않는다. CC0 실제 녹음을 `public/sounds`에 넣고 반복 재생한다.
**이유:** 사용자가 전자음 효과를 원하지 않으며, 녹음 음원이 자연스럽다.
**적용 시점:** 앰비언스나 효과음을 추가할 때.

<!-- 예시 형식:

## [규칙 이름]

**규칙:** [한 줄 요약]
**이유:** [왜 이 규칙이 필요한가]
**적용 시점:** [언제 이 규칙이 발동되나]

-->

## No cloud floor under the figure, no mountains over open sea

**Rule:** with a panorama the figure sits directly on the scenery (no cloud bank, no white fade at the bottom); mountain strips are not used over open sea.
**Why:** the user said the cloud under the figure and mountains over the sea looked wrong.

## No 3D characters, no baked shadows

**Rule:** the person is a transparent picture in `public/figures`; do not bring back 3D models or walking. Figures and panoramas are made locally (ComfyUI) and contain no baked shadows.
**Why:** the user wants many picture variants (carpet, drone, cloud ...), and a floating picture has no ground to cast a shadow on; the app tints it by the time of day.

## The view is fixed, panoramas are tree-rich

**Rule:** no dragging or moving the view (the camera is fixed); beach panoramas show many palm trees and lush foliage around the scene.
**Why:** the user asked for "more trees around" and "no map movement".

## Anime style, one look for scenery and figure

**Rule:** panoramas and figures are anime illustrations made with Krea 2 and Qwen Image Edit (no photo-real, no 3D toy figures); the resort must make people want to go (palm trees, flowers, sparkling water).
**Why:** the user said the picture and the figure looked separated, the photo-real resort did not make them want to visit, and asked for anime. They also want Qwen Image Edit (and AI matting) for the cuts, not hand-made heuristics.

## The moon is an anime picture, large, crisp, and moves across the view

**Rule:** public/sky/moon.jpg is an anime moon disc; the moon crosses the visible sky each night and stays below the bloom threshold, with a faint glow only outside the rim. At night the figure stays readable (cool moonlit tint, not dark).
**Why:** the user asked for a bigger anime moon that moves with the time, that is crisp (not hazy), and for a brighter figure at night.
