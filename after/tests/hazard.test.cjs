const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core = script.slice(0, script.indexOf('const game=Daldongne.mount'));
const context = {module: {exports: {}}};
vm.runInNewContext(core, context);
const g = context.module.exports;

const run = (s, secs, dt = 1 / 60) => { for (let i = 0; i < Math.round(secs / dt); i++) g.step(s, dt); };

test('HP starts at 3 and resets', () => {
  const s = g.newGame();
  assert.equal(s.hp, 3);
  assert.equal(g.HP_MAX, 3);
  assert.equal(s.stars.length, 0);
  assert.equal(s.timeLeft, g.TIME_LIMIT);
});

test('a hit spills every cup still in hand and sends you back to the cafe', () => {
  const s = g.newGame(); g.start(s); s.aliens = [];   // falling stars only
  s.n = g.CAFE.door.slice(); g.interact(s);
  assert.equal(s.carrying, g.ORDER_N);
  s.n = g.ORDERS[0].door.slice(); g.interact(s);      // one delivered, the rest in hand
  assert.equal(s.done.length, 1);
  assert.equal(s.carrying, g.ORDER_N - 1);
  s.n = g.newGame().n;                                 // back out in the open
  run(s, 3.05);
  s.n = s.stars[0].to.slice();                         // stand on the impact point
  run(s, 1.4);
  assert.equal(s.hp, 2, 'one heart gone');
  assert.equal(s.carrying, 0, 'the cups in hand are spilled');
  assert.equal(s.target, 'cafe', 'sent back to the cafe');
  assert.equal(s.done.length, 1, 'the delivery already made still counts');
  s.n = g.CAFE.door.slice(); g.interact(s);
  assert.equal(s.carrying, g.ORDER_N - 1, 'the cafe refills only what is still owed');
});

test('the run is on a clock', () => {
  const s = g.newGame(); g.start(s);
  run(s, 2);
  assert.ok(s.timeLeft < g.TIME_LIMIT && s.timeLeft > g.TIME_LIMIT - 2.2);
  s.timeLeft = .05;
  run(s, .3);
  assert.equal(s.status, 'lost');
  assert.equal(s.timeLeft, 0);
  assert.equal(g.newGame().timeLeft, g.TIME_LIMIT, 'the clock resets');
});

test('every hit slows the walk down', () => {
  const s = g.newGame();
  const full = g.walkSpeed(s);
  s.hp = 2; const hurt = g.walkSpeed(s);
  s.hp = 1; const worse = g.walkSpeed(s);
  assert.equal(full, g.WALK);
  assert.ok(hurt < full && worse < hurt, `${full} > ${hurt} > ${worse}`);
  assert.ok(worse > g.WALK * .5, 'still playable at one heart');
});

test('a volley of 4 stars is fired every 3 seconds while playing', () => {
  const s = g.newGame(); g.start(s);
  run(s, 2.9);
  assert.equal(s.stars.length, 0, 'nothing fired before 3s');
  run(s, 0.2);
  assert.equal(g.STAR_VOLLEY, 4);
  assert.equal(s.stars.length, 4, 'four stars at 3s');
  run(s, 3.0);
  assert.ok(s.stars.length >= 3 && s.stars.length <= 4, 'second volley arrives as the first expires');
});

test('one volley costs a standing player exactly 1 hp, not 4', () => {
  const s = g.newGame(); g.start(s); s.aliens = [];   // falling stars only
  run(s, 3.1);
  assert.equal(s.stars.length, 4);
  run(s, 2.6);
  assert.equal(s.hp, g.HP_MAX - 1, 'only the aimed star connects');
});

test('the fanned stars miss a standing player', () => {
  const s = g.newGame(); g.start(s);
  run(s, 3.05);
  const offsets = s.stars.map(st => g.math.angle(st.to, s.n));
  assert.equal(offsets.filter(a => a < 0.001).length, 1, 'exactly one aimed straight at the walker');
  assert.ok(offsets.filter(a => a > 0.1).length === 3, 'the other three are spread wide');
});

test('nothing fires while paused or before start', () => {
  const s = g.newGame();
  run(s, 10);
  assert.equal(s.stars.length, 0);
  assert.equal(s.hp, g.HP_MAX);
  g.start(s); g.pause(s);
  run(s, 10);
  assert.equal(s.stars.length, 0);
});

test('a hit costs exactly 1 hp and removes that star', () => {
  const s = g.newGame(); g.start(s); s.aliens = [];   // falling stars only
  run(s, 3.1);
  const before = s.stars.length;
  run(s, 2.5);
  assert.equal(s.hp, g.HP_MAX - 1, 'one hit costs exactly 1 hp');
  assert.ok(s.stars.length < before, 'the star disappears on impact');
});

