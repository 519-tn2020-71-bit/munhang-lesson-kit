# 문항 수업 부품 사전

munhang.js가 동작을 붙인다. 수업 HTML에는 구조와 `data-*` 속성만 쓴다. 넘기기, 판서, 단계(`.step`), 단계 막대(`.reveal`), 문제(`.quiz`)는 exploragram 엔진의 부품이다(https://github.com/N-lifescience/exploragram 의 부품 사전).

## 0. 머리 여섯 줄 (순서를 지킨다)

```html
<link rel="stylesheet" href="{{BASE}}/munhang.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2.8.1/engine/exploragram.css">
<link rel="stylesheet" href="{{BASE}}/kit.css">
<script defer src="{{BASE}}/munhang.js"></script>
<script defer src="{{BASE}}/kit.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2.8.1/engine/exploragram.js"></script>
```

- `<html data-deck="mock-2025-06-18-21">`: 판서 저장 열쇠. 영문 소문자·숫자·하이픈으로 시험과 문항 범위마다 다르게.
- `<body data-theme="ppt">`, 장은 `<section class="slide" id="고정-id" data-sec="묶음" data-title="목차 이름">`.

## 1. 지문 `template.mh-src`

지문은 파일 안에 **한 번만** 쓴다. 읽기 장과 판정 장이 여기서 복사해 간다.

```html
<template class="mh-src" id="s18" data-title="[18~21] 다음 글을 읽고 물음에 답하시오.">
  <p data-para="1">첫 문단 글 그대로 …<span class="mh-note step">화제</span></p>
  <p data-para="2a" data-label="2문단 ①">둘째 문단 앞부분 …</p>
  <p data-para="2b" data-label="2문단 ②">둘째 문단 뒷부분 …</p>
  <div data-para="보기" class="mh-bogi"><p>&lt;보기&gt; 글 그대로 …</p></div>
</template>
```

- `data-para`: 문단 열쇠. 숫자면 탭 이름이 'N문단'이 되고, 아니면 `data-label`이나 열쇠 자체가 이름이 된다. 한 지문 안에서 겹치지 않는다.
- 한 조각 420자 이하(점검 `mh-long-para`). <보기>도 마찬가지로 `보기1`, `보기2`로 나눈다.
- 시험지의 ㉠, ⓐ, [A], 밑줄은 그대로 쓴다. 밑줄은 `<u>`, 네모 칸은 `<span style="border:2px solid">`.
- `.mh-note.step`: 읽기 장에서 →로 여는 문단 꼬리표(화제, 정의, 원리, 예시, 반론, 결론 …). 판정 장에서는 저절로 빠진다. AI가 붙인 꼬리표이므로 template에 `data-ai="문단 꼬리표"`를 붙인다.
- 시: `<p data-para="1" class="mh-poem">` 안에서 줄을 그대로 바꾼다(줄바꿈 문자 유지).

## 2. 지문 읽기 `.mh-read`

```html
<section class="slide" id="s18-read1" data-sec="18~21번 지문" data-title="1~2문단">
  <h2>문단마다 무엇을 말할까?</h2>
  <div class="mh-read" data-src="s18" data-paras="1-2"></div>
</section>
```

- `data-paras`: `1-2`, `3,4`, `2a,2b`, `보기`처럼 고른다. 빼면 전부.
- 지문 제목(`data-title`)은 저절로 붙는다. 둘째 장부터는 `data-title="off"`.
- 26px로 한 장에 600자 안팎이 들어간다. 넘치면 장을 나눈다.

## 3. 구조도 `ol.mh-map`

```html
<ol class="mh-map">
  <li class="step"><b>1문단</b><span>화제 제시: …</span></li>
  <li class="step" data-rel="원리 설명"><b>2문단</b><span>…</span></li>
  <li class="step" data-rel="반론과 보완"><b>3문단</b><span>…</span></li>
</ol>
```

- `data-rel`은 앞 문단과의 관계(구체화, 원리 설명, 예시, 대조, 반론, 보완, 평가, 결론 …). 문단 5개 안팎이면 한 장에 든다.
- 중심 내용은 AI가 쓰므로 `ol`에 `data-ai="구조도"`를 붙인다. 해설지에 '지문 분석'이 있으면 그것을 따른다.

## 4. 고르기 `.quiz[data-q]` (응답 모으기)

```html
<section class="slide" id="q19-poll" data-sec="19번" data-title="19번 고르기">
  <h2>19. 윗글을 이해한 내용으로 적절하지 않은 것은?</h2>
  <div class="quiz" data-q="19">
    <button class="opt" data-why="2문단에 그대로 나온다.">선지 ① 글 그대로</button>
    …
    <button class="opt" data-ok data-why="맞다. …이므로 틀린 설명이다.">선지 ③ 글 그대로</button>
    …
  </div>
</section>
```

- 선지 순서는 시험지 그대로(엔진이 번호 ①~⑤를 붙이므로 선지 글에 번호를 넣지 않는다).
- `data-ok`는 정답 하나. `data-why`는 한 문장.
- <보기>나 자료가 있으면 `<div class="mh-pair"><div class="mh-read" data-src="s18" data-paras="보기" data-title="off"></div><div class="quiz" data-q="21">…</div></div>`.
- 문항이 여럿이면 정답 자리가 같다는 `quiz-spot` 경고가 날 수 있다. 시험 순서를 지킨 것이므로 그대로 둔다.

## 5. 선지 판정 `.mh-judge`

```html
<section class="slide" id="q19-judge" data-sec="19번" data-title="19번 선지 판정">
  <h2>선지마다 근거를 찾아보자</h2>
  <div class="mh-judge" data-src="s18" data-q="19" data-answer="3" data-paras="1-4">
    <div class="mh-view"></div>
    <div class="mh-side">
      <p class="mh-stem">19. 윗글을 이해한 내용으로 적절하지 않은 것은?</p>
      <div class="reveal" data-stops="시작|①|②|③|④|⑤">
        <p data-only="0" style="font-size:24px">→를 누르면 선지가 하나씩 나온다.</p>
        <div class="mh-ch" data-only="1" data-ox="o" data-ev="2|지문에서 그대로 복사한 구절">
          <p class="mh-ct">① 선지 글 그대로</p>
          <p class="mh-why">2문단에 ~라고 했다.</p>
        </div>
        … ② ~ ⑤도 같은 꼴 …
      </div>
    </div>
  </div>
</section>
```

- `data-answer`: 정답 번호(해설지 정답표). `data-q`: 문항 번호(고르기 장과 같게).
- `data-paras`: 탭으로 보일 문단(빼면 전부). 관계없는 다른 지문 문단은 빼서 탭을 줄인다.
- `.mh-ch`: 선지 하나. `data-only`는 단계 막대 칸 번호(1~5). `data-ox`, `data-ev`, `.mh-ct`, `.mh-why`를 꼭 쓴다.
- 「○ 맞다 / ✕ 틀리다 / 판정과 근거」 단추와 판정 줄은 munhang.js가 붙인다. 직접 쓰지 않는다.
- 근거 문단 탭에는 노란 점이 찍히고, 첫 근거 문단이 열리며 구절에 형광이 칠해진다.
- 선지 글이 길어 넘치면 글자를 줄이지 말고 `data-paras`로 탭 수를 줄이거나, 판정 장을 두 장(①~③, ④~⑤)으로 나눈다. 두 장 모두 같은 `data-q`, `data-answer`를 주고, 둘째 장은 `data-stops="시작|④|⑤"`, 선지마다 `data-n="4"`처럼 원래 번호를 준다(`data-only`는 1, 2로 다시 센다). 점검은 같은 `data-q`의 장을 묶어 다섯 개를 센다.

## 6. 반 자료(선택)

```html
<table class="compare"><thead><tr><th>선지</th><th>①</th><th>②</th><th>③</th><th>④</th><th>⑤</th></tr></thead>
<tbody><tr><th>고른 비율</th><td>5%</td><td>12%</td><td class="ans">61%</td><td>18%</td><td>4%</td></tr></tbody></table>
```

선생님이 준 자료만 쓴다. 지어내지 않는다.

## 7. 점검 코드 `Munhang.check()`

| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `mh-src`, `mh-paras` | 지문 template이 없거나 고른 문단이 없음 | `data-src`, `data-paras` 철자 |
| `mh-dup-para` | 한 지문에 같은 `data-para`가 둘 | 열쇠를 다르게 |
| `mh-long-para` | 문단 조각이 420자 초과 | `2a`, `2b`로 나눈다 |
| `mh-answer`, `mh-stem`, `mh-choices` | 정답 번호·발문 없음, 선지가 5개가 아님 | 해설지 정답표, 발문 |
| `mh-ox` | 선지에 `data-ox` 없음 | `o` 또는 `x` |
| `mh-ox-key` | `data-ox`가 정답 번호·발문과 맞지 않음 | 정답과 발문('적절하지 않은')을 다시 본다 |
| `mh-why` | 해설 없음 | `.mh-why` 한두 문장 |
| `mh-ev` | 근거 없음, 문단 없음, 구절이 지문에 글자 그대로 없음 | 지문에서 구절을 다시 복사 |
| `mh-quiz-key` | 고르기 장의 정답 자리가 `data-answer`와 다름 | `data-ok` 자리 |
| `mh-img` | 그림 src가 없거나 외부 주소 | 시험지에서 잘라 `그림/` 폴더에 두고 묶는다 |
| `mh-img-alt` | 그림 설명(alt) 없음 | 무엇을 잘랐는지와 시험지 쪽(예: "13번 〈보기〉 그래프, 6쪽") |
| `mh-img-broken` | 그림이 열리지 않음 | 파일 이름, `그림/` 폴더, 묶기를 확인 |

화면 점검 `Munhang.layout()`은 그림도 잰다: `mh-img-out`(카드 밖으로 나가 잘림), `mh-img-spill`(제 칸을 벗어나 옆 글을 덮음), `mh-img-blur`(원래 크기보다 1.5배 넘게 늘어나 흐림 → `scale=3`으로 다시 자른다). `Munhang.figures()`는 장마다 그림 목록(장 번호, alt, 원래 크기, 열림 여부)을 준다. 시험지 쪽과 하나씩 대 볼 때 쓴다.

엔진 점검(`Exploragram.audit()`, 툴바 「점검」)도 함께 0으로 만든다. 넘침(`slide-overflow`)은 장을 나눠 고친다.
