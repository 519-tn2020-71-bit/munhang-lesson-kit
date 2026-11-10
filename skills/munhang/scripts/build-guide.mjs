// 채팅 AI(ChatGPT·Gemini·Claude 채팅)용 합본 지침을 만든다.
// 쓰기: node scripts/build-guide.mjs [엔진주소]
//   엔진주소: munhang.css·js를 올린 곳(예: https://cdn.jsdelivr.net/gh/계정/munhang@1/skills/munhang/engine)
//   비우면 수업 HTML 옆 munhang/ 폴더를 가리킨다.
import fs from 'node:fs';
import path from 'node:path';

const skill = path.join(import.meta.dirname, '..');
const base = (process.argv[2] || 'munhang').replace(/\/$/, '');
const strip = (md) => md.replace(/^---[\s\S]*?---\n/, '');
const skillMd = strip(fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'))
  .replace(/`node scripts\/[^`]+`/g, (m) => m + '(코드를 돌릴 수 있을 때만)');
const parts = fs.readFileSync(path.join(skill, 'references', 'parts.md'), 'utf8').replaceAll('{{BASE}}', base);
const setEx = fs.readFileSync(path.join(skill, 'assets', 'set-example.mjs'), 'utf8');
const sheetEx = fs.readFileSync(path.join(skill, 'assets', 'set-example-sheet.mjs'), 'utf8');
const template = fs.readFileSync(path.join(skill, 'assets', 'template.html'), 'utf8').replaceAll('"munhang/', '"' + base + '/');

const out = `<!-- 자동 생성: node scripts/build-guide.mjs (손으로 고치지 않는다) -->
# 문항 수업 합본 지침

> **AI에게**: 이 파일 하나가 지침 전체다. 선생님이 모의고사 시험지와 해설지를 주면 이 지침대로 세트 데이터 파일(.mjs) 하나를 만든다. 선생님 PC에 Node.js가 없으면 문항 수업 HTML 파일 하나를 직접 만든다.
> 만들기 전에 인터뷰하고 설계표를 확인받는다. HTML을 직접 쓸 때 \`<head>\`의 여섯 줄은 그대로 둔다(지금 환경에서 안 열려도 교실 브라우저가 연다).
> 엔진 주소: ${base}/munhang.css·js, ${base}/kit.css·js, exploragram@2.8.1 (묶기 전에는 수업 파일 옆 munhang 폴더에 하네스 engine 폴더의 파일을 둔다)

${skillMd}

---

${parts}

---

## 세트 데이터 예시 (assets/set-example.mjs)

코드를 돌릴 수 있으면 이 꼴로 세트 파일을 쓰고 \`node scripts/gen.mjs 세트.mjs\`로 만든다. 채팅 AI는 이 꼴의 세트 파일을 선생님께 준다.

\`\`\`js
${setEx}\`\`\`

## 활동지 그대로 예시 (assets/set-example-sheet.mjs)

활동지·교과서 본문을 '활동지 그대로(디지털 교과서)'로 고른 경우의 세트 꼴이다. 블록: \`text\`, \`q\`, \`quiz\`, \`table\`, \`box\`, \`img\`. '문항 만들기'를 고른 경우는 위 시험 세트와 같은 꼴에 \`madeQs: true\`를 더한다.

\`\`\`js
${sheetEx}\`\`\`

---

## 뼈대 (Node.js가 없을 때 HTML을 직접 쓰는 경우)

\`\`\`html
${template}\`\`\`
`;
const dest = path.join(skill, '..', '..', 'guide', 'munhang-guide.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`저장: ${dest} (${out.split('\n').length}줄, 엔진 주소 ${base})`);