test('stars burst on landing and leave a pop behind', () => {
  const s = g.newGame(); g.start(s); s.aliens = [];   // falling stars only
  run(s, 3.05);
  for (const st of s.stars) st.to = g.math.at(2.4, -.5); // aim them all far away
  const fired = s.stars.slice();
  run(s, 1.0);
  assert.equal(s.hp, g.HP_MAX, 'missed stars do no damage');
  assert.ok(fired.every(st => s.stars.includes(st)), 'still falling just before impact');
  run(s, 0.3);
  assert.ok(fired.every(st => !s.stars.includes(st)), 'gone the moment they land');
  assert.equal(s.pops.length, 4, 'each landing leaves a burst');
  run(s, 0.7);
  assert.equal(s.pops.length, 0, 'the burst fades out');
});

test('stars fall twice as fast as before', () => {
  const s = g.newGame(); g.start(s);
  run(s, 3.05);
  const st = s.stars[0];
  const high = st.alt;
  run(s, 1.18 / 2);
  assert.ok(st.alt < high * .6, 'halfway down by half of the 1.18s fall');
  assert.ok(s.stars.includes(st), 'still in the air at the halfway mark');
});

test('walking speed is doubled from the original .37', () => {
  assert.equal(g.WALK, .74);
  const s = g.newGame(); g.start(s);
  const from = s.n.slice();
  for (let i = 0; i < 30; i++) g.step(s, 1 / 60, {x: 1});
  const travelled = g.math.angle(from, s.n);
  assert.ok(Math.abs(travelled - .74 * .5) < .01, 'half a second at .74 rad/s, got ' + travelled);
});

test('arrow keys move the walker the way the screen shows it', () => {
  const s = g.newGame(); g.start(s);
  const cam = g.camera(s);
  const screen = st => cam.project(g.math.mul(st.n, g.R));
  const before = screen(s);
  for (let i = 0; i < 20; i++) g.step(s, 1 / 60, {y: -1});   // ArrowUp
  const afterUp = screen(s);
  assert.ok(afterUp.y < before.y, `up must move up the screen (${before.y} -> ${afterUp.y})`);

  const s2 = g.newGame(); g.start(s2);
  for (let i = 0; i < 20; i++) g.step(s2, 1 / 60, {y: 1});   // ArrowDown
  assert.ok(screen(s2).y > before.y, 'down must move down the screen');

  const s3 = g.newGame(); g.start(s3);
  for (let i = 0; i < 20; i++) g.step(s3, 1 / 60, {x: 1});   // ArrowRight
  assert.ok(screen(s3).x > before.x, 'right must move right on screen');
});

test('trees and yard props block the walker', () => {
  const tree = g.PROPS.find(p => p.kind === 'tree');
  assert.ok(tree, 'there are tree obstacles');
  assert.ok(g.PROPS.some(p => p.kind === 'bench') && g.PROPS.some(p => p.kind === 'wall'));
  const M = g.math;
  const s = g.newGame(); g.start(s);
  // stand a clear step outside the tree, facing it, then walk straight in
  const away = M.frame(tree.n).e;
  const gap = tree.r + .06;
  s.n = M.norm(M.add(M.mul(tree.n, Math.cos(gap)), M.mul(away, Math.sin(gap))));
  assert.ok(M.angle(s.n, tree.n) > tree.r, 'test starts outside the tree');
  s.north = M.norm(M.sub(tree.n, M.mul(s.n, M.dot(tree.n, s.n))));  // face the tree
  const start = M.angle(s.n, tree.n);
  for (let i = 0; i < 180; i++) g.step(s, 1 / 60, {y: 1});
  const end = M.angle(s.n, tree.n);
  assert.ok(end < start, 'the walker actually advanced toward the tree');
  assert.ok(end >= tree.r - 1e-9, `blocked at the trunk, got ${end} vs radius ${tree.r}`);
});

test('the saucer flies well above the rooftops', () => {
  const s = g.newGame(); g.start(s);
  g.fireStar(s);
  const alt = s.stars[0].alt;
  const tallest = Math.max(...g.SITES.map(b => b.h));
  assert.ok(alt >= 2.2, 'stars start high in the sky, got ' + alt);
  assert.ok(alt > 2.5 * tallest, `clears the tallest roof (${tallest}) by a wide margin`);
});

