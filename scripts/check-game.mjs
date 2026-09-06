import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';

// Exercise the actual TypeScript modules with an isolated, in-memory save slot.
const saved = new Map();
globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) };
globalThis.window = { localStorage: globalThis.localStorage };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { CITIES, edgesFrom } = await server.ssrLoadModule('/src/data/cities.ts');
  const { MISSIONS, DISCOVERY_MISSIONS } = await server.ssrLoadModule('/src/data/missions.ts');
  const { CARDS } = await server.ssrLoadModule('/src/data/cards.ts');
  const { PHOTOS, photoById } = await server.ssrLoadModule('/src/data/photos.ts');
  const { priceChoices } = await server.ssrLoadModule('/src/game/priceChoices.ts');
  const { foodPrice } = await server.ssrLoadModule('/src/game/economy.ts');
  const { useGame } = await server.ssrLoadModule('/src/game/store.ts');
  const state = () => useGame.getState();
  assert.equal(DISCOVERY_MISSIONS.length, 24);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
  const positions = new Set();
  for (const city of CITIES) {
    assert.ok(photoById(city.id), `Missing city photograph: ${city.id}`);
    for (const food of city.foods) {
      const price = foodPrice(food, city);
      const options = priceChoices(price, `${city.id}:${food.id}`);
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.ok(options.every((n) => Number.isFinite(n) && n > 0));
      assert.ok(options.includes(price));
      positions.add(options.indexOf(price));
    }
  }
  assert.ok(positions.size >= 3, 'Correct price must move between positions');
  for (const photo of Object.values(PHOTOS)) {
    for (const path of [photo.src, photo.thumb]) {
      assert.ok(existsSync(`public${path}`), `Missing asset: ${path}`);
      assert.equal(readFileSync(`public${path}`).subarray(8, 12).toString(), 'WEBP');
    }
    assert.ok(photo.author && photo.license && photo.sourceUrl.startsWith('https://commons.wikimedia.org/'));
  }
  for (const mission of MISSIONS) {
    const city = CITIES.find((c) => c.id === mission.cityId);
    for (const id of mission.cardIds) assert.ok(CARDS.some((c) => c.id === id));
    for (const step of mission.steps) {
      if (step.t === 'photo') assert.ok(photoById(step.photoId), `Missing clue photo: ${step.photoId}`);
      if (step.t === 'buy') assert.ok(city.foods.some((f) => f.id === step.foodId));
      if (step.t === 'visit') assert.ok(city.pois.some((p) => p.id === step.poiId));
      if (step.t === 'quiz' || step.t === 'photo') assert.ok(step.answer >= 0 && step.answer < step.options.length);
    }
  }
  state().newGame('검증 작가', 'EUR');
  state().capturePhoto('paris'); state().capturePhoto('paris'); state().capturePhoto('lille');
  assert.equal(state().snapshots.length, 1, 'No duplicate or remote city captures');
  assert.ok(state().visitPoi('arenes', 30).ok);
  assert.ok(state().visitedPois.includes('paris:arenes'));
  assert.ok(state().snapshots.some((p) => p.photoId === 'paris:arenes'));
  state().startMission('paris-discovery-food'); state().nextStep();
  const balance = state().wallet.EUR;
  const purchase = state().buyFood('croissant', 1.5);
  const afterPurchase = state().wallet.EUR;
  state().buyFood('croissant', 1.5);
  assert.ok(balance > afterPurchase);
  assert.equal(state().wallet.EUR, afterPurchase, 'Resumed purchase is not charged twice');
  assert.equal(state().guesses.length, 1);
  assert.equal(state().active.result.price, purchase.price);
  state().setPaused(true); await useGame.persist.rehydrate();
  assert.equal(state().active.result.kind, 'buy', 'Receipt survives save reload');
  state().abandonMission();
  state().startMission('paris-discovery-photo'); state().nextStep();
  state().answer(false, 2); state().answer(false, 2);
  assert.equal(state().active.wrong, 1, 'Answer cannot be counted twice');
  assert.equal(state().active.result.picked, 2);
  while (state().currentStep().t !== 'article') state().nextStep();
  const report = state().submitArticle(state().cards);
  const paid = state().wallet.EUR;
  assert.deepEqual(state().submitArticle(state().cards), report);
  assert.equal(state().wallet.EUR, paid, 'Article fee cannot be collected twice');
  assert.equal(state().articles.length, 1);
  state().abandonMission();
  const edge = edgesFrom('paris').find((e) => e.to === 'boulogne');
  assert.ok(state().travel(edge, false).ok); state().arrive();
  assert.equal(state().cityId, 'boulogne');
  assert.equal(state().travelling, null);
  // Backward compatibility with v1 saves that predate the album fields.
  const old = JSON.parse(saved.get('carnet-save-v1'));
  delete old.state.snapshots; delete old.state.visitedPois; delete old.state.tastedFoods;
  state().reset();
  saved.set('carnet-save-v1', JSON.stringify(old));
  await useGame.persist.rehydrate();
  assert.equal(state().cityId, 'boulogne');
  assert.deepEqual(state().snapshots, []);
  assert.deepEqual(state().visitedPois, []);
  console.log(`PASS: ${CITIES.length} cities, ${MISSIONS.length} missions, ${Object.keys(PHOTOS).length} local photos; price choices, travel, collection, persistence and duplicate rewards.`);
} finally { await server.close(); }
