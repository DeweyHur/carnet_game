import { useGame } from '../game/store';

export default function LanguageSwitch() {
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  return <div className="metro-language" role="group" aria-label={lang === 'en' ? 'Language' : '언어'}>
    <button lang="ko" aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>KO</button>
    <button lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
  </div>;
}