test('the damage circle matches the circle that gets drawn', () => {
  const M = g.math;
  // a star aimed at a fixed point: standing inside the ring is hit, standing outside is not
  const shift = (from, along, rad) => M.norm(M.add(M.mul(from, Math.cos(rad)), M.mul(along, Math.sin(rad))));
  const probe = offset => {
    const s = g.newGame(); g.start(s); s.aliens = [];   // falling stars only
    run(s, 3.05);
    const st = s.stars[0];
    s.stars.length = 1;                        // isolate the aimed star from its fan
    const side = M.frame(st.to).e;
    s.n = shift(st.to, side, offset);          // stand `offset` radians from the impact point
    const hp0 = s.hp;
    run(s, 2.6);                                // carry past the 2.35s impact without moving
    return hp0 - s.hp;
  };
  const r = 0.095;
  assert.equal(probe(0), 1, 'dead centre is a hit');
  assert.equal(probe(r * 0.8), 1, 'well inside the ring is a hit');
  assert.equal(probe(r * 1.3), 0, 'clearly outside the ring is a miss');
});

test('the walker turns to face the way they move', () => {
  const M = g.math;
  const s = g.newGame(); g.start(s);
  const heading = () => {
    const east = M.norm(M.cross(s.north, s.n));
    const u = M.norm(M.add(M.mul(s.north, Math.cos(s.facing)), M.mul(east, Math.sin(s.facing))));
    return M.mul(u, -1);            // the body faces -u
  };
  for (let i = 0; i < 60; i++) g.step(s, 1 / 60, {x: 1});     // walk right
  const east = M.norm(M.cross(s.north, s.n));
  assert.ok(M.dot(heading(), east) > 0.9, 'faces east after walking east');

  for (let i = 0; i < 60; i++) g.step(s, 1 / 60, {y: -1});    // then walk up-screen
  const ahead = M.mul(s.north, -1);
  assert.ok(M.dot(heading(), ahead) > 0.9, 'turns to face the new heading');

  const held = s.facing;
  for (let i = 0; i < 30; i++) g.step(s, 1 / 60, {});          // stop
  assert.equal(s.facing, held, 'keeps facing where it stopped');
});

test('aliens patrol the surface without standing inside anything', () => {
  const s = g.newGame(); g.start(s);
  assert.equal(s.aliens.length, g.ALIEN_COUNT);
  for (const a of s.aliens) {
    assert.ok(Math.abs(g.math.len(a.n) - 1) < 1e-9, 'sits on the surface');
    assert.ok(!g.blocked(a.n), 'does not spawn inside a building or tree');
  }
  const before = s.aliens.map(a => a.n.slice());
  run(s, 1.5);
  assert.ok(s.aliens.some((a, i) => g.math.angle(a.n, before[i]) > .02), 'they actually move');
  for (const a of s.aliens) assert.ok(!g.blocked(a.n), 'and never end up inside something');
});

test('bumping an alien costs one heart, with a moment of mercy after', () => {
  const s = g.newGame(); g.start(s);
  s.stars = []; s.timeLeft = 999;
  const a = s.aliens[0], before = s.aliens.length;
  s.n = a.n.slice();                       // stand right on top of one
  g.step(s, 1 / 60);
  assert.equal(s.hp, g.HP_MAX - 1, 'one heart gone');
  assert.ok(s.hurtTime > 0, 'brief invulnerability follows');
  assert.equal(s.aliens.length, before - 1, 'the alien bursts and is gone');
  assert.ok(!s.aliens.includes(a), 'that exact one, not some other');
  assert.ok(s.pops.some(p => p.alien), 'and leaves a burst behind');
  s.stars = [];
  const hpAfter = s.hp;
  for (let i = 0; i < 20; i++) { s.n = s.aliens[0].n.slice(); g.step(s, 1 / 60); s.stars = [] }
  assert.equal(s.hp, hpAfter, 'no second hit while the mercy window lasts');
});

test('an alien bump spills the coffee, exactly like a star', () => {
  const s = g.newGame(); g.start(s);
  s.n = g.CAFE.door.slice(); g.interact(s);
  assert.equal(s.carrying, g.ORDER_N);
  s.n = g.ORDERS[0].door.slice(); g.interact(s);       // deliver one, the rest left in hand
  assert.equal(s.done.length, 1);
  assert.equal(s.carrying, g.ORDER_N - 1);
  s.stars = []; s.timeLeft = 999;
  s.n = s.aliens[0].n.slice();
  g.step(s, 1 / 60);
  assert.equal(s.hp, g.HP_MAX - 1, 'one heart gone');
  assert.equal(s.carrying, 0, 'every cup in hand is spilled');
  assert.equal(s.target, 'cafe', 'sent back to the cafe');
  assert.equal(s.done.length, 1, 'the delivery already made still counts');
  s.n = g.CAFE.door.slice(); g.interact(s);
  assert.equal(s.carrying, g.ORDER_N - 1, 'the cafe refills only what is still owed');
});

