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

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
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
    'boulogne:seine-musicale': ('La Seine Musicale', '스갱 섬 · 라 센 뮤지칼'),
    'saint-denis:sd-market': ('fr:Marché de Saint-Denis', '생드니 시장'),
    'argenteuil:monet-house': ('fr:Maison de Claude Monet à Argenteuil', '아르장퇴유 모네의 집'),
    'montreuil:murs': ('fr:Murs à pêches', '몽트뢰유 복숭아 담장'),
    'versailles:gardens': ('Gardens of Versailles', '베르사유 정원'),
    'amiens:verne-house': ('Maison de Jules Verne', '쥘 베른의 집'),
    'amiens:hortillonnages': ('fr:Hortillonnages d’Amiens', '아미앵 수상정원'),
    'amiens:madeleine': ('La Madeleine Cemetery, Amiens', '아미앵 마들렌 묘지'),
    'reims:reddition': ('Musée de la Reddition', '랭스 항복 박물관'),
    'reims:caves': ('Champagne wine region', '샹파뉴의 포도밭'),
    'rouen:rouen-cath': ('Rouen Cathedral', '루앙 대성당'),
    'rouen:vieux-marche': ('fr:Place du Vieux-Marché', '루앙 비외마르셰 광장'),
    'lille:pba': ('Palais des Beaux-Arts de Lille', '릴 순수미술관'),
    'lille:degaulle-house': ('Birthplace of Charles de Gaulle', '드골 생가'),
    'orleans:maison-jeanne': ('fr:Maison de Jeanne d’Arc (Orléans)', '오를레앙 잔 다르크의 집'),
    'food:croissant': ('Croissant', '크루아상'),
    'food:jambon-beurre': ('Jambon-beurre', '잠봉뵈르'),
    'food:cafe': ('Espresso', '에스프레소'),
    'food:croque': ('Croque monsieur', '크로크무슈'),
    'food:onion-soup': ('French onion soup', '프랑스식 양파 수프'),
    'food:paris-brest': ('Paris–Brest', '파리 브레스트'),
    'food:msemen': ('Msemmen', '므세멘'),
    'food:ficelle': ('Ficelle picarde', '피셀 피카르드'),
    'food:biscuit-rose': ('Pink biscuits of Reims', '랭스의 분홍 비스킷'),
    'food:carbonnade': ('Carbonade flamande', '카르보나드 플라망드'),
    'food:welsh': ('Welsh rarebit', '웰시'),
    'food:moules': ('Moules-frites', '홍합과 감자튀김'),
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
    manifest_path = ROOT / 'src' / 'data' / 'photoManifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    failed = []
    for asset_id, (page, label) in TARGETS.items():
        if sys.argv[1:] and asset_id not in sys.argv[1:]:
            continue
        if asset_id in manifest and (ROOT / 'public' / manifest[asset_id]['src'].lstrip('/')).exists():
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
