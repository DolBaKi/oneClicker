# build-models.py
# - 크롤링한 노트북 사양 CSV를 사이트가 바로 읽을 수 있는 가벼운 JSON(data/models.json)으로 바꾼다
# - 사용법: python3 scripts/build-models.py ../techspec_laptops_2015_2026.csv
#
# 왜 CSV를 그대로 안 쓰는가:
#   원본은 2.1MB이고 GPU 칸은 "Intel HD Graphics in processor only, or; ..." 같은 긴 문장이다.
#   화면에서 쓰는 건 모델명 검색과 사양 비교뿐이라, 거기에 필요한 값만 짧게 뽑아 둔다.
#   (브라우저에서 CSV를 해석하는 코드를 넣는 것보다 미리 한 번 바꿔 두는 편이 단순하다)

import csv
import json
import re
import sys
from pathlib import Path

# 그래픽 칩 이름을 뽑는 패턴. 순서가 중요하다: 구체적인 이름("Iris Xe")을 넓은 이름("Iris")보다 먼저 본다.
# 브라우저가 알려 주는 이름(WebGL renderer)과 비교할 것이라 소문자·짧은 형태로 통일한다.
GPU_PATTERNS = [
    r'geforce\s+(?:rtx|gtx|mx)\s*\d{3,4}(?:\s*ti)?',
    r'rtx\s*a?\d{3,4}(?:\s*ti)?',
    r'gtx\s*\d{3,4}(?:\s*ti)?',
    r'quadro\s+\w+',
    r'radeon\s+(?:rx\s*)?\d{3,4}[a-z]{0,2}',
    r'radeon\s+(?:pro\s+)?\w+',
    r'radeon',
    r'iris\s+xe',
    r'iris\s+plus',
    r'iris\s+pro',
    r'iris',
    r'uhd\s+graphics\s*\d{0,3}',
    r'hd\s+graphics\s*\d{0,4}',
    r'arc\s+\w?\d{2,3}\w?',
    r'arc',
    r'adreno',
    r'apple\s+m\d(?:\s+(?:pro|max|ultra))?',
]

# CPU 문자열에 들어 있는 제조사. 그래픽 칩 이름이 없을 때 "적어도 제조사는 맞는가"를 보는 데 쓴다
CPU_BRANDS = [('intel', 'intel'), ('amd', 'amd'), ('ryzen', 'amd'), ('apple', 'apple'),
              ('snapdragon', 'qualcomm'), ('qualcomm', 'qualcomm'), ('mediatek', 'mediatek')]


def clean(text):
    # (R), (TM) 같은 표시와 중복 공백을 없앤다. 브라우저 쪽 이름도 같은 방식으로 정리한다
    text = re.sub(r'\((?:r|tm)\)|®|™', ' ', text, flags=re.I)
    return re.sub(r'\s+', ' ', text).strip()


def extract_gpus(row):
    source = clean(f"{row['gpu']} {row['cpu']}").lower()
    found = []
    for pattern in GPU_PATTERNS:
        for match in re.findall(pattern, source):
            name = re.sub(r'\s+', ' ', match).strip()
            # "iris xe"를 이미 찾았으면 "iris"는 넣지 않는다 (넓은 이름이 좁은 이름을 덮지 않게)
            if not any(name in f for f in found):
                found.append(name)
    return found[:6]


def extract_cpus(text):
    # "Intel Core i5 1.6GHz dual-core (Turbo Boost up to 2.7GHz) | Intel Core i7 ..." -> 옵션 목록
    options = []
    for part in text.split('|'):
        part = re.sub(r'\(.*?\)', '', clean(part))
        part = re.split(r',| \d+(?:\.\d+)?\s?GHz', part)[0].strip()
        if part and part not in options:
            options.append(part[:48])
    return options[:8]


def extract_cores(text):
    # "2 | 4 | 4" -> [2, 4]. CPU 옵션별 (물리) 코어 수 목록
    return sorted({int(n) for n in re.findall(r'\d+', text) if 0 < int(n) <= 64})


def extract_brands(text):
    lower = text.lower()
    return sorted({brand for key, brand in CPU_BRANDS if key in lower})


def convert(row):
    year = row['release_year'].strip()
    item = {
        'id': row['id'].strip() or f"{row['vendor']}-{row['model']}",
        'v': row['vendor'].strip(),
        'm': row['model'].strip(),
        'y': int(year) if year.isdigit() else None,
        'c': extract_cpus(row['cpu']),
        't': extract_cores(row['cpu_cores']),  # t 필드 = 물리 코어 수
        'g': extract_gpus(row),
        'b': extract_brands(row['cpu']),
    }
    # 빈 목록은 빼서 파일 크기를 줄인다 (읽는 쪽은 없으면 빈 목록으로 본다)
    return {k: v for k, v in item.items() if v not in ([], None, '')}


def main():
    if len(sys.argv) < 2:
        sys.exit('사용법: python3 scripts/build-models.py <사양 CSV 경로>')

    with open(sys.argv[1], encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))

    models = [convert(r) for r in rows if r['model'].strip()]
    models.sort(key=lambda m: (m['v'], -(m.get('y') or 0), m['m']))

    out = Path(__file__).resolve().parent.parent / 'data' / 'models.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(models, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    with_gpu = sum(1 for m in models if 'g' in m)
    with_cores = sum(1 for m in models if 't' in m)
    print(f'{len(models)}개 모델 -> {out} ({out.stat().st_size // 1024}KB)')
    print(f'그래픽 칩 이름 있음: {with_gpu}개, 코어 수 있음: {with_cores}개')


if __name__ == '__main__':
    main()
