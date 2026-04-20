// ── 人類 (Pedestrians) ─────────────────────────────────────────────────
// 小黃橢圓體 NPC。按下 Start 後才開始從頂邊陸續走入。
// 閒逛模式：慢速隨機漫遊，遇到建築會被推開。
// 逃命模式：偵測到玩家距離 < 2wu 後快速逃離，持續 3 秒再恢復閒逛。
// 玩家觸碰人類時人類立即消失並噴出黃色碎塊，從頂邊補回一個。
// 走到螢幕底邊外時：直接傳送回頂邊重生。
// 建築被打倒：在原地生成 hpMax/10 個人類。
// 場上人數控制參數 PED_MAX：從頂邊補人時若場上人數 >= PED_MAX 則暫緩。

const PED_INITIAL_COUNT   = 14;   // 初始目標人口（逐批從頂邊走入）
const PED_MAX             = 50;   // 場上人數控制參數：頂邊補充上限
const PED_SPAWN_INTERVAL  = 1.8;  // 秒：每隔幾秒從頂邊生一個（直到達初始目標）
const PED_REPLACE_DELAY   = 0.8;  // 秒：人類消失後幾秒補一個新的進來
const PED_REPLACE_PER_FRAME = 2;  // 每幀最多從替換佇列補入的數量（防爆量生成）

const PED_WANDER_SPD_MIN = 0.008; // 閒逛最低速 (wu/frame at 60fps)
const PED_WANDER_SPD_MAX = 0.020; // 閒逛最高速
const PED_FLEE_SPD       = 0.042; // 逃命速度
const PED_TURN_MIN       = 1.8;   // 閒逛：最少幾秒換方向
const PED_TURN_MAX       = 4.5;

const PED_R  = 0.19;
const PED_SY = 1.55;
const PED_Y  = PED_R * PED_SY * 0.5;

const PED_DETECT_DIST  = 2.0;
const PED_DETECT_DIST2 = PED_DETECT_DIST * PED_DETECT_DIST;
const PED_TOUCH_DIST   = PED_R + BODY_RADIUS + 0.2;
const PED_TOUCH_DIST2  = PED_TOUCH_DIST * PED_TOUCH_DIST;
const PED_FLEE_DUR     = 3.0;

// ── InstancedMesh ─────────────────────────────────────────────────────
const _PED_COLOR_ALIVE   = new THREE.Color(0xf5c518);
const _PED_COLOR_STUNNED = new THREE.Color(0xb8a85e); // grayish-yellow

const _pedInstMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(PED_R, 5, 4),
  new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false }),
  PED_MAX
);
_pedInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
_pedInstMesh.frustumCulled = false;  // bounding box 不涵蓋所有 instance，停用自動剔除
_pedInstMesh.count = PED_MAX;

// 隱藏用：將閒置 slot 移到畫面外，並初始化所有 slot 的顏色
const _pedHideMatrix = new THREE.Matrix4().setPosition(0, -9999, 0);
for (let i = 0; i < PED_MAX; i++) {
  _pedInstMesh.setMatrixAt(i, _pedHideMatrix);
  _pedInstMesh.setColorAt(i, _PED_COLOR_ALIVE);
}
_pedInstMesh.instanceMatrix.needsUpdate = true;
_pedInstMesh.instanceColor.needsUpdate  = true;
scene.add(_pedInstMesh);

// 重用 dummy 物件做矩陣合成（單執行緒，安全共用）
const _pedDummy = new THREE.Object3D();
_pedDummy.scale.set(1, PED_SY, 1);

// 閒置 slot 池
const _pedFreeSlots = [];
for (let i = PED_MAX - 1; i >= 0; i--) _pedFreeSlots.push(i);

const pedestrians      = [];
let   _pedSpawnTimer   = 0;
const _pedReplaceQueue = [];

// ── 輔助 ──────────────────────────────────────────────────────────────

function _wanderDir() {
  const spd   = PED_WANDER_SPD_MIN + Math.random() * (PED_WANDER_SPD_MAX - PED_WANDER_SPD_MIN);
  const angle = Math.random() * Math.PI * 2;
  // 微弱向上（-z）偏移，讓人流整體有往上漂移的感覺
  const vz = Math.sin(angle) * spd - 0.004;
  return { vx: Math.cos(angle) * spd, vz };
}

function _setInstanceMatrix(id, x, z, facingY) {
  _pedDummy.position.set(x, PED_Y, z);
  _pedDummy.rotation.set(0, facingY, 0);
  _pedDummy.updateMatrix();
  _pedInstMesh.setMatrixAt(id, _pedDummy.matrix);
}

