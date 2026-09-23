const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Load the game's exported rules without mounting a browser canvas.
const core = script.slice(0, script.indexOf('const game=Daldongne.mount'));
const context = {module: {exports: {}}};
vm.runInNewContext(core, context);
const g = context.module.exports;

test('ready state does not move or deliver; start and pause control time', () => {
  const s = g.newGame();
  const initial = JSON.stringify(s.n);
  g.step(s, .02, {x: 1});
  assert.equal(JSON.stringify(s.n), initial);
  assert.equal(g.interact(s), false);
  g.start(s);g.step(s,.02);
  assert.equal(s.time,.02);
  g.pause(s);g.step(s,.02);
  assert.equal(s.time,.02);
  g.pause(s);assert.equal(s.status,'playing');
});
test('coffee is required and distant interaction cannot deliver', () => {
  const s = g.newGame();g.start(s);
  s.n = g.ORDERS[0].door;
  assert.equal(g.interact(s),false);
  assert.equal(s.done.length,0);
  assert.equal(s.target,'cafe');
  s.n = g.math.at(0,-1.4);
  assert.equal(g.interact(s),false);
});
test('pick up four cups; duplicate interactions do not add deliveries; all four win', () => {
  const s = g.newGame();g.start(s);s.n=g.CAFE.door;
  assert.equal(g.interact(s),true);assert.equal(s.carrying,4);
  assert.equal(g.interact(s),false);assert.equal(s.carrying,4);
  for (const [i,site] of g.ORDERS.entries()) {
    s.n=site.door;assert.equal(g.interact(s),true);
    assert.equal(s.done.length,i+1);assert.equal(s.carrying,3-i);
    assert.equal(g.interact(s),false);assert.equal(s.done.length,i+1);
  }
  assert.equal(s.status,'won');
  const fresh=g.newGame();assert.equal(fresh.status,'ready');
  assert.equal(fresh.done.length,0);assert.equal(fresh.carrying,0);
});
