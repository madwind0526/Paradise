# Patterns

> 검증된 코드 패턴. 복붙 바로 가능한 형태로 유지.

## 리깅 모델 절차 애니메이션

**사용 시점:** 부모 본과 자식 본의 rest 회전을 유지하면서 관절 움직임을 적용할 때.

관절 회전을 rest 월드 프레임 기준으로 계산한 뒤 `inverse(parentRest) * worldRotation * parentRest * localRest`로 로컬 회전을 만든다.

## 모바일 기준 화면을 넓은 브라우저에서 유지

**사용 시점:** 앱 자체가 세로 모바일 화면을 기준으로 하고 데스크톱에서 가로로 확장되면 안 될 때.

앱 컨테이너에 `width: 100%; max-width: 420px; margin-inline: auto`를 적용한다. 휴대폰에서는 가용 폭을 그대로 쓰고 넓은 화면에서는 가운데 정렬한다.

## 눈 덮인 산의 중앙 골짜기와 오목한 발자국

**사용 시점:** Snow North와 Grassland처럼 산이 화면을 감싸야 할 때. Salt Desert에는 적용하지 않는다.

기본 시야 정면 양쪽에 서로 다른 높이의 봉우리를 두고 중앙을 낮춘다. Snow North와 Grassland만 부드러운 다중 주파수 표면, 불규칙한 눈선, 드러난 바위 패치를 사용한다. 발자국은 동심 링 타원 메시의 중심을 낮고 어둡게, 가장자리를 약간 높고 밝게 해 눌린 눈을 표현한다.

## Salt Desert의 다층 능선

**사용 시점:** 야간 산 실루엣에서 겹친 먼 능선이 안개에 묻힐 때.

9개 능선은 그대로 유지한다. Salt Desert에 한해 먼 능선의 안개 혼합을 낮추고 야간 노출을 올려 층을 구별한다. Snow North와 Grassland의 안개 처리는 별도로 유지한다.

## Mixamo FBX walk clips
Mixamo animation exports can prefix track names with a numbered namespace such as `mixamorig9Hips`, while the target character uses `mixamorigHips`. Strip the optional numeric namespace and bind each clip track to the target rig's actual bone name. Only apply the clip to Mixamo-style rigs; retain the existing procedural pose for other skeletons. Keep animation FBX files out of character discovery.

## Stable IDs for file-backed built-in entries

When a built-in entry is loaded from a file and its ID is used for selection or persistence, derive the ID from the stable filename during loading. Do not assume the content file contains that ID; otherwise multiple entries can share `undefined` and selection state cannot be saved.

## Figure pictures: generate on green, remove the shadow with an editor, key to alpha

Z-Image Turbo (cfg 1) ignores negative prompts, so "no shadow" in the prompt does not work. Draw the figure on a flat green background, remove the cast shadow with Qwen Image Edit (2511 lightning), then key the green with `scripts/figures/key-figure.py` (soft matte on greenness ratio, border-connected region plus big background-colored patches, despill). Never fill holes in the mask: it fills the background between ropes.

## Panorama with the sky cut out

Region-grow from the top edge over smooth pale areas (gradient below a threshold), stop at the sea line, feather the mask. The real sky dome then shows behind the scenery and follows the time of day. Keep buildings tiny: the figure and nature matter more.

## Krea 2 Turbo panoramas (palm beaches)

ComfyUI core nodes: UNETLoader (krea2_turbo_nvfp4) + CLIPLoader type "krea2" (qwen3vl_4b_fp8_scaled) + VAELoader (qwen_image_vae) + ConditioningZeroOut as negative, KSampler 8 steps cfg 1. 1792x768 in ~15 s. Prompt: scene, then "wide panoramic photograph taken from a terrace ..., pale hazy sky at the top, soft mist along the bottom edge, no people, no text". Palms framing both sides gives the resort feel. Sky cut-out needs a more tolerant gradient threshold (SKY_THR=6) and edge colors copied from the nearest solid pixel to avoid pale rims on palm fronds.

## Mountain strips

`scenery.mountains` shows three alpha strips (far/mid/near, mirrored repeat on cylinders at 520/430/340 m) standing on the sea line; far ones are hazier. Keep the haze mix high (0.4-0.6) or the near strip becomes a dark slab.

## Anime pictures: Qwen Edit for every cut, BiRefNet for a real alpha

Panorama: Krea 2 anime, then Qwen Edit "paint the sky flat magenta, also between the leaves", then a soft magenta matte (3-cut-sky.py; magenta far from the sky is repaired, magenta pieces next to the sky are sky). Figure: Krea 2 anime on green, then Qwen Edit removes the shadow, then the ComfyUI-RMBG BiRefNetRMBG node (BiRefNet-matting; pass every optional input, background Alpha) gives a true matte.
The photo wall reaches 80 m below its picture and stretches the last row there, so no cloud floor is needed at the bottom of the screen.
