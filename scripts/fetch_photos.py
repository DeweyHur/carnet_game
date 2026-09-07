"""Download reusable Commons photos, WebP derivatives, and attribution.
Run: python scripts/fetch_photos.py [asset-id ...]. Existing assets are kept.
"""
import html
import io
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
    'paris:metro-palais-royal': ('Palais Royal–Musée du Louvre (Paris Métro)', '팔레 루아얄 뮈제 뒤 루브르 역'),
    'paris:metro-tuileries': ('Tuileries (Paris Métro)', '튈르리 역'),
    'paris:metro-champs': ('Champs-Élysées–Clemenceau (Paris Métro)', '샹젤리제 클레망소 역'),
    'paris:metro-franklin': ('Franklin D. Roosevelt (Paris Métro)', '프랭클린 루스벨트 역'),
    'paris:metro-george': ('George V (Paris Métro)', '조르주 생크 역'),
    'paris:metro-kleber': ('Kléber (Paris Métro)', '클레베르 역'),
    'paris:metro-boissiere': ('Boissière (Paris Métro)', '부아시에르 역'),
    'paris:metro-madeleine': ('Madeleine (Paris Métro)', '마들렌 역'),
    'paris:metro-saint-lazare': ('Saint-Lazare (Paris Métro)', '생라자르 지하철역'),
    'paris:metro-trinite': ("Trinité–d'Estienne d'Orves station", '트리니테 데스티엔 도르브 역'),
    'paris:metro-lorette': ('Notre-Dame-de-Lorette (Paris Métro)', '노트르담 드 로레트 역'),
    'paris:metro-saint-georges': ('Saint-Georges (Paris Métro)', '생조르주 역'),
    'paris:metro-pigalle': ('Pigalle (Paris Métro)', '피갈 역'),
    'paris:metro-concorde': ('Concorde (Paris Métro)', '콩코르드 역 · 환승 풍경'),
    'paris:metro-etoile': ('Charles de Gaulle–Étoile station', '샤를 드골 에투알 역'),
    'paris:metro-trocadero': ('Trocadéro (Paris Métro)', '트로카데로 역'),
    'paris:metro-passy': ('Passy (Paris Métro)', '파시 역 · 센 강을 건너기 전'),
    'paris:metro-bir-hakeim': ('Bir-Hakeim (Paris Métro)', '비르아켐 역 · 6호선'),
    'paris:metro-abbesses': ('Abbesses (Paris Métro)', '아베스 역 · 몽마르트르의 입구'),
    'paris:louvre': ('File:Louvre Museum Wikimedia Commons.jpg', '루브르 피라미드'),
    'paris:montmartre': ('Sacré-Cœur, Paris', '몽마르트르 · 사크레쾨르'),
    'paris': ('File:Eiffel Tower from Seine river.jpg', '센 강과 에펠탑'),
    'boulogne': ('fr:Musée départemental Albert-Kahn', '알베르 칸 박물관 정원'),
    'saint-denis': ('Basilica of Saint-Denis', '생드니 대성당'),
    'argenteuil': ('Argenteuil', '아르장퇴유의 거리'),
    'montreuil': ('Montreuil, Seine-Saint-Denis', '몽트뢰유'),
    'versailles': ('File:Chateau Versailles Galerie des Glaces.jpg', '베르사유 거울의 방'),
    'chartres': ('Chartres Cathedral', '샤르트르 대성당'),
    'amiens': ('Amiens Cathedral', '아미앵 대성당'),
    'reims': ('Reims Cathedral', '랭스 대성당'),
    'rouen': ('Gros Horloge', '루앙의 대시계'),
    'lille': ('Vieille Bourse', '릴 구 증권거래소'),
    'orleans': ('Orléans Cathedral', '오를레앙 생트크루아 대성당'),
    'paris:citeco': ('Hôtel Gaillard', '시테코 · 오텔 가이야르'),
    'paris:carnavalet': ('Musée Carnavalet', '카르나발레 박물관'),
    'paris:cluny': ('Musée de Cluny', '클뤼니 박물관'),
    'paris:sainte-chapelle': ('Sainte-Chapelle', '생트샤펠'),
    'paris:arenes': ('Arènes de Lutèce', '루테티아 원형경기장'),
    'boulogne:seine-musicale': ('File:La Seine musicale at night.jpg', '스갱 섬 · 라 센 뮤지칼의 밤'),
    'saint-denis:sd-market': ('fr:Marché de Saint-Denis', '생드니 시장'),
    'montreuil:murs': ('File:Montreuil.Murs à Peches.jpg', '몽트뢰유 복숭아 담장'),
    'versailles:gardens': ('Gardens of Versailles', '베르사유 정원'),
    'amiens:verne-house': ('File:Amiens Maison Jules Verne 1.jpg', '쥘 베른의 집'),
    'amiens:hortillonnages': ('fr:Hortillonnages d’Amiens', '아미앵 수상정원'),
    'amiens:madeleine': ('File:Amiens allée des passiflores depuis tombe Jules Verne (cimetière de la Madeleine) 19a.jpg', '아미앵 마들렌 묘지'),
    'reims:reddition': ('File:Musée de la Reddition - entrée.jpg', '랭스 항복 박물관'),
    'reims:caves': ('File:Champagne vineyard and Church.jpg', '샹파뉴 포도밭 · 저장고 투어의 배경'),
    'rouen:rouen-cath': ('Rouen Cathedral', '루앙 대성당'),
    'rouen:vieux-marche': ('fr:Place du Vieux-Marché', '루앙 비외마르셰 광장'),
    'lille:pba': ('Palais des Beaux-Arts de Lille', '릴 순수미술관'),
    'lille:degaulle-house': ('Birthplace of Charles de Gaulle', '드골 생가'),
    'orleans:maison-jeanne': ('File:Maison Jeanne Arc - Orléans (FR45) - 2022-07-16 - 1.jpg', '오를레앙 잔 다르크의 집'),
    'food:croissant': ('Croissant', '크루아상'),
    'food:jambon-beurre': ('Jambon-beurre', '잠봉뵈르'),
    'food:cafe': ('Espresso', '에스프레소'),
    'food:croque': ('Croque monsieur', '크로크무슈'),
    'food:onion-soup': ('French onion soup', '프랑스식 양파 수프'),
    'food:paris-brest': ('Paris–Brest', '파리 브레스트'),
    'food:msemen': ('Msemmen', '므세멘'),
    'food:ficelle': ('Ficelle picarde', '피셀 피카르드'),
    'food:biscuit-rose': ('File:3 Biscuit rose de Reims.jpg', '랭스의 분홍 비스킷'),
    'food:carbonnade': ('Carbonade flamande', '카르보나드 플라망드'),
    'food:welsh': ('Welsh rarebit', '웰시'),
    'food:moules': ('Moules-frites', '홍합과 감자튀김'),
    # ── 국경 너머: 런던·브뤼셀·제네바
    'london': ('Big Ben', '빅벤과 웨스트민스터궁'),
    'london:st-pancras': ('St Pancras railway station', '세인트 판크라스 인터내셔널'),
    'london:british-museum': ('British Museum', '대영박물관'),
    'london:tower-bridge': ('Tower Bridge', '타워 브리지'),
    'london:boe-museum': ('Bank of England Museum', '영란은행 박물관'),
    'brussels': ('Grand-Place', '브뤼셀 그랑플라스'),
    'brussels:atomium': ('Atomium', '아토미움'),
    'geneva': ("Jet d'Eau", '제네바 분수'),
    'geneva:reformation-wall': ('Reformation Wall', '종교개혁 기념벽'),
    'food:fish-chips': ('Fish and chips', '피시 앤 칩스'),
    'food:scone': ('Scone', '스콘'),
    'food:gaufre': ('Belgian waffle', '벨기에 와플'),
    'food:neuhaus': ('Neuhaus (chocolatier)', '뇌하우스 프랄린'),
    'food:fondue': ('Fondue', '치즈 퐁뒤'),
    'food:rosti': ('Rösti', '뢰스티'),
    # ── 국경 너머: 쾰른·바르셀로나
    'cologne': ('Cologne Cathedral', '쾰른 대성당'),
    'cologne:hohenzollern': ('Hohenzollern Bridge', '호엔촐레른 다리'),
    'barcelona': ('Sagrada Família', '사그라다 파밀리아'),
    'barcelona:park-guell': ('Park Güell', '구엘 공원'),
    'barcelona:boqueria': ('La Boqueria', '보케리아 시장'),
    'food:koelsch': ('Kölsch (beer)', '쾰쉬'),
    'food:pa-tomaquet': ('Pa amb tomàquet', '판 콘 토마테'),
    'food:jamon': ('Jamón ibérico', '이베리코 하몬'),
    'food:crema-catalana': ('Crema catalana', '크레마 카탈라나'),
    # ── 국경 너머: 베를린·마드리드
    'berlin': ('Brandenburg Gate', '브란덴부르크 문'),
    'berlin:east-side-gallery': ('East Side Gallery', '이스트사이드 갤러리'),
    'berlin:ddr-museum': ('DDR Museum', 'DDR 박물관'),
    'madrid': ('Museo del Prado', '프라도 미술관'),
    'madrid:puerta-del-sol': ('Puerta del Sol', '푸에르타 델 솔'),
    'madrid:royal-palace': ('Royal Palace, Madrid', '마드리드 왕궁'),
    'food:currywurst': ('Currywurst', '커리부어스트'),
    'food:berliner': ('Berliner (pastry)', '베를리너 도넛'),
    'food:doner': ('Döner kebab', '되너 케밥'),
    'food:tortilla': ('Tortilla de patatas', '스페인식 감자 오믈렛'),
    'food:cocido': ('Cocido madrileño', '코시도 마드릴레뇨'),
    'food:churros': ('Churro', '추로스'),
}
HEADERS = {'User-Agent': 'CarnetGame/0.2 (educational travel game; Commons photo attribution downloader)'}