function _makePedAt(x, z) {
  if (_pedFreeSlots.length === 0) return null; // no available slot — skip silently
  const instanceId = _pedFreeSlots.pop();
  _pedInstMesh.setColorAt(instanceId, _PED_COLOR_ALIVE); // always reset to yellow on spawn
  const { vx, vz } = _wanderDir();
  const facing = Math.atan2(vx, vz);
  _setInstanceMatrix(instanceId, x, z, facing);
  return {
    instanceId, x, z, vx, vz, facing,
    mode:      'wander',
    fleeTimer: 0,
    turnTimer: PED_TURN_MIN + Math.random() * (PED_TURN_MAX - PED_TURN_MIN),
    stunned:   false,
  };
}

function _spawnFromTop() {
  const x = (Math.random() * 2 - 1) * (AREA - 0.8);
  const z = _gZTop + 0.4 + Math.random() * (_gZBot - _gZTop - 0.8);
  const ped = _makePedAt(x, z);
  if (ped) pedestrians.push(ped);
}

function _spawnAtPos(wx, wz) {
  const x = clamp(wx + (Math.random() - 0.5) * 1.8, -AREA + 0.4, AREA - 0.4);
  const z = clamp(wz + (Math.random() - 0.5) * 1.8, _gZTop + 0.4, _gZBot - 0.4);
  const ped = _makePedAt(x, z);
  if (ped) pedestrians.push(ped);
}

// 移除第 i 個人類，釋放 slot（被玩家吃掉時呼叫，不補充）
function _removePedAt(i) {
  const p = pedestrians[i];
  _pedInstMesh.setMatrixAt(p.instanceId, _pedHideMatrix);
  _pedInstMesh.setColorAt(p.instanceId, _PED_COLOR_ALIVE); // reset slot for reuse
  _pedFreeSlots.push(p.instanceId);
  pedestrians.splice(i, 1);
}

// 重置到地板內隨機位置
function _teleportToTop(p) {
  p.x = (Math.random() * 2 - 1) * (AREA - 0.8);
  p.z = _gZTop + 0.4 + Math.random() * (_gZBot - _gZTop - 0.8);
  p.mode      = 'wander';
  p.fleeTimer = 0;
  p.stunned   = false;
  _pedInstMesh.setColorAt(p.instanceId, _PED_COLOR_ALIVE);
  const { vx, vz } = _wanderDir();
  p.vx = vx; p.vz = vz;
  p.facing    = Math.atan2(vx, vz);
  p.turnTimer = PED_TURN_MIN + Math.random() * (PED_TURN_MAX - PED_TURN_MIN);
}

// ── 公開 API ──────────────────────────────────────────────────────────

function spawnPedsAtBuilding(bx, bz, hpMax) {
  if (!gameStarted) return;
  const count = Math.min(30, Math.max(1, Math.round(hpMax / 10)));
  for (let i = 0; i < count; i++) _spawnAtPos(bx, bz);
}

