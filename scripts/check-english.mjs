import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

export async function checkEnglish(server, useGame) {
  const { translateEnglish, ENGLISH } = await server.ssrLoadModule('/src/i18n.ts');
  const korean = /[가-힣]/;
  const missing = new Map();
  const check = (text, path) => {
    if (typeof text !== 'string' || !korean.test(text)) return;
    const translated = translateEnglish(text);
    if (korean.test(translated)) missing.set(path + ': ' + text, translated);
  };
  function data(value, path) {
    if (typeof value === 'string') check(value, path);
    else if (Array.isArray(value)) value.forEach((v,i) => data(v,`${path}[${i}]`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v]) => data(v,`${path}.${k}`));
  }
  for (const file of ['cities', 'cards', 'missions', 'photos', 'sources', 'metro', 'parisArrondissements']) {
    const module = await server.ssrLoadModule(`/src/data/${file}.ts`);
    for (const [key,value] of Object.entries(module)) if (typeof value !== 'function') data(value, `${file}.${key}`);
  }
  // Check all authored literals, JSX text and interpolation templates, including hidden states.
  for (const path of ['src/App.tsx', ...readdirSync('src/ui').filter(f=>f.endsWith('.tsx')).map(f=>`src/ui/${f}`), 'src/game/store.ts']) {
    const source = ts.createSourceFile(path, readFileSync(path,'utf8'), ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    function visit(n) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) check(n.text,path);
      if (ts.isJsxText(n)) check(n.text.replace(/\s+/g,' '),path);
      if (ts.isTemplateExpression(n)) check(n.head.text+n.templateSpans.map((s,i)=>`{${i}}${s.literal.text}`).join(''),path);
      ts.forEachChild(n,visit);
    }
    visit(source);
  }
  for (const [ko,en] of Object.entries(ENGLISH)) {
    assert.equal(korean.test(en),false,`English catalog contains Korean: ${ko}`);
    assert.deepEqual([...ko.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...en.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),`Interpolation mismatch: ${ko}`);
  }
  assert.equal(missing.size,0,`Untranslated content:\n${[...missing].map(([k,v])=>`${k}\n  => ${v}`).join('\n')}`);

  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  // SSR normally reads Zustand's original snapshot. For these render tests read the
  // current isolated test-store snapshot, as a mounted client does after each action.
  const originalHook=React.useSyncExternalStore;
  React.useSyncExternalStore=(_subscribe,getSnapshot)=>getSnapshot();
  const before=useGame.getState();
  let renders=0;
  try {
    useGame.getState().newGame('Jamie','EUR'); useGame.getState().setLang('en');
    const assertRender = (component,props,label) => {
      const html=renderToStaticMarkup(React.createElement(component,props));
      // Check visible text and accessible labels, excluding image URLs and user data.
      const visible=html.replace(/<[^>]+>/g,' ');
      assert.equal(korean.test(visible),false,`Korean visible in ${label}: ${visible.match(/.{0,40}[가-힣].{0,80}/g)?.join('\n')}`);
      assert.equal(/(?:alt|title|aria-label|placeholder)="[^"]*[가-힣]/.test(html),false,`Korean accessibility text in ${label}`);
      renders++; return html;
    };
    for (const file of ['MetroJourney','Intro','Hud','Journey','Notebook']) {
      const {default:Component}=await server.ssrLoadModule(`/src/ui/${file}.tsx`);
      assertRender(Component,{onJournal(){},onNotebook(){},onCity(){},onClose(){},selected:'paris',onSelect(){},onAlbum(){},mapMode:false,onMap(){}},file);
    }
    const {default:Panel}=await server.ssrLoadModule('/src/ui/CityPanel.tsx');
    const {CITIES}=await server.ssrLoadModule('/src/data/cities.ts');
    for (const city of CITIES) for (const tab of ['places','transport','food','missions']) assertRender(Panel,{cityId:city.id,initialTab:tab,onClose(){}},`${city.id}/${tab}`);
    const {default:Scene}=await server.ssrLoadModule('/src/ui/Scene.tsx');
    const {MISSIONS}=await server.ssrLoadModule('/src/data/missions.ts');
    for (const mission of MISSIONS) for (let step=0;step<mission.steps.length;step++) {
      useGame.setState({cityId:mission.cityId,active:{missionId:mission.id,step,wrong:0},paused:false});
      assertRender(Scene,{},`${mission.id}/${step}`);
    }
    // Old Korean saves must render in either locale; switching never changes answers or content.
    const mission=MISSIONS.find(m=>m.steps.some(s=>s.t==='quiz'));
    const quiz=mission.steps.find(s=>s.t==='quiz');
    const options=[...quiz.options];
    useGame.getState().setLang('ko'); assert.equal(translateEnglish('파리'),'Paris');
    useGame.getState().setLang('en'); assert.deepEqual(quiz.options,options);
    await useGame.persist.rehydrate(); assert.equal(useGame.getState().lang,'en');
    assert.equal(translateEnglish('파리 · 첫 풍경 엽서'),'Paris · First-view postcard');
    assert.equal(translateEnglish('오늘의 메뉴는 크루아상예요. 카운터에서 서서 마시면 더 싸다.'),"Today's menu is Croissant. It costs less if you stand at the counter.");
    console.log(`PASS: English catalog, every content record, ${renders} English screens/mission steps, immutable answers and saved locale.`);
  } finally { React.useSyncExternalStore=originalHook; useGame.setState(before,true); }
}
