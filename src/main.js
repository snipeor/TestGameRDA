const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudGold = document.getElementById('gold');
const hudWave = document.getElementById('wave');
const hudBase = document.getElementById('base');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnBuild = document.getElementById('btn-build');
const btnRepair = document.getElementById('btn-repair');
const btnStart = document.getElementById('btn-start');
const overlay = document.getElementById('instructions');
const overlayTitle = overlay.querySelector('h1');
const overlayBody = overlay.querySelector('p');
const overlayList = overlay.querySelector('ul');
const overlayButton = overlay.querySelector('button');

const overlayDefaults = {
  title: overlayTitle.textContent,
  body: overlayBody.textContent,
  listHTML: overlayList ? overlayList.innerHTML : '',
  button: overlayButton.textContent,
};

const WORLD_LENGTH = 2600;
let viewWidth = canvas.width;
let viewHeight = canvas.height;
let groundY = viewHeight - 120;
const CAMERA_PADDING = 180;

const state = {
  running: false,
  gold: 100,
  wave: 1,
  baseHealth: 5,
  enemiesDefeated: 0,
  cameraX: 0,
  time: 0,
  difficulty: 1,
};

const player = {
  x: 200,
  y: groundY,
  width: 40,
  height: 64,
  speed: 200,
  dir: 1,
  animTime: 0,
  moving: false,
};

const controls = {
  left: false,
  right: false,
};

const towers = [];
const enemies = [];
const projectiles = [];

const slots = Array.from({ length: 16 }, (_, i) => ({
  x: 200 + i * 150,
  y: groundY,
  tower: null,
}));

const waves = {
  spawnTimer: 0,
  enemiesToSpawn: 0,
  active: false,
};

btnStart.addEventListener('click', () => {
  overlay.style.display = 'none';
  startGame();
});

const setupButton = (btn, key) => {
  const setState = (pressed) => {
    controls[key] = pressed;
    if (pressed) player.dir = key === 'left' ? -1 : 1;
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    setState(true);
  });
  btn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    setState(false);
  });
  btn.addEventListener('lostpointercapture', () => setState(false));
};

setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');

btnBuild.addEventListener('click', () => {
  buildOrUpgradeTower();
});

btnRepair.addEventListener('click', () => {
  repairTower();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') controls.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') controls.right = true;
  if (e.code === 'Space') buildOrUpgradeTower();
  if (e.code === 'KeyR') repairTower();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') controls.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') controls.right = false;
});

