import assert from 'node:assert/strict';
export async function checkRail(server,assertRender) {
  const {RAIL_TRIPS}=await server.ssrLoadModule('/src/data/rail.ts');
  const {photoById}=await server.ssrLoadModule('/src/data/photos.ts');
  const {RailJourneyView}=await server.ssrLoadModule('/src/ui/RailJourney.tsx');
  const {initialRailState,railReducer,railProgress,restoreRailState}=await server.ssrLoadModule('/src/game/railJourney.ts');
  const props={dispatch(){},paused:false,onPause(){},saveError:false,onMetro(){}};
  let state=initialRailState();
  assert.equal(new Set(RAIL_TRIPS.map(t=>t.id)).size,8);
  assert.deepEqual(restoreRailState('{broken'),initialRailState());
  assert.deepEqual(railReducer(state,{type:'select',id:'missing'}),state);
  for(const trip of RAIL_TRIPS) {
    assert.ok(photoById(trip.id),`Missing ${trip.id} cover`);
    assert.equal(trip.moments.length,3);
    for(const m of trip.moments) assert.ok(photoById(m.photo),`Missing ${m.photo}`);
    // Complete all eight combinations of the three independent memory choices.
    for(let combination=0;combination<8;combination++) {
      state=railReducer(state,{type:'select',id:trip.id});
      state=railReducer(state,{type:'replay'});
      const render=()=>assertRender(RailJourneyView,{...props,state},`rail/${trip.id}/${combination}/${railProgress(state).phase}/${railProgress(state).step}`);
      const advance=()=>{state=railReducer(state,{type:'advance'});render();};
      render();advance();assert.equal(railProgress(state).phase,'window');
      advance();
      if(trip.via) {
        assert.equal(railProgress(state).phase,'transfer');advance();
        assert.equal(railProgress(state).leg,1);assert.equal(railProgress(state).phase,'window');advance();
      }
      assert.equal(railProgress(state).phase,'arrival');advance();
      for(let step=0;step<3;step++) {
        assert.equal(railProgress(state).step,step);
        const blocked=railReducer(state,{type:'advance'});assert.deepEqual(blocked,state,'Cannot skip an unchosen memory');
        state=railReducer(state,{type:'choose',choice:(combination>>step)&1});render();
        assert.deepEqual(restoreRailState(JSON.stringify(state)),state,'Journey restores at each choice');
        advance();
      }
      assert.equal(railProgress(state).phase,'complete');assert.equal(railProgress(state).stamped,true);
      state=railReducer(state,{type:'quiz',choice:(trip.quiz.answer+1)%3});render();
      state=railReducer(state,{type:'quiz',choice:trip.quiz.answer});render();
      assert.equal(railProgress(state).badge,true);
      assert.deepEqual(restoreRailState(JSON.stringify(state)),state);
    }
  }
  assert.equal(Object.values(state.trips).filter(p=>p.stamped).length,8);
  const replay=railReducer(state,{type:'replay'});
  assert.equal(railProgress(replay).stamped,true,'Replay keeps the city stamp');
  assert.equal(railProgress(replay).badge,true,'Replay keeps the discovery badge');
  const damaged=restoreRailState(JSON.stringify({selected:'nice',trips:{nice:{phase:'complete',step:999,choices:[0,99,1],leg:99}}}));
  assert.equal(railProgress(damaged).phase,'walk');assert.deepEqual(railProgress(damaged).choices,[0]);assert.equal(railProgress(damaged).step,1);
  assertRender(RailJourneyView,{...props,state,saveError:true,paused:true},'rail/storage-failure');
  console.log('PASS: 8 rail cities, 64 complete choice paths, required connection, discovery rewards and save recovery.');
}
