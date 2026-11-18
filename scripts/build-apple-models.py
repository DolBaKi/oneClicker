# build-apple-models.py
# - 손으로 정리한 애플 맥북 사양(data/apple_extra.json)을 models.json에 더한다
# - 사양 CSV(techspec)는 2015년부터라, 그 이전 구형 맥북과 중간에 빠진 구성을 보충한다
# - build-models.py → build-korean-models.py → 이 스크립트 순서로 실행한다
#
# 값 출처: 애플 공식 사양과 EveryMac/Notebookcheck로 교차 확인한 공개 사양.
#   스레드 수는 코어 수(인텔 듀얼코어=4, 쿼드코어=8, 애플 실리콘=코어 수)이고,
#   GPU는 브라우저(WebGL)가 보통 보여 주는 내장 그래픽 이름으로 적었다.

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXTRA = HERE.parent / 'data' / 'apple_extra.json'
OUT = HERE.parent / 'data' / 'models.json'


def main():
    extra = json.loads(EXTRA.read_text(encoding='utf-8'))
    models = json.loads(OUT.read_text(encoding='utf-8'))
    have = {m['m'].lower() for m in models if m['v'] == 'apple'}

    added = []
    for e in extra:
        if e['m'].lower() in have:
            continue  # 이미 있는 모델은 건너뛴다 (CSV와 중복 방지)
        have.add(e['m'].lower())
        row = {'id': 'apple-' + e['m'].lower().replace(' ', '-').replace('(', '').replace(')', '')
               .replace(',', ''), 'v': 'apple', 'm': e['m'], 'y': e['y']}
        if e.get('t'):
            row['t'] = [e['t']]
        if e.get('g'):
            row['g'] = [e['g']]
        if e.get('b'):
            row['b'] = [e['b']]
        added.append(row)

    models.extend(added)
    models.sort(key=lambda m: (m['v'], -(m.get('y') or 0), m['m']))
    OUT.write_text(json.dumps(models, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'애플 {len(added)}종 추가 -> 전체 {len(models)}종 ({OUT.stat().st_size // 1024}KB)')


if __name__ == '__main__':
    main()
