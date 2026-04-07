// ── Duration constants ─────────────────────────────────────────────────
const FIRE_EFFECT_DURATION  = INVINCIBLE_SEC;         // same as flash
const SMOKE_EFFECT_DURATION = INVINCIBLE_SEC + 1;     // 1 extra second

// ── Geometry & material pools ──────────────────────────────────────────
const _fireGeo  = new THREE.SphereGeometry(0.26, 7, 5);   // larger fire particles
const _smokeGeo = new THREE.SphereGeometry(0.13, 16, 12); // round smoke (high segments)

const _fireMats = [0xff2200, 0xff5500, 0xff8800, 0xffcc00].map(c =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false })
);
const _smokeMat = new THREE.MeshBasicMaterial({
  color: 0x222222, transparent: true, depthWrite: false
});

function _makeMat(isSmoke) {
  return isSmoke
  ? _smokeMat.clone()
  : _fireMats[Math.floor(Math.random() * _fireMats.length)].clone();
}

// ── Particle pool ──────────────────────────────────────────────────────
const FIRE_POOL  = 60;
const SMOKE_POOL = 80;

function _buildPool(count, geo, isSmoke) {
  return Array.from({ length: count }, () => {
    const mesh = new THREE.Mesh(geo, _makeMat(isSmoke));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, active: false, life: 0, maxLife: 0,
      vx: 0, vy: 0, vz: 0, initScale: 1, isSmoke };
    });
  }
  
  const firePool  = _buildPool(FIRE_POOL,  _fireGeo,  false);
  const smokePool = _buildPool(SMOKE_POOL, _smokeGeo, true);
  
  // Pre-built merged array so updateEffects never allocates one per frame
  const _allParticlePool = [...firePool, ...smokePool];
  
  // Circular-scan heads: next search starts after the last acquired slot (O(1) typical)
  let _fireHead  = 0;
  let _smokeHead = 0;
  
  // ── Per-player emitter state ───────────────────────────────────────────
  const playerEffects = players.map(() => ({
    fireTimer:   0,
    smokeTimer:  0,
    fireEmitCD:  0,
    smokeEmitCD: 0,
    eyeEmitCD:   0,
  }));
  
  // ── Spawn one fire or smoke particle ──────────────────────────────────
  function _spawn(pool, px, py, pz, isSmoke) {
    let slot = -1;
    const len = pool.length;
    let head = isSmoke ? _smokeHead : _fireHead;
    for (let i = 0; i < len; i++) {
      const idx = (head + i) % len;
      if (!pool[idx].active) { slot = idx; break; }
    }
    if (slot === -1) return;
    if (isSmoke) _smokeHead = (slot + 1) % len;
    else         _fireHead  = (slot + 1) % len;
    const p = pool[slot];
    
    p.active  = true;
    p.maxLife = isSmoke
    ? 0.7 + Math.random() * 0.5
    : 0.18 + Math.random() * 0.18;
    p.life = p.maxLife;
    
    const spread = isSmoke ? 0.2 : 0.6;
    p.vx = (Math.random() - 0.5) * spread;
    p.vy = (isSmoke ? 0.35 : 1.0) + Math.random() * (isSmoke ? 0.25 : 0.7);
    p.vz = (Math.random() - 0.5) * spread;
    
    p.initScale = isSmoke
    ? 0.7 + Math.random() * 0.7
    : 0.4 + Math.random() * 0.8;
    
    p.mesh.position.set(px, py, pz);
    p.mesh.scale.setScalar(p.initScale);
    p.mesh.material.opacity = 1;
    p.mesh.visible = true;
  }
  
  // ── Death explosion particles ──────────────────────────────────────────
  const deathParticles = [];
  const _DEATH_PARTICLE_MAX = 300; // shared pool for player death + building debris
  
  function triggerDeathExplosion(pi) {
    const p = players[pi];
    const pos = p.group.position;
    const bodyColor = p.bodyMats[0].color.clone();
    const COUNT = 26;
    
    // Discard oldest particles if the pool is full
    while (deathParticles.length + COUNT > _DEATH_PARTICLE_MAX) {
      const old = deathParticles.shift();
      scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
    
    for (let k = 0; k < COUNT; k++) {
      const s = 0.10 + Math.random() * 0.18;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * (0.5 + Math.random() * 1.0), s),
        new THREE.MeshLambertMaterial({ color: bodyColor, transparent: true, opacity: 1 })
      );
      mesh.castShadow = true;
      
      const theta  = Math.random() * Math.PI * 2;
      const upBias = 0.35 + Math.random() * 0.65;
      const speed  = 3 + Math.random() * 4.5;
      const vx = Math.cos(theta) * speed * (1 - upBias * 0.4);
      const vy = upBias * speed * 0.85 + 1.5;
      const vz = Math.sin(theta) * speed * (1 - upBias * 0.4);
      
      mesh.position.set(pos.x, pos.y + 0.52, pos.z);
      scene.add(mesh);
      
      const maxLife = 0.6 + Math.random() * 0.3;
      deathParticles.push({
        mesh, vx, vy, vz,
        rx: (Math.random() - 0.5) * 10,
        rz: (Math.random() - 0.5) * 10,
        life: maxLife, maxLife,
      });
    }
  }
  
  function updateDeathParticles(dt) {
    for (let i = deathParticles.length - 1; i >= 0; i--) {
      const pt = deathParticles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        scene.remove(pt.mesh);
        pt.mesh.geometry.dispose();
        pt.mesh.material.dispose();
        deathParticles.splice(i, 1);
        continue;
      }
      if (pt.isSmoke) {
        // Smoke: gentle upward drift, no gravity, slow drag
        pt.vx *= Math.pow(0.85, dt * 60);
        pt.vz *= Math.pow(0.85, dt * 60);
        pt.vy += 0.25 * dt; // slight upward acceleration
      } else {
        pt.vy -= 28 * dt; // gravity — heavy chunks fall fast
        if (pt.mesh.position.y < 0.05) {
          pt.mesh.position.y = 0.05;
          pt.vy *= -0.25;
          pt.vx *= 0.7;
          pt.vz *= 0.7;
        }
        pt.mesh.rotation.x += pt.rx * dt;
        pt.mesh.rotation.z += pt.rz * dt;
      }
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      const frac = pt.life / pt.maxLife;
      if (pt.isSmoke) {
        // Smoke: linear fade from full opacity to 0 over entire lifetime
        pt.mesh.material.opacity = frac * 0.85;
      } else if (frac < 0.4) {
        // Debris: fade out in final 40% of life
        pt.mesh.material.opacity = frac / 0.4;
      }
    }
  }
  
  // ── Building hit debris (small chips at punch contact point) ─────────
  function spawnBuildingHitDebris(wx, wy, wz, color, scale = 1) {
    const COUNT = 16;
    while (deathParticles.length + COUNT > _DEATH_PARTICLE_MAX) {
      const old = deathParticles.shift();
      scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
    }
    for (let k = 0; k < COUNT; k++) {
      const s = (0.04 + Math.random() * 0.07) * scale;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * (0.5 + Math.random()), s),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.castShadow = true;
      const theta = Math.random() * Math.PI * 2;
      const speed = (1.5 + Math.random() * 2.5) * scale;
      mesh.position.set(wx, wy, wz);
      scene.add(mesh);
      const maxLife = 0.3 + Math.random() * 0.2;
      deathParticles.push({
        mesh,
        vx: Math.cos(theta) * speed,
        vy: (1.0 + Math.random() * 2.0) * scale,
        vz: Math.sin(theta) * speed,
        rx: (Math.random() - 0.5) * 15,
        rz: (Math.random() - 0.5) * 15,
        life: maxLife, maxLife,
      });
    }
  }
  
  // ── Building destroy debris (large burst at building position) ─────────
  function spawnBuildingDestroyDebris(bx, bCenterY, bz, bw, bh, bd, color) {
    const COUNT = Math.max(12, Math.round(bw * bd * 6)); // ~12 for 1×1, ~54 for 3×3
    while (deathParticles.length + COUNT > _DEATH_PARTICLE_MAX) {
      const old = deathParticles.shift();
      scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
    }
    for (let k = 0; k < COUNT; k++) {
      const s = 0.08 + Math.random() * 0.24;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * (0.5 + Math.random() * 1.2), s),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.castShadow = true;
      const theta  = Math.random() * Math.PI * 2;
      const upBias = 0.3 + Math.random() * 0.7;
      const speed  = 4 + Math.random() * 7;
      // Spawn from a random point within the building footprint
      mesh.position.set(
        bx + (Math.random() - 0.5) * bw,
        bCenterY + (Math.random() - 0.5) * bh * 0.5,
        bz + (Math.random() - 0.5) * bd
      );
      scene.add(mesh);
      const maxLife = 0.7 + Math.random() * 0.6;
      deathParticles.push({
        mesh,
        vx: Math.cos(theta) * speed * (1 - upBias * 0.4),
        vy: upBias * speed * 0.85 + 2,
        vz: Math.sin(theta) * speed * (1 - upBias * 0.4),
        rx: (Math.random() - 0.5) * 12,
        rz: (Math.random() - 0.5) * 12,
        life: maxLife, maxLife,
      });
    }
  }
  
  // ── 人類被碰消失碎塊（小黃碎片） ────────────────────────────────────
  function spawnPedTouchDebris(px, py, pz) {
    const COUNT = 10;
    while (deathParticles.length + COUNT > _DEATH_PARTICLE_MAX) {
      const old = deathParticles.shift();
      scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
    }
    for (let k = 0; k < COUNT; k++) {
      const s = 0.05 + Math.random() * 0.07;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * (0.5 + Math.random() * 0.8), s),
        new THREE.MeshLambertMaterial({ color: 0xf5c518, transparent: true, opacity: 1 })
      );
      const theta = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 3.0;
      mesh.position.set(px, py, pz);
      scene.add(mesh);
      const maxLife = 0.35 + Math.random() * 0.25;
      deathParticles.push({
        mesh,
        vx: Math.cos(theta) * speed,
        vy: 1.5 + Math.random() * 2.5,
        vz: Math.sin(theta) * speed,
        rx: (Math.random() - 0.5) * 18,
        rz: (Math.random() - 0.5) * 18,
        life: maxLife, maxLife,
      });
    }
  }
  
  // ── Punch trail (fist-path ghost) ─────────────────────────────────────
  // One ghost sphere is spawned per frame at the fist's world position while
  // attacking; each stays in place and fades out, tracing the punch path.
  const _punchTrail = [];
  const _punchTrailGeo = new THREE.SphereGeometry(0.11, 8, 6); // same radius as arm
  
  // Spawns two concentric ghost spheres: outer yellow + inner white.
  // armScale: p.armR's current scale; ghosts are 1.5× (outer) and 1.0× (inner).
  function addPunchTrail(x, y, z, armScale) {
    const life = 0.12 + Math.random() * 0.05;
    
    // ── Outer: yellow, 1.5× fist ──────────────────────────────────────────
    const outerScale = armScale * 1.5;
    const outerMesh = new THREE.Mesh(
      _punchTrailGeo,
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.60, depthWrite: false })
    );
    outerMesh.position.set(x, y, z);
    outerMesh.scale.setScalar(outerScale);
    scene.add(outerMesh);
    _punchTrail.push({ mesh: outerMesh, life, maxLife: life, initScale: outerScale });
    
    // ── Inner: white, 1.0× fist ───────────────────────────────────────────
    const innerMesh = new THREE.Mesh(
      _punchTrailGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
    );
    innerMesh.position.set(x, y, z);
    innerMesh.scale.setScalar(armScale);
    scene.add(innerMesh);
    _punchTrail.push({ mesh: innerMesh, life, maxLife: life, initScale: armScale });
  }
  
  function _updatePunchTrail(dt) {
    for (let i = _punchTrail.length - 1; i >= 0; i--) {
      const pt = _punchTrail[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        scene.remove(pt.mesh);
        pt.mesh.material.dispose();
        _punchTrail.splice(i, 1);
        continue;
      }
      const frac = pt.life / pt.maxLife; // 1→0
      pt.mesh.material.opacity = frac * 0.7;
      pt.mesh.scale.setScalar(pt.initScale * (0.5 + frac * 0.5)); // shrink as it fades
    }
  }
  
  // ── Public: trigger on damage ──────────────────────────────────────────
  function triggerDamageEffects(playerIndex) {
    const fx = playerEffects[playerIndex];
    fx.fireTimer   = FIRE_EFFECT_DURATION;
    fx.smokeTimer  = SMOKE_EFFECT_DURATION;
    fx.fireEmitCD  = 0;
    fx.smokeEmitCD = 0;
  }
  
  // ── Per-frame update ───────────────────────────────────────────────────
  function updateEffects(elapsedSec) {
    updateDeathParticles(elapsedSec);
    _updatePunchTrail(elapsedSec);
    // tick all active particles
    for (const p of _allParticlePool) {
      if (!p.active) continue;
      p.life -= elapsedSec;
      if (p.life <= 0) {
        p.active = false; p.mesh.visible = false;
        if (p.isSmoke) p.mesh.material.color.set(0x222222); // restore default smoke colour
        continue;
      }
      
      const t = p.life / p.maxLife; // 1 → 0
      p.mesh.position.x += p.vx * elapsedSec;
      p.mesh.position.y += p.vy * elapsedSec;
      p.mesh.position.z += p.vz * elapsedSec;
      p.mesh.material.opacity = p.isSmoke ? t * 0.7 : t;
      
      // smoke expands then shrinks in last 1s; fire shrinks throughout
      let s;
      if (p.isSmoke) {
        const expanded = p.initScale * (1 + (1 - t) * 2.0);
        // fade out scale in final 1 second of its own life
        const shrinkT = Math.min(1, p.life / 1.0); // 1→0 over last 1s
        s = expanded * shrinkT;
      } else {
        s = p.initScale * t;
      }
      p.mesh.scale.setScalar(Math.max(s, 0.01));
    }
    
    // dash smoke — white puffs at feet while dashing; drift upward and fade out
    players.forEach((player, i) => {
      const fx = playerEffects[i];
      if (!player.isDashing) return;
      fx.smokeEmitCD -= elapsedSec;
      if (fx.smokeEmitCD <= 0) {
        fx.smokeEmitCD = 0.02; // emit ~50/s during dash
        // Particle count fades out as dash progresses (tFrac: 1→0)
        const tFrac = Math.max(0, player.dashTimer / DASH_DUR);
        for (let n = 0; n < 2; n++) {
          if (Math.random() > tFrac) continue;
          const p = _acquireSmoke();
          if (!p) break;
          p.active    = true;
          p.maxLife   = (0.7 + Math.random() * 0.5) * 0.8;  // 0.56–0.96 s
          p.life      = p.maxLife;
          // Drift toward back of character + small random spread
          const backX = -Math.sin(player.facing);
          const backZ = -Math.cos(player.facing);
          const spd   = 0.3 + Math.random() * 0.3;
          p.vx        = backX * spd + (Math.random() - 0.5) * 0.15;
          p.vy        = (Math.random() - 0.3) * 0.15;
          p.vz        = backZ * spd + (Math.random() - 0.5) * 0.15;
          p.initScale = 1.35 + Math.random() * 0.75;
          p.mesh.position.set(
            player.group.position.x + (Math.random() - 0.5) * 0.6,
            0.1,
            player.group.position.z + (Math.random() - 0.5) * 0.6
          );
          p.mesh.scale.setScalar(p.initScale);
          p.mesh.material.opacity = 0.6;
          p.mesh.material.color.set(0xffffff);
          p.mesh.visible = true;
        }
      }
    });
    
    // heavy punch lunge smoke — black puffs below each fist during extend phase
    players.forEach((player, i) => {
      if (!player.isAttacking || !player.isHeavyPunch) return;
      const hp = 1 - player.attackTimer / ATTACK_HEAVY_DUR;
      if (hp < ATTACK_HEAVY_WINDUP_FRAC || hp >= ATTACK_HEAVY_EXTEND_FRAC) return;
      const fx = playerEffects[i];
      fx.smokeEmitCD -= elapsedSec;
      if (fx.smokeEmitCD > 0) return;
      fx.smokeEmitCD = 0.02;
      
      // Compute fist local positions (mirrors game.js heavy punch animation)
      const fwdExt = (hp - ATTACK_HEAVY_WINDUP_FRAC) / (ATTACK_HEAVY_EXTEND_FRAC - ATTACK_HEAVY_WINDUP_FRAC);
      const backExt = 1 - fwdExt;
      const lArmX = 0.60 - fwdExt * 0.30;  // ±x offset (narrows at peak)
      const lArmZ = 0.08 + fwdExt * 0.88 - backExt * 0.50;
      const fc = player.facing;
      
      // World positions of left (sign=-1) and right (sign=+1) fist, projected to floor
      for (const sign of [-1, 1]) {
        const fx_ = sign * lArmX;
        const fistWX = player.x + fx_ * Math.cos(fc) + lArmZ * Math.sin(fc);
        const fistWZ = player.z - fx_ * Math.sin(fc) + lArmZ * Math.cos(fc);
        for (let n = 0; n < 3; n++) {
          const p = _acquireSmoke();
          if (!p) break;
          p.active    = true;
          p.maxLife   = (0.5 + Math.random() * 0.35) * 0.8;
          p.life      = p.maxLife;
          const backX_ = -Math.sin(fc);
          const backZ_ = -Math.cos(fc);
          const spd    = 0.5 + Math.random() * 0.5;
          p.vx         = backX_ * spd + (Math.random() - 0.5) * 0.2;
          p.vy         = (Math.random() - 0.3) * 0.15;
          p.vz         = backZ_ * spd + (Math.random() - 0.5) * 0.2;
          p.initScale  = 1.35 + Math.random() * 0.75;
          p.mesh.position.set(fistWX + (Math.random() - 0.5) * 0.2, 0.1, fistWZ + (Math.random() - 0.5) * 0.2);
          p.mesh.scale.setScalar(p.initScale);
          p.mesh.material.opacity = 0.6;
          p.mesh.material.color.set(0x666666);
          p.mesh.visible = true;
        }
      }
    });
    
    // emit new particles per player
    players.forEach((player, i) => {
      const fx = playerEffects[i];
      if (fx.fireTimer <= 0 && fx.smokeTimer <= 0) return;
      
      const bx = player.group.position.x;
      const by = player.group.position.y + 0.55; // body center y
      const bz = player.group.position.z;
      
      if (fx.fireTimer > 0) {
        fx.fireTimer  -= elapsedSec;
        fx.fireEmitCD -= elapsedSec;
        if (fx.fireEmitCD <= 0) {
          fx.fireEmitCD = 0.025;
          _spawn(firePool,
            bx + (Math.random() - 0.5) * 0.5,
            by + (Math.random() - 0.5) * 0.45,
            bz + (Math.random() - 0.5) * 0.5,
            false);
          }
        }
        
        if (fx.smokeTimer > 0) {
          fx.smokeTimer  -= elapsedSec;
          fx.smokeEmitCD -= elapsedSec;
          if (fx.smokeEmitCD <= 0) {
            fx.smokeEmitCD = 0.10;
            _spawn(smokePool,
              bx + (Math.random() - 0.5) * 1.2,
              by + (Math.random() - 0.3) * 0.9,
              bz + (Math.random() - 0.5) * 1.2,
              true);
            }
          }
        });
        
        // ── Duo eye flames — fire sparks near both eyes when duo bar is full ──
        players.forEach((player, i) => {
          if (!player.active || player.isDead) return;
          if (player.fusingWith !== null) return; // suppressed during fusion animation
          if (duoValues[i] < DUO_MAX) return;
          const fx = playerEffects[i];
          fx.eyeEmitCD -= elapsedSec;
          if (fx.eyeEmitCD > 0) return;
          fx.eyeEmitCD = 0.04; // ~25/s
          
          const fc  = player.facing;
          const cos = Math.cos(fc), sin = Math.sin(fc);
          const ey  = player.group.position.y + 0.70;
          
          for (const side of [-1, 1]) {
            const lx = side * 0.19;
            const lz = 0.45;
            const wx = player.group.position.x + lx * cos + lz * sin;
            const wz = player.group.position.z - lx * sin + lz * cos;
            
            // Emit 1-2 fire particles per eye per cycle
            for (let n = 0; n < 2; n++) {
              let slot = -1;
              for (let k = 0; k < firePool.length; k++) {
                const idx = (_fireHead + k) % firePool.length;
                if (!firePool[idx].active) { slot = idx; _fireHead = (idx + 1) % firePool.length; break; }
              }
              if (slot === -1) break;
              const p = firePool[slot];
              p.active    = true;
              p.maxLife   = 0.25 + Math.random() * 0.20;
              p.life      = p.maxLife;
              p.vx        = (Math.random() - 0.5) * 0.8;
              p.vy        = 1.5 + Math.random() * 1.5;
              p.vz        = (Math.random() - 0.5) * 0.8;
              p.initScale = 0.3 + Math.random() * 0.25;
              p.mesh.position.set(wx + (Math.random() - 0.5) * 0.12, ey + (Math.random() - 0.5) * 0.1, wz + (Math.random() - 0.5) * 0.12);
              p.mesh.scale.setScalar(p.initScale);
              p.mesh.material.color.set(Math.random() < 0.5 ? 0xffcc00 : 0xccff00);
              p.mesh.material.opacity = 1.0;
              p.mesh.visible = true;
            }
          }
        });
      }
      
      // ── Fusion smoke burst (gray-white spheres, no debris chunks) ────────
      function spawnFusionSmokeBurst(cx, cz) {
        const COUNT = 48;
        for (let k = 0; k < COUNT; k++) {
          const r    = 0.12 + Math.random() * 0.22;
          const gray = 0.72 + Math.random() * 0.28; // 0.72–1.0 → off-white to white
          const col  = new THREE.Color(gray, gray, gray);
          while (deathParticles.length + 1 > _DEATH_PARTICLE_MAX) {
            const old = deathParticles.shift();
            scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
          }
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(r, 8, 6),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false })
          );
          const theta  = Math.random() * Math.PI * 2;
          const upBias = 0.1 + Math.random() * 0.3;
          const speed  = 8 + Math.random() * 10;
          mesh.position.set(
            cx + (Math.random() - 0.5) * 0.3,
            0.3 + Math.random() * 0.8,
            cz + (Math.random() - 0.5) * 0.3
          );
          scene.add(mesh);
          const maxLife = 0.6 + Math.random() * 0.5;
          deathParticles.push({
            mesh,
            vx: Math.cos(theta) * speed * (1 - upBias * 0.5) * 1.5,
            vy: (upBias * speed * 0.7 + 1.5) * 0.5,
            vz: Math.sin(theta) * speed * (1 - upBias * 0.5) * 1.5,
            rx: 0, rz: 0,
            life: maxLife, maxLife,
            isSmoke: true,
          });
        }
      }

      // ── Duo ring collision explosion ──────────────────────────────────────
      function spawnDuoExplosion(cx, cz) {
        const COUNT = 40;
        while (deathParticles.length + COUNT > _DEATH_PARTICLE_MAX) {
          const old = deathParticles.shift();
          scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
        }
        const colors = [0xffcc00, 0xccff00, 0xffffff, 0xff8800];
        for (let k = 0; k < COUNT; k++) {
          const s = 0.10 + Math.random() * 0.22;
          const color = colors[Math.floor(Math.random() * colors.length)];
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(s, s * (0.5 + Math.random() * 1.2), s),
            new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 })
          );
          mesh.castShadow = true;
          const theta  = Math.random() * Math.PI * 2;
          const upBias = 0.3 + Math.random() * 0.7;
          const speed  = 5 + Math.random() * 9;
          mesh.position.set(
            cx + (Math.random() - 0.5) * 0.4,
            0.5 + Math.random() * 0.5,
            cz + (Math.random() - 0.5) * 0.4
          );
          scene.add(mesh);
          const maxLife = 0.7 + Math.random() * 0.5;
          deathParticles.push({
            mesh,
            vx: Math.cos(theta) * speed * (1 - upBias * 0.4),
            vy: upBias * speed * 0.9 + 2,
            vz: Math.sin(theta) * speed * (1 - upBias * 0.4),
            rx: (Math.random() - 0.5) * 14,
            rz: (Math.random() - 0.5) * 14,
            life: maxLife, maxLife,
          });
        }
      }

      // ── Cannon building thrust (fire + black smoke toward +Z) ────────────
      // Call every frame while the building is in launch phase.
      // bx/bz: building center; bw/bh/bd: width/height/depth.
      function spawnCannonThrust(bx, bz, bw, bh, bd) {
        const faceZ = bz + bd / 2; // +Z face (trailing edge, bottom of screen)

        // Fire: 3 particles per call
        for (let k = 0; k < 3; k++) {
          let slot = -1;
          for (let j = 0; j < firePool.length; j++) {
            const idx = (_fireHead + j) % firePool.length;
            if (!firePool[idx].active) { slot = idx; break; }
          }
          if (slot === -1) break;
          _fireHead = (slot + 1) % firePool.length;
          const p = firePool[slot];
          p.active    = true;
          p.maxLife   = 0.12 + Math.random() * 0.14;
          p.life      = p.maxLife;
          p.vx        = (Math.random() - 0.5) * 2.5;
          p.vy        = (Math.random() - 0.5) * 1.0;
          p.vz        = 3.5 + Math.random() * 4.0;  // strong +Z exhaust
          p.initScale = 0.6 + Math.random() * 1.0;
          p.mesh.position.set(
            bx + (Math.random() - 0.5) * bw,
            Math.random() * bh,
            faceZ + Math.random() * 0.3
          );
          p.mesh.scale.setScalar(p.initScale);
          p.mesh.material.opacity = 1;
          p.mesh.visible = true;
        }

        // Smoke: 2 particles per call, dark black
        for (let k = 0; k < 2; k++) {
          let slot = -1;
          for (let j = 0; j < smokePool.length; j++) {
            const idx = (_smokeHead + j) % smokePool.length;
            if (!smokePool[idx].active) { slot = idx; break; }
          }
          if (slot === -1) break;
          _smokeHead = (slot + 1) % smokePool.length;
          const p = smokePool[slot];
          p.active    = true;
          p.maxLife   = 0.45 + Math.random() * 0.45;
          p.life      = p.maxLife;
          p.vx        = (Math.random() - 0.5) * 1.8;
          p.vy        = (Math.random() - 0.5) * 0.5;
          p.vz        = 2.0 + Math.random() * 2.5;  // +Z exhaust
          p.initScale = 1.0 + Math.random() * 1.4;
          p.mesh.position.set(
            bx + (Math.random() - 0.5) * bw,
            Math.random() * bh,
            faceZ + Math.random() * 0.5
          );
          p.mesh.scale.setScalar(p.initScale);
          p.mesh.material.color.set(0x0a0a0a); // near-black smoke
          p.mesh.material.opacity = 0.85;
          p.mesh.visible = true;
        }
      }

      // ── Reset on new game ──────────────────────────────────────────────────
      function resetEffects() {
        playerEffects.forEach(fx => {
          fx.fireTimer  = 0;
          fx.smokeTimer = 0;
          fx.eyeEmitCD  = 0;
        });
        for (const p of _allParticlePool) {
          p.active = false;
          p.mesh.visible = false;
        }
        _fireHead  = 0;
        _smokeHead = 0;
        deathParticles.forEach(pt => {
          scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
        });
        deathParticles.length = 0;
        _punchTrail.forEach(pt => { scene.remove(pt.mesh); pt.mesh.material.dispose(); });
        _punchTrail.length = 0;
      }
      