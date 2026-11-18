# build-extra-models.py
# - 손으로 정리한 추가 모델(애플 구형 맥북, 삼성 빈 연식)을 models.json에 더한다
# - 사양 CSV(techspec)가 비워 둔 연식을, 공식 사양 + 웹 검색으로 확인한 값으로 채운다
# - 실행 순서: build-models.py -> build-korean-models.py -> 이 스크립트
#
# 소스: data/apple_extra.json(v=apple), data/samsung_extra.json(v=samsung)
#   스레드=코어 수(인텔 듀얼=4·쿼드=8·12세대 P=16, 애플 실리콘=코어 수), GPU는 브라우저가 보는 내장 그래픽.

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'data' / 'models.json'
SOURCES = [('apple_extra.json', 'apple'), ('samsung_extra.json', 'samsung')]


def merge_recrawl(models):
    # schemanetworks(공개 소스)를 연도 제한 없이 다시 긁어 기존 CSV가 놓친 노트북을 더한다.
    # 이름이 이미 있으면 건너뛴다. 값은 소스 그대로(연도·스레드·GPU·CPU 제조사).
    path = HERE.parent / 'data' / 'recrawl_models.json'
    if not path.exists():
        return 0
    extra = json.loads(path.read_text(encoding='utf-8'))
    have = {m['m'].lower().strip() for m in models}
    added = 0
    for e in extra:
        name = e.get('m', '').strip()
        if not name or name.lower() in have:
            continue
        have.add(name.lower())
        models.append(e)
        added += 1
    print(f'재크롤 {added}종 추가')
    return added


def merge_file(models, fname, label):
    # 이름이 겹치지 않는 모델만 더하는 일반 병합 (파일은 이미 models.json 형식).
    path = HERE.parent / 'data' / fname
    if not path.exists():
        return 0
    extra = json.loads(path.read_text(encoding='utf-8'))
    have = {m['m'].lower().strip() for m in models}
    added = 0
    for e in extra:
        name = e.get('m', '').strip()
        if not name or name.lower() in have:
            continue
        have.add(name.lower())
        models.append(e)
        added += 1
    print(f'{label} {added}종 추가')
    return added


def main():
    models = json.loads(OUT.read_text(encoding='utf-8'))
    total = merge_recrawl(models)
    # 에누리(price.enuri.com, robots 허용) 국내 노트북. 국내 판매 config 코드까지 검색되게 한다.
    total += merge_file(models, 'enuri_models.json', '에누리 국내')
    for fname, vendor in SOURCES:
        path = HERE.parent / 'data' / fname
        if not path.exists():
            continue
        extra = json.loads(path.read_text(encoding='utf-8'))
        have = {m['m'].lower() for m in models if m['v'] == vendor}
        added = 0
        for e in extra:
            if e['m'].lower() in have:
                continue
            have.add(e['m'].lower())
            slug = e['m'].lower().replace(' ', '-').replace('(', '').replace(')', '').replace(',', '')
            row = {'id': f'{vendor}-{slug}', 'v': vendor, 'm': e['m'], 'y': e['y']}
            if e.get('t'):
                row['t'] = [e['t']]
            if e.get('g'):
                row['g'] = [e['g']]
            if e.get('b'):
                row['b'] = [e['b']]
            models.append(row)
            added += 1
        print(f'{vendor} {added}종 추가')
        total += added
    models.sort(key=lambda m: (m['v'], -(m.get('y') or 0), m['m']))
    OUT.write_text(json.dumps(models, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'합계 {total}종 추가 -> 전체 {len(models)}종 ({OUT.stat().st_size // 1024}KB)')


if __name__ == '__main__':
    main()