test('aliens charge once the walker is close and calm down again', () => {
  const M = g.math;
  const s = g.newGame(); g.start(s);
  s.stars = []; s.timeLeft = 999;
  const a = s.aliens[0];
  assert.equal(a.rage, 0, 'starts calm');

  // park the walker just inside the aggro radius, far enough not to collide during the check
  const side = M.frame(a.n).e, gap = g.ALIEN_AGGRO * .8;
  s.n = M.norm(M.add(M.mul(a.n, Math.cos(gap)), M.mul(side, Math.sin(gap))));
  const before = M.angle(a.n, s.n);
  for (let i = 0; i < 20; i++) { g.step(s, 1 / 60); s.stars = [] }
  assert.ok(s.aliens.includes(a), 'still alive ??this test is about the charge, not the bump');
  assert.ok(a.rage > .5, 'winds up to a charge, got ' + a.rage.toFixed(2));
  assert.ok(M.angle(a.n, s.n) < before, 'and closes the gap');

  // walk away to the far side and it settles down
  s.n = M.mul(s.n, -1);
  for (let i = 0; i < 90; i++) { g.step(s, 1 / 60); s.stars = [] }
  assert.ok(a.rage < .1, 'calms back down out of range, got ' + a.rage.toFixed(2));
});

test('a charge that never lands burns the alien out, harmlessly', () => {
  const M = g.math;
  const s = g.newGame(); g.start(s);
  s.stars = []; s.timeLeft = 999;
  const a = s.aliens[0];
  s.aliens = [a];                    // one alien, so nobody else can land a hit meanwhile
  const before = s.aliens.length;
  // hold the walker just inside the aggro ring, stepping away each frame so it never connects
  const side = M.frame(a.n).e, gap = g.ALIEN_AGGRO * .8;
  s.n = M.norm(M.add(M.mul(a.n, Math.cos(gap)), M.mul(side, Math.sin(gap))));
  for (let i = 0; i < 60 * (g.ALIEN_FUSE + 1); i++) {
    s.stars = [];
    const away = M.norm(M.sub(s.n, M.mul(a.n, M.dot(s.n, a.n))));
    s.n = M.norm(M.add(M.mul(a.n, Math.cos(gap)), M.mul(away, Math.sin(gap))));  // keep the gap fixed
    g.step(s, 1 / 60);
    if (!s.aliens.includes(a)) break;
  }
  assert.ok(!s.aliens.includes(a), 'it blew itself up');
  assert.ok(s.aliens.length < before, 'the crowd thins out');   // neighbours may burn out too
  assert.equal(s.hp, g.HP_MAX, 'and took no heart with it');
  assert.ok(s.pops.some(p => p.alien), 'leaving the same green burst');
});

test('a charging alien can always be outrun', () => {
  const s = g.newGame();
  for (let hp = 1; hp <= g.HP_MAX; hp++) {
    s.hp = hp;
    assert.ok(g.walkSpeed(s) > g.ALIEN_RUSH,
      `at ${hp} heart(s) the walk (${g.walkSpeed(s).toFixed(2)}) must beat the rush (${g.ALIEN_RUSH})`);
  }
});

test('the field is crowded but nobody starts on top of anything', () => {
  const s = g.newGame();
  assert.equal(s.aliens.length, g.ALIEN_COUNT);
  assert.ok(g.ALIEN_COUNT >= 8, 'a proper crowd');
  for (let i = 0; i < s.aliens.length; i++) {
    assert.ok(!g.blocked(s.aliens[i].n));
    assert.ok(g.math.angle(s.aliens[i].n, s.n) > .4, 'not on the walker');
    for (let j = i + 1; j < s.aliens.length; j++)
      assert.ok(g.math.angle(s.aliens[i].n, s.aliens[j].n) > .2, 'spread out');
  }
});

