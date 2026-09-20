import { useEffect } from 'react';
import Portrait from './Portrait';
import { useTypewriter } from './useTypewriter';
import { useGame } from '../game/store';
import { cityById } from '../data/cities';
import { primeAudio, sfx } from '../game/audio';

// ─── 안내인 첫 만남 ─────────────────────────────────────────────────────────
// 도시의 안내인이 처음 입을 여는 순간, 그 사람을 소개하는 인물 카드가 한 번 뜬다.
// 카드를 닫으면 수첩 「사람들」에 적히고, 두 번 다시 뜨지 않는다.

export default function GuideIntro({ cityId }: { cityId: string }) {
  const sound = useGame((s) => s.sound);
  const speed = useGame((s) => s.textSpeed);
  const meetGuide = useGame((s) => s.meetGuide);
  const city = cityById(cityId);
  const g = city.guide;
  const { shown, done, skip } = useTypewriter(g.intro, { speed, voice: 'guide', sound, animate: speed > 0 });

  useEffect(() => { primeAudio(); sfx.page(); }, []);

  // 인사하면 metGuides에 들어가고, 그 순간 이 카드는 사라진다
  const close = () => { primeAudio(); sfx.advance(); meetGuide(cityId); };

  return (
    <div className="vn-center" onClick={() => { if (!done) skip(); }}>
      <div className="meet-card">
        <div className="meet-tag">{city.names.ko}에서 만난 사람</div>
        <Portrait who="guide" name={g.name} color={g.color} look={g.look} expression={g.mood ?? 'neutral'} talking={!done} size={168} />
        <h3>{g.name}<small>{g.archetype}</small></h3>
        <div className="meet-city">{city.names.ko} · {city.names.fr}</div>
        <p className="meet-quote">{shown}<span className="caret" style={{ opacity: done ? 0 : 1 }}>▏</span></p>
        <div className="meet-foot">
          <span className="hint">수첩 「사람들」에 적어 둡니다</span>
          <button className="btn red sm" onClick={(e) => { e.stopPropagation(); if (!done) { skip(); return; } close(); }}>
            {done ? '인사한다 ▸' : '전부 보기 ⏩'}
          </button>
        </div>
      </div>
    </div>
  );
}