// ── 每幀更新 ──────────────────────────────────────────────────────────
function updatePedestrians(dt, dtSec) {
  if (!gameStarted) return;

  const paused = gamePaused;

  // 初始逐批生成
  if (!paused && pedestrians.length < PED_INITIAL_COUNT && pedestrians.length < PED_MAX) {
    _pedSpawnTimer -= dtSec;
    if (_pedSpawnTimer <= 0) {
      _spawnFromTop();
      _pedSpawnTimer = PED_SPAWN_INTERVAL;
    }
  }

  // 替換佇列
  if (!paused) {
    let spawned = 0;
    for (let i = _pedReplaceQueue.length - 1; i >= 0 && spawned < PED_REPLACE_PER_FRAME; i--) {
      if (_pedReplaceQueue[i] > 0) {
        _pedReplaceQueue[i] -= dtSec;
      } else if (pedestrians.length < PED_MAX) {
        _spawnFromTop();
        _pedReplaceQueue.splice(i, 1);
        spawned++;
      }
    }
  }

  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const p = pedestrians[i];

    // 滾出地板邊界：傳送回地板內隨機位置
    if (p.x < -AREA + 0.4 || p.x > AREA - 0.4 || p.z < _gZTop + 0.4 || p.z > _gZBot - 0.4) {
      _teleportToTop(p);
      _setInstanceMatrix(p.instanceId, p.x, p.z, p.facing);
      continue;
    }

    if (!paused) {
      // 建築碰撞
      for (const b of buildings) {
        if (Math.abs(p.z - b.z) > b.d / 2 + PED_R + 0.1) continue;
        const fix = _pushOutOfBuilding(p.x, p.z, PED_R, b);
        if (fix) { p.x = fix.x; p.z = fix.z; }
      }

      // 玩家偵測（觸碰 + 逃命）
      let touchedByIndex = -1;
      let nearestDist2   = Infinity;
      let nearestPl      = null;

      for (let pi = 0; pi < players.length; pi++) {
        const pl = players[pi];
        if (!pl.active || pl.isDead) continue;
        const dx = p.x - pl.x, dz = p.z - pl.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < PED_TOUCH_DIST2) { touchedByIndex = pi; break; }
        if (d2 < nearestDist2)    { nearestDist2 = d2; nearestPl = pl; }
      }

      if (touchedByIndex >= 0) {
        if (players[touchedByIndex].fusingWith !== null) {
          // fusing — ignore touch
        } else {
          spawnPedTouchDebris(p.x, PED_Y, p.z);
          addDuoValue(touchedByIndex);
          _removePedAt(i);
          continue;
        }
      }

      // 融合獸碰觸：昏倒
      if (!p.stunned) {
        for (const ball of _fusionBalls) {
          if (ball.dispersing) continue;
          const dx = p.x - ball.cx, dz = p.z - ball.cz;
          if (dx * dx + dz * dz < (ball.R + PED_R) * (ball.R + PED_R)) {
            p.stunned = true;
            p.vx = 0; p.vz = 0;
            _pedInstMesh.setColorAt(p.instanceId, _PED_COLOR_STUNNED);
            break;
          }
        }
      }

      // 逃命 / 閒逛模式切換（昏倒時跳過）
      if (p.stunned) {
        _setInstanceMatrix(p.instanceId, p.x, p.z, p.facing);
        continue;
      }
      if (nearestDist2 < PED_DETECT_DIST2) {
        p.mode      = 'flee';
        p.fleeTimer = PED_FLEE_DUR;
        const dist  = Math.sqrt(nearestDist2);
        let dx = (p.x - nearestPl.x) / dist;
        let dz = (p.z - nearestPl.z) / dist;
        if (dist < 0.001) { dx = 0; dz = -1; }
        p.vx = dx * PED_FLEE_SPD;
        p.vz = dz * PED_FLEE_SPD;

      } else if (p.mode === 'flee') {
        p.fleeTimer -= dtSec;
        if (p.fleeTimer <= 0) {
          p.mode      = 'wander';
          p.fleeTimer = 0;
          const { vx, vz } = _wanderDir();
          p.vx = vx; p.vz = vz;
          p.turnTimer = PED_TURN_MIN + Math.random() * (PED_TURN_MAX - PED_TURN_MIN);
        }

      } else {
        p.turnTimer -= dtSec;
        if (p.turnTimer <= 0) {
          const { vx, vz } = _wanderDir();
          p.vx = vx; p.vz = vz;
          p.turnTimer = PED_TURN_MIN + Math.random() * (PED_TURN_MAX - PED_TURN_MIN);
        }
      }

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      if (p.x < -AREA + 0.4)    { p.x = -AREA + 0.4;    p.vx =  Math.abs(p.vx); }
      if (p.x >  AREA - 0.4)    { p.x =  AREA - 0.4;    p.vx = -Math.abs(p.vx); }
      if (p.z < _gZTop + 0.4)   { p.z = _gZTop + 0.4;   p.vz =  Math.abs(p.vz); }
      if (p.z > _gZBot - 0.4)   { p.z = _gZBot - 0.4;   p.vz = -Math.abs(p.vz); }

      if (Math.abs(p.vx) + Math.abs(p.vz) > 0.001) p.facing = Math.atan2(p.vx, p.vz);
    }

    _setInstanceMatrix(p.instanceId, p.x, p.z, p.facing);
  }

  // 全部 slot 更新完才標記一次
  _pedInstMesh.instanceMatrix.needsUpdate = true;
  _pedInstMesh.instanceColor.needsUpdate  = true;
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetPedestrians() {
  // Hide all instances and rebuild free slot pool from scratch
  for (let i = 0; i < PED_MAX; i++) _pedInstMesh.setMatrixAt(i, _pedHideMatrix);
  _pedInstMesh.instanceMatrix.needsUpdate = true;
  _pedFreeSlots.length = 0;
  for (let i = PED_MAX - 1; i >= 0; i--) _pedFreeSlots.push(i);
  pedestrians.length      = 0;
  _pedReplaceQueue.length = 0;
  _pedSpawnTimer          = 0;
}