// Walk straight across a trap at a given speed and report whether it caught us.
function crossTrap(hp) {
  const M = g.math;
  const s = g.newGame(); g.start(s);
  s.stars = []; s.aliens = []; s.hearts = []; s.timeLeft = 999; s.hp = hp;
  const tr = s.traps[0];
  const dir = M.frame(tr.n).e;
  // start one trap-radius short of the plate, heading straight through the middle
  s.n = M.norm(M.add(M.mul(tr.n, Math.cos(g.TRAP_R)), M.mul(dir, -Math.sin(g.TRAP_R))));
  s.north = M.norm(M.sub(tr.n, M.mul(s.n, M.dot(tr.n, s.n))));   // walking forward = toward the plate
  const hp0 = s.hp;
  for (let i = 0; i < 90 && !tr.spent; i++) { g.step(s, 1 / 60, {y: 1}); s.stars = [] }
  return {armed: tr.spent, hurt: hp0 - s.hp};
}

test('a trap arms when stepped on and only a full-speed walker outruns it', () => {
  const fast = crossTrap(g.HP_MAX);        // 0.74 rad/s
  assert.ok(fast.armed, 'stepping on the plate arms it');
  assert.equal(fast.hurt, 0, 'at full speed you clear the blast');

  const slow = crossTrap(1);               // two hearts down, 0.49 rad/s
  assert.ok(slow.armed);
  assert.equal(slow.hurt, 1, 'hobbling, the same crossing catches you');
});

test('standing on an armed trap always costs a heart', () => {
  const M = g.math;
  const s = g.newGame(); g.start(s);
  s.stars = []; s.aliens = []; s.hearts = []; s.timeLeft = 999;
  const tr = s.traps[0];
  s.n = tr.n.slice();
  for (let i = 0; i < 60 && !tr.spent; i++) { g.step(s, 1 / 60); s.stars = [] }
  assert.ok(tr.spent, 'it went off');
  assert.equal(s.hp, g.HP_MAX - 1);
  assert.ok(s.pops.some(p => p.trap), 'and left a burst');
});

test('traps are laid clear of doorsteps and of each other', () => {
  const M = g.math;
  const s = g.newGame();
  assert.equal(s.traps.length, g.TRAP_COUNT);
  for (let i = 0; i < s.traps.length; i++) {
    const a = s.traps[i].n;
    assert.ok(!g.blocked(a), 'not inside a building or boulder');
    assert.ok(M.angle(a, s.n) > .5, 'not under the walker at the start');
    for (const site of g.SITES) assert.ok(M.angle(a, site.door) > .29, 'not on a doorstep');
    for (let j = i + 1; j < s.traps.length; j++)
      assert.ok(M.angle(a, s.traps[j].n) > .3, 'not stacked on each other');
  }
  assert.equal(g.newGame().traps.every(t => !t.spent && t.fuse === 0), true, 'a new run re-lays them');
});

test('the task line names the current step', () => {
  const s = g.newGame(); g.start(s);
  assert.match(g.taskText(s), /카페에서 커피 받기/);
  s.n = g.CAFE.door; g.interact(s);
  assert.equal(s.carrying, g.ORDER_N);
  assert.match(g.taskText(s), /배달하기/);
  assert.match(g.taskText(s), new RegExp(g.ORDER_N + '잔'));
  s.n = g.ORDERS[0].door; g.interact(s);
  assert.match(g.taskText(s), new RegExp((g.ORDER_N - 1) + '잔'));
});

test('losing every heart ends the game and reset restores them', () => {
  const s = g.newGame(); g.start(s);
  run(s, 30);
  assert.equal(s.hp, 0);
  assert.equal(s.status, 'lost');
  assert.equal(s.stars.length, 0);
  const fresh = g.newGame();
  assert.equal(fresh.hp, 3);
  assert.equal(fresh.status, 'ready');
});

test('a lost game stops moving and delivering', () => {
  const s = g.newGame(); g.start(s);
  run(s, 30);
  assert.equal(s.status, 'lost');
  const where = JSON.stringify(s.n);
  g.step(s, .02, {x: 1});
  assert.equal(JSON.stringify(s.n), where);
  assert.equal(g.interact(s), false);
});

test('the saucer stays above the town, not on it', () => {
  const s = g.newGame(); g.start(s);
  const u = g.ufoNormal(s);
  assert.ok(Math.abs(g.math.len(u) - 1) < 1e-9, 'unit normal');
  const sep = g.math.angle(u, s.n);
  assert.ok(sep > .3 && sep < .5, 'orbits near the player, got ' + sep);
});

test('delivery still works while dodging', () => {
  const s = g.newGame(); g.start(s);
  s.n = g.CAFE.door;
  assert.equal(g.interact(s), true);
  assert.equal(s.carrying, g.ORDER_N);
  for (const o of g.ORDERS) { s.n = o.door; assert.equal(g.interact(s), true); }
  assert.equal(s.done.length, g.ORDER_N);
  assert.equal(s.status, 'won');
});
