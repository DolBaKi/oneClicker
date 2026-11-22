# build-korean-models.py
# - 삼성 공식(한국) 사이트맵·제품목록에서 모은 갤럭시북/노트북 코드를 models.json 형식으로 바꾼다
# - LG는 기존 CSV(techspec)에 그램 86종이 이미 있어 추가하지 않는다. 삼성만 13종뿐이라 여기서 보충한다.
#
# 출처: samsung.com/sec 소비자 사이트맵 + 갤럭시북 목록(공식), robots.txt가 사이트맵 수집을 허용.
# 사양 유추 원칙:
#   - 모델명/코드로 "확실한 것만" 채운다. 모르면 비워 둔다(빈 값 = 화면에서 "목록에 정보 없음").
#   - 스레드 수는 같은 모델에도 CPU 옵션이 여럿이라 코드로 특정할 수 없다 -> 항상 비운다.
#   - 거짓 '사양 일치'를 만드느니, 모른다고 두는 편이 맞다(scoring.js의 원칙과 같다).

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAMSUNG_BASE = HERE.parent / 'data' / 'samsung_base.json'   # {코드: 원본이름}
SAMSUNG_SPECS = HERE.parent / 'data' / 'samsung_specs.json'  # {코드base: {threads, gpu}} 실측 사양
OUT = HERE.parent / 'data' / 'models.json'


def code_base(code):
    # NT/NP 지역 접두사를 떼어 같은 모델을 맞춘다 (NT750XFG == NP750XFG)
    return re.sub(r'^N[TP]', '', code.upper())

# 시리즈 이름 -> (표시용 한글 이름, 출시 연도, GPU, CPU 제조사)
#   연도는 삼성 시리즈별 출시 시기(대략)다. 세대가 섞인 생성은 대표 연도를 쓴다.
#   GPU: 갤럭시북 박형은 모두 인텔 내장이다. 11~13세대=Iris Xe, Core Ultra=Intel Arc.
#   edge/go/s = Qualcomm Snapdragon(ARM), 내장 Adreno.
SERIES = [
    # (이름에 들어있는 키, 한글 표시명, 연도, gpu, 브랜드)
    ('갤럭시 북6 울트라', '갤럭시북6 울트라', 2026, 'geforce rtx', 'intel'),
    ('갤럭시 북6 프로', '갤럭시북6 프로', 2026, 'intel arc', 'intel'),
    ('갤럭시 북6', '갤럭시북6', 2026, 'intel arc', 'intel'),
    ('갤럭시 북5 프로 360', '갤럭시북5 프로 360', 2025, 'intel arc', 'intel'),
    ('갤럭시 북5 프로', '갤럭시북5 프로', 2025, 'intel arc', 'intel'),
    ('갤럭시 북5 360', '갤럭시북5 360', 2025, 'intel arc', 'intel'),
    ('갤럭시 북5', '갤럭시북5', 2025, 'intel arc', 'intel'),
    ('갤럭시 북4 울트라', '갤럭시북4 울트라', 2024, 'geforce rtx', 'intel'),
    ('갤럭시 북4 프로 360', '갤럭시북4 프로 360', 2024, 'intel arc', 'intel'),
    ('갤럭시 북4 프로', '갤럭시북4 프로', 2024, 'intel arc', 'intel'),
    ('갤럭시 북4 엣지', '갤럭시북4 엣지', 2024, 'qualcomm adreno', 'qualcomm'),
    ('갤럭시 북4', '갤럭시북4', 2024, 'intel', 'intel'),
    # 옛날 네이밍 (소비자 사이트맵에 남아 있는 2018~2021 모델)
    ('galaxy book flex', '갤럭시북 플렉스', 2020, 'iris plus', 'intel'),
    ('galaxybook ion', '갤럭시북 이온', 2020, 'iris plus', 'intel'),
    ('galaxy book ion', '갤럭시북 이온', 2020, 'iris plus', 'intel'),
    ('galaxy book s', '갤럭시북 S', 2020, 'qualcomm adreno', 'qualcomm'),
    ('galaxy book pro', '갤럭시북 프로', 2021, 'iris xe', 'intel'),
    ('galaxy book', '갤럭시북', 2021, 'iris xe', 'intel'),
    ('notebook 7', '삼성 노트북 7', 2019, None, 'intel'),
    ('notebook 9', '삼성 노트북 9', 2018, None, 'intel'),
    ('notebook pen s', '삼성 노트북 Pen S', 2019, None, 'intel'),
    ('notebook pen', '삼성 노트북 Pen', 2019, None, 'intel'),
    ('notebook plus', '삼성 노트북 Plus', 2019, None, 'intel'),
    ('notebook flash', '삼성 노트북 Flash', 2019, None, 'intel'),
    ('notebook 3', '삼성 노트북 3', 2019, None, 'intel'),
    ('notebook 5', '삼성 노트북 5', 2019, None, 'intel'),
    ('notebook', '삼성 노트북', None, None, None),  # 세대 불명: 코드로 연도만 유추
]

