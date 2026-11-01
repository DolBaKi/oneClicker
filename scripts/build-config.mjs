// build-config.mjs
// - 배포할 때 환경 변수를 읽어 api/config.js를 만들어 준다
// - 이 파일이 필요한 이유: 접속 키를 깃허브에 올리지 않기로 했는데,
//   배포된 사이트도 Supabase에 저장은 해야 하기 때문이다.
//   키는 Vercel 설정에만 넣어두고, 배포 순간에만 파일로 찍어낸다.

import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  // 키가 없어도 배포 자체는 막지 않는다. 측정과 결과 화면은 그대로 동작하고
  // 저장만 실패하는데, 그 경우 화면에 안내가 뜨도록 이미 만들어 뒀다.
  console.warn('[build] SUPABASE_URL / SUPABASE_KEY 가 없어 config.js를 만들지 않습니다.');
  console.warn('[build] Vercel 프로젝트 설정 > Environment Variables 에 두 값을 넣어 주세요.');
  process.exit(0);
}

writeFileSync('api/config.js',
  `// 배포할 때 scripts/build-config.mjs가 자동으로 만든 파일입니다. 직접 고치지 마세요.\n`
  + `export const SUPABASE_URL = '${url}';\n`
  + `export const SUPABASE_KEY = '${key}';\n`);

console.log('[build] api/config.js 생성 완료');
