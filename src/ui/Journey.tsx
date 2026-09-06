import { useState } from 'react';
import { CITIES, cityById, REGIONS } from '../data/cities';
import { cityPhotos, photoById } from '../data/photos';
import { missionsForCity } from '../data/missions';
import { useGame } from '../game/store';
import TravelPhoto from './TravelPhoto';
import { useT } from '../i18n';

export default function Journey({ selected, onSelect, onAlbum, mapMode, onMap }: {
  selected: string | null; onSelect: (id: string) => void; onAlbum: () => void; mapMode: boolean; onMap: () => void;
}) {
  const s = useGame();
  const t = useT();
  const city = cityById(selected ?? s.cityId);
  const photos = cityPhotos(city.id);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex % Math.max(1, photos.length)];
  const here = city.id === s.cityId;
  const collected = s.snapshots.some((p) => p.photoId === photo?.id);
  const next = missionsForCity(s.cityId).find((m) => !s.completed.includes(m.id) && (!m.requires || m.requires.every((id) => s.completed.includes(id))));
  return <>
    <div className={`journey-main${mapMode ? ' is-map' : ''}${selected ? '' : ' expanded'}`}>
      <div className="journey-heading"><div><span className="eyebrow">LE CARNET DE VOYAGE / VOL. 01</span><h1>{t('오늘은, 어디까지 걸어볼까.')}</h1></div><div className="view-switch"><button className={!mapMode ? 'active' : ''} onClick={() => { if (mapMode) onMap(); }}>{t('풍경')}</button><button className={mapMode ? 'active' : ''} onClick={() => { if (!mapMode) onMap(); }}>{t('지도 ↗')}</button></div></div>
      {!mapMode && <>
        <div className="destination-hero">
          <TravelPhoto key={photo?.id} photo={photo} priority className="hero-photo" />
          <div className="hero-shade" />
          <div className="hero-location"><span className="destination-kicker">{here ? t('● 지금 머무는 도시') : s.unlocked.includes(city.region) ? t('다음 여행의 미리보기') : t('아직 도착하지 않은 풍경')} · {t(REGIONS[city.region].name)}</span><h2>{city.names.fr}</h2><p>{city.names.ko} <span>{city.coord[1].toFixed(2)}° N · {city.coord[0].toFixed(2)}° E</span></p></div>
          <div className="hero-bottom"><span>{photo?.title ?? city.names.ko}<small>{photoIndex % Math.max(1, photos.length) + 1} / {photos.length} PHOTOGRAPHS</small></span><div className="hero-controls"><button aria-label="이전 풍경" onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}>←</button><button aria-label="다음 풍경" onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}>→</button><button className="capture" disabled={!here || collected || !photo || !!s.travelling} onClick={() => { if (photo) s.capturePhoto(photo.id); }}>{collected ? t('✓ 앨범에 담았어요') : here ? t('＋ 사진 담기') : t('도착해서 사진 담기')}</button></div></div>
        </div>
        <div className="journey-notes"><button className="next-assignment" onClick={() => { if (s.active) s.setPaused(false); else if (next) s.startMission(next.id); }} disabled={!!s.travelling || (!s.active && !next)}><span className="note-icon">✎</span><span><small>{s.active ? t('이어 쓰는 여행') : t('편집부의 다음 취재')}</small><b>{s.active ? t('접어둔 미션 이어하기') : next?.title ?? t('모든 취재를 마쳤어요')}</b></span><span className="note-arrow">↗</span></button><button className="album-note" onClick={onAlbum}><span className="note-icon">▧</span><span><small>{t('나만의 여행 앨범')}</small><b>{s.snapshots.length}{s.lang === 'en' ? ' memories' : '장의 기억'}</b></span><span className="note-arrow">→</span></button></div>
      </>}
      {mapMode && (
        <button className="map-assignment" onClick={() => { if (s.active) s.setPaused(false); else if (next) s.startMission(next.id); }} disabled={!!s.travelling || (!s.active && !next)}>
          <span className="note-icon">✎</span><span><small>{s.active ? t('이어 쓰는 여행') : t('편집부의 다음 취재')}</small><b>{s.active ? t('접어둔 미션 이어하기') : next?.title ?? t('모든 취재를 마쳤어요')}</b></span><span className="note-arrow">↗</span>
        </button>
      )}
    </div>
    {!mapMode && <section className="destination-strip" aria-label="도시 여행 목록"><div className="strip-heading"><span>{t('다음 페이지의 도시들')}</span><small>{s.visited.length} / {CITIES.length} CITIES VISITED</small></div><div className="destination-scroll">{CITIES.map((c, i) => {
      const picture = photoById(c.id);
      const locked = !s.unlocked.includes(c.region);
      return <button key={c.id} className={`destination-card${c.id === city.id ? ' chosen' : ''}`} onClick={() => { setPhotoIndex(0); onSelect(c.id); }} aria-pressed={c.id === city.id}>
        {picture && <img src={picture.thumb} alt="" loading="lazy" width={240} height={150} />}<span className="postcard-number">{String(i + 1).padStart(2, '0')}</span><div><b>{c.names.ko}</b><small>{locked ? `🔒 ${t('이야기 진행으로 열기')}` : s.visited.includes(c.id) ? t('✓ 나의 발자취') : c.names.fr}</small></div>
      </button>;
    })}</div></section>}
  </>;
}