# 코드 세대 글자 -> 대략 출시 연도.
# 삼성 코드 NT[모델]X[세대][변형]에서 X 다음 글자가 세대다. 웹 검증: NT850XBC(B)=2019년(오디세이 RTX2060).
GEN_YEAR = {'A': 2018, 'B': 2019, 'C': 2020, 'D': 2021, 'E': 2022, 'F': 2023,
            'G': 2024, 'H': 2025, 'J': 2026}


def year_from_code(code):
    # NT850XBC -> X 다음 글자 B. NT550EBV처럼 X가 없으면 E 다음 글자로 본다
    m = re.search(r'[XQUV]([A-Z])[A-Z]?$', code) or re.search(r'[A-Z]([A-Z])[A-Z]$', code)
    return GEN_YEAR.get(m.group(1)) if m else None


# 모델 번호 850/860 = 게이밍 오디세이 (외장 그래픽). 웹 검증: NT850XBC = 노트북 오디세이
def refine_label(code, label):
    if label == '삼성 노트북' and re.match(r'NT8[56]0X', code):
        return '삼성 노트북 오디세이'
    return label


def classify(name):
    low = name.lower()
    for key, label, year, gpu, brand in SERIES:
        if key.lower() in low:
            return label, year, gpu, brand
    return None


# 모델명 안의 CPU 등급(Core Ultra 7 등) -> 인텔 내장 GPU 보정
def gpu_from_cpu_tier(name, default):
    if re.search(r'core.{0,3}ultra', name, re.I):
        return 'intel arc'
    return default


def main():
    base = json.loads(SAMSUNG_BASE.read_text(encoding='utf-8'))
    # data.csv(인도 Smartprix 공개 데이터)에서 뽑은 갤럭시북 실측 스레드·GPU. 코드base로 맞춘다
    specs = json.loads(SAMSUNG_SPECS.read_text(encoding='utf-8')) if SAMSUNG_SPECS.exists() else {}
    models = json.loads(OUT.read_text(encoding='utf-8'))

    # 기존 삼성 모델 이름(중복 방지용)
    have = {m['m'].lower() for m in models if m['v'] == 'samsung'}

    added = []
    for code, raw in sorted(base.items()):
        # 이름 없는 코드(대부분 수출용 NP)는 건너뛴다. 한국 바닥 라벨은 NT라 노이즈만 된다.
        if not raw:
            continue
        info = classify(raw)
        if not info:
            continue  # 분류 못 하는 이름은 넣지 않는다
        label, year, gpu, brand = info
        gpu = gpu_from_cpu_tier(raw, gpu)
        label = refine_label(code, label)
        if year is None:
            year = year_from_code(code)  # 시리즈로 연도를 모르면 코드 세대 글자로 유추

        # 표시 이름: "갤럭시북5 프로 (NT940XHA)" — 바닥 라벨 코드로도 검색되게 코드를 넣는다
        display = f'{label} ({code})'
        if display.lower() in have:
            continue
        have.add(display.lower())

        row = {'id': f'samsung-{code.lower()}', 'v': 'samsung', 'm': display}
        if year:
            row['y'] = year

        # 실측 사양이 있으면 유추값보다 우선한다 (스레드 수는 실측으로만 채운다)
        spec = specs.get(code_base(code))
        if spec:
            if spec.get('cores'):
                row['t'] = [spec['cores']]  # t = 코어 수
            if spec.get('gpu'):
                gpu = spec['gpu']
        if gpu:
            row['g'] = [gpu]
        if brand:
            row['b'] = [brand]
        added.append(row)

    # 실측 사양(data.csv)이 있는데 위에서 추가되지 않은 코드(한국 이름이 없던 모델)를 보탠다.
    # 한국 바닥 라벨은 NT라서 NT 코드로 등록한다.
    added_bases = {code_base(re.search(r'\(([A-Z0-9]+)\)', m['m']).group(1))
                   for m in added if re.search(r'\(([A-Z0-9]+)\)', m['m'])}
    for b, spec in specs.items():
        if b in added_bases:
            continue
        name = spec.get('name') or '삼성 갤럭시북'
        code = f'NT{b}'
        display = f'{name} ({code})'
        if display.lower() in have:
            continue
        row = {'id': f'samsung-{code.lower()}', 'v': 'samsung', 'm': display, 'y': year_from_code(code)}
        if spec.get('cores'):
            row['t'] = [spec['cores']]  # t = 코어 수
        if spec.get('gpu'):
            row['g'] = [spec['gpu']]
        row['b'] = ['intel']
        added.append(row)

    models.extend(added)
    models.sort(key=lambda m: (m['v'], -(m.get('y') or 0), m['m']))
    OUT.write_text(json.dumps(models, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'삼성 {len(added)}종 추가 -> 전체 {len(models)}종 ({OUT.stat().st_size // 1024}KB)')
    with_year = sum(1 for m in added if 'y' in m)
    with_gpu = sum(1 for m in added if 'g' in m)
    print(f'연도 채움 {with_year}, GPU 채움 {with_gpu}, 나머지는 이름·코드만')


if __name__ == '__main__':
    main()
