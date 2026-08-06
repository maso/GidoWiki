/* ═══════════════════════════════════════
   IDLE STUNT LIBRARY
   Each stunt is a pure function of progress p (0→1): every frame it sets
   transforms directly from p, so there is no per-frame accumulated state and
   the end-of-stunt restore is always exact. All stunts start AND end at the
   neutral pose (grp at y=0 / rotations ≡ 0 mod 2π, body/hands/feet at base),
   which is what makes fair random pairing safe.
═══════════════════════════════════════ */

export const FOOT_BASE_Y = 0.085;
export const FOOT_BASE_Z = 0.05;

export const easeInOut = p => 0.5 - Math.cos(p * Math.PI) / 2;

export const STUNTS = [
  {
    // 大跳：預備下蹲 → 高高躍起（伸展＋收腳＋舉手）→ 落地擠壓回彈
    id: 'big-jump', dur: 1.0,
    tick(c, p) {
      if (p < 0.25) {
        const q = p / 0.25;
        c.bodyMesh.scale.set(1 + 0.13 * q, 1 - 0.24 * q, 1 + 0.13 * q);
        c.bodyMesh.position.y = 0.48 - 0.11 * q;
      } else if (p < 0.78) {
        const q = (p - 0.25) / 0.53;
        const h = Math.sin(q * Math.PI);
        c.grp.position.y = h * 0.62;
        c.bodyMesh.position.y = 0.48;
        c.bodyMesh.scale.set(1 - 0.10 * h, 1 + 0.20 * h, 1 - 0.10 * h);
        c.handL.position.y = 0.38 + 0.34 * h;
        c.handR.position.y = 0.38 + 0.34 * h;
        c.footL.position.y = FOOT_BASE_Y + 0.17 * h;
        c.footR.position.y = FOOT_BASE_Y + 0.17 * h;
      } else {
        const q = (p - 0.78) / 0.22;
        const s = Math.sin((1 - q) * Math.PI * 0.5) * 0.18;
        c.grp.position.y = 0;
        c.bodyMesh.scale.set(1 + s, 1 - s, 1 + s);
        c.bodyMesh.position.y = 0.48 - s * 0.3;
        c.handL.position.y = 0.38;
        c.handR.position.y = 0.38;
        c.footL.position.y = FOOT_BASE_Y;
        c.footR.position.y = FOOT_BASE_Y;
      }
    },
  },
  {
    // 原地轉一圈（水平 360°）回到正面，途中輕輕墊一下腳
    id: 'spin-360', dur: 1.2,
    tick(c, p) {
      c.grp.rotation.y = easeInOut(p) * Math.PI * 2;
      c.grp.position.y = Math.sin(p * Math.PI) * 0.07;
    },
  },
  {
    // 好奇地一直轉、轉到背對鏡頭看一看，再繼續同方向轉回正面
    id: 'turn-look-back', dur: 2.6,
    tick(c, p) {
      let angle;
      if (p < 0.3)       angle = easeInOut(p / 0.3) * Math.PI;
      else if (p < 0.66) angle = Math.PI + Math.sin((p - 0.3) / 0.36 * Math.PI * 2) * 0.09;
      else               angle = Math.PI + easeInOut((p - 0.66) / 0.34) * Math.PI;
      c.grp.rotation.y = angle;
    },
  },
  {
    // 後空翻：跳起同時往後翻整整一圈
    id: 'backflip', dur: 1.05,
    tick(c, p) {
      c.grp.position.y = Math.sin(p * Math.PI) * 0.72;
      c.grp.rotation.x = -easeInOut(p) * Math.PI * 2;
      const h = Math.sin(p * Math.PI);
      c.handL.position.y = 0.38 + 0.26 * h;
      c.handR.position.y = 0.38 + 0.26 * h;
    },
  },
  {
    // 側翻（cartwheel）：跳起側向滾轉一圈
    id: 'cartwheel', dur: 1.1,
    tick(c, p) {
      c.grp.position.y = Math.sin(p * Math.PI) * 0.55;
      c.grp.rotation.z = easeInOut(p) * Math.PI * 2;
    },
  },
  {
    // 扭扭舞：上半身快速左右扭動、雙手高舉跟著擺
    id: 'wiggle-dance', dur: 1.7,
    tick(c, p) {
      const fade = Math.sin(p * Math.PI);
      const w = Math.sin(p * Math.PI * 6);
      c.upperGrp.rotation.y = w * 0.42 * fade;
      c.bodyMesh.position.y = 0.48 + Math.abs(w) * 0.05 * fade;
      c.handL.position.y = 0.38 + (0.34 + w * 0.08) * fade;
      c.handR.position.y = 0.38 + (0.34 - w * 0.08) * fade;
    },
  },
  {
    // 伸展體操：整個身體向上拉長、雙手高舉過頭，像做早操
    id: 'stretch-up', dur: 1.5,
    tick(c, p) {
      const s = Math.sin(p * Math.PI);
      c.bodyMesh.scale.set(1 - 0.12 * s, 1 + 0.30 * s, 1 - 0.12 * s);
      c.bodyMesh.position.y = 0.48 + 0.14 * s;
      c.handL.position.y = 0.38 + 0.5 * s;
      c.handR.position.y = 0.38 + 0.5 * s;
      c.handL.position.x = -0.52 + 0.14 * s;
      c.handR.position.x =  0.52 - 0.14 * s;
    },
  },
  {
    // 向鏡頭揮手打招呼：舉起右手左右揮動
    id: 'wave-hello', dur: 1.6,
    tick(c, p) {
      const lift = Math.min(1, Math.min(p, 1 - p) / 0.18);
      c.handR.position.y = 0.38 + 0.5 * lift;
      c.handR.position.x = 0.52 + Math.sin(p * Math.PI * 7) * 0.1 * lift;
      c.upperGrp.rotation.y = -0.12 * lift;
    },
  },
  {
    // 跳躍轉體：跳起的同時水平轉一整圈，體操落地
    id: 'spin-jump', dur: 1.0,
    tick(c, p) {
      const h = Math.sin(p * Math.PI);
      c.grp.position.y = h * 0.5;
      c.grp.rotation.y = easeInOut(p) * Math.PI * 2;
      c.bodyMesh.scale.set(1 - 0.08 * h, 1 + 0.14 * h, 1 - 0.08 * h);
      c.footL.position.y = FOOT_BASE_Y + 0.14 * h;
      c.footR.position.y = FOOT_BASE_Y + 0.14 * h;
    },
  },
  {
    // 不倒翁搖擺：以腳底為支點左右搖晃，幅度漸漸變小停回原位
    id: 'roly-poly', dur: 2.0,
    tick(c, p) {
      const decay = 1 - easeInOut(p);
      c.grp.rotation.z = Math.sin(p * Math.PI * 5) * 0.3 * decay;
    },
  },
  {
    // 連續兩次小彈跳：噠噠兩下的輕快節奏
    id: 'double-hop', dur: 1.0,
    tick(c, p) {
      const h = Math.abs(Math.sin(p * Math.PI * 2)) * 0.24;
      c.grp.position.y = h;
      c.bodyMesh.scale.set(1 - h * 0.5, 1 + h * 0.9, 1 - h * 0.5);
    },
  },
  {
    // 快速連轉兩圈（720°）炫技
    id: 'spin-double', dur: 1.4,
    tick(c, p) {
      c.grp.rotation.y = easeInOut(p) * Math.PI * 4;
      c.grp.position.y = Math.sin(p * Math.PI) * 0.1;
    },
  },
  {
    // 鞠躬謝幕：上半身前傾行禮、停一下再起身（腳不動）
    id: 'take-a-bow', dur: 1.8,
    tick(c, p) {
      let bow;
      if (p < 0.3)       bow = easeInOut(p / 0.3);
      else if (p < 0.65) bow = 1;
      else               bow = 1 - easeInOut((p - 0.65) / 0.35);
      c.upperGrp.rotation.x = bow * 0.5;
      c.handL.position.y = 0.38 - bow * 0.1;
      c.handR.position.y = 0.38 - bow * 0.1;
    },
  },
  {
    // 左右滑步：向右滑一步再向左滑回來，帶小碎跳與側傾
    id: 'side-shuffle', dur: 1.3,
    tick(c, p) {
      const slide = Math.sin(p * Math.PI * 2);
      c.grp.position.x = c.stuntBaseX + slide * 0.32;
      c.grp.position.y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.06;
      c.grp.rotation.z = -slide * 0.1;
    },
  },
  {
    // 點點頭：上半身小幅前後點動，像在說「對對對」
    id: 'nod-nod', dur: 1.2,
    tick(c, p) {
      const fade = Math.sin(p * Math.PI);
      c.upperGrp.rotation.x = Math.max(0, Math.sin(p * Math.PI * 4)) * 0.2 * fade;
    },
  },
  {
    // 跳躍拍手：躍起時雙手在頭頂合掌拍一下
    id: 'jump-clap', dur: 0.95,
    tick(c, p) {
      const h = Math.sin(p * Math.PI);
      c.grp.position.y = h * 0.55;
      c.handL.position.x = -0.52 + 0.46 * h;
      c.handR.position.x =  0.52 - 0.46 * h;
      c.handL.position.y = 0.38 + 0.45 * h;
      c.handR.position.y = 0.38 + 0.45 * h;
    },
  },
  {
    // 踢腿：單腳向前高踢，身體微微後仰保持平衡
    id: 'high-kick', dur: 1.1,
    tick(c, p) {
      const k = Math.sin(p * Math.PI);
      c.footL.position.z = FOOT_BASE_Z + k * 0.42;
      c.footL.position.y = FOOT_BASE_Y + k * 0.3;
      c.upperGrp.rotation.x = -k * 0.16;
      c.handL.position.y = 0.38 + k * 0.18;
      c.handR.position.y = 0.38 + k * 0.18;
    },
  },
  {
    // 萬歲慶祝：小跳一下後雙手高舉成 V 字定格，再放下
    id: 'tada', dur: 1.6,
    tick(c, p) {
      const jump = p < 0.3 ? Math.sin(p / 0.3 * Math.PI) * 0.3 : 0;
      const arms = Math.min(1, Math.min(p / 0.25, (1 - p) / 0.15));
      c.grp.position.y = jump;
      c.handL.position.y = 0.38 + 0.42 * arms;
      c.handR.position.y = 0.38 + 0.42 * arms;
      c.handL.position.x = -0.52 - 0.13 * arms;
      c.handR.position.x =  0.52 + 0.13 * arms;
    },
  },
  {
    // 抬頭看天：上半身後仰望向天空發呆一會兒，再回神
    id: 'sky-gaze', dur: 2.2,
    tick(c, p) {
      const tilt = Math.min(1, Math.min(p / 0.25, (1 - p) / 0.25));
      c.upperGrp.rotation.x = -0.34 * tilt;
    },
  },
  {
    // 倒立：向前翻起倒立、微微晃動撐住，再翻回來站好
    id: 'handstand', dur: 1.9,
    tick(c, p) {
      let angle, wobble = 0;
      if (p < 0.35)      angle = easeInOut(p / 0.35) * Math.PI;
      else if (p < 0.65) { angle = Math.PI; wobble = Math.sin((p - 0.35) / 0.3 * Math.PI * 3) * 0.05; }
      else               angle = Math.PI * (1 - easeInOut((p - 0.65) / 0.35));
      c.grp.rotation.x = angle;
      c.grp.rotation.z = wobble;
      c.grp.position.y = Math.sin(angle / 2) * 1.05;
      const up = Math.sin(angle / 2);
      c.handL.position.y = 0.38 - up * 0.22;
      c.handR.position.y = 0.38 - up * 0.22;
    },
  },
];