def read_url(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=35) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)

def clean(value):
    return html.unescape(re.sub('<[^>]+>', '', value)).strip()

def fetch(asset_id, page, label):
    if page.startswith('File:'):
        title = page
    else:
        lang, page = ('fr', page[3:]) if page.startswith('fr:') else ('en', page)
        summary = json.loads(read_url(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(page, safe='')))
        original = summary.get('originalimage', {}).get('source')
        if not original:
            raise ValueError('No lead image: ' + page)
        path = urllib.parse.urlsplit(original).path
        filename = path.split('/')[-2] if '/thumb/' in path else path.rsplit('/', 1)[-1]
        title = 'File:' + urllib.parse.unquote(filename).replace('_', ' ')
    params = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'redirects': 1, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'titles': title, 'iiurlwidth': 1280})
    data = json.loads(read_url('https://commons.wikimedia.org/w/api.php?' + params))
    page_info = next(iter(data['query']['pages'].values()))
    if 'imageinfo' not in page_info:
        raise ValueError('Missing Commons file: ' + title)
    info = page_info['imageinfo'][0]
    meta = info['extmetadata']
    license_name = clean(meta.get('LicenseShortName', {}).get('value', ''))
    if not any(x in license_name.lower() for x in ['cc by', 'cc0', 'public domain', 'pd']):
        raise ValueError('License needs review: ' + license_name)
    download_url = info.get('thumburl', info['url']).split('?')[0]
    raw = read_url(download_url)
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    im.thumbnail((1600, 1200))
    name = asset_id.replace(':', '-')
    out = ROOT / 'public' / 'photos' / (name + '.webp')
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=82, method=6)
    thumb = im.copy()
    thumb.thumbnail((480, 360))
    thumb.save(out.with_name(name + '-thumb.webp'), 'WEBP', quality=75)
    return {'id': asset_id, 'src': '/photos/' + name + '.webp', 'thumb': '/photos/' + name + '-thumb.webp', 'title': label,
            'author': clean(meta.get('Artist', {}).get('value', 'Wikimedia Commons contributor')),
            'license': license_name, 'licenseUrl': meta.get('LicenseUrl', {}).get('value', ''),
            'sourceUrl': info['descriptionurl'], 'originalUrl': info['url'], 'width': im.width, 'height': im.height,
            'changes': 'Resized and converted to WebP; thumbnails resized. Display may crop the image.'}

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--search':
        for term in sys.argv[2:]:
            query = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'list': 'search', 'srnamespace': 6, 'srlimit': 4, 'srsearch': term + ' filetype:bitmap'})
            result = json.loads(read_url('https://commons.wikimedia.org/w/api.php?' + query))
            print(term, [p['title'] for p in result['query']['search']], flush=True)
            time.sleep(1)
        sys.exit(0)
    manifest_path = ROOT / 'src' / 'data' / 'photoManifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    failed = []
    for asset_id, (page, label) in TARGETS.items():
        if sys.argv[1:] and asset_id not in sys.argv[1:]:
            continue
        if '--refresh' not in sys.argv and asset_id in manifest and (ROOT / 'public' / manifest[asset_id]['src'].lstrip('/')).exists():
            continue
        try:
            manifest[asset_id] = fetch(asset_id, page, label)
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print('OK', asset_id, flush=True)
            time.sleep(1)
        except Exception as error:
            failed.append(asset_id)
            print('FAILED', asset_id, str(error), flush=True)
    print('Photos:', len(manifest), 'Failures:', ', '.join(failed), flush=True)
    if failed:
        sys.exit(1)