function startGame() {
  overlayTitle.textContent = overlayDefaults.title;
  overlayBody.textContent = overlayDefaults.body;
  if (overlayList) {
    overlayList.style.display = 'block';
    overlayList.innerHTML = overlayDefaults.listHTML;
  }
  overlayButton.textContent = overlayDefaults.button;
  state.running = true;
  state.gold = 100;
  state.wave = 1;
  state.baseHealth = 5;
  state.difficulty = 1;
  state.enemiesDefeated = 0;
  state.cameraX = 0;
  player.x = 200;
  player.dir = 1;
  player.animTime = 0;
  controls.left = controls.right = false;
  towers.length = 0;
  enemies.length = 0;
  projectiles.length = 0;
  slots.forEach((slot) => (slot.tower = null));
  beginNextWave();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function beginNextWave() {
  waves.active = true;
  waves.enemiesToSpawn = 5 + Math.floor(state.wave * 1.5 * state.difficulty);
  waves.spawnTimer = 1500;
  state.difficulty *= 1.1;
}

function buildOrUpgradeTower() {
  if (!state.running) return;
  const slot = findNearestSlot(player.x);
  if (!slot) return;
  const cost = slot.tower ? 80 : 50;
  if (state.gold < cost) return;
  state.gold -= cost;
  if (!slot.tower) {
    slot.tower = createTower(slot.x, slot.y);
    towers.push(slot.tower);
  } else {
    slot.tower.level++;
    slot.tower.fireRate *= 0.85;
    slot.tower.range += 25;
    slot.tower.damage += 4;
    slot.tower.maxHealth += 20;
    slot.tower.health = slot.tower.maxHealth;
  }
  flashUI(btnBuild);
}

function repairTower() {
  if (!state.running) return;
  const slot = findNearestSlot(player.x);
  if (!slot || !slot.tower) return;
  const cost = 40;
  if (state.gold < cost || slot.tower.health >= slot.tower.maxHealth) return;
  state.gold -= cost;
  slot.tower.health = Math.min(slot.tower.health + 30, slot.tower.maxHealth);
  flashUI(btnRepair);
}

function flashUI(button) {
  button.classList.add('active');
  setTimeout(() => button.classList.remove('active'), 120);
}

function findNearestSlot(x) {
  let nearest = null;
  let minDist = Infinity;
  for (const slot of slots) {
    const d = Math.abs(slot.x - x);
    if (d < minDist && d < 90) {
      minDist = d;
      nearest = slot;
    }
  }
  return nearest;
}

function createTower(x, y) {
  return {
    x,
    y: y - 60,
    level: 1,
    range: 260,
    fireRate: 900,
    lastShot: 0,
    damage: 12,
    health: 80,
    maxHealth: 80,
  };
}

function spawnEnemy() {
  const speed = 40 + Math.random() * 15 + state.wave * 2;
  const health = 50 + state.wave * 14;
  enemies.push({
    x: WORLD_LENGTH + 80,
    y: groundY - 40,
    width: 32,
    height: 48,
    speed,
    health,
    maxHealth: health,
    damageTimer: 0,
  });
}

function updateHUD() {
  hudGold.textContent = `Gold: ${Math.floor(state.gold)}`;
  hudWave.textContent = `Wave: ${state.wave}`;
  hudBase.textContent = `Base ❤️: ${state.baseHealth}`;
}

let lastTime = performance.now();
function loop(time) {
  if (!state.running) return;
  const dt = Math.min(32, time - lastTime);
  lastTime = time;
  state.time += dt;

  update(dt / 1000);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  handlePlayerMovement(dt);
  updateCamera();
  updateTowers(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  spawnGold(dt);
  updateHUD();
}

function spawnGold(dt) {
  state.gold += dt * 6;
}

function handlePlayerMovement(dt) {
  player.moving = false;
  let velocity = 0;
  if (controls.left) velocity -= player.speed;
  if (controls.right) velocity += player.speed;
  if (velocity !== 0) {
    player.moving = true;
    player.dir = Math.sign(velocity);
  }
  player.x += velocity * dt;
  player.x = Math.max(120, Math.min(WORLD_LENGTH - 120, player.x));
  player.animTime += dt * (player.moving ? 6 : 2);
}

function updateCamera() {
  const leftBound = state.cameraX + CAMERA_PADDING;
  const rightBound = state.cameraX + viewWidth - CAMERA_PADDING;
  const maxCamera = Math.max(0, WORLD_LENGTH - viewWidth);
  if (player.x < leftBound) {
    state.cameraX = Math.max(0, player.x - CAMERA_PADDING);
  } else if (player.x > rightBound) {
    state.cameraX = Math.min(maxCamera, player.x - (viewWidth - CAMERA_PADDING));
  }
  state.cameraX = Math.max(0, Math.min(maxCamera, state.cameraX));
}

function updateTowers(dt) {
  for (const tower of towers) {
    tower.lastShot -= dt * 1000;
    if (tower.lastShot < 0) tower.lastShot = 0;
    const target = findTarget(tower);
    if (target && tower.lastShot <= 0) {
      fireProjectile(tower, target);
      tower.lastShot = tower.fireRate;
    }
  }
}

function findTarget(tower) {
  let best = null;
  let bestDist = tower.range;
  for (const enemy of enemies) {
    const dist = enemy.x - tower.x;
    if (dist < 0 || dist > tower.range) continue;
    if (!best || dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

function fireProjectile(tower, enemy) {
  projectiles.push({
    x: tower.x,
    y: tower.y,
    target: enemy,
    speed: 420,
    damage: tower.damage,
  });
}

function updateEnemies(dt) {
  if (!waves.active && enemies.length === 0) {
    state.wave++;
    beginNextWave();
  }

  if (waves.active) {
    waves.spawnTimer -= dt * 1000;
    if (waves.spawnTimer <= 0 && waves.enemiesToSpawn > 0) {
      waves.spawnTimer = 850 + Math.random() * 300;
      waves.enemiesToSpawn--;
      spawnEnemy();
    }
    if (waves.enemiesToSpawn <= 0) waves.active = false;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.x -= enemy.speed * dt;
    enemy.damageTimer -= dt;

    const tower = towers.find((t) => Math.abs(t.x - enemy.x) < 24);
    if (tower) {
      if (enemy.damageTimer <= 0) {
        enemy.damageTimer = 0.7;
        tower.health -= 16;
        if (tower.health <= 0) {
          removeTower(tower);
        }
      }
      enemy.x += 15 * dt; // slow near tower
    }

    if (enemy.x < 80) {
      enemies.splice(i, 1);
      state.baseHealth--;
      if (state.baseHealth <= 0) {
        gameOver();
        return;
      }
    }
  }
}

function removeTower(tower) {
  const index = towers.indexOf(tower);
  if (index !== -1) towers.splice(index, 1);
  const slot = slots.find((s) => s.tower === tower);
  if (slot) slot.tower = null;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (!enemies.includes(proj.target)) {
      projectiles.splice(i, 1);
      continue;
    }
    const dir = Math.sign(proj.target.x - proj.x) || 1;
    proj.x += proj.speed * dt * dir;
    proj.y += Math.sin((proj.x + proj.y) * 0.02) * 12 * dt;
    if (Math.abs(proj.x - proj.target.x) < 18) {
      proj.target.health -= proj.damage;
      if (proj.target.health <= 0) {
        const enemyIndex = enemies.indexOf(proj.target);
        if (enemyIndex !== -1) enemies.splice(enemyIndex, 1);
        state.gold += 22 + state.wave * 2;
        state.enemiesDefeated++;
      }
      projectiles.splice(i, 1);
    }
  }
}

function gameOver() {
  state.running = false;
  overlay.style.display = 'flex';
  overlayTitle.textContent = 'The Keep Has Fallen';
  overlayBody.textContent = `You survived ${state.wave - 1} full waves and defeated ${state.enemiesDefeated} enemies.`;
  if (overlayList) {
    overlayList.style.display = 'none';
  }
  overlayButton.textContent = 'Try Again';
}

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  ctx.save();
  ctx.translate(-state.cameraX, 0);
  drawGround();
  drawSlots();
  drawTowers();
  drawPlayer();
  drawEnemies();
  drawProjectiles();
  drawBase();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  gradient.addColorStop(0, '#0e1d2c');
  gradient.addColorStop(0.4, '#132a45');
  gradient.addColorStop(0.8, '#1e2638');
  gradient.addColorStop(1, '#2c1d12');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // Mountains
  drawParallaxLayer(0.15, '#192d44', 120);
  drawParallaxLayer(0.25, '#1f3550', 180);
  drawParallaxLayer(0.35, '#142336', 240);
}

function drawParallaxLayer(speed, color, height) {
  ctx.fillStyle = color;
  const offset = (state.cameraX * speed) % viewWidth;
  for (let i = -1; i < 4; i++) {
    const x = i * viewWidth - offset;
    ctx.beginPath();
    ctx.moveTo(x, viewHeight - height);
    ctx.lineTo(x + viewWidth * 0.5, viewHeight - height - 80);
    ctx.lineTo(x + viewWidth, viewHeight - height);
    ctx.lineTo(x + viewWidth, viewHeight);
    ctx.lineTo(x, viewHeight);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = '#2f2115';
  ctx.fillRect(0, groundY, WORLD_LENGTH, viewHeight - groundY);
  ctx.fillStyle = '#3e2a18';
  for (let i = 0; i < WORLD_LENGTH; i += 64) {
    ctx.fillRect(i, groundY - 16, 32, 16);
  }
}

function drawSlots() {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 2;
  for (const slot of slots) {
    if (!slot.tower) {
      ctx.strokeRect(slot.x - 24, slot.y - 52, 48, 48);
    }
  }
  ctx.setLineDash([]);
}

function drawTowers() {
  for (const tower of towers) {
    const pulse = 1 + Math.sin(state.time * 0.005 + tower.x) * 0.03;
    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#b6a07b';
    ctx.beginPath();
    ctx.moveTo(-16, 48);
    ctx.lineTo(-16, -18);
    ctx.lineTo(0, -38);
    ctx.lineTo(16, -18);
    ctx.lineTo(16, 48);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ede3c5';
    ctx.fillRect(-10, -18, 20, 16);

    ctx.fillStyle = '#32251b';
    ctx.fillRect(-4, -40, 8, -14 * tower.level);

    const healthRatio = tower.health / tower.maxHealth;
    ctx.fillStyle = '#1a1f2b';
    ctx.fillRect(-18, 52, 36, 6);
    ctx.fillStyle = healthRatio > 0.6 ? '#6fe38e' : healthRatio > 0.3 ? '#f2b15c' : '#f26d6d';
    ctx.fillRect(-18, 52, 36 * healthRatio, 6);
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y - 48);
  ctx.scale(player.dir, 1);

  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-20, 20, 36, 38);
  ctx.fillStyle = '#d0a46f';
  ctx.fillRect(-12, 6, 24, 24);
  ctx.fillStyle = '#f7d37b';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#efb54a';
  ctx.beginPath();
  ctx.moveTo(-20, -22);
  ctx.lineTo(20, -22);
  ctx.lineTo(0, -50);
  ctx.closePath();
  ctx.fill();

  const bob = Math.sin(player.animTime) * 3;
  ctx.fillStyle = '#c9c1ac';
  ctx.fillRect(-28, 20 + bob, 12, 24);
  ctx.fillRect(16, 20 - bob, 12, 24);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = '#611626';
    ctx.fillRect(-16, -32, 32, 48);
    ctx.fillStyle = '#9d2235';
    ctx.fillRect(-12, -40, 24, 14);
    ctx.fillStyle = '#311015';
    ctx.fillRect(-18, 16, 36, 12);

    const ratio = enemy.health / enemy.maxHealth;
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -48, 40, 6);
    ctx.fillStyle = ratio > 0.5 ? '#6fe38e' : ratio > 0.25 ? '#f7c766' : '#f26d6d';
    ctx.fillRect(-20, -48, 40 * ratio, 6);
    ctx.restore();
  }
}

function drawProjectiles() {
  ctx.fillStyle = '#ffe08c';
  for (const proj of projectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBase() {
  ctx.save();
  ctx.translate(80, groundY - 20);
  ctx.fillStyle = '#544230';
  ctx.fillRect(-60, 20, 120, 60);
  ctx.fillStyle = '#8e7350';
  ctx.fillRect(-40, -20, 80, 40);
  ctx.fillStyle = '#35271a';
  ctx.fillRect(-20, 10, 40, 30);
  ctx.restore();
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  viewWidth = rect.width;
  viewHeight = rect.height;
  canvas.width = viewWidth * dpr;
  canvas.height = viewHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = viewHeight - 120;
  player.y = groundY;
  slots.forEach((slot) => {
    slot.y = groundY;
    if (slot.tower) {
      slot.tower.y = groundY - 60;
    }
  });
}
