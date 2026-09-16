/* ==========================================================================
   PIXEL BUSTER SAGA - app.js
   ブラウザ完結型ハクスラアクションRPG
   （物理演算 / スキル / 装備 / 進化 / 音響合成 / セーブ永続化）
   --------------------------------------------------------------------------
    1.  定数 & ユーティリティ
    2.  キャラクター定義（4系統 × 3段階進化）
    3.  スキル & シナジー定義
    4.  敵定義 / ステージパターン / 装備生成 / セーブ
    5.  Web Audio API 音響シンセサイザー
    6.  ラン状態 & ステータス計算
    7.  ステージ / ウェーブ構築
    8.  物理演算 & 衝突判定
    9.  友情コンボ / タップバースト / エフェクト
   10.  描画（Canvas 480 x 700）
   11.  HUD & 演出（DOM）
   12.  ゲームフロー
   13.  スキル選択モーダル
   14.  インベントリ
   15.  キャラクター選択 & 進化
   16.  入力 / ゲームループ / 初期化
   ========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     1. 定数 & ユーティリティ
     ========================================================================== */
  var CANVAS_W = 480;
  var CANVAS_H = 700;
  var SAVE_KEY = 'PIXEL_BUSTER_SAGA_SAVE';

  var FIELD = { x: 10, y: 10, w: CANVAS_W - 20, h: CANVAS_H - 20 };
  var LAUNCH_X = 240;
  var LAUNCH_Y = 618;

  var WALL_RESTITUTION = 0.986;
  var OBSTACLE_RESTITUTION = 0.988;
  var ENEMY_RESTITUTION = 0.968;
  var STOP_SPEED = 85;
  var MAX_SPEED = 1700;
  var MIN_PULL = 14;
  var MAX_PULL = 168;
  var MIN_LAUNCH_SPEED = 260;
  var MAX_LAUNCH_SPEED = 1150;
  var BALL_RADIUS = 9;
  var CORE_RADIUS = 8;
  var BURST_RADIUS = 80;
  var BURST_DAMAGE_MUL = 2.6;
  var GEAR_BOOST = 1.8;
  var GEAR_MAX_INPUT_SPEED = 780;
  var GEAR_COOLDOWN = 0.8;
  var COMBO_CAP = 60;
  var SHOT_MAX_TIME = 15;
  var COMBO_SPEED_MIN = 150;
  var COMBO_WINDOW = 2.6;
  var HITSTOP_WEAK = 95;
  var HITSTOP_CRIT = 70;
  var HITSTOP_BURST = 130;
  var WAVES_PER_STAGE = 3;
  var SUBSTEP_PX = 4;
  var MAX_SUBSTEPS = 48;
  var ENEMY_TURN_TIME = 1.75;
  var MAX_PARTICLES = 460;
  var BASE_SHOTS = 3;
  var BERSERKER_HP_COST = 0.10;
  var BERSERKER_LIFESTEAL = 0.15;
  var SYNERGY_LIGHTNING_MUL = 0.45;
  var SYNERGY_CHAINFIRE_MUL = 1.2;
  var EVOLVE_COST = { 3: 250, 4: 800 };
  var REROLL_BASE_COST = 30;
  var REROLL_STEP_COST = 15;
  var SKIP_GOLD_BASE = 20;
  var LUCK_DROP_PER_POINT = 0.02;
  var LUCK_RARE_PER_POINT = 0.004;

  /* ---- Battle Core 2.0 定数 ---- */
  var FLICK_WINDOW = 0.12;
  var FLICK_SPEED_MAX = 1500;
  var FLICK_WEIGHT = 0.35;
  var POWER_LOCK_TIME = 0.6;
  var POWER_STEP = 0.02;
  var AIM_ASSIST_ANGLE = 0.122;
  var CARRY_SHOT_MAX = 2;

  var MATERIALS = {
    wall: { restitution: 0.986, friction: 0.03, spin: 0.35 },
    obstacle: { restitution: 0.988, friction: 0.06, spin: 0.5 },
    enemy: { restitution: 0.968, friction: 0.14, spin: 0.7 },
    barrel: { restitution: 0.972, friction: 0.1, spin: 0.55 },
    gear: { restitution: 0.98, friction: 0.05, spin: 0.4 }
  };
  var LINEAR_DRAG = 0.28;
  var QUAD_DRAG = 0.00022;
  var MAGNUS_K = 0.9;
  var SPIN_DECAY = 0.55;
  var SPIN_DAMAGE_SCALE = 0.01;
  var SPIN_DAMAGE_CAP = 30;
  var SPIN_CORE_BONUS = 1.5;
  var PIERCE_SPEED = 900;
  var PIERCE_SPIN = 8;
  var PIERCE_SLOW = 0.82;
  var PIERCE_MAX = 4;
  var TIGHT_GAP_MAX = 54;
  var TIGHT_BONUS = 0.1;
  var TIGHT_BONUS_CAP = 0.5;
  var GEAR_DIR_BLEND = 0.25;
  var WARP_EXIT_BOOST = 1.05;

  var TIMESCALE_WEAK = { scale: 0.25, time: 0.09 };
  var TIMESCALE_CRIT = { scale: 0.45, time: 0.06 };
  var TIMESCALE_BOSS = { scale: 0.15, time: 0.6 };

  var FRIEND_CHAIN_WINDOW = 3.0;
  var FRIEND_CHAIN_STEP = 0.25;
  var FRIEND_CHAIN_MAX = 3;
  var SUPPORT_INTERVAL = 2;
  var REVIVE_HP_RATIO = 0.3;
  var PARTY_SIZE = 3;

  var PITY_EPIC_START = 10;
  var PITY_EPIC_STEP = 0.06;
  var PITY_EPIC_HARD = 24;
  var PITY_CURSED_START = 26;
  var PITY_CURSED_STEP = 0.05;
  var PITY_CURSED_HARD = 60;
  var FUSE_MAX_OPS = 5;
  var FUSE_MAX_PLUS = 3;
  var PURGE_COST = 150;
  var ITEM_CAP = 90;

  var ROLES = {
    fire: { key: 'attacker', label: 'アタッカー' },
    wind: { key: 'support', label: 'サポート' },
    water: { key: 'mage', label: 'メイジ' },
    dark: { key: 'tank', label: 'タンク' }
  };
  var ROLE_AURA = {
    attacker: { dmg: 0.15, crit: 0, taken: 1, supportCd: 0 },
    mage: { dmg: 0, crit: 0.08, taken: 1, supportCd: 0 },
    support: { dmg: 0, crit: 0, taken: 1, supportCd: -1 },
    tank: { dmg: 0, crit: 0, taken: 0.8, supportCd: 0 }
  };

  var ELEMENTS = {
    fire: { label: '火', color: '#ff6a3d', glow: 'rgba(255,106,61,.65)', dark: '#7a2408' },
    wind: { label: '風', color: '#6ef08a', glow: 'rgba(110,240,138,.65)', dark: '#134a25' },
    water: { label: '水', color: '#47d9ff', glow: 'rgba(71,217,255,.65)', dark: '#0d3a4f' },
    dark: { label: '闇', color: '#b478ff', glow: 'rgba(180,120,255,.65)', dark: '#2c1350' }
  };

  var RARITIES = {
    normal: { label: 'Normal', color: '#b3a8d2', glow: 'rgba(179,168,210,.35)', sell: 12, ops: 1 },
    rare: { label: 'Rare', color: '#47d9ff', glow: 'rgba(71,217,255,.45)', sell: 38, ops: 2 },
    epic: { label: 'Epic', color: '#b478ff', glow: 'rgba(180,120,255,.5)', sell: 95, ops: 3 },
    cursed: { label: 'Cursed', color: '#ff2d55', glow: 'rgba(255,45,85,.55)', sell: 150, ops: 2 }
  };

  var SLOT_LABEL = { weapon: '武器', relic: 'レリック' };

  /* ---- 数学ユーティリティ ---- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist(ax, ay, bx, by) { return Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)); }
  function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
  function round1(v) { return Math.round(v * 10) / 10; }
  function pctText(v) { return (v * 100).toFixed(0) + '%'; }
  function fmtNum(v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function stars(n) { return '★'.repeat(clamp(Math.round(n), 0, 5)); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var uidSeq = 1;
  function nextUid() { uidSeq += 1; return 'it' + uidSeq + Date.now().toString(36); }

  /* ---- DOM ユーティリティ ---- */
  function $(id) { return document.getElementById(id); }
  function setText(el, text) { if (el && el.textContent !== String(text)) { el.textContent = String(text); } }
  function setClass(el, name, on) { if (!el) { return; } if (on) { el.classList.add(name); } else { el.classList.remove(name); } }
  function setStyle(el, prop, value) { if (el) { el.style.setProperty(prop, value); } }
  function clear(el) { if (el) { while (el.firstChild) { el.removeChild(el.firstChild); } } }
  function cloneTemplate(id) {
    var tpl = $(id);
    if (!tpl) { return null; }
    return tpl.content.firstElementChild.cloneNode(true);
  }
  function fillFields(root, data) {
    if (!root) { return root; }
    Object.keys(data).forEach(function (key) {
      var nodes = root.querySelectorAll('[data-field="' + key + '"]');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var value = data[key];
        if (node.tagName === 'UL' || node.tagName === 'OL') {
          clear(node);
          if (Array.isArray(value)) {
            for (var j = 0; j < value.length; j += 1) {
              var li = document.createElement('li');
              var entry = value[j];
              if (entry && typeof entry === 'object') {
                li.textContent = entry.text;
                if (entry.cls) { li.classList.add(entry.cls); }
              } else {
                li.textContent = String(entry);
              }
              node.appendChild(li);
            }
          }
        } else {
          node.textContent = (value === null || value === undefined) ? '' : String(value);
        }
      }
    });
    return root;
  }

  /* ==========================================================================
     2. キャラクター定義（4系統 × 3段階進化）
     ========================================================================== */
  var FRIEND_LABEL = {
    homing: '敵追尾弾',
    laser: '十字貫通レーザー',
    shockwave: '周囲爆発衝撃波',
    nova: '深淵吸引波'
  };

  var CHARACTERS = [
    {
      id: 'fire',
      element: 'fire',
      desc: '灼熱の剣を操る攻撃特化型。衝撃波で周囲の敵をまとめて薙ぎ払う。',
      evolutions: [
        {
          star: 3, name: '緋焔の戦士', glyph: '火',
          atk: 11, hp: 104, critRate: 0.05, critDmg: 1.60,
          friend: { type: 'shockwave', count: 1, radius: 78, dmgMul: 1.4, heal: 0 }
        },
        {
          star: 4, name: '緋焔の剣豪', glyph: '炎',
          atk: 15, hp: 126, critRate: 0.07, critDmg: 1.70,
          friend: { type: 'shockwave', count: 1, radius: 96, dmgMul: 1.9, heal: 0 }
        },
        {
          star: 5, name: '緋焔の覇王', glyph: '焱',
          atk: 20, hp: 150, critRate: 0.09, critDmg: 1.85,
          friend: { type: 'shockwave', count: 1, radius: 118, dmgMul: 2.6, heal: 0 }
        }
      ]
    },
    {
      id: 'wind',
      element: 'wind',
      desc: '疾風の矢で敵を追い詰める射手。追尾弾が逃げる敵を確実に仕留める。',
      evolutions: [
        {
          star: 3, name: '翠嵐の射手', glyph: '風',
          atk: 10, hp: 94, critRate: 0.09, critDmg: 1.65,
          friend: { type: 'homing', count: 2, radius: 0, dmgMul: 0.95, heal: 0 }
        },
        {
          star: 4, name: '翠嵐の狩人', glyph: '嵐',
          atk: 14, hp: 112, critRate: 0.11, critDmg: 1.75,
          friend: { type: 'homing', count: 3, radius: 0, dmgMul: 1.15, heal: 0 }
        },
        {
          star: 5, name: '翠嵐の嵐王', glyph: '颶',
          atk: 18, hp: 132, critRate: 0.13, critDmg: 1.90,
          friend: { type: 'homing', count: 4, radius: 0, dmgMul: 1.45, heal: 0 }
        }
      ]
    },
    {
      id: 'water',
      element: 'water',
      desc: '万象を貫く水の賢者。十字レーザーで盤面を一掃する。',
      evolutions: [
        {
          star: 3, name: '蒼海の賢者', glyph: '水',
          atk: 12, hp: 98, critRate: 0.06, critDmg: 1.75,
          friend: { type: 'laser', count: 2, radius: 240, dmgMul: 1.25, heal: 0 }
        },
        {
          star: 4, name: '蒼海の司祭', glyph: '海',
          atk: 17, hp: 116, critRate: 0.08, critDmg: 1.85,
          friend: { type: 'laser', count: 2, radius: 300, dmgMul: 1.70, heal: 0 }
        },
        {
          star: 5, name: '蒼海の海神', glyph: '濤',
          atk: 23, hp: 138, critRate: 0.10, critDmg: 2.00,
          friend: { type: 'laser', count: 2, radius: 380, dmgMul: 2.20, heal: 0 }
        }
      ]
    },
    {
      id: 'dark',
      element: 'dark',
      desc: '深淵より来たる騎士。吸引波で敵を削りながら己の命を喰らう。',
      evolutions: [
        {
          star: 3, name: '深淵の騎士', glyph: '闇',
          atk: 13, hp: 90, critRate: 0.08, critDmg: 1.70,
          friend: { type: 'nova', count: 1, radius: 90, dmgMul: 1.0, heal: 0.08 }
        },
        {
          star: 4, name: '深淵の死騎', glyph: '冥',
          atk: 18, hp: 106, critRate: 0.10, critDmg: 1.80,
          friend: { type: 'nova', count: 1, radius: 112, dmgMul: 1.4, heal: 0.12 }
        },
        {
          star: 5, name: '深淵の獄王', glyph: '獄',
          atk: 24, hp: 126, critRate: 0.12, critDmg: 1.95,
          friend: { type: 'nova', count: 1, radius: 136, dmgMul: 1.9, heal: 0.16 }
        }
      ]
    }
  ];

  function getCharDef(id) {
    for (var i = 0; i < CHARACTERS.length; i += 1) {
      if (CHARACTERS[i].id === id) { return CHARACTERS[i]; }
    }
    return CHARACTERS[0];
  }

  function getEvolution(charId, star) {
    var def = getCharDef(charId);
    var best = def.evolutions[0];
    for (var i = 0; i < def.evolutions.length; i += 1) {
      if (def.evolutions[i].star <= star) { best = def.evolutions[i]; }
    }
    return best;
  }

  function getNextEvolution(charId, star) {
    var def = getCharDef(charId);
    for (var i = 0; i < def.evolutions.length; i += 1) {
      if (def.evolutions[i].star > star) { return def.evolutions[i]; }
    }
    return null;
  }

  /* ==========================================================================
     3. スキル & シナジー定義
     ========================================================================== */
  var SKILLS = [
    { id: 'blazing_blade', name: '烈火の刃', glyph: '炎', tags: ['fire'], max: 5, desc: '攻撃力 +12%（レベルごと）' },
    { id: 'hellfire', name: '業火の追撃', glyph: '燃', tags: ['fire'], max: 3, desc: '命中時に着火状態を付与し、毎秒 攻撃力×35%×Lv のスリップダメージ' },
    { id: 'searing_resonance', name: '灼熱の共鳴', glyph: '焦', tags: ['fire'], max: 3, desc: '弱点コアへのダメージ +20%×Lv' },
    { id: 'thunder_lance', name: '雷鳴の槍', glyph: '雷', tags: ['lightning'], max: 5, desc: 'クリティカルダメージ +15%×Lv' },
    { id: 'discharge', name: '放電の矢', glyph: '電', tags: ['lightning'], max: 3, desc: '命中時に 25%×Lv の確率で最寄りの敵へ追撃放電（攻撃力50%）' },
    { id: 'swift_bolt', name: '迅雷の足', glyph: '迅', tags: ['lightning'], max: 3, desc: '射出速度 +6%×Lv' },
    { id: 'reflect_mastery', name: '反射の極意', glyph: '反', tags: ['reflect'], max: 4, desc: '反射スタック上限 +1、反射時に攻撃力25%×Lv の衝撃波' },
    { id: 'iron_will', name: '鉄壁の意志', glyph: '壁', tags: ['reflect'], max: 3, desc: '最大HP +14×Lv、被ダメージ -6%×Lv' },
    { id: 'ricochet_art', name: '跳弾の心得', glyph: '跳', tags: ['reflect'], max: 3, desc: '反射ごとにコンボ +1×Lv（コンボ倍率に直結）' },
    { id: 'critical_edge', name: '会心の一撃', glyph: '会', tags: ['crit'], max: 5, desc: 'クリティカル率 +7%×Lv' },
    { id: 'assassin_blade', name: '会心の刃', glyph: '刃', tags: ['crit'], max: 4, desc: 'クリティカルダメージ +22%×Lv' },
    { id: 'keen_eye', name: '鋭利な瞳', glyph: '瞳', tags: ['crit'], max: 3, desc: '弱点コア命中時のコンボ +2×Lv' },
    { id: 'lucky_charm', name: '幸運の護符', glyph: '幸', tags: [], max: 5, desc: 'LUCK +1×Lv（追加ドロップ率と高レア抽選が上昇）' },
    { id: 'gold_dig', name: '黄金の採掘', glyph: '金', tags: [], max: 5, desc: '獲得ゴールド +25%×Lv' },
    { id: 'extra_shot', name: '追加の弾丸', glyph: '弾', tags: [], max: 3, desc: 'ウェーブごとのショット数 +1' },
    { id: 'vitality', name: '生命の護符', glyph: '命', tags: [], max: 3, desc: '最大HP +18×Lv、取得時に同量を回復' },
    { id: 'bounty', name: '黄金の恵み', glyph: '宝', tags: [], max: 99, desc: '即座にゴールド +45（繰り返し取得可）' },
    { id: 'endless_growth', name: '無限の成長', glyph: '成', tags: [], max: 99, desc: '攻撃力 +4%、最大HP +6（繰り返し取得可）' }
  ];

  var SYNERGIES = [
    {
      id: 'lightning_reflect', name: '跳弾雷撃', requires: ['reflect', 'lightning'],
      desc: '壁に反射するたびに最寄りの敵へ落雷（攻撃力45%）'
    },
    {
      id: 'chain_fire', name: '連鎖発火', requires: ['fire', 'crit'],
      desc: 'クリティカル時に着火し、着火中の敵の撃破で周囲へ誘爆（攻撃力120%）'
    },
    {
      id: 'berserker_pact', name: '狂戦士の契約', requires: ['fire', 'crit', 'reflect'],
      desc: '射出時に現在HPの10%を消費。攻撃力+100%、与ダメージの15%をHP吸収'
    }
  ];

  function getSkillDef(id) {
    for (var i = 0; i < SKILLS.length; i += 1) {
      if (SKILLS[i].id === id) { return SKILLS[i]; }
    }
    return null;
  }

  function skillTotals(skills) {
    var lv = function (id) { return skills[id] || 0; };
    var t = {
      atkPct: 0, maxHp: 0, critRate: 0, critDmg: 0, reflectPlus: 0, speedPct: 0,
      weakBonus: 0, comboBonus: 0, weakCombo: 0, luck: 0, goldPct: 0, shotPlus: 0,
      dmgReduce: 0, burnMul: 0, dischargeChance: 0, reflectPulse: 0
    };
    t.atkPct += lv('blazing_blade') * 0.12;
    t.burnMul += lv('hellfire') * 0.35;
    t.weakBonus += lv('searing_resonance') * 0.20;
    t.critDmg += lv('thunder_lance') * 0.15;
    t.dischargeChance += lv('discharge') * 0.25;
    t.speedPct += lv('swift_bolt') * 0.06;
    t.reflectPlus += lv('reflect_mastery');
    t.reflectPulse += lv('reflect_mastery') * 0.25;
    t.dmgReduce += lv('iron_will') * 0.06;
    t.maxHp += lv('iron_will') * 14;
    t.comboBonus += lv('ricochet_art');
    t.critRate += lv('critical_edge') * 0.07;
    t.critDmg += lv('assassin_blade') * 0.22;
    t.weakCombo += lv('keen_eye') * 2;
    t.luck += lv('lucky_charm');
    t.goldPct += lv('gold_dig') * 0.25;
    t.shotPlus += lv('extra_shot');
    t.maxHp += lv('vitality') * 18;
    t.atkPct += lv('endless_growth') * 0.04;
    t.maxHp += lv('endless_growth') * 6;
    return t;
  }

  function detectSynergies(skills) {
    var tags = {};
    for (var i = 0; i < SKILLS.length; i += 1) {
      var def = SKILLS[i];
      if ((skills[def.id] || 0) > 0) {
        for (var j = 0; j < def.tags.length; j += 1) { tags[def.tags[j]] = true; }
      }
    }
    var flags = {};
    for (var k = 0; k < SYNERGIES.length; k += 1) {
      var syn = SYNERGIES[k];
      var ok = true;
      for (var m = 0; m < syn.requires.length; m += 1) {
        if (!tags[syn.requires[m]]) { ok = false; }
      }
      flags[syn.id] = ok;
    }
    return { tags: tags, flags: flags };
  }

  function synergyTextFor(skills, skillDef) {
    var lines = [];
    for (var i = 0; i < SYNERGIES.length; i += 1) {
      var syn = SYNERGIES[i];
      if (syn.requires.indexOf('') >= 0) { continue; }
      var related = false;
      for (var j = 0; j < skillDef.tags.length; j += 1) {
        if (syn.requires.indexOf(skillDef.tags[j]) >= 0) { related = true; }
      }
      if (!related) { continue; }
      var after = {};
      Object.keys(skills).forEach(function (k) { after[k] = skills[k]; });
      after[skillDef.id] = (after[skillDef.id] || 0) + 1;
      var before = detectSynergies(skills).flags[syn.id];
      var later = detectSynergies(after).flags[syn.id];
      if (!before && later) {
        lines.push('取得でシナジー『' + syn.name + '』が発動！');
      } else if (before && later) {
        lines.push('シナジー『' + syn.name + '』を強化');
      } else {
        lines.push('シナジー『' + syn.name + '』の条件タグ：' + syn.requires.join(' + '));
      }
    }
    return lines.join(' / ');
  }

  /* ==========================================================================
     4. 敵定義 / ステージパターン / 装備生成 / セーブ
     ========================================================================== */
  var ENEMY_TYPES = {
    slime: { key: 'slime', name: 'スライム', hp: 34, radius: 15, color: '#6ef08a', dark: '#134a25', bullets: 1, bulletSpeed: 150, bulletDmg: 4, gold: 6, coreOffset: 6, wander: 10, shots: 1 },
    bat: { key: 'bat', name: 'バット', hp: 24, radius: 12, color: '#b478ff', dark: '#2c1350', bullets: 2, bulletSpeed: 205, bulletDmg: 5, gold: 8, coreOffset: 9, wander: 30, shots: 1 },
    brute: { key: 'brute', name: 'ブルート', hp: 82, radius: 20, color: '#ff9a3d', dark: '#5a2a05', bullets: 3, bulletSpeed: 130, bulletDmg: 7, gold: 14, coreOffset: 11, wander: 6, shots: 1 },
    mage: { key: 'mage', name: 'ダークメイジ', hp: 54, radius: 16, color: '#47d9ff', dark: '#0d3a4f', bullets: 4, bulletSpeed: 175, bulletDmg: 6, gold: 12, coreOffset: 12, wander: 14, shots: 1 },
    boss: { key: 'boss', name: '魔王アビスロード', hp: 520, radius: 34, color: '#ff2d55', dark: '#3d0011', bullets: 9, bulletSpeed: 165, bulletDmg: 10, gold: 95, coreOffset: 20, wander: 8, shots: 2, boss: true }
  };

  var STAGE_PATTERNS = [
    {
      name: '四方の関門',
      obstacles: [
        { x: 56, y: 150, w: 112, h: 18 }, { x: 312, y: 150, w: 112, h: 18 },
        { x: 56, y: 402, w: 112, h: 18 }, { x: 312, y: 402, w: 112, h: 18 }
      ],
      barrels: [{ x: 90, y: 300 }, { x: 390, y: 300 }],
      gears: [{ x: 196, y: 500, w: 88, h: 16, dir: -90 }],
      warps: [{ x: 44, y: 210 }, { x: 436, y: 210 }]
    },
    {
      name: '中央十字',
      obstacles: [
        { x: 210, y: 116, w: 60, h: 108 }, { x: 122, y: 296, w: 236, h: 18 }
      ],
      barrels: [{ x: 240, y: 210 }],
      gears: [{ x: 66, y: 560, w: 100, h: 16, dir: -90 }, { x: 314, y: 560, w: 100, h: 16, dir: -90 }],
      warps: [{ x: 60, y: 120 }, { x: 420, y: 430 }]
    },
    {
      name: 'ピンボール回廊',
      obstacles: [
        { x: 66, y: 196, w: 18, h: 152 }, { x: 396, y: 196, w: 18, h: 152 },
        { x: 188, y: 330, w: 104, h: 18 }
      ],
      barrels: [{ x: 150, y: 150 }, { x: 330, y: 150 }],
      gears: [{ x: 186, y: 620, w: 108, h: 16, dir: -90 }],
      warps: [{ x: 300, y: 480 }, { x: 180, y: 480 }]
    },
    {
      name: '二本の大柱',
      obstacles: [
        { x: 146, y: 116, w: 18, h: 204 }, { x: 316, y: 116, w: 18, h: 204 },
        { x: 190, y: 470, w: 100, h: 18 }
      ],
      barrels: [{ x: 240, y: 200 }],
      gears: [{ x: 60, y: 380, w: 74, h: 16, dir: 0 }, { x: 346, y: 380, w: 74, h: 16, dir: 180 }],
      warps: [{ x: 420, y: 130 }, { x: 60, y: 130 }]
    },
    {
      name: '要塞',
      obstacles: [
        { x: 180, y: 196, w: 120, h: 118 },
        { x: 56, y: 116, w: 18, h: 84 }, { x: 406, y: 116, w: 18, h: 84 }
      ],
      barrels: [{ x: 240, y: 360 }, { x: 100, y: 300 }, { x: 380, y: 300 }],
      gears: [{ x: 196, y: 600, w: 88, h: 16, dir: -90 }],
      warps: [{ x: 60, y: 470 }, { x: 420, y: 470 }]
    },
    {
      name: '魔の巣窟',
      obstacles: [
        { x: 118, y: 176, w: 84, h: 18 }, { x: 278, y: 256, w: 84, h: 18 },
        { x: 108, y: 380, w: 84, h: 18 }, { x: 296, y: 424, w: 84, h: 18 }
      ],
      barrels: [{ x: 240, y: 120 }, { x: 66, y: 300 }],
      gears: [{ x: 120, y: 540, w: 96, h: 16, dir: -90 }, { x: 264, y: 540, w: 96, h: 16, dir: -90 }],
      warps: [{ x: 430, y: 320 }, { x: 50, y: 600 }]
    }
  ];

  function stageIndexToKey(index) {
    var world = Math.floor((index - 1) / 10) + 1;
    var level = ((index - 1) % 10) + 1;
    return world + '-' + level;
  }

  function getPatternFor(index) {
    return STAGE_PATTERNS[(index - 1) % STAGE_PATTERNS.length];
  }

  function stageHpMul(stageIndex) { return 1 + 0.34 * (stageIndex - 1); }
  function stageDmgMul(stageIndex) { return 1 + 0.16 * (stageIndex - 1); }
  function stageGoldMul(stageIndex) { return 1 + 0.20 * (stageIndex - 1); }

  function createEnemy(typeKey, x, y, stageIndex, waveIndex) {
    var base = ENEMY_TYPES[typeKey] || ENEMY_TYPES.slime;
    var hpMul = stageHpMul(stageIndex) * (1 + 0.16 * (waveIndex - 1));
    var hp = Math.round(base.hp * hpMul);
    return {
      key: base.key,
      name: base.name,
      x: x,
      y: y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      radius: base.radius,
      hp: hp,
      maxHp: hp,
      alive: true,
      hitFlash: 0,
      burn: 0,
      burnDps: 0,
      coreAngle: Math.random() * Math.PI * 2,
      coreSpin: base.boss ? 0.5 : rand(1.1, 1.9) * (Math.random() < 0.5 ? -1 : 1),
      coreOffset: base.coreOffset,
      color: base.color,
      dark: base.dark,
      bulletDmg: Math.round(base.bulletDmg * stageDmgMul(stageIndex)),
      bulletSpeed: base.bulletSpeed,
      bullets: base.bullets,
      shots: base.shots,
      wander: base.wander,
      wanderPhase: Math.random() * Math.PI * 2,
      gold: Math.round(base.gold * stageGoldMul(stageIndex)),
      boss: !!base.boss,
      spawnAnim: 0.45,
      deathAnim: 0,
      hitCd: 0
    };
  }

  /* ---- 装備（ハクスラ）生成 ---- */
  var WEAPON_NAMES = {
    normal: ['錆びた鉄剣', '訓練用の剣', '石斧'],
    rare: ['碧水の長剣', '嵐呼びの弓', '真鍮の大槌'],
    epic: ['業火の魔剣', '雷鳴の双刃', '深淵の咎剣'],
    cursed: ['呪血のグロウブレード', '亡者の骨剣', '堕ちたる聖剣']
  };
  var RELIC_NAMES = {
    normal: ['古びた護符', '木彫りの像', '硝子の指輪'],
    rare: ['精霊の指輪', '疾風の紋章', '碧海の護石'],
    epic: ['竜脈の宝珠', '星喰らいの腕輪', '雷帝の証'],
    cursed: ['呪われた聖杯', '亡霊の首飾り', '深淵の心臓']
  };

  function rollRarity(luck, stageIndex) {
    if (!save.pity) { save.pity = { epic: 0, cursed: 0 }; }
    var rareBoost = luck * LUCK_RARE_PER_POINT + (stageIndex - 1) * 0.012;
    var epicPity = save.pity.epic;
    var cursedPity = save.pity.cursed;
    var epicBonus = Math.max(0, epicPity - PITY_EPIC_START) * PITY_EPIC_STEP;
    var cursedBonus = Math.max(0, cursedPity - PITY_CURSED_START) * PITY_CURSED_STEP;
    var forcedCursed = cursedPity >= PITY_CURSED_HARD;
    var forcedEpic = epicPity >= PITY_EPIC_HARD;
    save.pity.epic += 1;
    save.pity.cursed += 1;
    if (forcedCursed || (Math.random() - rareBoost * 0.35 - cursedBonus) < 0.045) {
      save.pity.cursed = 0;
      return 'cursed';
    }
    if (forcedEpic || (Math.random() - rareBoost * 0.5 - epicBonus) < 0.15) {
      save.pity.epic = 0;
      return 'epic';
    }
    var r = Math.random() - rareBoost * 0.5;
    if (r < 0.46) { return 'rare'; }
    return 'normal';
  }

  function rollOption(rarity, key) {
    var tier = { normal: 0, rare: 1, epic: 2, cursed: 3 }[rarity] || 0;
    var table = {
      atkPct: { label: '攻撃力', values: [6, 11, 16, 24], unit: '%' },
      critRate: { label: 'クリ率', values: [3, 5, 8, 50], unit: '%' },
      critDmg: { label: 'クリダメージ', values: [8, 14, 22, 35], unit: '%' },
      reflectPlus: { label: '反射スタック', values: [1, 1, 2, 3], unit: '' },
      maxHpPlus: { label: '最大HP', values: [8, 14, 22, 40], unit: '' },
      shotPlus: { label: 'ショット数', values: [0, 0, 1, 1], unit: '' }
    };
    var def = table[key];
    if (!def) { return null; }
    var base = def.values[tier];
    if (base <= 0) { return null; }
    var value = (key === 'reflectPlus' || key === 'shotPlus')
      ? base
      : Math.round(base * rand(0.85, 1.25) * 10) / 10;
    return { key: key, label: def.label + ' +' + value + def.unit, value: value, curse: false };
  }

  function createItem(slot, forceRarity, stageIndex) {
    var rarity = forceRarity || rollRarity(0, stageIndex || 1);
    var names = (slot === 'relic' ? RELIC_NAMES : WEAPON_NAMES)[rarity];
    var item = {
      uid: nextUid(),
      slot: slot,
      rarity: rarity,
      name: pick(names),
      opts: [],
      plus: 0,
      locked: false
    };
    var opCount = RARITIES[rarity].ops;
    if (rarity === 'cursed') {
      item.opts.push({ key: 'critRate', label: 'クリ率 +' + (40 + randInt(0, 20)) + '%', value: 40 + randInt(0, 20), curse: false });
      item.opts.push({ key: 'curseDouble', label: '被ダメージ 2倍', value: 2, curse: true });
      opCount = 0;
    }
    var pool = shuffle(['atkPct', 'critRate', 'critDmg', 'reflectPlus', 'maxHpPlus']);
    if (rarity === 'epic') { pool.push('shotPlus'); }
    var used = {};
    for (var i = 0; i < pool.length && opCount > 0; i += 1) {
      var key = pool[i];
      if (used[key]) { continue; }
      var op = rollOption(rarity, key);
      if (!op) { continue; }
      used[key] = true;
      item.opts.push(op);
      opCount -= 1;
    }
    return item;
  }

  function itemSellValue(item) {
    return RARITIES[item.rarity].sell + item.opts.length * 6 + (item.plus || 0) * 25;
  }

  /* ---- 合成（＋強化）による効果値 ---- */
  function itemPlusBonus(item, op) {
    var plus = item.plus || 0;
    if (plus <= 0) { return 0; }
    if (op.key === 'atkPct' || op.key === 'critRate' || op.key === 'critDmg') { return plus * 3; }
    if (op.key === 'maxHpPlus') { return plus * 6; }
    if (op.key === 'reflectPlus' || op.key === 'shotPlus') { return plus >= 2 ? 1 : 0; }
    return 0;
  }

  function itemOptionValue(item, op) {
    return op.value + itemPlusBonus(item, op);
  }

  function equipTotals() {
    var total = {
      atkPct: 0, critRate: 0, critDmg: 0, reflectPlus: 0, maxHpPlus: 0,
      shotPlus: 0, dmgTakenMult: 1, curses: 0
    };
    ['weapon', 'relic'].forEach(function (slot) {
      var item = getEquippedItem(slot);
      if (!item) { return; }
      item.opts.forEach(function (op) {
        if (op.key === 'curseDouble') { total.dmgTakenMult *= 2; total.curses += 1; return; }
        var value = itemOptionValue(item, op);
        if (op.key === 'atkPct') { total.atkPct += value / 100; return; }
        if (op.key === 'critRate') { total.critRate += value / 100; return; }
        if (op.key === 'critDmg') { total.critDmg += value / 100; return; }
        if (op.key === 'reflectPlus') { total.reflectPlus += value; return; }
        if (op.key === 'maxHpPlus') { total.maxHpPlus += value; return; }
        if (op.key === 'shotPlus') { total.shotPlus += value; }
      });
    });
    return total;
  }

  function getEquippedItem(slot) {
    var uid = save.equip[slot];
    if (!uid) { return null; }
    for (var i = 0; i < save.items.length; i += 1) {
      if (save.items[i].uid === uid) { return save.items[i]; }
    }
    return null;
  }

  function findItem(uid) {
    for (var i = 0; i < save.items.length; i += 1) {
      if (save.items[i].uid === uid) { return save.items[i]; }
    }
    return null;
  }

  function equipItem(uid) {
    var item = findItem(uid);
    if (!item) { return false; }
    save.equip[item.slot] = item.uid;
    persistSave();
    return true;
  }

  function unequipSlot(slot) {
    if (!save.equip[slot]) { return false; }
    save.equip[slot] = null;
    persistSave();
    return true;
  }

  /* ---- 合成 / 浄化 / ロック / 自動売却 ---- */
  function findFusePartner(item) {
    for (var i = 0; i < save.items.length; i += 1) {
      var other = save.items[i];
      if (other.uid === item.uid) { continue; }
      if (other.name === item.name && other.rarity === item.rarity && other.slot === item.slot) {
        return other;
      }
    }
    return null;
  }

  function itemHasCurse(item) {
    for (var i = 0; i < item.opts.length; i += 1) {
      if (item.opts[i].curse) { return true; }
    }
    return false;
  }

  function fuseItems(uid) {
    var item = findItem(uid);
    if (!item) { return false; }
    if (item.locked) {
      showToast('ロック中の装備は合成できません', '✕', 'warn');
      return false;
    }
    var partner = findFusePartner(item);
    if (!partner) {
      showToast('同名＋同レアの装備が必要です', '✕', 'warn');
      return false;
    }
    save.items = save.items.filter(function (it) { return it.uid !== partner.uid; });
    Object.keys(save.equip).forEach(function (slot) {
      if (save.equip[slot] === partner.uid) { save.equip[slot] = item.uid; }
    });
    var resultText = '';
    if (item.opts.length < FUSE_MAX_OPS) {
      var pool = shuffle(['atkPct', 'critRate', 'critDmg', 'reflectPlus', 'maxHpPlus']);
      var existing = {};
      for (var i = 0; i < item.opts.length; i += 1) { existing[item.opts[i].key] = true; }
      for (var p = 0; p < pool.length; p += 1) {
        if (existing[pool[p]]) { continue; }
        var op = rollOption(item.rarity, pool[p]);
        if (!op) { continue; }
        item.opts.push(op);
        resultText = '新オプション『' + op.label + '』を獲得';
        break;
      }
    }
    if (!resultText) {
      item.plus = Math.min(FUSE_MAX_PLUS, (item.plus || 0) + 1);
      resultText = '強化値 ＋' + item.plus + ' に上昇';
    }
    Sfx.evolution();
    flashScreen('flash--evolve');
    showToast('合成成功：' + resultText, '★', 'synergy');
    persistSave();
    if (state && state.player) {
      recomputePlayer(false);
      updateHud();
    }
    return true;
  }

  function purgeItem(uid) {
    var item = findItem(uid);
    if (!item) { return false; }
    if (!itemHasCurse(item)) {
      showToast('この装備に呪いはありません', '✕', 'warn');
      return false;
    }
    if (save.gold < PURGE_COST) {
      showToast('ゴールドが足りません（' + PURGE_COST + 'G 必要）', '✕', 'warn');
      return false;
    }
    save.gold -= PURGE_COST;
    item.opts = item.opts.filter(function (op) { return !op.curse; });
    Sfx.fanfare();
    flashScreen('flash--friend');
    showToast('呪いを浄化しました（-' + PURGE_COST + 'G）', '◇', 'luck');
    persistSave();
    if (state && state.player) {
      recomputePlayer(false);
      updateHud();
    }
    return true;
  }

  function toggleItemLock(uid) {
    var item = findItem(uid);
    if (!item) { return false; }
    item.locked = !item.locked;
    Sfx.ui();
    showToast(item.locked ? 'ロックしました（売却・合成から保護）' : 'ロックを解除しました',
      item.locked ? '●' : '○', '');
    persistSave();
    return true;
  }

  /* ---- 在庫上限（装備中・ロック中・高レアは保護して整理） ---- */
  function trimInventory() {
    if (save.items.length <= ITEM_CAP) { return; }
    var keep = [];
    var removable = [];
    for (var i = 0; i < save.items.length; i += 1) {
      var item = save.items[i];
      var equipped = (save.equip[item.slot] === item.uid);
      var safe = equipped || item.locked || item.rarity === 'epic' || item.rarity === 'cursed';
      if (safe) { keep.push(item); } else { removable.push(item); }
    }
    while (keep.length < ITEM_CAP && removable.length > 0) {
      keep.push(removable.shift());
    }
    while (keep.length > ITEM_CAP) {
      keep.shift();
    }
    save.items = keep;
  }

  function autoSellItems() {
    var keep = [];
    var sold = 0;
    var value = 0;
    for (var i = 0; i < save.items.length; i += 1) {
      var item = save.items[i];
      var equipped = (save.equip[item.slot] === item.uid);
      var trash = (item.rarity === 'normal' || item.rarity === 'rare') && !equipped && !item.locked;
      if (trash) {
        sold += 1;
        value += itemSellValue(item);
      } else {
        keep.push(item);
      }
    }
    if (sold === 0) {
      showToast('売却対象がありません（装備中・ロック中は保護）', '✕', 'warn');
      return 0;
    }
    save.items = keep;
    save.gold += value;
    Sfx.coin();
    showToast('自動売却: ' + sold + '個 → +' + value + 'G', '＋', 'gold');
    persistSave();
    return sold;
  }

  function compareItems(item) {
    var current = getEquippedItem(item.slot);
    if (!current) { return SLOT_LABEL[item.slot] + '未装備 → そのまま装備できます'; }
    if (current.uid === item.uid) { return '現在装備中'; }
    var parts = [];
    for (var i = 0; i < item.opts.length; i += 1) {
      var op = item.opts[i];
      if (op.curse) {
        parts.push('呪い付き');
        continue;
      }
      var best = 0;
      for (var j = 0; j < current.opts.length; j += 1) {
        if (current.opts[j].key === op.key && !current.opts[j].curse) {
          best = Math.max(best, itemOptionValue(current, current.opts[j]));
        }
      }
      var delta = Math.round((itemOptionValue(item, op) - best) * 10) / 10;
      parts.push(op.key + ' ' + (delta >= 0 ? '+' : '') + delta);
    }
    return '比較 → ' + parts.join(' / ');
  }

  function sellItem(uid) {
    var item = findItem(uid);
    if (!item) { return 0; }
    Object.keys(save.equip).forEach(function (slot) {
      if (save.equip[slot] === uid) { save.equip[slot] = null; }
    });
    var value = itemSellValue(item);
    save.items = save.items.filter(function (it) { return it.uid !== uid; });
    save.gold += value;
    persistSave();
    return value;
  }

  /* ---- セーブデータ ---- */
  function createDefaultSave() {
    return {
      version: 2,
      gold: 0,
      bestStageIndex: 1,
      chars: { fire: { star: 3, luck: 0 } },
      items: [],
      equip: { weapon: null, relic: null },
      selectedCharId: 'fire',
      soundEnabled: true,
      runs: 0,
      clearedStages: 0,
      party: { main: 'fire', subs: [] },
      pity: { epic: 0, cursed: 0 }
    };
  }

  function isKnownChar(id) {
    for (var i = 0; i < CHARACTERS.length; i += 1) {
      if (CHARACTERS[i].id === id) { return true; }
    }
    return false;
  }

  function sanitizeSave(raw) {
    var out = createDefaultSave();
    if (!raw || typeof raw !== 'object') { return out; }
    if (typeof raw.gold === 'number' && isFinite(raw.gold)) { out.gold = clamp(Math.floor(raw.gold), 0, 99999999); }
    if (typeof raw.bestStageIndex === 'number' && isFinite(raw.bestStageIndex)) { out.bestStageIndex = clamp(Math.floor(raw.bestStageIndex), 1, 9999); }
    if (typeof raw.runs === 'number' && isFinite(raw.runs)) { out.runs = clamp(Math.floor(raw.runs), 0, 9999999); }
    if (typeof raw.clearedStages === 'number' && isFinite(raw.clearedStages)) { out.clearedStages = clamp(Math.floor(raw.clearedStages), 0, 9999999); }
    if (typeof raw.soundEnabled === 'boolean') { out.soundEnabled = raw.soundEnabled; }

    out.chars = {};
    if (raw.chars && typeof raw.chars === 'object') {
      Object.keys(raw.chars).forEach(function (id) {
        if (!isKnownChar(id)) { return; }
        var entry = raw.chars[id] || {};
        out.chars[id] = {
          star: clamp(Math.floor(Number(entry.star) || 3), 3, 5),
          luck: clamp(Math.floor(Number(entry.luck) || 0), 0, 999)
        };
      });
    }
    if (Object.keys(out.chars).length === 0) { out.chars = { fire: { star: 3, luck: 0 } }; }

    if (Array.isArray(raw.items)) {
      out.items = raw.items.filter(function (it) {
        return it && typeof it === 'object' && it.uid &&
          (it.slot === 'weapon' || it.slot === 'relic') && RARITIES[it.rarity];
      }).slice(0, 120).map(function (it) {
        return {
          uid: String(it.uid),
          slot: it.slot,
          rarity: it.rarity,
          name: String(it.name || '名もなき装備'),
          opts: Array.isArray(it.opts) ? it.opts.map(function (op) {
            return {
              key: String(op.key || ''),
              label: String(op.label || ''),
              value: Number(op.value) || 0,
              curse: !!op.curse
            };
          }) : [],
          plus: clamp(Math.floor(Number(it.plus) || 0), 0, FUSE_MAX_PLUS),
          locked: !!it.locked
        };
      });
    }

    if (raw.equip && typeof raw.equip === 'object') {
      var hasWeapon = function (uid) {
        return typeof uid === 'string' && out.items.some(function (it) { return it.uid === uid && it.slot === 'weapon'; });
      };
      var hasRelic = function (uid) {
        return typeof uid === 'string' && out.items.some(function (it) { return it.uid === uid && it.slot === 'relic'; });
      };
      out.equip.weapon = hasWeapon(raw.equip.weapon) ? raw.equip.weapon : null;
      out.equip.relic = hasRelic(raw.equip.relic) ? raw.equip.relic : null;
    }

    if (typeof raw.selectedCharId === 'string' && out.chars[raw.selectedCharId]) {
      out.selectedCharId = raw.selectedCharId;
    }

    out.party = { main: out.selectedCharId, subs: [] };
    if (raw.party && typeof raw.party === 'object') {
      if (typeof raw.party.main === 'string' && out.chars[raw.party.main]) {
        out.party.main = raw.party.main;
      }
      if (Array.isArray(raw.party.subs)) {
        for (var si = 0; si < raw.party.subs.length && out.party.subs.length < PARTY_SIZE - 1; si += 1) {
          var sid = raw.party.subs[si];
          if (typeof sid === 'string' && out.chars[sid] && sid !== out.party.main &&
            out.party.subs.indexOf(sid) < 0) {
            out.party.subs.push(sid);
          }
        }
      }
    }
    if (raw.pity && typeof raw.pity === 'object') {
      out.pity = {
        epic: clamp(Math.floor(Number(raw.pity.epic) || 0), 0, 999),
        cursed: clamp(Math.floor(Number(raw.pity.cursed) || 0), 0, 999)
      };
    }
    return out;
  }

  function loadSave() {
    var raw = null;
    try {
      var text = window.localStorage.getItem(SAVE_KEY);
      if (text) { raw = JSON.parse(text); }
    } catch (err) {
      raw = null;
    }
    save = sanitizeSave(raw);
    return save;
  }

  function persistSave() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      /* ストレージが使えない環境でもプレイは継続できるようにする */
    }
  }

  function grantCharacter(charId) {
    if (save.chars[charId]) {
      var gained = save.chars[charId].star < 5 ? 3 : 2;
      save.chars[charId].luck += gained;
      if (save.chars[charId].star < 5) { save.chars[charId].star += 1; }
      persistSave();
      return { added: false, luck: gained, starUp: true };
    }
    save.chars[charId] = { star: 3, luck: 0 };
    persistSave();
    return { added: true, luck: 0, starUp: false };
  }

  function ownedCharIds() { return Object.keys(save.chars); }
  function charLuckOf(charId) { return save.chars[charId] ? save.chars[charId].luck : 0; }
  function totalLuck() {
    return ownedCharIds().reduce(function (sum, id) { return sum + charLuckOf(id); }, 0);
  }

  /* ==========================================================================
     5. Web Audio API 音響シンセサイザー（外部音声ファイル不使用）
     ========================================================================== */
  var Sound = (function () {
    var ctx = null;
    var master = null;
    var enabled = true;
    var noiseBuffer = null;

    function supported() {
      return !!(window.AudioContext || window.webkitAudioContext);
    }

    function buildNoise() {
      var len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i += 1) { data[i] = Math.random() * 2 - 1; }
    }

    function ensure() {
      if (!supported()) { return null; }
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.42;
        master.connect(ctx.destination);
        buildNoise();
      }
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      return ctx;
    }

    function ready() {
      if (!enabled) { return null; }
      return ensure();
    }

    function tone(opt) {
      var c = ready();
      if (!c) { return; }
      var t0 = c.currentTime + (opt.delay || 0);
      var dur = opt.dur || 0.15;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = opt.type || 'square';
      osc.frequency.setValueAtTime(Math.max(20, opt.freq), t0);
      if (opt.endFreq && opt.endFreq !== opt.freq) {
        if (opt.glide === 'lin') {
          osc.frequency.linearRampToValueAtTime(Math.max(20, opt.endFreq), t0 + dur);
        } else {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.endFreq), t0 + dur);
        }
      }
      var vol = opt.vol === undefined ? 0.24 : opt.vol;
      var attack = opt.attack === undefined ? 0.006 : opt.attack;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    function noiseHit(opt) {
      var c = ready();
      if (!c) { return; }
      var t0 = c.currentTime + (opt.delay || 0);
      var dur = opt.dur || 0.3;
      var src = c.createBufferSource();
      src.buffer = noiseBuffer;
      var filter = c.createBiquadFilter();
      filter.type = opt.filterType || 'lowpass';
      filter.Q.value = opt.q === undefined ? 1 : opt.q;
      filter.frequency.setValueAtTime(opt.filterFrom || 3200, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, opt.filterTo || 220), t0 + dur);
      var gain = c.createGain();
      var vol = opt.vol === undefined ? 0.3 : opt.vol;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    }

    function arpeggio(notes, opt) {
      var options = opt || {};
      var step = options.step || 0.055;
      var dur = options.dur || 0.16;
      var vol = options.vol === undefined ? 0.2 : options.vol;
      var type = options.type || 'triangle';
      for (var i = 0; i < notes.length; i += 1) {
        tone({ type: type, freq: notes[i], dur: dur, vol: vol, delay: i * step, attack: 0.004 });
      }
    }

    return {
      unlock: function () { ensure(); },
      isEnabled: function () { return enabled; },
      setEnabled: function (on) {
        enabled = !!on;
        if (enabled) { ensure(); }
      },
      tone: tone,
      noise: noiseHit,
      arpeggio: arpeggio
    };
  })();

  /* ---- 効果音プリセット（実行時に周波数・エンベロープを合成） ---- */
  var Sfx = {
    launch: function () {
      Sound.tone({ type: 'sawtooth', freq: 680, endFreq: 190, dur: 0.24, vol: 0.22 });
      Sound.tone({ type: 'square', freq: 340, endFreq: 120, dur: 0.18, vol: 0.12, delay: 0.01 });
      Sound.noise({ dur: 0.14, vol: 0.1, filterFrom: 2400, filterTo: 500 });
    },
    hit: function (combo) {
      var f = clamp(520 + (combo || 0) * 24, 520, 1600);
      Sound.tone({ type: 'square', freq: f, endFreq: f * 1.25, dur: 0.06, vol: 0.15, attack: 0.002 });
    },
    weak: function () {
      Sound.tone({ type: 'triangle', freq: 1180, endFreq: 1720, dur: 0.13, vol: 0.22, attack: 0.003 });
      Sound.tone({ type: 'square', freq: 2360, dur: 0.07, vol: 0.1, delay: 0.01 });
    },
    crit: function () {
      Sound.tone({ type: 'sawtooth', freq: 260, endFreq: 90, dur: 0.2, vol: 0.24 });
      Sound.noise({ dur: 0.18, vol: 0.18, filterFrom: 5200, filterTo: 800 });
    },
    friend: function () {
      Sound.arpeggio([880, 1108.7, 1318.5, 1760], { step: 0.05, dur: 0.18, vol: 0.2 });
      Sound.tone({ type: 'sine', freq: 220, dur: 0.4, vol: 0.14, delay: 0.02 });
    },
    explosion: function () {
      Sound.noise({ dur: 0.55, vol: 0.34, filterFrom: 3400, filterTo: 140, q: 1.2 });
      Sound.tone({ type: 'sine', freq: 110, endFreq: 38, dur: 0.45, vol: 0.3 });
    },
    barrel: function () {
      Sound.noise({ dur: 0.7, vol: 0.38, filterFrom: 2600, filterTo: 90, q: 1.5 });
      Sound.tone({ type: 'sawtooth', freq: 150, endFreq: 40, dur: 0.6, vol: 0.26 });
    },
    burst: function () {
      Sound.noise({ dur: 0.65, vol: 0.4, filterFrom: 6000, filterTo: 120, q: 1.4 });
      Sound.tone({ type: 'sine', freq: 190, endFreq: 34, dur: 0.6, vol: 0.34 });
      Sound.tone({ type: 'square', freq: 90, endFreq: 30, dur: 0.5, vol: 0.18, delay: 0.02 });
    },
    warp: function () {
      Sound.tone({ type: 'sine', freq: 320, endFreq: 1600, dur: 0.12, vol: 0.18 });
      Sound.tone({ type: 'sine', freq: 1600, endFreq: 420, dur: 0.14, vol: 0.14, delay: 0.1 });
    },
    gear: function () {
      Sound.tone({ type: 'square', freq: 420, endFreq: 1180, dur: 0.14, vol: 0.16, glide: 'lin' });
    },
    enemyShot: function () {
      Sound.tone({ type: 'square', freq: 300, endFreq: 150, dur: 0.1, vol: 0.1 });
    },
    damage: function () {
      Sound.tone({ type: 'sawtooth', freq: 220, endFreq: 80, dur: 0.24, vol: 0.26 });
      Sound.noise({ dur: 0.2, vol: 0.16, filterFrom: 1200, filterTo: 200 });
    },
    waveClear: function () {
      Sound.arpeggio([659.3, 880, 1046.5], { step: 0.08, dur: 0.24, vol: 0.2 });
    },
    fanfare: function () {
      Sound.arpeggio([523.3, 659.3, 784, 1046.5], { step: 0.09, dur: 0.3, vol: 0.22, type: 'square' });
      Sound.tone({ type: 'triangle', freq: 1318.5, dur: 0.6, vol: 0.16, delay: 0.36 });
      Sound.tone({ type: 'sine', freq: 261.6, dur: 0.7, vol: 0.16, delay: 0.36 });
    },
    evolution: function () {
      Sound.arpeggio([523.3, 659.3, 784, 1046.5, 1318.5, 1568], { step: 0.075, dur: 0.28, vol: 0.2 });
      Sound.tone({ type: 'sawtooth', freq: 196, endFreq: 392, dur: 0.9, vol: 0.14, delay: 0.1, glide: 'lin' });
      Sound.noise({ dur: 0.8, vol: 0.12, filterFrom: 7000, filterTo: 1200, filterType: 'bandpass', q: 2 });
    },
    drop: function (rarity) {
      var base = { normal: 587.3, rare: 784, epic: 987.8, cursed: 659.3 }[rarity] || 587.3;
      Sound.tone({ type: 'triangle', freq: base, dur: 0.14, vol: 0.16 });
      Sound.tone({ type: 'triangle', freq: base * 1.5, dur: 0.22, vol: 0.14, delay: 0.07 });
      if (rarity === 'epic' || rarity === 'cursed') {
        Sound.tone({ type: 'sine', freq: base * 2, dur: 0.34, vol: 0.12, delay: 0.16 });
      }
    },
    gameOver: function () {
      Sound.arpeggio([392, 349.2, 311.1, 261.6], { step: 0.14, dur: 0.4, vol: 0.22, type: 'sawtooth' });
      Sound.tone({ type: 'sine', freq: 130.8, dur: 1.1, vol: 0.2, delay: 0.5 });
    },
    ui: function () {
      Sound.tone({ type: 'square', freq: 880, endFreq: 1180, dur: 0.05, vol: 0.1, attack: 0.002 });
    },
    coin: function () {
      Sound.tone({ type: 'square', freq: 1046.5, dur: 0.06, vol: 0.12 });
      Sound.tone({ type: 'square', freq: 1568, dur: 0.1, vol: 0.1, delay: 0.05 });
    }
  };

  /* ==========================================================================
     6. ラン状態 & ステータス計算
     ========================================================================== */
  var save = null;
  var state = null;
  var dom = {};
  var lastFrameTime = 0;
  var rafId = 0;
  var modalReturnTo = 'title';
  var inventoryReturnTo = 'title';
  var helpReturnTo = 'title';
  var suppressTapsUntil = 0;

  function createState() {
    return {
      phase: 'title',
      stageIndex: 1,
      waveIndex: 1,
      pattern: null,
      obstacles: [],
      barrels: [],
      gears: [],
      warps: [],
      enemies: [],
      bullets: [],
      missiles: [],
      effects: [],
      particles: [],
      texts: [],
      friends: [],
      ball: { x: LAUNCH_X, y: LAUNCH_Y, vx: 0, vy: 0, trail: [], alive: false, bounce: 0, maxBounce: 4, spin: 0, life: 0, omega: 0, pierce: 0, tightBonus: 0 },
      player: null,
      combo: 0,
      comboTimer: 0,
      hitStop: 0,
      timeScale: 1,
      timeScaleTimer: 0,
      shakeTimer: 0,
      shakeHard: false,
      aim: {
        active: false, pointerX: LAUNCH_X, pointerY: LAUNCH_Y, originX: LAUNCH_X, originY: LAUNCH_Y,
        power: 0, dirX: 0, dirY: -1, locked: false, lockedPower: 0, lastMove: 0, flick: 0,
        assist: false, samples: [], ghost: null
      },
      pointerId: null,
      pointers: {},
      friendChain: 0,
      friendChainTimer: 0,
      duoMembers: {},
      duoFired: false,
      partyRevives: 0,
      partyDowned: [],
      carryShots: 0,
      supportCounter: 0,
      lockNotified: false,
      time: 0,
      enemyTurnTimer: 0,
      warpCooldown: 0,
      gearOccupied: [],
      rerollCount: 0,
      runGold: 0,
      runDrops: [],
      pendingResult: null,
      resultNext: null,
      stageClearBonus: 0,
      lastShotIndex: 0,
      bestCombo: 0,
      chipHash: ''
    };
  }

  function createPlayer(charId) {
    var entry = save.chars[charId] || { star: 3, luck: 0 };
    return {
      charId: charId,
      star: entry.star,
      charLuck: entry.luck,
      glyph: '火',
      name: '',
      element: 'fire',
      friend: { type: 'shockwave', count: 1, radius: 78, dmgMul: 1.4, heal: 0 },
      skills: {},
      tags: {},
      synergy: {},
      hp: 100,
      maxHp: 100,
      atk: 10,
      critRate: 0.05,
      critDmg: 1.6,
      dmgTakenMult: 1,
      reflectPlus: 0,
      speedMul: 1,
      weakBonus: 0,
      comboBonus: 0,
      weakCombo: 0,
      luck: 0,
      goldPct: 0,
      burnMul: 0,
      dischargeChance: 0,
      reflectPulse: 0,
      berserk: false,
      shotsPerWave: BASE_SHOTS,
      shotsLeft: BASE_SHOTS,
      burstUsed: false,
      partyMembers: [],
      partyDown: [],
      auraDmg: 1,
      auraCrit: 0,
      auraTaken: 1,
      auraSupportCd: 0,
      friendRevive: 0
    };
  }

  function computePreviewStats(charId, star) {
    var ev = getEvolution(charId, star);
    var eq = equipTotals();
    return {
      ev: ev,
      atk: Math.round(ev.atk * (1 + eq.atkPct)),
      maxHp: Math.round(ev.hp + eq.maxHpPlus),
      critRate: clamp(ev.critRate + eq.critRate, 0, 0.95),
      critDmg: ev.critDmg + eq.critDmg,
      dmgTakenMult: eq.dmgTakenMult,
      reflectPlus: eq.reflectPlus
    };
  }

  /* ---- パーティ（メイン＋サブ2） ---- */
  function partySubIds() {
    var subs = (save.party && save.party.subs) ? save.party.subs : [];
    var out = [];
    for (var i = 0; i < subs.length && out.length < PARTY_SIZE - 1; i += 1) {
      if (subs[i] && save.chars[subs[i]] && out.indexOf(subs[i]) < 0) { out.push(subs[i]); }
    }
    return out;
  }

  function buildPartyMembers(charId, star) {
    var p = state.player;
    var mainId = charId || (p ? p.charId : save.selectedCharId);
    var mainStar = star || (save.chars[mainId] ? save.chars[mainId].star : 3);
    var ids = [mainId].concat(partySubIds());
    var members = [];
    for (var i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      var entry = save.chars[id] || { star: 3, luck: 0 };
      var def = getCharDef(id);
      var ev = getEvolution(id, entry.star);
      members.push({
        charId: id,
        star: entry.star,
        name: ev.name,
        glyph: ev.glyph,
        element: def.element,
        friend: ev.friend,
        role: ROLES[id] || ROLES.fire,
        isMain: i === 0
      });
    }
    return members;
  }

  function partyAuras(members) {
    var aura = { dmg: 1, crit: 0, taken: 1, supportCd: 0 };
    for (var i = 1; i < members.length; i += 1) {
      var def = ROLE_AURA[members[i].role.key] || ROLE_AURA.attacker;
      aura.dmg += def.dmg;
      aura.crit += def.crit;
      aura.taken *= def.taken;
      aura.supportCd += def.supportCd;
    }
    return aura;
  }

  function partyAuraSummary() {
    var p = state.player;
    if (!p || !p.partyMembers || p.partyMembers.length < 2) { return 'なし'; }
    var parts = [];
    for (var i = 1; i < p.partyMembers.length; i += 1) {
      var m = p.partyMembers[i];
      parts.push(m.name + '（' + m.role.label + '）');
    }
    return parts.join(' / ');
  }

  function recomputePlayer(fullHeal) {
    if (!state || !state.player) { return; }
    var p = state.player;
    var entry = save.chars[p.charId] || { star: p.star, luck: 0 };
    p.star = entry.star;
    p.charLuck = entry.luck;
    var def = getCharDef(p.charId);
    var ev = getEvolution(p.charId, p.star);
    var eq = equipTotals();
    var st = skillTotals(p.skills);
    var syn = detectSynergies(p.skills);
    p.synergy = syn.flags;
    p.tags = syn.tags;
    p.glyph = ev.glyph;
    p.name = ev.name;
    p.element = def.element;
    p.friend = ev.friend;
    p.partyMembers = buildPartyMembers(p.charId, p.star);
    var aura = partyAuras(p.partyMembers);
    p.auraDmg = aura.dmg;
    p.auraCrit = aura.crit;
    p.auraTaken = aura.taken;
    p.auraSupportCd = aura.supportCd;
    p.friendRevive = aura.supportCd < 0 ? 1 : 0;
    var atkMul = 1 + eq.atkPct + st.atkPct;
    if (syn.flags.berserker_pact) { atkMul *= 2; }
    p.atk = ev.atk * atkMul * aura.dmg;
    p.maxHp = Math.round(ev.hp + eq.maxHpPlus + st.maxHp);
    p.critRate = clamp(ev.critRate + eq.critRate + st.critRate + aura.crit, 0, 0.95);
    p.critDmg = ev.critDmg + eq.critDmg + st.critDmg;
    p.dmgTakenMult = eq.dmgTakenMult * (1 - clamp(st.dmgReduce, 0, 0.6)) * aura.taken;
    p.reflectPlus = eq.reflectPlus + st.reflectPlus;
    p.speedMul = 1 + st.speedPct;
    p.weakBonus = st.weakBonus;
    p.comboBonus = st.comboBonus;
    p.weakCombo = st.weakCombo;
    p.luck = p.charLuck + st.luck;
    p.goldPct = st.goldPct;
    p.burnMul = st.burnMul;
    p.dischargeChance = st.dischargeChance;
    p.reflectPulse = st.reflectPulse;
    p.berserk = syn.flags.berserker_pact;
    p.shotsPerWave = BASE_SHOTS + st.shotPlus + eq.shotPlus;
    if (fullHeal) { p.hp = p.maxHp; } else { p.hp = clamp(p.hp, 1, p.maxHp); }
    p.shotsLeft = clamp(p.shotsLeft, 0, p.shotsPerWave);
    state.ball.maxBounce = 4 + p.reflectPlus;
  }

  function comboMultiplier() {
    return 1 + state.combo * 0.05;
  }

  function playerGoldGain(base) {
    var p = state.player;
    return Math.max(1, Math.round(base * (1 + p.goldPct)));
  }

  /* ==========================================================================
     7. ステージ / ウェーブ構築
     ========================================================================== */
  function buildStageField(stageIndex) {
    var pattern = getPatternFor(stageIndex);
    state.pattern = pattern;
    state.obstacles = pattern.obstacles.map(function (o) {
      return { x: o.x, y: o.y, w: o.w, h: o.h, flash: 0 };
    });
    state.barrels = pattern.barrels.map(function (b) {
      return { x: b.x, y: b.y, r: 14, hp: 3, maxHp: 3, alive: true, hitFlash: 0, spawn: 1 };
    });
    state.gears = pattern.gears.map(function (g) {
      var dirDeg = (g.dir === undefined) ? -90 : g.dir;
      return {
        x: g.x, y: g.y, w: g.w, h: g.h, glow: 0, occupied: false, cooldown: 0,
        dir: dirDeg, dirRad: dirDeg * Math.PI / 180
      };
    });
    state.warps = pattern.warps.map(function (w, i) {
      return { x: w.x, y: w.y, r: 17, index: i, pulse: 0 };
    });
  }

  function isSpawnAreaFree(x, y, radius, placed) {
    var i;
    for (i = 0; i < state.obstacles.length; i += 1) {
      var o = state.obstacles[i];
      if (x > o.x - radius && x < o.x + o.w + radius && y > o.y - radius && y < o.y + o.h + radius) {
        return false;
      }
    }
    for (i = 0; i < state.barrels.length; i += 1) {
      if (dist(x, y, state.barrels[i].x, state.barrels[i].y) < radius + 18) { return false; }
    }
    for (i = 0; i < state.warps.length; i += 1) {
      if (dist(x, y, state.warps[i].x, state.warps[i].y) < radius + 22) { return false; }
    }
    for (i = 0; i < state.gears.length; i += 1) {
      var g = state.gears[i];
      if (x > g.x - radius && x < g.x + g.w + radius && y > g.y - radius && y < g.y + g.h + radius) {
        return false;
      }
    }
    for (i = 0; i < placed.length; i += 1) {
      if (dist(x, y, placed[i].x, placed[i].y) < radius + placed[i].radius + 16) { return false; }
    }
    if (dist(x, y, LAUNCH_X, LAUNCH_Y) < 190) { return false; }
    return true;
  }

  function findSpawn(radius, placed) {
    var best = null;
    for (var attempt = 0; attempt < 90; attempt += 1) {
      var x = rand(FIELD.x + radius + 6, FIELD.x + FIELD.w - radius - 6);
      var y = rand(FIELD.y + radius + 30, FIELD.y + FIELD.h * 0.52);
      if (isSpawnAreaFree(x, y, radius, placed)) { return { x: x, y: y }; }
      if (!best) { best = { x: x, y: y }; }
    }
    return best || { x: 240, y: 170 };
  }

  function buildWaveEnemies(stageIndex, waveIndex) {
    var specs = [];
    var isBossWave = waveIndex >= WAVES_PER_STAGE;
    if (isBossWave) {
      specs.push({ type: 'boss', x: 240, y: 148 });
      var guards = Math.min(3, 1 + Math.floor(stageIndex / 3));
      for (var g = 0; g < guards; g += 1) {
        specs.push({ type: 'bat', dynamic: true });
      }
    } else {
      var count = 2 + waveIndex + Math.min(4, Math.floor((stageIndex - 1) / 2));
      var pool = ['slime', 'slime', 'bat'];
      if (stageIndex >= 2) { pool.push('brute'); }
      if (stageIndex >= 3) { pool.push('mage'); }
      if (waveIndex >= 2) { pool.push('brute', 'mage'); }
      for (var i = 0; i < count; i += 1) {
        specs.push({ type: pick(pool), dynamic: true });
      }
    }
    var placed = [];
    var enemies = [];
    for (var s = 0; s < specs.length; s += 1) {
      var spec = specs[s];
      var radius = (ENEMY_TYPES[spec.type] || ENEMY_TYPES.slime).radius;
      var pos;
      if (spec.dynamic) {
        pos = findSpawn(radius, placed);
      } else {
        pos = { x: spec.x, y: spec.y };
      }
      placed.push({ x: pos.x, y: pos.y, radius: radius });
      enemies.push(createEnemy(spec.type, pos.x, pos.y, stageIndex, waveIndex));
    }
    return enemies;
  }

  function buildFriends() {
    var p = state.player;
    var members = (p.partyMembers && p.partyMembers.length > 0)
      ? p.partyMembers
      : [{ charId: p.charId, name: p.name, glyph: p.glyph, element: p.element, friend: p.friend, isMain: true }];
    var count = Math.max(members.length, p.friend.count);
    var list = [];
    var y = FIELD.y + FIELD.h - 46;
    for (var i = 0; i < count; i += 1) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      var x = lerp(FIELD.x + 52, FIELD.x + FIELD.w - 52, t);
      var ownerIndex = i % members.length;
      var owner = members[ownerIndex];
      list.push({
        id: 'friend-' + i,
        x: x,
        y: y - (i % 2 === 0 ? 0 : 26),
        r: 11,
        used: false,
        pulse: 0,
        type: owner.friend.type,
        friend: owner.friend,
        ownerIndex: ownerIndex,
        ownerName: owner.name,
        element: owner.element,
        color: ELEMENTS[owner.element].color
      });
    }
    state.friends = list;
  }

  function aliveEnemies() {
    return state.enemies.filter(function (e) { return e.alive; });
  }

  function bossAlive() {
    for (var i = 0; i < state.enemies.length; i += 1) {
      if (state.enemies[i].alive && state.enemies[i].boss) { return state.enemies[i]; }
    }
    return null;
  }

  /* ==========================================================================
     8. 物理演算 & 衝突判定
     ========================================================================== */
  /* ---- エフェクト生成 ---- */
  function addParticles(x, y, count, color, speed, size) {
    if (state.particles.length > MAX_PARTICLES) { return; }
    for (var i = 0; i < count; i += 1) {
      var ang = Math.random() * Math.PI * 2;
      var sp = rand(speed * 0.35, speed);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rand(0.28, 0.62),
        maxLife: 0.62,
        size: rand(size * 0.6, size * 1.5),
        color: color
      });
    }
  }

  function addText(x, y, text, color, size, big) {
    state.texts.push({
      x: x, y: y, text: String(text), color: color,
      size: size || 13, life: big ? 0.95 : 0.7, maxLife: big ? 0.95 : 0.7,
      vy: big ? -34 : -26
    });
  }

  function addRing(x, y, radius, color, life, width) {
    state.effects.push({
      kind: 'ring', x: x, y: y, radius: radius, color: color,
      life: life || 0.34, maxLife: life || 0.34, width: width || 3
    });
  }

  function addShockwave(x, y, radius, color) {
    state.effects.push({
      kind: 'shockwave', x: x, y: y, radius: radius, color: color,
      life: 0.42, maxLife: 0.42, width: 4
    });
  }

  function addLightning(x1, y1, x2, y2, color) {
    var points = [{ x: x1, y: y1 }];
    var segments = 6;
    for (var i = 1; i < segments; i += 1) {
      var t = i / segments;
      var mx = lerp(x1, x2, t) + rand(-14, 14);
      var my = lerp(y1, y2, t) + rand(-14, 14);
      points.push({ x: mx, y: my });
    }
    points.push({ x: x2, y: y2 });
    state.effects.push({ kind: 'lightning', points: points, color: color || '#ffe45c', life: 0.24, maxLife: 0.24 });
  }

  function addLaser(x, y, angle, length, color) {
    state.effects.push({
      kind: 'laser', x: x, y: y, angle: angle, length: length,
      color: color || '#47d9ff', life: 0.34, maxLife: 0.34, width: 16
    });
  }

  function addBeamFlash(x, y, color) {
    state.effects.push({ kind: 'flash', x: x, y: y, color: color, life: 0.22, maxLife: 0.22, radius: 46 });
  }

  /* ---- ダメージ & 撃破 ---- */
  function strikeEnemy(enemy, amount, opts) {
    if (!enemy || !enemy.alive) { return 0; }
    var options = opts || {};
    var dmg = Math.max(1, Math.round(amount));
    enemy.hp -= dmg;
    enemy.hitFlash = 0.16;
    if (options.burn) {
      enemy.burn = Math.max(enemy.burn, options.burnDur || 3);
      enemy.burnDps = Math.max(enemy.burnDps, options.burnDps || 0);
    }
    var color = options.color || '#ffffff';
    addParticles(enemy.x, enemy.y, options.weak ? 14 : 7, color, options.weak ? 220 : 140, options.weak ? 3.4 : 2.4);
    addText(enemy.x, enemy.y - enemy.radius - 4, dmg, color, options.big ? 20 : 13, options.big);
    if (options.lifesteal && options.lifesteal > 0) {
      healPlayer(dmg * options.lifesteal, false);
    }
    if (enemy.hp <= 0) {
      killEnemy(enemy, options);
    }
    return dmg;
  }

  function killEnemy(enemy, opts) {
    if (!enemy.alive) { return; }
    enemy.alive = false;
    enemy.deathAnim = 0.3;
    var options = opts || {};
    addParticles(enemy.x, enemy.y, enemy.boss ? 46 : 18, enemy.color, enemy.boss ? 320 : 200, 3);
    addRing(enemy.x, enemy.y, enemy.boss ? 96 : 42, enemy.color, 0.4, 3);
    if (enemy.boss) {
      addShockwave(enemy.x, enemy.y, 150, '#ff2d55');
      flashScreen('flash--burst');
      shakeScreen(true);
      applyTimeScale(TIMESCALE_BOSS);
    }
    var gold = playerGoldGain(enemy.gold);
    save.gold += gold;
    state.runGold += gold;
    addText(enemy.x, enemy.y - enemy.radius - 20, '+' + gold + 'G', '#f2c75c', 12, false);
    Sfx.coin();
    if (enemy.burn > 0 && state.player.synergy.chain_fire) {
      var radius = 92;
      addShockwave(enemy.x, enemy.y, radius, '#ff6a3d');
      Sfx.explosion();
      for (var i = 0; i < state.enemies.length; i += 1) {
        var other = state.enemies[i];
        if (!other.alive) { continue; }
        if (dist(enemy.x, enemy.y, other.x, other.y) <= radius + other.radius) {
          strikeEnemy(other, state.player.atk * SYNERGY_CHAINFIRE_MUL, { color: '#ffb073', big: false, chain: true });
        }
      }
      addText(enemy.x, enemy.y - 34, '誘爆', '#ff6a3d', 13, true);
    }
    updateHud();
    if (options.silent !== true) { Sfx.explosion(); }
  }

  function damagePlayer(amount, sourceX, sourceY) {
    var p = state.player;
    var dmg = Math.max(1, Math.round(amount * p.dmgTakenMult));
    p.hp = Math.max(0, p.hp - dmg);
    addText(state.ball.x, state.ball.y - 22, '-' + dmg, '#ff8fa3', 15, false);
    addParticles(state.ball.x, state.ball.y, 8, '#ff2d55', 150, 2.6);
    flashScreen('flash--damage');
    shakeScreen(true);
    Sfx.damage();
    updateHud();
    if (p.hp <= 0) {
      if (!tryPartyRevive()) {
        endRun('defeat');
      }
    }
  }

  /* ---- 控えメンバーによる蘇生（1ステージで最大人数-1回） ---- */
  function tryPartyRevive() {
    var p = state.player;
    if (!p.partyMembers || p.partyMembers.length < 2) { return false; }
    if (state.partyDowned.length >= p.partyMembers.length - 1) { return false; }
    var idx = 1 + state.partyDowned.length;
    var member = p.partyMembers[idx];
    if (!member) { return false; }
    state.partyDowned.push(member.charId);
    if (!p.partyDown) { p.partyDown = []; }
    p.partyDown.push(member.charId);
    p.hp = Math.round(p.maxHp * REVIVE_HP_RATIO);
    applyTimeScale(TIMESCALE_BOSS);
    flashScreen('flash--evolve');
    shakeScreen(true);
    Sfx.fanfare();
    showBanner('控えが復活！', member.name + ' が身代わりになった', 'friend');
    showToast('サブ『' + member.name + '』が身代わりに → HP ' + p.hp + ' で復活', '＋', 'luck');
    for (var i = 0; i < state.friends.length; i += 1) {
      if (state.friends[i].ownerIndex === idx) { state.friends[i].used = true; }
    }
    renderPartyPips();
    updateHud();
    return true;
  }

  function healPlayer(amount, showText) {
    var p = state.player;
    var before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    var healed = Math.round(p.hp - before);
    if (healed > 0 && showText) {
      addText(state.ball.x, state.ball.y - 30, '+' + healed, '#6ef08a', 13, false);
    }
    if (healed > 0) { updateHud(); }
  }

  function addCombo(amount) {
    if (amount <= 0) { return; }
    state.combo = Math.min(state.combo + amount, COMBO_CAP);
    state.comboTimer = COMBO_WINDOW;
    if (state.combo > state.bestCombo) { state.bestCombo = state.combo; }
    updateHud();
  }

  function resetCombo() {
    state.combo = 0;
    state.comboTimer = 0;
    updateHud();
  }

  /* ---- 射出 & 反射スタック ---- */
  function launchSpeed(power, speedMul) {
    var base = MIN_LAUNCH_SPEED + clamp(power, 0, 1) * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
    return base * (speedMul || 1);
  }

  function bounceMultiplier() {
    return 1 + 0.08 * state.ball.bounce;
  }

  /* ---- Battle Core 2.0 物理コア ---- */
  function ballSpeed() {
    var b = state.ball;
    return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  }

  function pointInsideAnySolid(x, y) {
    if (x < FIELD.x || x > FIELD.x + FIELD.w || y < FIELD.y || y > FIELD.y + FIELD.h) { return true; }
    var i;
    for (i = 0; i < state.obstacles.length; i += 1) {
      var o = state.obstacles[i];
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) { return true; }
    }
    for (i = 0; i < state.barrels.length; i += 1) {
      var bl = state.barrels[i];
      if (bl.alive && dist(x, y, bl.x, bl.y) < bl.r) { return true; }
    }
    return false;
  }

  function tightGapCheck(x, y, nx, ny) {
    var px = x + nx * BALL_RADIUS;
    var py = y + ny * BALL_RADIUS;
    for (var step = 2; step <= TIGHT_GAP_MAX; step += 2) {
      if (pointInsideAnySolid(px + nx * step, py + ny * step)) { return true; }
    }
    return false;
  }

  function resolveCollision(nx, ny, material, hitX, hitY) {
    var b = state.ball;
    var mat = material || MATERIALS.wall;
    var vn = b.vx * nx + b.vy * ny;
    var tx = -ny;
    var ty = nx;
    var vt = b.vx * tx + b.vy * ty;
    var newVn = -vn * mat.restitution;
    var newVt = vt * (1 - mat.friction);
    b.vx = nx * newVn + tx * newVt;
    b.vy = ny * newVn + ty * newVt;
    b.omega = clamp(b.omega + vt * mat.spin - b.omega * mat.spin * 0.5, -40, 40);
    return {
      normalSpeed: Math.abs(vn),
      tangentSpeed: vt,
      tight: tightGapCheck(hitX, hitY, nx, ny)
    };
  }

  function spinDamageMultiplier() {
    return 1 + Math.min(Math.abs(state.ball.omega), SPIN_DAMAGE_CAP) * SPIN_DAMAGE_SCALE;
  }

  function tightDamageMultiplier() {
    return 1 + clamp(state.ball.tightBonus, 0, TIGHT_BONUS_CAP);
  }

  function applyTimeScale(profile) {
    state.timeScale = profile.scale;
    state.timeScaleTimer = profile.time;
  }

  function nearestEnemy(x, y, exceptBoss) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      if (exceptBoss && e.boss) { continue; }
      var d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function launchBall(dirX, dirY, power) {
    var b = state.ball;
    var p = state.player;
    var speed = launchSpeed(power, p.speedMul);
    b.x = LAUNCH_X;
    b.y = LAUNCH_Y;
    b.vx = dirX * speed;
    b.vy = dirY * speed;
    b.alive = true;
    b.bounce = 0;
    b.life = 0;
    b.omega = clamp(dirX * -4 + 6, -10, 14) * (0.5 + power);
    b.pierce = 0;
    b.tightBonus = 0;
    b.trail.length = 0;
    p.burstUsed = false;
    state.timeScale = 1;
    state.timeScaleTimer = 0;
    state.phase = 'moving';
    p.shotsLeft = Math.max(0, p.shotsLeft - 1);
    state.lastShotIndex += 1;
    resetCombo();
    state.friendChain = 0;
    state.friendChainTimer = 0;
    state.duoMembers = {};
    state.duoFired = false;
    if (p.friendRevive > 0) {
      for (var fi = 0; fi < state.friends.length; fi += 1) {
        if (state.friends[fi].used && Math.random() < 0.5) {
          state.friends[fi].used = false;
          state.friends[fi].pulse = 0.5;
        }
      }
    }
    if (p.berserk) {
      var cost = Math.min(Math.round(p.hp * BERSERKER_HP_COST), Math.max(0, p.hp - 1));
      if (cost > 0) {
        p.hp -= cost;
        addText(b.x, b.y - 36, '-' + cost + ' HP', '#ff2d55', 14, false);
      }
    }
    Sfx.launch();
    addRing(b.x, b.y, 26, ELEMENTS[p.element].color, 0.3, 2);
    fireSupportVolley();
    updateHud();
  }

  /* ---- サブの自律援護（ターン経過で自動発動） ---- */
  function fireSupportVolley() {
    var p = state.player;
    if (!p.partyMembers || p.partyMembers.length < 2) { return; }
    var interval = SUPPORT_INTERVAL + p.auraSupportCd;
    if (interval < 1) { interval = 1; }
    state.supportCounter += 1;
    if (state.supportCounter % interval !== 0) { return; }
    for (var i = 1; i < p.partyMembers.length; i += 1) {
      var m = p.partyMembers[i];
      if (p.partyDown && p.partyDown.indexOf(m.charId) >= 0) { continue; }
      var target = weakestEnemy();
      if (!target) { continue; }
      var el = ELEMENTS[m.element];
      var color = el.color;
      state.missiles.push({
        x: LAUNCH_X + (i === 1 ? -18 : 18),
        y: LAUNCH_Y - 8,
        vx: 0,
        vy: -260,
        dmg: p.atk * 0.45 * m.friend.dmgMul,
        color: color,
        life: 4.2,
        target: target,
        trail: [],
        support: true
      });
      addText(LAUNCH_X + (i === 1 ? -18 : 18), LAUNCH_Y - 30, '援護!', color, 11, false);
      addParticles(LAUNCH_X + (i === 1 ? -18 : 18), LAUNCH_Y - 10, 8, color, 130, 2.2);
    }
    Sfx.friend();
  }

  function weakestEnemy() {
    var best = null;
    var bestHp = Infinity;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      if (!best || e.hp < bestHp) {
        best = e;
        bestHp = e.hp;
      }
    }
    return best;
  }

  function onWallBounce(hitX, hitY, tight) {
    var b = state.ball;
    var p = state.player;
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.bounce = Math.min(b.bounce + 1, b.maxBounce);
    if (tight) {
      b.tightBonus = clamp(b.tightBonus + TIGHT_BONUS, 0, TIGHT_BONUS_CAP);
      addCombo(2);
      addText(hitX, hitY - 20, 'カンカン!', '#ffe45c', 12, true);
      addRing(hitX, hitY, 24, '#ffe45c', 0.26, 2);
      flashScreen('flash--crit');
    }
    if (speed > COMBO_SPEED_MIN) {
      addCombo(1 + p.comboBonus);
    }
    Sfx.hit(state.combo);
    addParticles(hitX, hitY, 4, '#8f7ec9', 90, 2.2);
    if (p.reflectPulse > 0) {
      var pulseDamage = p.atk * p.reflectPulse * bounceMultiplier();
      addShockwave(hitX, hitY, 82, '#47d9ff');
      for (var i = 0; i < state.enemies.length; i += 1) {
        var e = state.enemies[i];
        if (!e.alive) { continue; }
        if (dist(hitX, hitY, e.x, e.y) <= 82 + e.radius) {
          strikeEnemy(e, pulseDamage, { color: '#47d9ff' });
        }
      }
    }
    if (p.synergy.lightning_reflect) {
      var target = nearestEnemy(hitX, hitY, false);
      if (target) {
        addLightning(hitX, hitY, target.x, target.y, '#ffe45c');
        strikeEnemy(target, p.atk * SYNERGY_LIGHTNING_MUL, { color: '#ffe45c' });
        Sfx.weak();
      }
    }
  }

  function collideWalls() {
    var b = state.ball;
    var didBounce = false;
    var res = null;
    if (b.x - BALL_RADIUS < FIELD.x) {
      b.x = FIELD.x + BALL_RADIUS;
      res = resolveCollision(1, 0, MATERIALS.wall, FIELD.x, b.y);
      didBounce = true;
    } else if (b.x + BALL_RADIUS > FIELD.x + FIELD.w) {
      b.x = FIELD.x + FIELD.w - BALL_RADIUS;
      res = resolveCollision(-1, 0, MATERIALS.wall, FIELD.x + FIELD.w, b.y);
      didBounce = true;
    }
    if (b.y - BALL_RADIUS < FIELD.y) {
      b.y = FIELD.y + BALL_RADIUS;
      res = resolveCollision(0, 1, MATERIALS.wall, b.x, FIELD.y);
      didBounce = true;
    } else if (b.y + BALL_RADIUS > FIELD.y + FIELD.h) {
      b.y = FIELD.y + FIELD.h - BALL_RADIUS;
      res = resolveCollision(0, -1, MATERIALS.wall, b.x, FIELD.y + FIELD.h);
      didBounce = true;
    }
    if (didBounce) {
      onWallBounce(b.x, b.y, res ? res.tight : false);
      return true;
    }
    return false;
  }

  function collideObstacles() {
    var b = state.ball;
    var hit = false;
    for (var i = 0; i < state.obstacles.length; i += 1) {
      var o = state.obstacles[i];
      var cx = clamp(b.x, o.x, o.x + o.w);
      var cy = clamp(b.y, o.y, o.y + o.h);
      var dx = b.x - cx;
      var dy = b.y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 > BALL_RADIUS * BALL_RADIUS) { continue; }
      var d = Math.sqrt(d2);
      var nx;
      var ny;
      if (d < 0.0001) {
        var left = Math.abs(b.x - o.x);
        var right = Math.abs(o.x + o.w - b.x);
        var top = Math.abs(b.y - o.y);
        var bottom = Math.abs(o.y + o.h - b.y);
        var minSide = Math.min(left, right, top, bottom);
        nx = 0;
        ny = 0;
        if (minSide === left) { nx = -1; } else if (minSide === right) { nx = 1; } else if (minSide === top) { ny = -1; } else { ny = 1; }
      } else {
        nx = dx / d;
        ny = dy / d;
        b.x = cx + nx * BALL_RADIUS;
        b.y = cy + ny * BALL_RADIUS;
      }
      o.flash = 0.2;
      var oRes = resolveCollision(nx, ny, MATERIALS.obstacle, cx, cy);
      onWallBounce(cx, cy, oRes.tight);
      hit = true;
    }
    return hit;
  }

  function corePosition(enemy) {
    return {
      x: enemy.x + Math.cos(enemy.coreAngle) * enemy.coreOffset,
      y: enemy.y + Math.sin(enemy.coreAngle) * enemy.coreOffset
    };
  }

  function explodeBarrel(barrel) {
    barrel.alive = false;
    var radius = 132;
    addShockwave(barrel.x, barrel.y, radius, '#ff9a3d');
    addParticles(barrel.x, barrel.y, 34, '#ff6a3d', 300, 3.2);
    flashScreen('flash--burst');
    shakeScreen(true);
    Sfx.barrel();
    var damage = state.player.atk * 3.0;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      if (dist(barrel.x, barrel.y, e.x, e.y) <= radius + e.radius) {
        strikeEnemy(e, damage, { color: '#ff9a3d', big: true });
      }
    }
    for (var j = 0; j < state.barrels.length; j += 1) {
      var other = state.barrels[j];
      if (!other.alive || other === barrel) { continue; }
      if (dist(barrel.x, barrel.y, other.x, other.y) <= radius) {
        other.hp = 0;
        other.hitFlash = 0.2;
        explodeBarrel(other);
      }
    }
    state.bullets = state.bullets.filter(function (bl) {
      return dist(barrel.x, barrel.y, bl.x, bl.y) > radius;
    });
    addText(barrel.x, barrel.y - 26, '誘爆!', '#ff9a3d', 16, true);
  }

  function collideBarrels() {
    var b = state.ball;
    var hit = false;
    for (var i = 0; i < state.barrels.length; i += 1) {
      var barrel = state.barrels[i];
      if (!barrel.alive) { continue; }
      var d = dist(b.x, b.y, barrel.x, barrel.y);
      var minD = BALL_RADIUS + barrel.r;
      if (d >= minD) { continue; }
      var nx = (b.x - barrel.x) / (d || 1);
      var ny = (b.y - barrel.y) / (d || 1);
      b.x = barrel.x + nx * minD;
      b.y = barrel.y + ny * minD;
      resolveCollision(nx, ny, MATERIALS.barrel, b.x, b.y);
      barrel.hp -= 1;
      barrel.hitFlash = 0.2;
      addParticles(barrel.x, barrel.y, 6, '#ffcf9a', 140, 2.4);
      if (barrel.hp <= 0) {
        explodeBarrel(barrel);
      } else {
        Sfx.hit(state.combo);
        addText(barrel.x, barrel.y - 20, barrel.hp + '/3', '#ffcf9a', 11, false);
      }
      hit = true;
    }
    return hit;
  }

  function hitEnemyBody(enemy, weak) {
    var b = state.ball;
    var p = state.player;
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var crit = Math.random() < p.critRate;
    var damage = p.atk * comboMultiplier() * bounceMultiplier() * spinDamageMultiplier() * tightDamageMultiplier();
    if (weak) { damage *= 3 * (1 + p.weakBonus); }
    if (crit) { damage *= p.critDmg; }
    if (b.pierce > 0) { damage *= 1 + 0.1 * b.pierce; }
    var options = {
      color: crit ? '#ffe45c' : (weak ? '#47d9ff' : '#ffffff'),
      weak: weak,
      big: weak || crit,
      lifesteal: p.berserk ? BERSERKER_LIFESTEAL : 0
    };
    if (p.burnMul > 0) {
      options.burn = true;
      options.burnDur = 3;
      options.burnDps = p.atk * p.burnMul;
    }
    if (crit && p.synergy.chain_fire) {
      options.burn = true;
      options.burnDur = 4;
      options.burnDps = Math.max(options.burnDps || 0, p.atk * 0.5);
    }
    strikeEnemy(enemy, damage, options);
    if (speed > COMBO_SPEED_MIN) {
      addCombo(1 + (weak ? p.weakCombo : 0));
    }
    if (weak) {
      state.hitStop = Math.max(state.hitStop, HITSTOP_WEAK);
      applyTimeScale(TIMESCALE_WEAK);
      shakeScreen(false);
      Sfx.weak();
      addText(b.x, b.y - 30, 'WEAK!', '#47d9ff', 15, true);
      flashScreen('flash--crit');
    } else if (crit) {
      state.hitStop = Math.max(state.hitStop, HITSTOP_CRIT);
      applyTimeScale(TIMESCALE_CRIT);
      Sfx.crit();
      flashScreen('flash--crit');
    } else {
      Sfx.hit(state.combo);
    }
    if (p.dischargeChance > 0 && Math.random() < p.dischargeChance) {
      var target = nearestEnemy(b.x, b.y, true);
      if (target && target !== enemy) {
        addLightning(b.x, b.y, target.x, target.y, '#47d9ff');
        strikeEnemy(target, p.atk * 0.5 * comboMultiplier(), { color: '#47d9ff' });
      }
    }
  }

  function collideEnemies() {
    var b = state.ball;
    var hit = false;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive || e.hitCd > 0) { continue; }
      var d = dist(b.x, b.y, e.x, e.y);
      var minD = BALL_RADIUS + e.radius;
      if (d >= minD) { continue; }
      var nx = (b.x - e.x) / (d || 1);
      var ny = (b.y - e.y) / (d || 1);
      var core = corePosition(e);
      var coreReach = CORE_RADIUS + BALL_RADIUS + (Math.abs(b.omega) > 12 ? SPIN_CORE_BONUS : 0);
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      var weak = dist(b.x, b.y, core.x, core.y) <= coreReach;
      var canPierce = speed >= PIERCE_SPEED && Math.abs(b.omega) >= PIERCE_SPIN && b.pierce < PIERCE_MAX;
      if (canPierce) {
        b.pierce += 1;
        b.vx *= PIERCE_SLOW;
        b.vy *= PIERCE_SLOW;
        b.omega *= 0.7;
        e.hitCd = 0.14;
        addCombo(2);
        addText(b.x, b.y - 26, '貫通 x' + b.pierce, '#b478ff', 13, true);
        addParticles(b.x, b.y, 10, '#b478ff', 200, 2.6);
        addRing(b.x, b.y, 30, '#b478ff', 0.3, 3);
        Sfx.crit();
      } else {
        b.x = e.x + nx * minD;
        b.y = e.y + ny * minD;
        e.hitCd = 0.06;
        resolveCollision(nx, ny, MATERIALS.enemy, e.x + nx * e.radius, e.y + ny * e.radius);
      }
      hitEnemyBody(e, weak);
      hit = true;
    }
    return hit;
  }

  function collideFriends() {
    var b = state.ball;
    for (var i = 0; i < state.friends.length; i += 1) {
      var f = state.friends[i];
      if (f.used) { continue; }
      if (isFriendOwnerDown(f)) { continue; }
      if (dist(b.x, b.y, f.x, f.y) <= BALL_RADIUS + f.r) {
        f.used = true;
        f.pulse = 0.6;
        triggerFriendCombo(f);
      }
    }
  }

  function isFriendOwnerDown(f) {
    var p = state.player;
    if (!p || !p.partyDown || f.ownerIndex === undefined || f.ownerIndex === 0) { return false; }
    if (!p.partyMembers || !p.partyMembers[f.ownerIndex]) { return false; }
    return p.partyDown.indexOf(p.partyMembers[f.ownerIndex].charId) >= 0;
  }

  function checkGears() {
    var b = state.ball;
    var boosted = false;
    for (var i = 0; i < state.gears.length; i += 1) {
      var g = state.gears[i];
      var inside = b.x > g.x - BALL_RADIUS && b.x < g.x + g.w + BALL_RADIUS &&
        b.y > g.y - BALL_RADIUS && b.y < g.y + g.h + BALL_RADIUS;
      if (inside && !g.occupied && g.cooldown <= 0) {
        g.occupied = true;
        g.cooldown = GEAR_COOLDOWN;
        g.glow = 0.7;
        var before = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (before < GEAR_MAX_INPUT_SPEED) {
          b.vx *= GEAR_BOOST;
          b.vy *= GEAR_BOOST;
        }
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > 1) {
          var dvx = Math.cos(g.dirRad) * sp;
          var dvy = Math.sin(g.dirRad) * sp;
          b.vx = lerp(b.vx, dvx, GEAR_DIR_BLEND);
          b.vy = lerp(b.vy, dvy, GEAR_DIR_BLEND);
        }
        sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > MAX_SPEED) {
          var k = MAX_SPEED / sp;
          b.vx *= k;
          b.vy *= k;
        }
        b.bounce = Math.min(b.bounce + 1, b.maxBounce);
        addCombo(1);
        addParticles(b.x, b.y, 10, '#ffe45c', 170, 2.4);
        addRing(b.x, b.y, 30, '#ffe45c', 0.28, 2);
        Sfx.gear();
        boosted = true;
      } else if (!inside && g.occupied) {
        g.occupied = false;
      }
    }
    return boosted;
  }

  function checkWarps() {
    var b = state.ball;
    if (state.warpCooldown > 0 || state.warps.length < 2) { return false; }
    for (var i = 0; i < state.warps.length; i += 1) {
      var w = state.warps[i];
      if (dist(b.x, b.y, w.x, w.y) > w.r * 0.8) { continue; }
      var other = state.warps[(i + 1) % state.warps.length];
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.x = other.x;
      b.y = other.y;
      if (sp > 0.001) {
        b.x += (b.vx / sp) * (other.r + BALL_RADIUS + 2);
        b.y += (b.vy / sp) * (other.r + BALL_RADIUS + 2);
      }
      b.x = clamp(b.x, FIELD.x + BALL_RADIUS, FIELD.x + FIELD.w - BALL_RADIUS);
      b.y = clamp(b.y, FIELD.y + BALL_RADIUS, FIELD.y + FIELD.h - BALL_RADIUS);
      b.vx *= WARP_EXIT_BOOST;
      b.vy *= WARP_EXIT_BOOST;
      state.warpCooldown = 0.35;
      w.pulse = 0.6;
      other.pulse = 0.6;
      addParticles(b.x, b.y, 12, '#b478ff', 180, 2.6);
      addRing(b.x, b.y, 34, '#b478ff', 0.32, 2);
      Sfx.warp();
      return true;
    }
    return false;
  }

  function updateBall(dt) {
    var b = state.ball;
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (speed < 0.001) {
      endShot();
      return;
    }
    var steps = Math.ceil((speed * dt) / SUBSTEP_PX);
    steps = clamp(steps, 1, MAX_SUBSTEPS);
    var sub = dt / steps;
    for (var i = 0; i < steps; i += 1) {
      b.x += b.vx * sub;
      b.y += b.vy * sub;
      collideWalls();
      collideObstacles();
      collideBarrels();
      collideEnemies();
      collideFriends();
      checkGears();
      checkWarps();
      if (b.vx === 0 && b.vy === 0) { break; }
    }
    /* マグヌス効果（回転による弾道の曲がり） */
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > 1 && Math.abs(b.omega) > 0.5) {
      var magAcc = b.omega * MAGNUS_K;
      var perpX = -b.vy / sp;
      var perpY = b.vx / sp;
      b.vx += perpX * magAcc * dt;
      b.vy += perpY * magAcc * dt;
    }
    /* 速度比例＋二乗抗力（低速は伸び、高速は速やかに減衰） */
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > 0.0001) {
      var decel = (LINEAR_DRAG * sp + QUAD_DRAG * sp * sp) * dt;
      var nextSp = Math.max(0, sp - decel);
      var scale = nextSp / sp;
      b.vx *= scale;
      b.vy *= scale;
    }
    b.omega *= Math.pow(0.5, dt * SPIN_DECAY);
    b.spin += (8 + b.omega * 0.4) * dt;
    b.life += dt;
    b.trail.push({ x: b.x, y: b.y, life: 0.34 });
    if (b.trail.length > 26) { b.trail.shift(); }
    if (b.life >= SHOT_MAX_TIME) {
      addRing(b.x, b.y, 34, '#8f7ec9', 0.3, 2);
      b.vx = 0;
      b.vy = 0;
      endShot();
      return;
    }
    var remain = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (remain < STOP_SPEED) {
      b.vx = 0;
      b.vy = 0;
      endShot();
    }
  }

  function endShot() {
    var b = state.ball;
    b.vx = 0;
    b.vy = 0;
    b.alive = false;
    b.trail.length = 0;
    state.phase = 'idle';
    resetCombo();
    updateHud();
    if (aliveEnemies().length === 0) {
      onWaveCleared();
      return;
    }
    if (state.player.shotsLeft <= 0) {
      startEnemyTurn();
    } else {
      showBanner('SHOT ' + (state.player.shotsLeft) + ' LEFT', '狙いを定めて引っ張れ', '');
    }
  }

  /* ==========================================================================
     9. 友情コンボ / タップバースト / エフェクト
     ========================================================================== */
  function spawnMissile(x, y, dmg, color) {
    state.missiles.push({
      x: x, y: y, vx: 0, vy: -220, dmg: dmg, color: color,
      life: 3.2, target: null, trail: []
    });
  }

  function triggerFriendCombo(friend) {
    var p = state.player;
    var fr = friend.friend || p.friend;
    var el = ELEMENTS[friend.element || p.element];
    var chainBonus = 1 + state.friendChain * FRIEND_CHAIN_STEP;
    var baseDamage = p.atk * fr.dmgMul * chainBonus;
    Sfx.friend();
    flashScreen('flash--friend');
    if (state.friendChain > 0) {
      showBanner('フレンドチェーン x' + (state.friendChain + 1), FRIEND_LABEL[fr.type] || '連携攻撃', 'friend');
    } else {
      showBanner('友情コンボ', (friend.ownerName ? friend.ownerName + ' / ' : '') + (FRIEND_LABEL[fr.type] || '連携攻撃'), 'friend');
    }
    showToast('友情コンボ『' + (FRIEND_LABEL[fr.type] || '連携攻撃') + '』' +
      (state.friendChain > 0 ? '（チェーン x' + (state.friendChain + 1) + '）' : '') + ' 発動！', '◎', 'synergy');
    state.friendChain = Math.min(state.friendChain + 1, FRIEND_CHAIN_MAX);
    state.friendChainTimer = FRIEND_CHAIN_WINDOW;
    state.duoMembers['m' + friend.ownerIndex] = true;
    checkDuoSkill();
    addRing(friend.x, friend.y, 46, el.color, 0.4, 3);
    addParticles(friend.x, friend.y, 22, el.color, 220, 2.8);
    var i;

    if (fr.type === 'homing') {
      for (i = 0; i < fr.count; i += 1) {
        var ang = (Math.PI * 2 * i) / fr.count + Math.PI / 2;
        spawnMissile(friend.x + Math.cos(ang) * 16, friend.y + Math.sin(ang) * 16, baseDamage, el.color);
      }
      addText(friend.x, friend.y - 34, fr.count + '発 追尾弾', el.color, 13, true);
    } else if (fr.type === 'laser') {
      var armCount = fr.count >= 2 ? 4 : 2;
      var baseAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      for (i = 0; i < armCount; i += 1) {
        var beamAngle = baseAngles[i];
        addLaser(friend.x, friend.y, beamAngle, fr.radius, el.color);
        var hitCount = 0;
        for (var e = 0; e < state.enemies.length; e += 1) {
          var enemy = state.enemies[e];
          if (!enemy.alive) { continue; }
          var dx = enemy.x - friend.x;
          var dy = enemy.y - friend.y;
          var along = dx * Math.cos(beamAngle) + dy * Math.sin(beamAngle);
          if (along < 0 || along > fr.radius) { continue; }
          var perp = Math.abs(-dx * Math.sin(beamAngle) + dy * Math.cos(beamAngle));
          if (perp > enemy.radius + 16) { continue; }
          strikeEnemy(enemy, baseDamage, { color: el.color, big: true });
          hitCount += 1;
        }
        if (hitCount > 0) { state.hitStop = Math.max(state.hitStop, HITSTOP_CRIT); }
      }
      addText(friend.x, friend.y - 34, '十字貫通', el.color, 13, true);
    } else {
      var radius = Math.max(40, fr.radius);
      addShockwave(friend.x, friend.y, radius, el.color);
      for (i = 0; i < state.enemies.length; i += 1) {
        var target = state.enemies[i];
        if (!target.alive) { continue; }
        if (dist(friend.x, friend.y, target.x, target.y) <= radius + target.radius) {
          strikeEnemy(target, baseDamage, { color: el.color, big: true });
        }
      }
      state.bullets = state.bullets.filter(function (bl) {
        return dist(friend.x, friend.y, bl.x, bl.y) > radius;
      });
      var label = fr.type === 'nova' ? '深淵吸引波' : '衝撃波';
      addText(friend.x, friend.y - 34, label, el.color, 13, true);
      if (fr.heal > 0) {
        healPlayer(p.maxHp * fr.heal, true);
        addText(friend.x, friend.y + 26, 'HP回復', '#6ef08a', 12, false);
      }
    }
  }

  function checkDuoSkill() {
    var p = state.player;
    if (state.duoFired) { return; }
    var need = p.partyMembers ? p.partyMembers.length : 1;
    var have = 0;
    for (var k in state.duoMembers) {
      if (state.duoMembers[k]) { have += 1; }
    }
    if (have < need || have < 2) { return; }
    state.duoFired = true;
    var damage = p.atk * 3.2;
    var radius = 220;
    applyTimeScale(TIMESCALE_BOSS);
    flashScreen('flash--evolve');
    shakeScreen(true);
    Sfx.evolution();
    showBanner('DUO SKILL', 'パーティ全員の友情コンボが共鳴！', 'friend');
    showToast('デュオスキル発動！全体攻撃', '★', 'synergy');
    addShockwave(LAUNCH_X, LAUNCH_Y, radius, '#ffe45c');
    addRing(LAUNCH_X, LAUNCH_Y, radius * 0.6, '#ffffff', 0.4, 4);
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      addLightning(LAUNCH_X, LAUNCH_Y, e.x, e.y, '#ffe45c');
      strikeEnemy(e, damage, { color: '#ffe45c', big: true });
    }
    state.bullets.length = 0;
    healPlayer(p.maxHp * 0.1, true);
  }

  function updateMissiles(dt) {
    for (var i = state.missiles.length - 1; i >= 0; i -= 1) {
      var m = state.missiles[i];
      var target = (m.target && m.target.alive) ? m.target : nearestEnemy(m.x, m.y, false);
      m.target = target;
      if (target) {
        var ang = Math.atan2(target.y - m.y, target.x - m.x);
        var desiredVx = Math.cos(ang) * 430;
        var desiredVy = Math.sin(ang) * 430;
        m.vx = lerp(m.vx, desiredVx, 0.16);
        m.vy = lerp(m.vy, desiredVy, 0.16);
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 9) { m.trail.shift(); }
      addParticles(m.x, m.y, 1, m.color, 40, 1.8);
      if (target && dist(m.x, m.y, target.x, target.y) <= target.radius + 7) {
        strikeEnemy(target, m.dmg, { color: m.color });
        addRing(m.x, m.y, 26, m.color, 0.26, 2);
        state.missiles.splice(i, 1);
        continue;
      }
      if (m.life <= 0 || m.x < FIELD.x - 30 || m.x > FIELD.x + FIELD.w + 30 ||
        m.y < FIELD.y - 30 || m.y > FIELD.y + FIELD.h + 30) {
        state.missiles.splice(i, 1);
      }
    }
  }

  function triggerBurst() {
    var p = state.player;
    var b = state.ball;
    if (state.phase !== 'moving' || p.burstUsed) { return false; }
    p.burstUsed = true;
    b.vx = 0;
    b.vy = 0;
    b.alive = false;
    Sfx.burst();
    flashScreen('flash--burst');
    shakeScreen(true);
    state.hitStop = Math.max(state.hitStop, HITSTOP_BURST);
    var damage = p.atk * BURST_DAMAGE_MUL * comboMultiplier();
    addShockwave(b.x, b.y, BURST_RADIUS, '#47d9ff');
    addRing(b.x, b.y, BURST_RADIUS * 0.6, '#ffffff', 0.3, 3);
    addParticles(b.x, b.y, 42, '#ffffff', 330, 3.2);
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      if (dist(b.x, b.y, e.x, e.y) <= BURST_RADIUS + e.radius) {
        strikeEnemy(e, damage, { color: '#47d9ff', big: true });
      }
    }
    var cleared = state.bullets.length;
    state.bullets.length = 0;
    if (cleared > 0) { addText(b.x, b.y - 46, '弾消し x' + cleared, '#47d9ff', 12, false); }
    addText(b.x, b.y - 28, 'TAP BURST', '#ffffff', 16, true);
    showBanner('TAP BURST', '半径80px 衝撃波', 'friend');
    updateHud();
    endShot();
    return true;
  }

  function fireEnemyVolley(enemy) {
    var b = state.ball;
    var count = Math.max(1, enemy.bullets);
    var baseAngle = Math.atan2(b.y - enemy.y, b.x - enemy.x);
    var spread = enemy.boss ? Math.PI * 2 : 0.55;
    for (var i = 0; i < count; i += 1) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      var ang = baseAngle + (t - 0.5) * spread;
      state.bullets.push({
        x: enemy.x + Math.cos(ang) * (enemy.radius + 5),
        y: enemy.y + Math.sin(ang) * (enemy.radius + 5),
        vx: Math.cos(ang) * enemy.bulletSpeed,
        vy: Math.sin(ang) * enemy.bulletSpeed,
        r: 6,
        dmg: enemy.bulletDmg,
        life: 6,
        color: enemy.color,
        spin: Math.random() * Math.PI * 2
      });
    }
    addRing(enemy.x, enemy.y, enemy.radius + 14, enemy.color, 0.26, 2);
    Sfx.enemyShot();
  }

  function startEnemyTurn() {
    var alive = aliveEnemies();
    if (alive.length === 0) {
      onWaveCleared();
      return;
    }
    state.phase = 'enemyturn';
    state.enemyTurnTimer = ENEMY_TURN_TIME;
    resetCombo();
    showBanner('ENEMY TURN', '敵の反撃！', 'danger');
    for (var i = 0; i < alive.length; i += 1) {
      for (var s = 0; s < alive[i].shots; s += 1) {
        fireEnemyVolley(alive[i]);
      }
    }
    updateHud();
  }

  function finishEnemyTurn() {
    var p = state.player;
    p.shotsLeft = p.shotsPerWave;
    state.phase = 'idle';
    state.ball.x = LAUNCH_X;
    state.ball.y = LAUNCH_Y;
    updateHud();
    showBanner('YOUR TURN', 'SHOT ' + p.shotsLeft, '');
  }

  function updateBullets(dt) {
    var b = state.ball;
    for (var i = state.bullets.length - 1; i >= 0; i -= 1) {
      var bl = state.bullets[i];
      bl.x += bl.vx * dt;
      bl.y += bl.vy * dt;
      bl.life -= dt;
      bl.spin += dt * 6;
      var out = bl.x < FIELD.x - 16 || bl.x > FIELD.x + FIELD.w + 16 ||
        bl.y < FIELD.y - 16 || bl.y > FIELD.y + FIELD.h + 16;
      if (out || bl.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }
      if (state.phase === 'gameover' || state.phase === 'result') { continue; }
      if (dist(bl.x, bl.y, b.x, b.y) <= bl.r + BALL_RADIUS) {
        state.bullets.splice(i, 1);
        addParticles(bl.x, bl.y, 10, bl.color, 160, 2.4);
        damagePlayer(bl.dmg, bl.x, bl.y);
      }
    }
  }

  function updateEnemies(dt) {
    var t = state.time;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (e.spawnAnim > 0) { e.spawnAnim -= dt; }
      if (e.hitFlash > 0) { e.hitFlash -= dt; }
      if (e.hitCd > 0) { e.hitCd -= dt; }
      if (!e.alive) {
        if (e.deathAnim > 0) { e.deathAnim -= dt; }
        continue;
      }
      e.coreAngle += e.coreSpin * dt;
      if (e.wander > 0) {
        e.x = e.homeX + Math.sin(t * 0.9 + e.wanderPhase) * e.wander;
        e.y = e.homeY + Math.cos(t * 0.7 + e.wanderPhase * 1.3) * e.wander * 0.6;
      }
      if (e.burn > 0) {
        e.burn -= dt;
        var tick = e.burnDps * dt;
        e.hp -= tick;
        if (Math.random() < 0.35) {
          addParticles(e.x, e.y - e.radius * 0.4, 1, '#ff6a3d', 60, 2);
        }
        if (e.hp <= 0) {
          killEnemy(e, { color: '#ff6a3d' });
          continue;
        }
      }
      if (!e.boss && e.hp < e.maxHp * 0.999) {
        var drift = (e.maxHp - e.hp) / e.maxHp;
        e.x += Math.sin(t * 2.4 + e.wanderPhase) * drift * 12 * dt;
        e.y += Math.cos(t * 2.1 + e.wanderPhase) * drift * 8 * dt;
        e.x = clamp(e.x, FIELD.x + e.radius, FIELD.x + FIELD.w - e.radius);
        e.y = clamp(e.y, FIELD.y + e.radius, FIELD.y + FIELD.h * 0.68);
      }
    }
  }

  function updateParticles(dt) {
    for (var i = state.particles.length - 1; i >= 0; i -= 1) {
      var p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); }
    }
  }

  function updateTexts(dt) {
    for (var i = state.texts.length - 1; i >= 0; i -= 1) {
      var tx = state.texts[i];
      tx.y += tx.vy * dt;
      tx.vy *= 0.94;
      tx.life -= dt;
      if (tx.life <= 0) { state.texts.splice(i, 1); }
    }
  }

  function updateEffects(dt) {
    for (var i = state.effects.length - 1; i >= 0; i -= 1) {
      var fx = state.effects[i];
      fx.life -= dt;
      if (fx.life <= 0) { state.effects.splice(i, 1); }
    }
  }

  /* ==========================================================================
     10. 描画（Canvas 480 x 700）
     ========================================================================== */
  function drawBackground() {
    var ctx = dom.ctx;
    var g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#0a0713');
    g.addColorStop(0.5, '#0e0a1c');
    g.addColorStop(1, '#06040c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = 'rgba(122, 63, 255, .12)';
    ctx.lineWidth = 1;
    var x;
    var y;
    for (x = FIELD.x; x <= FIELD.x + FIELD.w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, FIELD.y);
      ctx.lineTo(x, FIELD.y + FIELD.h);
      ctx.stroke();
    }
    for (y = FIELD.y; y <= FIELD.y + FIELD.h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(FIELD.x, y);
      ctx.lineTo(FIELD.x + FIELD.w, y);
      ctx.stroke();
    }

    if (state.player) {
      var el = ELEMENTS[state.player.element];
      var rg = ctx.createRadialGradient(LAUNCH_X, LAUNCH_Y, 8, LAUNCH_X, LAUNCH_Y, 200);
      rg.addColorStop(0, el.color);
      rg.addColorStop(0.15, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = rg;
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      ctx.restore();
    }
  }

  function drawWalls() {
    var ctx = dom.ctx;
    ctx.save();
    ctx.strokeStyle = '#57457f';
    ctx.lineWidth = 8;
    ctx.shadowColor = 'rgba(122, 63, 255, .55)';
    ctx.shadowBlur = 12;
    ctx.strokeRect(FIELD.x - 4, FIELD.y - 4, FIELD.w + 8, FIELD.h + 8);
    ctx.restore();

    ctx.strokeStyle = 'rgba(236, 231, 251, .16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(FIELD.x - 1, FIELD.y - 1, FIELD.w + 2, FIELD.h + 2);
  }

  function drawObstacles() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.obstacles.length; i += 1) {
      var o = state.obstacles[i];
      ctx.fillStyle = '#1b1430';
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(o.x, o.y, o.w, o.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(122, 63, 255, .3)';
      ctx.lineWidth = 1;
      for (var d = 0; d < o.w + o.h; d += 12) {
        ctx.beginPath();
        ctx.moveTo(o.x + d, o.y);
        ctx.lineTo(o.x + d - o.h, o.y + o.h);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, .09)';
      ctx.fillRect(o.x, o.y, o.w, 3);
      ctx.fillStyle = 'rgba(0, 0, 0, .5)';
      ctx.fillRect(o.x, o.y + o.h - 3, o.w, 3);
      ctx.strokeStyle = o.flash > 0 ? '#ffffff' : '#57457f';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    }
  }

  function drawBarrels() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.barrels.length; i += 1) {
      var b = state.barrels[i];
      if (!b.alive) { continue; }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = b.hitFlash > 0 ? '#fff0d0' : '#7a3a12';
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : '#a85a1e';
      ctx.beginPath();
      ctx.arc(0, 0, b.r - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9a3d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, b.r - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2a1206';
      for (var s = 0; s < b.hp; s += 1) {
        ctx.fillRect(-8 + s * 6, -14, 5, 5);
      }
      ctx.fillStyle = '#ffd9a0';
      ctx.font = 'bold 10px "MS Gothic", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('爆', 0, 1);
      ctx.restore();
    }
  }

  function drawGears() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.gears.length; i += 1) {
      var g = state.gears[i];
      ctx.save();
      ctx.fillStyle = 'rgba(71, 217, 255, .16)';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = '#ffe45c';
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
      ctx.fillStyle = '#ffe45c';
      var offset = (state.time * 60) % 24;
      for (var a = offset; a < g.w; a += 24) {
        if (a < 6 || a > g.w - 10) { continue; }
        ctx.beginPath();
        ctx.moveTo(g.x + a, g.y + 4);
        ctx.lineTo(g.x + a + 8, g.y + g.h / 2);
        ctx.lineTo(g.x + a, g.y + g.h - 4);
        ctx.closePath();
        ctx.fill();
      }
      if (g.glow > 0) {
        ctx.globalAlpha = clamp(g.glow * 1.6, 0, 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(g.x, g.y, g.w, g.h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  function drawWarps() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.warps.length; i += 1) {
      var w = state.warps[i];
      ctx.save();
      ctx.translate(w.x, w.y);
      var pulse = 1 + Math.sin(state.time * 4 + i) * 0.08 + w.pulse;
      ctx.strokeStyle = '#b478ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, w.r * 1.5 * pulse, w.r * 0.95 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180, 120, 255, .45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, w.r * pulse, w.r * 0.62 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(180, 120, 255, .22)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w.r * 0.6, w.r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e5d4ff';
      ctx.font = 'bold 9px "MS Gothic", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 0 ? 'IN' : 'OUT', 0, -w.r - 6);
      ctx.restore();
    }
  }

  function drawLaunchPad() {
    var ctx = dom.ctx;
    var el = ELEMENTS[state.player.element];
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(LAUNCH_X, LAUNCH_Y, 26 + Math.sin(state.time * 3) * 2, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = el.color;
    ctx.beginPath();
    ctx.ellipse(LAUNCH_X, LAUNCH_Y, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFriends() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.friends.length; i += 1) {
      var f = state.friends[i];
      var color = f.color || ELEMENTS[state.player.element].color;
      var down = isFriendOwnerDown(f);
      ctx.save();
      ctx.translate(f.x, f.y);
      var pulse = 1 + Math.sin(state.time * 3.4 + i * 1.7) * 0.07;
      var dim = f.used || down;
      ctx.globalAlpha = dim ? 0.28 : 1;
      ctx.fillStyle = dim ? '#3b2f5c' : color;
      ctx.beginPath();
      ctx.arc(0, 0, f.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = dim ? 0.4 : 1;
      ctx.strokeStyle = dim ? '#57457f' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, f.r * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dim ? '#7c719e' : '#0b0813';
      ctx.font = 'bold 11px "MS Gothic", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String.fromCharCode(65 + i), 0, 1);
      if (state.friendChain > 0 && !f.used) {
        ctx.fillStyle = '#ffe45c';
        ctx.font = 'bold 9px "MS Gothic", monospace';
        ctx.fillText('x' + (state.friendChain + 1), 0, -f.r - 6);
      }
      ctx.restore();
    }
  }

  function drawEnemies() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive && e.deathAnim <= 0) { continue; }
      var scale = e.alive ? 1 : Math.max(0, e.deathAnim / 0.3);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.spawnAnim > 0) {
        var spawnT = 1 - clamp(e.spawnAnim / 0.45, 0, 1);
        ctx.scale(lerp(0.4, scale, spawnT), lerp(0.4, scale, spawnT));
        ctx.globalAlpha = lerp(0.35, 1, spawnT);
      } else {
        ctx.scale(scale, scale);
        ctx.globalAlpha = e.alive ? 1 : 0.6;
      }

      ctx.fillStyle = e.dark;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, .55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (e.boss) {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-e.radius * 0.6, -e.radius * 0.7);
        ctx.lineTo(-e.radius * 0.95, -e.radius * 1.35);
        ctx.moveTo(e.radius * 0.6, -e.radius * 0.7);
        ctx.lineTo(e.radius * 0.95, -e.radius * 1.35);
        ctx.stroke();
      }

      ctx.fillStyle = '#0b0813';
      var eyeOffset = e.radius * 0.32;
      var eyeSize = e.boss ? 5 : 3;
      ctx.fillRect(-eyeOffset - eyeSize, -eyeSize * 0.6, eyeSize * 2, eyeSize * 1.6);
      ctx.fillRect(eyeOffset - eyeSize, -eyeSize * 0.6, eyeSize * 2, eyeSize * 1.6);

      if (e.burn > 0) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#ff6a3d';
        ctx.beginPath();
        ctx.arc(rand(-e.radius * 0.5, e.radius * 0.5), rand(-e.radius * 0.6, 0), rand(2, 4.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      var core = corePosition(e);
      ctx.save();
      ctx.translate(core.x - e.x, core.y - e.y);
      ctx.rotate(e.coreAngle * 0.6);
      ctx.strokeStyle = '#47d9ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, CORE_RADIUS + 1, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, CORE_RADIUS + 1, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
      ctx.restore();

      var corePulse = 1 + Math.sin(state.time * 8) * 0.18;
      ctx.fillStyle = 'rgba(71, 217, 255, .35)';
      ctx.beginPath();
      ctx.arc(core.x - e.x, core.y - e.y, CORE_RADIUS * 1.5 * corePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(core.x - e.x, core.y - e.y, CORE_RADIUS * 0.62 * corePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (e.alive && !e.boss) {
        var w = e.radius * 2.2;
        var ratio = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, .7)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        ctx.fillStyle = ratio > 0.4 ? '#6ef08a' : '#ff2d55';
        ctx.fillRect(e.x - w / 2 + 1, e.y - e.radius - 11, (w - 2) * ratio, 3);
      }
    }
  }

  function drawBullets() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.bullets.length; i += 1) {
      var bl = state.bullets[i];
      ctx.save();
      ctx.translate(bl.x, bl.y);
      ctx.rotate(bl.spin);
      ctx.fillStyle = bl.color;
      ctx.beginPath();
      ctx.arc(0, 0, bl.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .85)';
      ctx.beginPath();
      ctx.arc(0, 0, bl.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-bl.r - 4, 0);
      ctx.lineTo(-bl.r - 10, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMissiles() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.missiles.length; i += 1) {
      var m = state.missiles[i];
      for (var t = 0; t < m.trail.length; t += 1) {
        var tp = m.trail[t];
        ctx.globalAlpha = (t / m.trail.length) * 0.5;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 5 * (t / m.trail.length) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBall() {
    var ctx = dom.ctx;
    var b = state.ball;
    var el = ELEMENTS[state.player.element];
    var i;
    for (i = 0; i < b.trail.length; i += 1) {
      var tp = b.trail[i];
      ctx.globalAlpha = (i / b.trail.length) * 0.45;
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, BALL_RADIUS * (0.35 + (i / b.trail.length) * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = el.color;
    ctx.shadowBlur = b.alive ? 16 : 8;
    ctx.fillStyle = el.dark;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.alive ? '#ffffff' : '#d9d2ef';
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS - 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-BALL_RADIUS + 2, 0);
    ctx.lineTo(BALL_RADIUS - 2, 0);
    ctx.moveTo(0, -BALL_RADIUS + 2);
    ctx.lineTo(0, BALL_RADIUS - 2);
    ctx.stroke();
    ctx.restore();

    if (b.alive && b.bounce > 0) {
      ctx.fillStyle = '#ffe45c';
      for (i = 0; i < b.bounce; i += 1) {
        ctx.fillRect(b.x - b.bounce * 3 + i * 6 + 2, b.y + BALL_RADIUS + 6, 4, 4);
      }
    }
    if (b.alive && state.combo > 1) {
      ctx.save();
      ctx.fillStyle = '#ff8f6a';
      ctx.font = 'bold 11px "MS Gothic", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x' + state.combo, b.x, b.y - BALL_RADIUS - 8);
      ctx.restore();
    }
  }

  /* ---- ゴースト弾道（本物の物理をそのまま予測計算） ---- */
  function simulateShot(dirX, dirY, power) {
    var p = state.player;
    var speed = launchSpeed(power, p.speedMul);
    var sim = {
      x: LAUNCH_X, y: LAUNCH_Y,
      vx: dirX * speed, vy: dirY * speed,
      omega: 0
    };
    var points = [];
    var hits = [];
    var coreHit = null;
    var combo = 0;
    var damage = 0;
    var dt = 1 / 60;
    var elapsed = 0;
    var bounces = 0;
    var steps = 0;
    var gearFlags = {};
    var enemyFlags = {};
    while (elapsed < 2.2 && bounces < 8 && steps < 170) {
      steps += 1;
      var sp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
      if (sp < 1) { break; }
      var sub = clamp(Math.ceil((sp * dt) / SUBSTEP_PX), 1, 12);
      var h = dt / sub;
      var si;
      for (si = 0; si < sub; si += 1) {
        sim.x += sim.vx * h;
        sim.y += sim.vy * h;

        if (sim.x - BALL_RADIUS < FIELD.x) {
          sim.x = FIELD.x + BALL_RADIUS;
          sim.vx = Math.abs(sim.vx) * MATERIALS.wall.restitution;
          bounces += 1;
        } else if (sim.x + BALL_RADIUS > FIELD.x + FIELD.w) {
          sim.x = FIELD.x + FIELD.w - BALL_RADIUS;
          sim.vx = -Math.abs(sim.vx) * MATERIALS.wall.restitution;
          bounces += 1;
        }
        if (sim.y - BALL_RADIUS < FIELD.y) {
          sim.y = FIELD.y + BALL_RADIUS;
          sim.vy = Math.abs(sim.vy) * MATERIALS.wall.restitution;
          bounces += 1;
        } else if (sim.y + BALL_RADIUS > FIELD.y + FIELD.h) {
          sim.y = FIELD.y + FIELD.h - BALL_RADIUS;
          sim.vy = -Math.abs(sim.vy) * MATERIALS.wall.restitution;
          bounces += 1;
        }

        var oi;
        for (oi = 0; oi < state.obstacles.length; oi += 1) {
          var ob = state.obstacles[oi];
          var ccx = clamp(sim.x, ob.x, ob.x + ob.w);
          var ccy = clamp(sim.y, ob.y, ob.y + ob.h);
          var ddx = sim.x - ccx;
          var ddy = sim.y - ccy;
          var dd2 = ddx * ddx + ddy * ddy;
          if (dd2 > BALL_RADIUS * BALL_RADIUS) { continue; }
          var dd = Math.sqrt(dd2);
          var nnx = dd > 0.001 ? ddx / dd : 0;
          var nny = dd > 0.001 ? ddy / dd : -1;
          var vvn = sim.vx * nnx + sim.vy * nny;
          sim.vx = (sim.vx - 2 * vvn * nnx) * MATERIALS.obstacle.restitution;
          sim.vy = (sim.vy - 2 * vvn * nny) * MATERIALS.obstacle.restitution;
          bounces += 1;
        }

        var gi;
        for (gi = 0; gi < state.gears.length; gi += 1) {
          var g = state.gears[gi];
          var inside = sim.x > g.x - BALL_RADIUS && sim.x < g.x + g.w + BALL_RADIUS &&
            sim.y > g.y - BALL_RADIUS && sim.y < g.y + g.h + BALL_RADIUS;
          if (inside && !gearFlags['g' + gi]) {
            gearFlags['g' + gi] = true;
            var gsp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
            if (gsp < GEAR_MAX_INPUT_SPEED) {
              sim.vx *= GEAR_BOOST;
              sim.vy *= GEAR_BOOST;
            }
            gsp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
            if (gsp > 1) {
              sim.vx = lerp(sim.vx, Math.cos(g.dirRad) * gsp, GEAR_DIR_BLEND);
              sim.vy = lerp(sim.vy, Math.sin(g.dirRad) * gsp, GEAR_DIR_BLEND);
            }
          } else if (!inside) {
            gearFlags['g' + gi] = false;
          }
        }

        var wi;
        for (wi = 0; wi < state.warps.length; wi += 1) {
          var w = state.warps[wi];
          if (dist(sim.x, sim.y, w.x, w.y) > w.r * 0.8) { continue; }
          var other = state.warps[(wi + 1) % state.warps.length];
          var wsp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy) || 1;
          sim.x = other.x + (sim.vx / wsp) * (other.r + BALL_RADIUS + 2);
          sim.y = other.y + (sim.vy / wsp) * (other.r + BALL_RADIUS + 2);
          break;
        }

        var ei;
        for (ei = 0; ei < state.enemies.length; ei += 1) {
          var en = state.enemies[ei];
          if (!en.alive || enemyFlags['e' + ei]) { continue; }
          var ed = dist(sim.x, sim.y, en.x, en.y);
          if (ed > BALL_RADIUS + en.radius) { continue; }
          var core = corePosition(en);
          var weak = dist(sim.x, sim.y, core.x, core.y) <= CORE_RADIUS + BALL_RADIUS;
          if (weak && !coreHit) { coreHit = { x: core.x, y: core.y }; }
          hits.push({ x: sim.x, y: sim.y, weak: weak });
          enemyFlags['e' + ei] = true;
          combo += 1;
          damage += p.atk * (weak ? 3 * (1 + p.weakBonus) : 1);
          var enx = (sim.x - en.x) / (ed || 1);
          var eny = (sim.y - en.y) / (ed || 1);
          var evn = sim.vx * enx + sim.vy * eny;
          sim.vx = (sim.vx - 2 * evn * enx) * MATERIALS.enemy.restitution;
          sim.vy = (sim.vy - 2 * evn * eny) * MATERIALS.enemy.restitution;
        }
      }
      elapsed += dt;
      if (steps % 2 === 0) { points.push({ x: sim.x, y: sim.y }); }
      sp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
      if (sp > 0.0001) {
        var decel = (LINEAR_DRAG * sp + QUAD_DRAG * sp * sp) * dt;
        var k = Math.max(0, sp - decel) / sp;
        sim.vx *= k;
        sim.vy *= k;
      }
    }
    return { points: points, hits: hits, coreHit: coreHit, combo: combo, damage: Math.round(damage) };
  }

  function drawAimGuide() {
    var ctx = dom.ctx;
    if (state.phase !== 'idle' && state.phase !== 'aiming') { return; }
    var aim = state.aim;
    var el = ELEMENTS[state.player.element];

    if (aim.active && aim.power > 0.02) {
      var ghost = aim.ghost || simulateShot(aim.dirX, aim.dirY, aim.power);
      var points = ghost.points;
      for (var i = 0; i < points.length; i += 1) {
        ctx.globalAlpha = 0.6 - (i / points.length) * 0.45;
        ctx.fillStyle = el.color;
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 3.2 - (i / points.length) * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (var h = 0; h < ghost.hits.length; h += 1) {
        var hx = ghost.hits[h];
        ctx.strokeStyle = hx.weak ? '#47d9ff' : '#ff8f6a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx.x, hx.y, hx.weak ? 11 : 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (ghost.coreHit) {
        ctx.strokeStyle = '#ff2d55';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ghost.coreHit.x - 9, ghost.coreHit.y);
        ctx.lineTo(ghost.coreHit.x + 9, ghost.coreHit.y);
        ctx.moveTo(ghost.coreHit.x, ghost.coreHit.y - 9);
        ctx.lineTo(ghost.coreHit.x, ghost.coreHit.y + 9);
        ctx.stroke();
      }

      var arrowLen = 30 + aim.power * 70;
      var tipX = LAUNCH_X + aim.dirX * arrowLen;
      var tipY = LAUNCH_Y + aim.dirY * arrowLen;
      ctx.strokeStyle = aim.locked ? '#ffe45c' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(LAUNCH_X, LAUNCH_Y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(Math.atan2(aim.dirY, aim.dirX));
      ctx.fillStyle = aim.locked ? '#ffe45c' : el.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, -7);
      ctx.lineTo(-14, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(236, 231, 251, .45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(aim.originX, aim.originY);
      ctx.lineTo(aim.pointerX, aim.pointerY);
      ctx.stroke();
      ctx.setLineDash([]);

      var barW = 9;
      var barH = 120;
      var barX = FIELD.x + 8;
      var barY = FIELD.y + FIELD.h - barH - 8;
      ctx.fillStyle = 'rgba(0, 0, 0, .55)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = aim.locked ? '#ffe45c' : (aim.power > 0.8 ? '#ff2d55' : (aim.power > 0.5 ? '#f2c75c' : '#47d9ff'));
      ctx.fillRect(barX, barY + barH * (1 - aim.power), barW, barH * aim.power);
      ctx.strokeStyle = aim.locked ? '#ffe45c' : '#57457f';
      ctx.lineWidth = aim.locked ? 2 : 1;
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px "MS Gothic", monospace';
      ctx.fillStyle = '#ffe45c';
      ctx.fillText('PW ' + Math.round(aim.power * 100) + '%' + (aim.flick > 0.2 ? ' / FLICK' : ''), barX + barW + 5, barY + 10);
      if (aim.locked) {
        ctx.fillStyle = '#ffe45c';
        ctx.fillText('LOCK', barX + barW + 5, barY + 24);
      }
      ctx.fillStyle = ghost.hits.length > 0 ? '#ff8f6a' : 'rgba(236, 231, 251, .6)';
      ctx.fillText('HIT ' + ghost.hits.length + ' / 与ダメ ' + ghost.damage, barX + barW + 5, barY + 38);
      if (state.player.shotsLeft <= 1) {
        ctx.fillStyle = '#47d9ff';
        ctx.fillText('ASSIST ON', barX + barW + 5, barY + 52);
      }
    } else if (state.phase === 'idle') {
      ctx.fillStyle = 'rgba(236, 231, 251, .5)';
      ctx.font = '11px "MS Gothic", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('引っ張って離すと射出', LAUNCH_X, LAUNCH_Y + 36);
    }
  }

  function drawEffects() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.effects.length; i += 1) {
      var fx = state.effects[i];
      var t = clamp(fx.life / fx.maxLife, 0, 1);
      ctx.save();
      if (fx.kind === 'ring' || fx.kind === 'shockwave') {
        var grow = fx.kind === 'shockwave'
          ? lerp(fx.radius * 0.35, fx.radius, 1 - t)
          : fx.radius * lerp(0.6, 1.25, 1 - t);
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.width * t + 1;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, Math.max(2, grow), 0, Math.PI * 2);
        ctx.stroke();
        if (fx.kind === 'shockwave') {
          ctx.globalAlpha = t * 0.22;
          ctx.fillStyle = fx.color;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, Math.max(2, grow), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.kind === 'lightning') {
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = fx.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(fx.points[0].x, fx.points[0].y);
        for (var p = 1; p < fx.points.length; p += 1) {
          ctx.lineTo(fx.points[p].x, fx.points[p].y);
        }
        ctx.stroke();
      } else if (fx.kind === 'laser') {
        ctx.globalAlpha = t;
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);
        var grad = ctx.createLinearGradient(0, 0, Math.max(1, fx.length), 0);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, fx.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, (-fx.width / 2) * t, fx.length, fx.width * t);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -1.5, fx.length * 0.9, 3);
      } else if (fx.kind === 'flash') {
        ctx.globalAlpha = t * 0.85;
        var fg = ctx.createRadialGradient(fx.x, fx.y, 1, fx.x, fx.y, fx.radius);
        fg.addColorStop(0, '#ffffff');
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    var ctx = dom.ctx;
    for (var i = 0; i < state.particles.length; i += 1) {
      var p = state.particles[i];
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    var ctx = dom.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < state.texts.length; i += 1) {
      var tx = state.texts[i];
      ctx.globalAlpha = clamp(tx.life / tx.maxLife, 0, 1);
      ctx.font = 'bold ' + tx.size + 'px "MS Gothic", monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, .85)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }

  function renderCanvas() {
    var ctx = dom.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!state.player) {
      ctx.fillStyle = '#07050d';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    drawBackground();
    drawWalls();
    drawObstacles();
    drawGears();
    drawWarps();
    drawBarrels();
    drawLaunchPad();
    drawFriends();
    drawAimGuide();
    drawEnemies();
    drawBullets();
    drawMissiles();
    drawBall();
    drawEffects();
    drawParticles();
    drawTexts();
  }

  /* ==========================================================================
     11. HUD & 演出（DOM）
     ========================================================================== */
  var shakeTimer = 0;
  var toastTimer = 0;

  function renderSkillChips(force) {
    var p = state.player;
    var chipHash = JSON.stringify(p.skills) + JSON.stringify(p.synergy);
    if (!force && state.chipHash === chipHash) { return; }
    state.chipHash = chipHash;
    var host = dom.hudSkills;
    if (!host) { return; }
    clear(host);
    for (var i = 0; i < SKILLS.length; i += 1) {
      var def = SKILLS[i];
      var level = p.skills[def.id] || 0;
      if (level <= 0) { continue; }
      var chip = cloneTemplate('tpl-skill-chip');
      if (!chip) { continue; }
      fillFields(chip, { glyph: def.glyph, name: def.name, level: 'Lv' + level });
      var contributes = false;
      for (var s = 0; s < SYNERGIES.length; s += 1) {
        var syn = SYNERGIES[s];
        if (!p.synergy[syn.id]) { continue; }
        for (var r = 0; r < syn.requires.length; r += 1) {
          if (def.tags.indexOf(syn.requires[r]) >= 0) { contributes = true; }
        }
      }
      if (contributes) { chip.classList.add('is-synergy'); }
      chip.setAttribute('data-tags', def.tags.join(' '));
      host.appendChild(chip);
    }
  }

  function renderPartyPips() {
    var host = dom.hudParty;
    var p = state.player;
    if (!host || !p) { return; }
    var members = p.partyMembers || [];
    clear(host);
    for (var i = 0; i < members.length; i += 1) {
      var m = members[i];
      var pip = document.createElement('span');
      pip.className = 'party-pip' + (i === 0 ? ' is-main' : '');
      pip.setAttribute('data-element', m.element);
      var down = (p.partyDown || []).indexOf(m.charId) >= 0;
      if (down) { pip.classList.add('is-down'); }
      var glyph = document.createElement('b');
      glyph.className = 'party-pip-glyph';
      glyph.textContent = m.glyph;
      pip.appendChild(glyph);
      var name = document.createElement('span');
      name.textContent = (i === 0 ? 'MAIN ' : 'SUB ' + i + ' ') + (down ? '×' : m.name);
      pip.appendChild(name);
      var role = document.createElement('span');
      role.className = 'party-pip-role';
      role.textContent = m.role.label;
      pip.appendChild(role);
      host.appendChild(pip);
    }
  }

  function updateHud() {
    if (!state || !state.player) { return; }
    var p = state.player;
    var el = ELEMENTS[p.element];
    setText(dom.hudCharName, p.name);
    setText(dom.hudPortraitGlyph, p.glyph);
    setText(dom.hudCharStars, stars(p.star));
    setText(dom.hudCharLuck, 'LUCK ' + p.luck);
    if (dom.hudCharElement) {
      dom.hudCharElement.textContent = el.label;
      dom.hudCharElement.setAttribute('data-element', p.element);
    }
    var ratio = clamp(p.hp / p.maxHp, 0, 1);
    setStyle(dom.hudHpFill, 'width', (ratio * 100).toFixed(2) + '%');
    setText(dom.hudHpText, Math.ceil(p.hp) + ' / ' + p.maxHp);
    setClass(dom.hudHp, 'hp-low', ratio <= 0.5 && ratio > 0.25);
    setClass(dom.hudHp, 'hp-critical', ratio <= 0.25);
    setText(dom.hudStage, stageIndexToKey(state.stageIndex));
    setText(dom.hudWave, state.waveIndex + ' / ' + WAVES_PER_STAGE);
    setText(dom.hudGold, fmtNum(save.gold));
    setText(dom.hudShots, p.shotsLeft);
    if (dom.hudShots) { setClass(dom.hudShots.closest('.hud-stat'), 'is-warning', p.shotsLeft <= 1); }
    setClass(dom.hudCombo, 'is-hidden', state.combo < 2);
    setText(dom.hudComboCount, state.combo);
    setText(dom.hudComboMult, 'x' + comboMultiplier().toFixed(2));
    var boss = bossAlive();
    setClass(dom.hudBoss, 'is-hidden', !boss);
    if (boss) {
      setText(dom.hudBossName, boss.name);
      setStyle(dom.hudBossFill, 'width', (clamp(boss.hp / boss.maxHp, 0, 1) * 100).toFixed(2) + '%');
    }
    var burstUsed = p.burstUsed || state.phase !== 'moving';
    setClass(dom.hudBurst, 'is-used', burstUsed);
    if (state.phase === 'moving') {
      setText(dom.hudBurstState, p.burstUsed ? 'USED' : 'READY');
    } else {
      setText(dom.hudBurstState, 'STANDBY');
    }
    renderSkillChips(false);
    renderPartyPips();
  }

  function showBanner(text, sub, variant) {
    if (!dom.bannerLayer) { return; }
    var node = cloneTemplate('tpl-banner');
    if (!node) { return; }
    fillFields(node, { text: text, sub: sub || '' });
    if (variant) { node.classList.add('banner--' + variant); }
    dom.bannerLayer.appendChild(node);
    void node.offsetWidth;
    node.classList.add('is-show');
    window.setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, 1560);
    while (dom.bannerLayer.children.length > 3) {
      dom.bannerLayer.removeChild(dom.bannerLayer.firstChild);
    }
  }

  function showToast(text, icon, variant) {
    if (!dom.toastLayer) { return; }
    var node = cloneTemplate('tpl-toast');
    if (!node) { return; }
    fillFields(node, { icon: icon || '★', text: text });
    if (variant) { node.classList.add('toast--' + variant); }
    dom.toastLayer.appendChild(node);
    void node.offsetWidth;
    node.classList.add('is-show');
    window.setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, 1950);
    while (dom.toastLayer.children.length > 4) {
      dom.toastLayer.removeChild(dom.toastLayer.firstChild);
    }
  }

  function flashScreen(variant) {
    var el = dom.flashLayer;
    if (!el) { return; }
    el.className = '';
    if (variant) { el.classList.add(variant); }
    void el.offsetWidth;
    el.classList.add('is-active');
    var duration = variant === 'flash--evolve' ? 1150 : 320;
    window.setTimeout(function () {
      el.classList.remove('is-active');
    }, duration);
  }

  function shakeScreen(hard) {
    var shell = dom.shell;
    if (!shell) { return; }
    var cls = hard ? 'is-shaking-hard' : 'is-shaking';
    shell.classList.remove('is-shaking');
    shell.classList.remove('is-shaking-hard');
    void shell.offsetWidth;
    shell.classList.add(cls);
    window.clearTimeout(shakeTimer);
    shakeTimer = window.setTimeout(function () {
      shell.classList.remove(cls);
    }, hard ? 480 : 320);
  }

  function setSoundUi() {
    var on = Sound.isEnabled();
    if (dom.soundIcon) { dom.soundIcon.textContent = on ? '♪' : '✕'; }
    if (dom.soundLabel) { dom.soundLabel.textContent = on ? 'ON' : 'OFF'; }
    setClass(dom.soundBtn, 'is-off', !on);
    setClass(dom.soundBtn, 'is-active', on);
    if (dom.pauseSoundLabel) { dom.pauseSoundLabel.textContent = on ? 'ON' : 'OFF'; }
  }

  function makeStatRow(label, value, valueClass) {
    var node = cloneTemplate('tpl-stat-row');
    if (!node) { return null; }
    fillFields(node, { label: label, value: value });
    if (valueClass) {
      var v = node.querySelector('[data-field="value"]');
      if (v) { v.classList.add(valueClass); }
    }
    return node;
  }

  function fillStatList(host, rows) {
    if (!host) { return; }
    clear(host);
    for (var i = 0; i < rows.length; i += 1) {
      var node = makeStatRow(rows[i].label, rows[i].value, rows[i].cls);
      if (node) { host.appendChild(node); }
    }
  }

  function makeDropRow(entry) {
    var node = cloneTemplate('tpl-drop-row');
    if (!node) { return null; }
    node.setAttribute('data-rarity', entry.rarity || 'normal');
    fillFields(node, {
      name: entry.name,
      rarity: RARITIES[entry.rarity || 'normal'].label,
      note: entry.note || ''
    });
    return node;
  }

  function makeItemCard(item, equipped) {
    var card = cloneTemplate('tpl-item-card');
    if (!card) { return null; }
    card.setAttribute('data-rarity', item.rarity);
    card.setAttribute('data-uid', item.uid);
    var opts = item.opts.map(function (op) {
      var label = op.label;
      if (!op.curse) {
        var bonus = itemPlusBonus(item, op);
        if (bonus > 0) { label += '（＋' + item.plus + ' 補正 +' + bonus + '）'; }
      }
      return { text: label, cls: op.curse ? 'is-curse' : '' };
    });
    fillFields(card, {
      slot: SLOT_LABEL[item.slot],
      name: item.name,
      rarity: RARITIES[item.rarity].label,
      plus: item.plus ? '＋' + item.plus : '',
      opts: opts,
      note: compareItems(item),
      sell: itemSellValue(item)
    });
    if (equipped) { card.classList.add('is-equipped'); }
    if (item.locked) { card.classList.add('is-locked'); }
    var fuseBtn = card.querySelector('[data-action="fuse"]');
    if (fuseBtn) {
      var partner = findFusePartner(item);
      fuseBtn.disabled = (!partner) || !!item.locked;
      fuseBtn.textContent = partner ? '合成（素材1）' : '素材なし';
    }
    var purgeBtn = card.querySelector('[data-action="purge"]');
    if (purgeBtn) {
      var cursed = itemHasCurse(item);
      purgeBtn.disabled = !cursed;
      purgeBtn.textContent = cursed ? '浄化 ' + PURGE_COST + 'G' : '浄化 ✕';
    }
    var lockBtn = card.querySelector('[data-action="lock"]');
    if (lockBtn) { lockBtn.textContent = item.locked ? 'ロック解除' : 'ロック'; }
    return card;
  }

  function makeCharCard(charId, opts) {
    var options = opts || {};
    var card = cloneTemplate('tpl-char-card');
    if (!card) { return null; }
    var def = getCharDef(charId);
    var owned = !!save.chars[charId];
    var star = owned ? save.chars[charId].star : 3;
    var ev = getEvolution(charId, star);
    card.setAttribute('data-char-id', charId);
    card.setAttribute('data-element', def.element);
    fillFields(card, {
      glyph: ev.glyph,
      name: owned ? ev.name : '？？？',
      stars: stars(star),
      element: ELEMENTS[def.element].label + '属性',
      luck: 'LUCK ' + charLuckOf(charId),
      lock: owned ? '' : '未所持'
    });
    if (!owned) { card.classList.add('is-locked'); }
    if (options.selected) { card.classList.add('is-selected'); }
    return card;
  }

  /* ---- モーダル制御 ---- */
  var MODAL_IDS = {
    title: 'modal-title',
    charselect: 'modal-charselect',
    skill: 'modal-skill',
    inventory: 'modal-inventory',
    result: 'modal-result',
    gameover: 'modal-gameover',
    pause: 'modal-pause',
    help: 'modal-help',
    evolution: 'modal-evolution'
  };

  function openModal(name) {
    closeAllModals();
    var el = $(MODAL_IDS[name]);
    if (el) { el.classList.add('is-open'); }
    setClass(document.body, 'is-modal-open', true);
  }

  function closeModal(name) {
    var el = $(MODAL_IDS[name]);
    if (el) { el.classList.remove('is-open'); }
    refreshBodyModalState();
  }

  function closeAllModals() {
    Object.keys(MODAL_IDS).forEach(function (key) {
      var el = $(MODAL_IDS[key]);
      if (el) { el.classList.remove('is-open'); }
    });
    refreshBodyModalState();
  }

  function refreshBodyModalState() {
    var open = false;
    Object.keys(MODAL_IDS).forEach(function (key) {
      var el = $(MODAL_IDS[key]);
      if (el && el.classList.contains('is-open')) { open = true; }
    });
    setClass(document.body, 'is-modal-open', open);
  }

  function anyModalOpen() {
    var open = false;
    Object.keys(MODAL_IDS).forEach(function (key) {
      var el = $(MODAL_IDS[key]);
      if (el && el.classList.contains('is-open')) { open = true; }
    });
    return open;
  }

  /* ==========================================================================
     12. ゲームフロー
     ========================================================================== */
  function startRun(charId) {
    var id = save.chars[charId] ? charId : save.selectedCharId;
    if (!save.chars[id]) { id = ownedCharIds()[0] || 'fire'; }
    save.selectedCharId = id;
    save.runs += 1;
    persistSave();
    state = createState();
    makePlayerForRun(id);
    buildStageField(state.stageIndex);
    startWave(1);
    closeAllModals();
    showBanner('STAGE ' + stageIndexToKey(state.stageIndex), state.pattern.name, '');
    updateHud();
  }

  function makePlayerForRun(charId) {
    state.player = createPlayer(charId);
    state.player.skills = {};
    recomputePlayer(true);
  }

  function startStage(index) {
    state.stageIndex = index;
    if (index > save.bestStageIndex) { save.bestStageIndex = index; }
    persistSave();
    buildStageField(index);
    startWave(1);
  }

  function startWave(waveIndex) {
    state.waveIndex = waveIndex;
    state.enemies = buildWaveEnemies(state.stageIndex, waveIndex);
    state.bullets = [];
    state.missiles = [];
    state.effects = [];
    state.particles = [];
    state.texts = [];
    state.phase = 'idle';
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.hitStop = 0;
    state.enemyTurnTimer = 0;
    state.warpCooldown = 0;
    state.rerollCount = 0;
    state.ball.x = LAUNCH_X;
    state.ball.y = LAUNCH_Y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.alive = false;
    state.ball.bounce = 0;
    state.ball.trail.length = 0;
    state.player.shotsLeft = state.player.shotsPerWave + clamp(state.carryShots, 0, CARRY_SHOT_MAX);
    state.carryShots = 0;
    state.player.burstUsed = false;
    state.partyDowned = [];
    state.player.partyDown = [];
    state.supportCounter = 0;
    state.friendChain = 0;
    state.friendChainTimer = 0;
    state.duoMembers = {};
    state.duoFired = false;
    state.timeScale = 1;
    state.timeScaleTimer = 0;
    for (var i = 0; i < state.barrels.length; i += 1) {
      state.barrels[i].hp = state.barrels[i].maxHp;
      state.barrels[i].alive = true;
    }
    buildFriends();
    updateHud();
    showBanner('WAVE ' + waveIndex + ' / ' + WAVES_PER_STAGE, state.pattern.name, '');
    if (bossAlive()) {
      window.setTimeout(function () {
        var boss = bossAlive();
        showBanner('BOSS', boss ? boss.name : '', 'danger');
        Sfx.fanfare();
      }, 720);
    }
  }

  function rollDrops(kind) {
    var p = state.player;
    var drops = [];
    var isStage = kind === 'stage';
    var countBase = isStage ? 2 : 1;
    var countBonus = Math.floor(p.luck / 6) + (isStage ? 1 : 0);
    var countChance = clamp(0.55 + p.luck * 0.01, 0, 0.98);
    var rolls = countBase + countBonus;
    var i;
    for (i = 0; i < rolls; i += 1) {
      if (Math.random() > countChance) { continue; }
      var slot = Math.random() < 0.5 ? 'weapon' : 'relic';
      drops.push(createItem(slot, rollRarity(p.luck, state.stageIndex), state.stageIndex));
    }
    if (isStage) {
      var slot2 = Math.random() < 0.5 ? 'weapon' : 'relic';
      var guaranteed = createItem(slot2, 'epic', state.stageIndex);
      drops.push(guaranteed);
    }
    for (i = 0; i < drops.length; i += 1) {
      var plusChance = (drops[i].rarity === 'cursed' ? 0.35 : (drops[i].rarity === 'epic' ? 0.28 : 0.1)) +
        (state.stageIndex - 1) * 0.01;
      if (Math.random() < plusChance) { drops[i].plus = 1; }
    }
    return drops;
  }

  function grantDrops(drops) {
    var equippedChanged = false;
    for (var i = 0; i < drops.length; i += 1) {
      var item = drops[i];
      save.items.push(item);
      if (!save.equip[item.slot]) {
        save.equip[item.slot] = item.uid;
        equippedChanged = true;
      }
      state.runDrops.push(item);
      Sfx.drop(item.rarity);
      showToast(RARITIES[item.rarity].label + '『' + item.name + '』を入手', '◆', item.rarity === 'cursed' ? 'warn' : 'drop');
    }
    if (save.items.length > ITEM_CAP) {
      trimInventory();
    }
    if (equippedChanged) {
      recomputePlayer(false);
      updateHud();
    }
    persistSave();
  }

  function rollCharacterDrop() {
    var p = state.player;
    var chance = clamp(0.18 + p.luck * 0.004 + (state.stageIndex - 1) * 0.01, 0, 0.75);
    if (Math.random() > chance) { return null; }
    var unowned = [];
    for (var i = 0; i < CHARACTERS.length; i += 1) {
      if (!save.chars[CHARACTERS[i].id]) { unowned.push(CHARACTERS[i].id); }
    }
    var target;
    var duplicated = false;
    if (unowned.length > 0) {
      target = pick(unowned);
    } else {
      target = pick(CHARACTERS).id;
      duplicated = true;
    }
    var result = grantCharacter(target);
    return { charId: target, added: result.added, luck: result.luck, duplicated: duplicated };
  }

  function showResultModal(isStageClear, drops, charDrop) {
    var p = state.player;
    setText(dom.resultTitle, isStageClear ? 'STAGE CLEAR' : 'WAVE CLEAR');
    setText(dom.resultSubtitle, isStageClear
      ? 'STAGE ' + stageIndexToKey(state.stageIndex) + ' 制覇（地形: ' + state.pattern.name + '）'
      : 'WAVE ' + state.waveIndex + ' 突破（地形: ' + state.pattern.name + '）');
    fillStatList(dom.resultStats, [
      { label: 'このランで稼いだゴールド', value: fmtNum(state.runGold) + ' G' },
      { label: '残りHP', value: Math.ceil(p.hp) + ' / ' + p.maxHp },
      { label: '最大コンボ', value: 'x' + state.bestCombo },
      { label: 'LUCK', value: p.luck },
      { label: '抽選回数（1ウェーブ）', value: (1 + Math.floor(p.luck / 6)) + ' 回' },
      { label: '抽選成功率', value: pctText(clamp(0.55 + p.luck * 0.01, 0, 0.98)) },
      { label: '天井カウンタ', value: 'Epic ' + save.pity.epic + ' / Cursed ' + save.pity.cursed }
    ]);
    clear(dom.resultDrops);
    var i;
    for (i = 0; i < drops.length; i += 1) {
      var notes = [];
      for (var o = 0; o < drops[i].opts.length; o += 1) { notes.push(drops[i].opts[o].label); }
      var row = makeDropRow({
        name: drops[i].name + (drops[i].plus ? ' ＋' + drops[i].plus : ''),
        rarity: drops[i].rarity,
        note: SLOT_LABEL[drops[i].slot] + (notes.length ? ' / ' + notes.join(' ・ ') : '') + ' / ' + compareItems(drops[i])
      });
      if (row) { dom.resultDrops.appendChild(row); }
    }
    if (charDrop) {
      var def = getCharDef(charDrop.charId);
      var star = charDrop.added ? 3 : save.chars[charDrop.charId].star;
      var ev = getEvolution(charDrop.charId, star);
      var row2 = makeDropRow({
        name: ev.name + '（' + ELEMENTS[def.element].label + '属性キャラ）',
        rarity: charDrop.added ? 'epic' : 'rare',
        note: charDrop.added ? 'NEW! キャラクターを獲得しました' : '重複入手 → LUCK +' + charDrop.luck
      });
      if (row2) { dom.resultDrops.appendChild(row2); }
    }
    var totalDrops = drops.length + (charDrop ? 1 : 0);
    setClass(dom.resultDropsEmpty, 'is-hidden', totalDrops > 0);
    setText(dom.resultLuckNote, 'LUCK ' + p.luck + ' ／ 抽選 ' + (1 + Math.floor(p.luck / 6)) +
      ' 回 / 成功率 ' + pctText(clamp(0.55 + p.luck * 0.01, 0, 0.98)) + ' / 天井 E' + save.pity.epic + ' C' + save.pity.cursed);
    if (charDrop && charDrop.added) { Sfx.fanfare(); }
    persistSave();
    updateHud();
  }

  function onWaveCleared() {
    if (state.phase === 'result' || state.phase === 'gameover') { return; }
    state.phase = 'result';
    Sfx.waveClear();
    state.carryShots = clamp(state.player.shotsLeft, 0, CARRY_SHOT_MAX);
    var isStageClear = state.waveIndex >= WAVES_PER_STAGE;
    var drops = rollDrops(isStageClear ? 'stage' : 'wave');
    grantDrops(drops);
    var charDrop = isStageClear ? rollCharacterDrop() : null;
    if (isStageClear) {
      save.clearedStages += 1;
      if (state.stageIndex + 1 > save.bestStageIndex) { save.bestStageIndex = state.stageIndex + 1; }
      persistSave();
    }
    showResultModal(isStageClear, drops, charDrop);
    state.resultNext = isStageClear ? 'nextStage' : 'nextWave';
    openModal('result');
    flashScreen(isStageClear ? 'flash--evolve' : 'flash--friend');
    if (isStageClear) { Sfx.fanfare(); }
    updateHud();
  }

  function proceedFromResult() {
    var next = state.resultNext || 'nextWave';
    closeModal('result');
    if (next === 'nextStage') {
      var heal = Math.round(state.player.maxHp * 0.35);
      healPlayer(heal, false);
      showToast('ステージクリア報酬: HP +' + heal, '＋', 'luck');
    }
    openSkillModal();
  }

  function afterSkillChoice() {
    closeModal('skill');
    if (state.pendingStageAdvance) {
      state.pendingStageAdvance = false;
      startStage(state.stageIndex + 1);
    } else {
      startWave(state.waveIndex + 1);
    }
    updateHud();
  }

  function endRun(reason) {
    if (state.phase === 'gameover') { return; }
    state.phase = 'gameover';
    state.player.hp = 0;
    save.bestStageIndex = Math.max(save.bestStageIndex, state.stageIndex);
    persistSave();
    Sfx.gameOver();
    flashScreen('flash--damage');
    shakeScreen(true);
    updateHud();
    setText(dom.gameoverTitle, reason === 'retire' ? 'RETIRE' : 'GAME OVER');
    setText(dom.gameoverSubtitle, reason === 'retire'
      ? 'STAGE ' + stageIndexToKey(state.stageIndex) + ' で撤退しました。'
      : 'STAGE ' + stageIndexToKey(state.stageIndex) + ' で力尽きました…');
    fillStatList(dom.gameoverStats, [
      { label: '到達ステージ', value: stageIndexToKey(state.stageIndex) },
      { label: '到達ウェーブ', value: state.waveIndex + ' / ' + WAVES_PER_STAGE },
      { label: '獲得ゴールド総計', value: fmtNum(save.gold) + ' G' },
      { label: '最大コンボ', value: 'x' + state.bestCombo },
      { label: '獲得LUCK', value: state.player.luck },
      { label: '所持キャラ', value: ownedCharIds().length + ' / ' + CHARACTERS.length },
      { label: '所持装備', value: save.items.length + ' 個' }
    ]);
    window.setTimeout(function () {
      openModal('gameover');
    }, 620);
  }

  function retireRun() {
    closeAllModals();
    endRun('retire');
  }

  function continueFromGameover(retry) {
    closeAllModals();
    if (retry) {
      startRun(save.selectedCharId);
    } else {
      state = createState();
      state.player = null;
      showTitle();
    }
  }

  /* ==========================================================================
     13. スキル選択モーダル
     ========================================================================== */
  var TAG_LABEL = { fire: '火', lightning: '雷', reflect: '反射', crit: '会心' };

  function availableSkills() {
    var p = state.player;
    var list = [];
    for (var i = 0; i < SKILLS.length; i += 1) {
      if ((p.skills[SKILLS[i].id] || 0) < SKILLS[i].max) { list.push(SKILLS[i]); }
    }
    return list;
  }

  function skillPoolChoices() {
    var available = availableSkills();
    if (available.length === 0) { return []; }
    return shuffle(available).slice(0, 3);
  }

  function openSkillModal() {
    state.phase = 'skill';
    state.skillChoices = skillPoolChoices();
    renderSkillModal();
    openModal('skill');
    updateHud();
  }

  function renderSkillModal() {
    var p = state.player;
    var host = dom.skillList;
    if (!host) { return; }
    clear(host);
    setText(dom.skillSubtitle, 'WAVE ' + state.waveIndex + ' 突破報酬：スキルを1つ選択してください。');
    setText(dom.skillGold, fmtNum(save.gold));
    setText(dom.skillRerollCost, REROLL_BASE_COST + REROLL_STEP_COST * state.rerollCount);
    setText(dom.skillSkipBonus, String(SKIP_GOLD_BASE + 5 * state.stageIndex));
    var synergyNames = [];
    for (var s = 0; s < SYNERGIES.length; s += 1) {
      if (p.synergy[SYNERGIES[s].id]) { synergyNames.push(SYNERGIES[s].name); }
    }
    setText(dom.skillSynergyNote, synergyNames.length > 0
      ? '発動中のシナジー: ' + synergyNames.join(' / ')
      : '同じタグ（火 / 雷 / 反射 / 会心）を重ねるとシナリオシナジーが発動します。');

    for (var i = 0; i < state.skillChoices.length; i += 1) {
      var def = state.skillChoices[i];
      var card = cloneTemplate('tpl-skill-card');
      if (!card) { continue; }
      var level = p.skills[def.id] || 0;
      card.setAttribute('data-skill-id', def.id);
      fillFields(card, {
        glyph: def.glyph,
        name: def.name,
        desc: def.desc,
        level: level > 0 ? 'Lv' + level + ' → Lv' + (level + 1) : 'NEW',
        synergy: synergyTextFor(p.skills, def)
      });
      var tagsHost = card.querySelector('[data-field="tags"]');
      if (tagsHost) {
        clear(tagsHost);
        for (var t = 0; t < def.tags.length; t += 1) {
          var tagEl = document.createElement('span');
          tagEl.className = 'tag tag--' + def.tags[t];
          tagEl.textContent = TAG_LABEL[def.tags[t]] || def.tags[t];
          tagsHost.appendChild(tagEl);
        }
      }
      var levelEl = card.querySelector('[data-field="level"]');
      if (levelEl && level === 0) { levelEl.classList.add('is-new'); }
      if (levelEl && synergyTextFor(p.skills, def).indexOf('発動！') >= 0) {
        levelEl.classList.add('is-synergy');
      }
      host.appendChild(card);
    }
    if (state.skillChoices.length === 0) {
      var none = document.createElement('p');
      none.className = 'empty-note';
      none.textContent = '取得可能なスキルがありません。ゴールドを受け取って進みましょう。';
      host.appendChild(none);
    }
  }

  function pickSkill(skillId) {
    var def = getSkillDef(skillId);
    if (!def) { return; }
    var p = state.player;
    var level = p.skills[def.id] || 0;
    if (level >= def.max) { return; }
    var beforeSyn = {};
    Object.keys(p.synergy).forEach(function (k) { beforeSyn[k] = p.synergy[k]; });
    p.skills[def.id] = level + 1;
    recomputePlayer(false);
    if (def.id === 'vitality') { p.hp = Math.min(p.maxHp, p.hp + 18); }
    if (def.id === 'bounty') { save.gold += 45; Sfx.coin(); }
    for (var i = 0; i < SYNERGIES.length; i += 1) {
      var syn = SYNERGIES[i];
      if (!beforeSyn[syn.id] && p.synergy[syn.id]) {
        showToast('シナジー『' + syn.name + '』発動！', '★', 'synergy');
        showBanner(syn.name, 'シナジー成立', 'friend');
        flashScreen('flash--evolve');
        Sfx.fanfare();
        addText(LAUNCH_X, LAUNCH_Y - 52, syn.name, '#ffe45c', 17, true);
      }
    }
    Sfx.ui();
    state.pendingStageAdvance = (state.resultNext === 'nextStage');
    persistSave();
    afterSkillChoice();
    updateHud();
  }

  function rerollSkills() {
    var cost = REROLL_BASE_COST + REROLL_STEP_COST * state.rerollCount;
    if (save.gold < cost) {
      showToast('ゴールドが足りません（必要 ' + cost + 'G）', '✕', 'warn');
      return;
    }
    save.gold -= cost;
    state.rerollCount += 1;
    state.skillChoices = skillPoolChoices();
    renderSkillModal();
    updateHud();
    Sfx.ui();
    persistSave();
  }

  function skipSkill() {
    var bonus = SKIP_GOLD_BASE + 5 * state.stageIndex;
    save.gold += bonus;
    Sfx.coin();
    showToast('スキルを見送り → +' + bonus + 'G', '＋', 'gold');
    state.pendingStageAdvance = (state.resultNext === 'nextStage');
    persistSave();
    afterSkillChoice();
    updateHud();
  }

  /* ==========================================================================
     14. インベントリ
     ========================================================================== */
  var RARITY_ORDER = { cursed: 0, epic: 1, rare: 2, normal: 3 };

  function activeSynergyNames() {
    var names = [];
    if (!state.player) { return names; }
    for (var i = 0; i < SYNERGIES.length; i += 1) {
      if (state.player.synergy[SYNERGIES[i].id]) { names.push(SYNERGIES[i].name); }
    }
    return names;
  }

  function openInventory(returnTo) {
    inventoryReturnTo = returnTo || 'title';
    renderInventory();
    openModal('inventory');
  }

  function renderInventory() {
    setText(dom.invGold, fmtNum(save.gold));
    setText(dom.invLuck, totalLuck());
    setText(dom.invBest, stageIndexToKey(save.bestStageIndex));
    if (dom.invPity) {
      var pity = save.pity || { epic: 0, cursed: 0 };
      setText(dom.invPity, 'E' + pity.epic + ' C' + pity.cursed);
    }
    if (dom.autoSellNote) {
      var normalCount = 0;
      for (var i = 0; i < save.items.length; i += 1) {
        var it = save.items[i];
        var equipped = (save.equip[it.slot] === it.uid);
        if ((it.rarity === 'normal' || it.rarity === 'rare') && !equipped && !it.locked) { normalCount += 1; }
      }
      setText(dom.autoSellNote, '売却対象 ' + normalCount + '個（装備中・ロック中は保護）');
    }
    renderEquipSlots();
    renderEquipStats();
    renderInventoryItems();
    renderInventoryChars();
  }

  function setInventoryTab(tab) {
    var tabs = ['equip', 'items', 'chars'];
    for (var i = 0; i < tabs.length; i += 1) {
      var key = tabs[i];
      var btn = $(key === 'equip' ? 'inv-tab-equip' : (key === 'items' ? 'inv-tab-items' : 'inv-tab-chars'));
      var panel = $(key === 'equip' ? 'inv-panel-equip' : (key === 'items' ? 'inv-panel-items' : 'inv-panel-chars'));
      setClass(btn, 'is-active', key === tab);
      setClass(panel, 'is-active', key === tab);
    }
  }

  function renderEquipSlots() {
    var slots = ['weapon', 'relic'];
    for (var i = 0; i < slots.length; i += 1) {
      var slot = slots[i];
      var host = $(slot === 'weapon' ? 'equip-slot-weapon' : 'equip-slot-relic');
      if (!host) { continue; }
      var item = getEquippedItem(slot);
      if (item) {
        host.setAttribute('data-rarity', item.rarity);
        setClass(host, 'is-empty', false);
        fillFields(host, {
          name: item.name,
          rarity: RARITIES[item.rarity].label,
          opts: item.opts.map(function (op) { return { text: op.label, cls: op.curse ? 'is-curse' : '' }; })
        });
      } else {
        host.removeAttribute('data-rarity');
        setClass(host, 'is-empty', true);
        fillFields(host, { name: '空き', rarity: '-', opts: [] });
      }
    }
  }

  function renderEquipStats() {
    var eq = equipTotals();
    var rows = [
      { label: '装備: 攻撃力補正', value: '+' + pctText(eq.atkPct) },
      { label: '装備: クリ率', value: '+' + pctText(eq.critRate) },
      { label: '装備: クリダメージ', value: '+' + pctText(eq.critDmg) },
      { label: '装備: 反射スタック上限', value: '+' + eq.reflectPlus },
      { label: '装備: 最大HP', value: '+' + eq.maxHpPlus },
      { label: '装備: ショット数', value: '+' + eq.shotPlus },
      { label: '被ダメージ倍率', value: 'x' + eq.dmgTakenMult.toFixed(2), cls: eq.dmgTakenMult > 1 ? 'is-debuff' : 'is-buff' }
    ];
    if (state && state.player) {
      var p = state.player;
      rows.push({ label: '現在の攻撃力', value: round1(p.atk) });
      rows.push({ label: '現在のクリ率', value: pctText(p.critRate) });
      rows.push({ label: '現在のクリダメージ', value: 'x' + p.critDmg.toFixed(2) });
      rows.push({ label: 'ショット数 / ウェーブ', value: p.shotsPerWave });
      var names = activeSynergyNames();
      rows.push({ label: '発動中のシナジー', value: names.length ? names.join(' / ') : 'なし', cls: names.length ? 'is-buff' : '' });
      rows.push({ label: 'パーティ', value: partyAuraSummary(), cls: p.partyMembers.length > 1 ? 'is-buff' : '' });
      rows.push({ label: 'オーラ: 与ダメージ', value: 'x' + p.auraDmg.toFixed(2), cls: p.auraDmg > 1 ? 'is-buff' : '' });
      rows.push({ label: 'オーラ: クリ率加算', value: '+' + pctText(p.auraCrit), cls: p.auraCrit > 0 ? 'is-buff' : '' });
      rows.push({ label: '被ダメージ倍率（合計）', value: 'x' + p.dmgTakenMult.toFixed(2), cls: p.dmgTakenMult > 1 ? 'is-debuff' : 'is-buff' });
    }
    fillStatList(dom.equipStats, rows);
  }

  function sortedItems() {
    return save.items.slice().sort(function (a, b) {
      if (RARITY_ORDER[a.rarity] !== RARITY_ORDER[b.rarity]) { return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]; }
      if (a.slot !== b.slot) { return a.slot < b.slot ? -1 : 1; }
      return itemSellValue(b) - itemSellValue(a);
    });
  }

  function renderInventoryItems() {
    var host = dom.inventoryList;
    if (!host) { return; }
    clear(host);
    var items = sortedItems();
    for (var i = 0; i < items.length; i += 1) {
      var equipped = (save.equip[items[i].slot] === items[i].uid);
      var card = makeItemCard(items[i], equipped);
      if (card) { host.appendChild(card); }
    }
    setClass(dom.invEmpty, 'is-hidden', items.length > 0);
  }

  function renderInventoryChars() {
    var host = dom.invCharList;
    if (!host) { return; }
    clear(host);
    for (var i = 0; i < CHARACTERS.length; i += 1) {
      var card = makeCharCard(CHARACTERS[i].id, { selected: save.selectedCharId === CHARACTERS[i].id });
      if (card) { host.appendChild(card); }
    }
  }

  function handleInventoryAction(uid, action) {
    var item = findItem(uid);
    if (!item) { return; }
    if (action === 'equip') {
      equipItem(uid);
      Sfx.ui();
      showToast('『' + item.name + '』を装備しました', '◆', 'drop');
      if (state && state.player) { recomputePlayer(false); updateHud(); }
      renderInventory();
    } else if (action === 'sell') {
      if (item.locked) {
        showToast('ロック中の装備は売却できません', '✕', 'warn');
        return;
      }
      var value = itemSellValue(item);
      var name = item.name;
      sellItem(uid);
      Sfx.coin();
      showToast('『' + name + '』を売却 → +' + value + 'G', '＋', 'gold');
      if (state && state.player) { recomputePlayer(false); updateHud(); }
      renderInventory();
    } else if (action === 'fuse') {
      if (fuseItems(uid)) { renderInventory(); }
    } else if (action === 'purge') {
      if (purgeItem(uid)) { renderInventory(); }
    } else if (action === 'lock') {
      toggleItemLock(uid);
      renderInventory();
    }
  }

  /* ==========================================================================
     15. キャラクター選択 & 進化
     ========================================================================== */
  var selectedCharId = null;

  function refreshTitleInfo() {
    setText(dom.saveGold, fmtNum(save.gold));
    setText(dom.saveBest, stageIndexToKey(save.bestStageIndex));
    setText(dom.saveChars, ownedCharIds().length + ' / ' + CHARACTERS.length);
    setText(dom.saveItems, save.items.length);
    setText(dom.titleVersion, 'ver 1.0.0 / SAVE: ' + SAVE_KEY);
  }

  function showTitle() {
    state.phase = 'title';
    refreshTitleInfo();
    openModal('title');
    updateHud();
  }

  function openCharSelect() {
    state.phase = 'charselect';
    selectedCharId = (save.selectedCharId && save.chars[save.selectedCharId])
      ? save.selectedCharId
      : (ownedCharIds()[0] || 'fire');
    renderCharSelect();
    renderPartyBar();
    renderCharDetail(selectedCharId, !!save.chars[selectedCharId]);
    if (dom.charConfirm) { dom.charConfirm.disabled = !save.chars[selectedCharId]; }
    openModal('charselect');
  }

  function renderPartyBar() {
    var slots = [
      { id: 'party-slot-main', key: 'main', label: 'MAIN' },
      { id: 'party-slot-sub0', key: 'sub0', label: 'SUB1' },
      { id: 'party-slot-sub1', key: 'sub1', label: 'SUB2' }
    ];
    var mainId = (save.party && save.party.main) || save.selectedCharId;
    if (!save.chars[mainId]) { mainId = ownedCharIds()[0] || 'fire'; }
    for (var i = 0; i < slots.length; i += 1) {
      var el = $(slots[i].id);
      if (!el) { continue; }
      var charId = null;
      if (slots[i].key === 'main') {
        charId = mainId;
      } else if (save.party && save.party.subs) {
        charId = save.party.subs[i - 1] || null;
      }
      if (charId && save.chars[charId]) {
        var ev = getEvolution(charId, save.chars[charId].star);
        setText(el, slots[i].label + ': ' + ev.name + ' ' + stars(save.chars[charId].star));
      } else {
        setText(el, slots[i].label + ': 空き');
      }
      setClass(el, 'is-main', slots[i].key === 'main');
    }
  }

  function assignPartySub(charId) {
    if (!save.chars[charId]) {
      showToast('未所持のキャラクターです', '✕', 'warn');
      return;
    }
    if (!save.party) { save.party = { main: save.selectedCharId, subs: [] }; }
    if (save.party.main === charId) {
      showToast('メインキャラはサブに編成できません', '✕', 'warn');
      return;
    }
    var subs = save.party.subs || [];
    if (subs.indexOf(charId) >= 0) {
      subs.splice(subs.indexOf(charId), 1);
      showToast('サブ編成から外しました', '◇', '');
    } else {
      if (subs.length >= PARTY_SIZE - 1) { subs.shift(); }
      subs.push(charId);
      showToast('サブに編成: ' + getEvolution(charId, save.chars[charId].star).name, '★', 'drop');
    }
    save.party.subs = subs;
    persistSave();
    renderPartyBar();
    renderCharSelect();
    if (state && state.player) {
      recomputePlayer(false);
      updateHud();
    }
  }

  function renderCharSelect() {
    var host = dom.charList;
    if (!host) { return; }
    clear(host);
    for (var i = 0; i < CHARACTERS.length; i += 1) {
      var card = makeCharCard(CHARACTERS[i].id, { selected: CHARACTERS[i].id === selectedCharId });
      if (card) { host.appendChild(card); }
    }
  }

  function renderCharDetail(charId, owned) {
    var def = getCharDef(charId);
    var star = owned ? save.chars[charId].star : 3;
    var preview = computePreviewStats(charId, star);
    var ev = preview.ev;
    setClass(dom.charDetail, 'is-hidden', false);
    setText(dom.charDetailGlyph, ev.glyph);
    setText(dom.charDetailName, owned ? ev.name : '？？？（未所持）');
    setText(dom.charDetailStars, stars(star));
    if (dom.charDetailElement) {
      dom.charDetailElement.textContent = ELEMENTS[def.element].label + '属性';
      dom.charDetailElement.setAttribute('data-element', def.element);
    }
    setText(dom.charDetailLuck, 'LUCK ' + charLuckOf(charId));
    setText(dom.charDetailDesc, def.desc);
    fillStatList(dom.charDetailStats, [
      { label: '攻撃力', value: preview.atk },
      { label: '最大HP', value: preview.maxHp },
      { label: 'クリ率', value: pctText(preview.critRate) },
      { label: 'クリダメージ', value: 'x' + preview.critDmg.toFixed(2) },
      { label: '反射スタック上限', value: 4 + preview.reflectPlus },
      { label: '被ダメージ倍率', value: 'x' + preview.dmgTakenMult.toFixed(2) }
    ]);
    var friendText = '友情コンボ: ' + FRIEND_LABEL[ev.friend.type] + '（弾数 ' + ev.friend.count;
    if (ev.friend.radius) { friendText += ' / 範囲 ' + Math.round(ev.friend.radius) + 'px'; }
    if (ev.friend.heal) { friendText += ' / 回復 ' + pctText(ev.friend.heal); }
    friendText += '）';
    setText(dom.charDetailFriend, friendText);

    var next = getNextEvolution(charId, star);
    if (!owned) {
      setText(dom.evolveCost, '未所持のため進化できません（ボス撃破で獲得）');
      setClass(dom.evolveCost, 'is-max', false);
      if (dom.btnEvolve) { dom.btnEvolve.disabled = true; }
    } else if (!next) {
      setText(dom.evolveCost, '最終進化（★5）に到達しています');
      setClass(dom.evolveCost, 'is-max', true);
      if (dom.btnEvolve) { dom.btnEvolve.disabled = true; }
    } else {
      var cost = EVOLVE_COST[star] || 0;
      setText(dom.evolveCost, '★' + star + ' → ★' + next.star + ' / 必要 ' + fmtNum(cost) + 'G（所持 ' + fmtNum(save.gold) + 'G）');
      setClass(dom.evolveCost, 'is-max', save.gold >= cost);
      if (dom.btnEvolve) { dom.btnEvolve.disabled = save.gold < cost; }
    }
  }

  function selectChar(charId) {
    var owned = !!save.chars[charId];
    renderCharDetail(charId, owned);
    if (owned) {
      selectedCharId = charId;
      save.selectedCharId = charId;
      persistSave();
    } else {
      showToast('未所持のキャラクターです（ボス撃破のドロップで獲得）', '✕', 'warn');
    }
    renderCharSelect();
    if (dom.charConfirm) { dom.charConfirm.disabled = !save.chars[selectedCharId]; }
  }

  function evolveChar() {
    var charId = selectedCharId;
    if (!charId || !save.chars[charId]) { return; }
    var star = save.chars[charId].star;
    var next = getNextEvolution(charId, star);
    if (!next) { return; }
    var cost = EVOLVE_COST[star] || 0;
    if (save.gold < cost) {
      showToast('ゴールドが足りません（必要 ' + fmtNum(cost) + 'G）', '✕', 'warn');
      return;
    }
    var before = getEvolution(charId, star);
    save.gold -= cost;
    save.chars[charId].star = next.star;
    persistSave();
    Sfx.evolution();
    flashScreen('flash--evolve');
    shakeScreen(false);
    renderCharDetail(charId, true);
    renderCharSelect();
    showEvolutionModal(before, next);
    if (state && state.player) { recomputePlayer(false); updateHud(); }
    refreshTitleInfo();
  }

  function showEvolutionModal(before, after) {
    setText(dom.evolutionFromGlyph, before.glyph);
    setText(dom.evolutionFromName, before.name);
    setText(dom.evolutionFromStars, stars(before.star));
    setText(dom.evolutionToGlyph, after.glyph);
    setText(dom.evolutionToName, after.name);
    setText(dom.evolutionToStars, stars(after.star));
    fillStatList(dom.evolutionDiff, [
      { label: '攻撃力', value: before.atk + ' → ' + after.atk, cls: 'is-buff' },
      { label: '最大HP', value: before.hp + ' → ' + after.hp, cls: 'is-buff' },
      { label: 'クリ率', value: pctText(before.critRate) + ' → ' + pctText(after.critRate), cls: 'is-buff' },
      { label: 'クリダメージ', value: 'x' + before.critDmg.toFixed(2) + ' → x' + after.critDmg.toFixed(2), cls: 'is-buff' },
      {
        label: '友情コンボ',
        value: FRIEND_LABEL[after.friend.type] + '（弾数 ' + before.friend.count + ' → ' + after.friend.count +
          (after.friend.radius ? ' / 範囲 ' + Math.round(before.friend.radius) + ' → ' + Math.round(after.friend.radius) : '') + '）',
        cls: 'is-buff'
      }
    ]);
    openModal('evolution');
    showBanner('EVOLUTION', after.name, 'friend');
  }

  /* ==========================================================================
     16. 入力 / ゲームループ / 初期化
     ========================================================================== */
  function cacheDom() {
    dom.shell = $('game-shell');
    dom.stageArea = $('stage-area');
    dom.canvas = $('game-canvas');
    dom.ctx = dom.canvas.getContext('2d');
    dom.hudPortraitGlyph = $('hud-portrait-glyph');
    dom.hudCharName = $('hud-char-name');
    dom.hudCharElement = $('hud-char-element');
    dom.hudCharStars = $('hud-char-stars');
    dom.hudCharLuck = $('hud-char-luck');
    dom.hudHp = $('hud-hp');
    dom.hudHpFill = $('hud-hp-fill');
    dom.hudHpText = $('hud-hp-text');
    dom.hudStage = $('hud-stage');
    dom.hudWave = $('hud-wave');
    dom.hudGold = $('hud-gold');
    dom.hudShots = $('hud-shots');
    dom.hudCombo = $('hud-combo');
    dom.hudComboCount = $('hud-combo-count');
    dom.hudComboMult = $('hud-combo-mult');
    dom.hudBoss = $('hud-boss');
    dom.hudBossName = $('hud-boss-name');
    dom.hudBossFill = $('hud-boss-fill');
    dom.hudBurst = $('hud-burst');
    dom.hudBurstState = $('hud-burst-state');
    dom.hudParty = $('hud-party');
    dom.hudSkills = $('hud-skills');
    dom.bannerLayer = $('banner-layer');
    dom.flashLayer = $('flash-layer');
    dom.toastLayer = $('toast-layer');
    dom.soundBtn = $('btn-sound');
    dom.soundIcon = $('btn-sound-icon');
    dom.soundLabel = $('btn-sound-label');
    dom.pauseSoundLabel = $('btn-pause-sound-label');

    dom.saveGold = $('save-gold');
    dom.saveBest = $('save-best');
    dom.saveChars = $('save-chars');
    dom.saveItems = $('save-items');
    dom.titleVersion = $('title-version');

    dom.charList = $('char-list');
    dom.charDetail = $('char-detail');
    dom.charDetailGlyph = $('char-detail-glyph');
    dom.charDetailName = $('char-detail-name');
    dom.charDetailStars = $('char-detail-stars');
    dom.charDetailElement = $('char-detail-element');
    dom.charDetailLuck = $('char-detail-luck');
    dom.charDetailDesc = $('char-detail-desc');
    dom.charDetailStats = $('char-detail-stats');
    dom.charDetailFriend = $('char-detail-friend');
    dom.charConfirm = $('btn-char-confirm');
    dom.btnEvolve = $('btn-evolve');
    dom.evolveCost = $('evolve-cost');

    dom.skillList = $('skill-list');
    dom.skillSubtitle = $('skill-subtitle');
    dom.skillGold = $('skill-gold');
    dom.skillRerollCost = $('skill-reroll-cost');
    dom.skillSkipBonus = $('skill-skip-bonus');
    dom.skillSynergyNote = $('skill-synergy-note');

    dom.invGold = $('inv-gold');
    dom.invLuck = $('inv-luck');
    dom.invBest = $('inv-best');
    dom.inventoryList = $('inventory-list');
    dom.invEmpty = $('inv-empty');
    dom.invCharList = $('inv-char-list');
    dom.equipStats = $('equip-stats');

    dom.partySubBtn = $('btn-party-sub');
    dom.partyBar = $('party-bar');
    dom.invPity = $('inv-pity');
    dom.autoSellBtn = $('btn-auto-sell');
    dom.autoSellNote = $('inv-auto-sell-note');

    dom.resultTitle = $('result-title');
    dom.resultSubtitle = $('result-subtitle');
    dom.resultStats = $('result-stats');
    dom.resultDrops = $('result-drops');
    dom.resultDropsEmpty = $('result-drops-empty');
    dom.resultLuckNote = $('result-luck-note');

    dom.gameoverTitle = $('gameover-title');
    dom.gameoverSubtitle = $('gameover-subtitle');
    dom.gameoverStats = $('gameover-stats');
    dom.pauseStats = $('pause-stats');

    dom.evolutionFromGlyph = $('evolution-from-glyph');
    dom.evolutionFromName = $('evolution-from-name');
    dom.evolutionFromStars = $('evolution-from-stars');
    dom.evolutionToGlyph = $('evolution-to-glyph');
    dom.evolutionToName = $('evolution-to-name');
    dom.evolutionToStars = $('evolution-to-stars');
    dom.evolutionDiff = $('evolution-diff');
  }

  /* ---- ポインタ座標変換（zoom スケーリング対応） ---- */
  function canvasPoint(clientX, clientY) {
    var rect = dom.canvas.getBoundingClientRect();
    var width = rect.width || CANVAS_W;
    var height = rect.height || CANVAS_H;
    return {
      x: (clientX - rect.left) * (CANVAS_W / width),
      y: (clientY - rect.top) * (CANVAS_H / height)
    };
  }

  function canAcceptGameplayInput() {
    if (!state || !state.player) { return false; }
    if (anyModalOpen()) { return false; }
    return state.phase === 'idle' || state.phase === 'aiming' || state.phase === 'moving';
  }

  function countPointers() {
    var n = 0;
    for (var k in state.pointers) {
      if (state.pointers[k]) { n += 1; }
    }
    return n;
  }

  function updateAimFromPoint(px, py) {
    var aim = state.aim;
    var now = state.time;
    aim.pointerX = px;
    aim.pointerY = py;
    var dx = aim.originX - px;
    var dy = aim.originY - py;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) {
      aim.power = 0;
      aim.lastMove = now;
      return;
    }
    aim.dirX = dx / len;
    aim.dirY = dy / len;
    var pullPower = clamp(len / MAX_PULL, 0, 1);
    aim.samples.push({ x: px, y: py, t: now });
    while (aim.samples.length > 2 && now - aim.samples[0].t > FLICK_WINDOW) {
      aim.samples.shift();
    }
    var flickSpeed = 0;
    if (aim.samples.length >= 2) {
      var first = aim.samples[0];
      var last = aim.samples[aim.samples.length - 1];
      var span = Math.max(0.001, last.t - first.t);
      flickSpeed = dist(first.x, first.y, last.x, last.y) / span;
    }
    aim.flick = clamp(flickSpeed / FLICK_SPEED_MAX, 0, 1);
    if (!aim.locked) {
      aim.power = clamp(pullPower + aim.flick * FLICK_WEIGHT, 0, 1);
      aim.lockedPower = aim.power;
    }
    aim.lastMove = now;
  }

  function adjustAimPower(delta) {
    var aim = state.aim;
    if (!aim.locked) { return; }
    aim.lockedPower = clamp(aim.lockedPower + delta, 0.05, 1);
    Sfx.ui();
  }

  function applyAimAssist(dirX, dirY) {
    var p = state.player;
    if (!p || p.shotsLeft > 1) { return { x: dirX, y: dirY, used: false }; }
    var best = null;
    var bestAngle = AIM_ASSIST_ANGLE;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (!e.alive) { continue; }
      var core = corePosition(e);
      var cx = core.x - LAUNCH_X;
      var cy = core.y - LAUNCH_Y;
      var cl = Math.sqrt(cx * cx + cy * cy);
      if (cl < 1) { continue; }
      var nx = cx / cl;
      var ny = cy / cl;
      var angle = Math.acos(clamp(dirX * nx + dirY * ny, -1, 1));
      if (angle < bestAngle) {
        bestAngle = angle;
        best = { x: nx, y: ny };
      }
    }
    if (best) { return { x: best.x, y: best.y, used: true }; }
    return { x: dirX, y: dirY, used: false };
  }

  function cancelAim(notify) {
    var aim = state.aim;
    if (!aim.active) { return; }
    aim.active = false;
    aim.locked = false;
    aim.power = 0;
    aim.samples = [];
    state.pointerId = null;
    if (state.phase === 'aiming') { state.phase = 'idle'; }
    if (dom.canvas) { dom.canvas.classList.remove('is-aiming'); }
    if (notify) { showToast('照準をキャンセルしました', '✕', 'warn'); }
  }

  function updateAimLock(dt) {
    var aim = state.aim;
    if (!aim.active || aim.locked) { return; }
    if (state.time - aim.lastMove < POWER_LOCK_TIME) { return; }
    if (aim.power < 0.12) { return; }
    aim.locked = true;
    aim.lockedPower = aim.power;
    Sfx.ui();
    showToast('パワーロック中（←→で微調整 / Rで射出 / Escでキャンセル）', '◈', 'gold');
  }

  function finishAim() {
    var aim = state.aim;
    if (!aim.active) { return; }
    var power = aim.locked ? aim.lockedPower : aim.power;
    var dirX = aim.dirX;
    var dirY = aim.dirY;
    var pullLength = dist(aim.originX, aim.originY, aim.pointerX, aim.pointerY);
    aim.active = false;
    aim.locked = false;
    state.pointerId = null;
    if (dom.canvas) { dom.canvas.classList.remove('is-aiming'); }
    if (pullLength < MIN_PULL && power * MAX_PULL < MIN_PULL) {
      state.phase = 'idle';
      return;
    }
    var assisted = applyAimAssist(dirX, dirY);
    if (assisted.used) {
      aim.assist = true;
      showToast('エイムアシスト発動（弱点コアへ吸着）', '◎', 'synergy');
    }
    launchBall(assisted.x, assisted.y, power);
  }

  function onPointerDown(ev) {
    Sound.unlock();
    if (!state) { return; }
    var key = 'p' + (ev.pointerId === undefined ? 0 : ev.pointerId);
    state.pointers[key] = true;
    if (countPointers() > 1) {
      if (state.aim.active) { cancelAim(true); }
      return;
    }
    if (!canAcceptGameplayInput()) { return; }
    if (state.phase === 'moving') {
      ev.preventDefault();
      triggerBurst();
      return;
    }
    if (state.phase !== 'idle') { return; }
    var pt = canvasPoint(ev.clientX, ev.clientY);
    var aim = state.aim;
    aim.active = true;
    aim.originX = pt.x;
    aim.originY = pt.y;
    aim.pointerX = pt.x;
    aim.pointerY = pt.y;
    aim.power = 0;
    aim.locked = false;
    aim.lockedPower = 0;
    aim.flick = 0;
    aim.assist = false;
    aim.samples = [];
    aim.ghost = null;
    aim.lastMove = state.time;
    aim.dirX = 0;
    aim.dirY = -1;
    state.phase = 'aiming';
    state.pointerId = ev.pointerId;
    if (dom.canvas.setPointerCapture) {
      try { dom.canvas.setPointerCapture(ev.pointerId); } catch (err) { /* 非対応環境では無視 */ }
    }
    dom.canvas.classList.add('is-aiming');
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!state || !state.aim.active || anyModalOpen()) { return; }
    if (state.pointerId !== null && state.pointerId !== undefined && ev.pointerId !== state.pointerId) { return; }
    var pt = canvasPoint(ev.clientX, ev.clientY);
    updateAimFromPoint(pt.x, pt.y);
    ev.preventDefault();
  }

  function onPointerUp(ev) {
    if (!state) { return; }
    var key = 'p' + (ev.pointerId === undefined ? 0 : ev.pointerId);
    delete state.pointers[key];
    if (!state.aim.active) { return; }
    if (state.pointerId !== null && state.pointerId !== undefined && ev.pointerId !== state.pointerId) { return; }
    var pt = canvasPoint(ev.clientX, ev.clientY);
    updateAimFromPoint(pt.x, pt.y);
    if (dom.canvas.releasePointerCapture) {
      try { dom.canvas.releasePointerCapture(ev.pointerId); } catch (err) { /* 未キャプチャ時は無視 */ }
    }
    ev.preventDefault();
    finishAim();
  }

  function isOpen(name) {
    var el = $(MODAL_IDS[name]);
    return !!(el && el.classList.contains('is-open'));
  }

  function toggleSound() {
    Sound.setEnabled(!Sound.isEnabled());
    save.soundEnabled = Sound.isEnabled();
    persistSave();
    setSoundUi();
    if (Sound.isEnabled()) { Sfx.ui(); }
  }

  /* ---- キーボード ---- */
  function onKeyDown(ev) {
    var key = ev.key ? ev.key.toLowerCase() : '';
    if (state && state.aim.active && state.aim.locked) {
      if (key === 'arrowleft' || key === 'arrowdown') { ev.preventDefault(); adjustAimPower(-POWER_STEP); return; }
      if (key === 'arrowright' || key === 'arrowup') { ev.preventDefault(); adjustAimPower(POWER_STEP); return; }
      if (key === 'r') { ev.preventDefault(); finishAim(); return; }
    }
    if (key === 'escape') {
      ev.preventDefault();
      if (state && state.aim.active) { cancelAim(true); return; }
      if (isOpen('help')) { closeHelp(); return; }
      if (isOpen('inventory')) { closeInventory(); return; }
      if (isOpen('evolution')) { closeModal('evolution'); openModal('charselect'); return; }
      if (state && state.phase === 'paused') { resumeGame(); return; }
      if (state && state.player && state.phase !== 'gameover' && state.phase !== 'title' &&
        state.phase !== 'result' && state.phase !== 'skill') {
        pauseGame();
      }
      return;
    }
    if (key === 'i') {
      ev.preventDefault();
      toggleInventory();
      return;
    }
    if (key === 'm') {
      ev.preventDefault();
      toggleSound();
      return;
    }
    if (key === 'h') {
      ev.preventDefault();
      if (isOpen('help')) { closeHelp(); } else { openHelp(state && state.player ? 'pause' : 'title'); }
      return;
    }
    if (key === ' ' || key === 'spacebar') {
      if (state && state.phase === 'moving' && canAcceptGameplayInput()) {
        ev.preventDefault();
        triggerBurst();
      }
    }
  }

  /* ---- ポーズ / ヘルプ / インベントリ ---- */
  function pauseGame() {
    if (!state || !state.player) { return; }
    if (state.phase === 'gameover' || state.phase === 'title') { return; }
    if (anyModalOpen()) { return; }
    state.resumePhase = state.phase;
    state.phase = 'paused';
    state.aim.active = false;
    dom.canvas.classList.remove('is-aiming');
    fillStatList(dom.pauseStats, [
      { label: 'ステージ', value: stageIndexToKey(state.stageIndex) },
      { label: 'ウェーブ', value: state.waveIndex + ' / ' + WAVES_PER_STAGE },
      { label: 'HP', value: Math.ceil(state.player.hp) + ' / ' + state.player.maxHp },
      { label: '攻撃力', value: round1(state.player.atk) },
      { label: 'LUCK', value: state.player.luck },
      { label: '所持ゴールド', value: fmtNum(save.gold) + ' G' },
      { label: '発動中のシナジー', value: activeSynergyNames().join(' / ') || 'なし' }
    ]);
    setSoundUi();
    openModal('pause');
  }

  function resumeGame() {
    closeModal('pause');
    if (state) {
      state.phase = state.resumePhase || 'idle';
      state.resumePhase = null;
    }
  }

  function openHelp(returnTo) {
    helpReturnTo = returnTo || 'title';
    openModal('help');
  }

  function closeHelp() {
    closeModal('help');
    if (state && state.player && state.phase === 'paused') {
      setSoundUi();
      openModal('pause');
      return;
    }
    if (state && state.player && state.phase === 'gameover') {
      openModal('gameover');
      return;
    }
    if (state && state.player && state.phase !== 'title' && state.phase !== 'charselect') {
      updateHud();
      return;
    }
    if (helpReturnTo === 'charselect') {
      openModal('charselect');
      return;
    }
    refreshTitleInfo();
    openModal('title');
  }

  function toggleInventory() {
    if (isOpen('inventory')) { closeInventory(); return; }
    if (anyModalOpen() && !isOpen('pause') && !isOpen('title') && !isOpen('charselect') && !isOpen('help')) {
      return;
    }
    if (isOpen('help')) { closeModal('help'); }
    if (state && state.player && state.phase !== 'gameover' && state.phase !== 'title') {
      if (state.phase === 'paused') { openInventory('pause'); } else { openInventory('game'); }
    } else {
      openInventory('title');
    }
  }

  function closeInventory() {
    closeModal('inventory');
    if (state && state.player && state.phase === 'paused') {
      setSoundUi();
      openModal('pause');
      return;
    }
    if (state && state.player && state.phase === 'gameover') {
      openModal('gameover');
      return;
    }
    if (inventoryReturnTo === 'charselect' && !state.player) {
      openModal('charselect');
      return;
    }
    if (state && state.player && state.phase !== 'title' && state.phase !== 'charselect') {
      updateHud();
      return;
    }
    refreshTitleInfo();
    openModal('title');
  }

  function wipeSave() {
    var ok = window.confirm('セーブデータを消去します。よろしいですか？（元に戻せません）');
    if (!ok) { return; }
    save = createDefaultSave();
    persistSave();
    Sound.setEnabled(save.soundEnabled);
    setSoundUi();
    refreshTitleInfo();
    showToast('セーブデータを消去しました', '✕', 'warn');
  }

  function confirmRetire() {
    if (!state || !state.player) { return; }
    var ok = window.confirm('リタイアしますか？（ここまでの報酬は保存されます）');
    if (ok) { retireRun(); }
  }

  function resumeOrContinue() {
    if (state && state.player && state.phase !== 'gameover') {
      closeAllModals();
      state.phase = state.resumePhase || 'idle';
      state.resumePhase = null;
      updateHud();
      return;
    }
    startRun(save.selectedCharId);
    var target = clamp(save.bestStageIndex, 1, 9999);
    if (target > 1) {
      startStage(target);
      showToast('STAGE ' + stageIndexToKey(target) + ' から再開します', '▶', 'gold');
    }
  }

  /* ---- 委譲イベント ---- */
  function onInventoryClick(ev) {
    var actionEl = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      if (action === 'unequip') {
        unequipSlot(actionEl.getAttribute('data-slot'));
        Sfx.ui();
        showToast('装備を外しました', '◇', '');
        if (state && state.player) { recomputePlayer(false); updateHud(); }
        renderInventory();
        return;
      }
      var owner = actionEl.closest('[data-uid]');
      if (owner) {
        handleInventoryAction(owner.getAttribute('data-uid'), action);
        return;
      }
    }
    var card = ev.target.closest ? ev.target.closest('#inventory-list [data-uid]') : null;
    if (card) { handleInventoryAction(card.getAttribute('data-uid'), 'equip'); }
  }

  function onCharListClick(ev) {
    var card = ev.target.closest ? ev.target.closest('[data-char-id]') : null;
    if (!card) { return; }
    selectChar(card.getAttribute('data-char-id'));
  }

  function onInvCharListClick(ev) {
    var card = ev.target.closest ? ev.target.closest('[data-char-id]') : null;
    if (!card) { return; }
    var id = card.getAttribute('data-char-id');
    if (!save.chars[id]) {
      showToast('未所持のキャラクターです', '✕', 'warn');
      return;
    }
    save.selectedCharId = id;
    persistSave();
    renderInventoryChars();
    showToast('出撃キャラを『' + getEvolution(id, save.chars[id].star).name + '』に設定しました', '★', 'gold');
  }

  function onSkillListClick(ev) {
    var card = ev.target.closest ? ev.target.closest('[data-skill-id]') : null;
    if (!card) { return; }
    pickSkill(card.getAttribute('data-skill-id'));
  }

  /* ---- イベント登録 ---- */
  function on(id, handler) {
    var el = $(id);
    if (!el) { return; }
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      Sound.unlock();
      Sfx.ui();
      handler(ev);
    });
  }

  function onPointerCancel() {
    if (!state || !state.aim.active) { return; }
    state.aim.active = false;
    state.pointerId = null;
    state.phase = 'idle';
    dom.canvas.classList.remove('is-aiming');
  }

  function onVisibilityChange() {
    if (document.hidden) { persistSave(); }
  }

  function bindEvents() {
    dom.canvas.addEventListener('pointerdown', onPointerDown);
    dom.canvas.addEventListener('pointermove', onPointerMove);
    dom.canvas.addEventListener('pointerup', onPointerUp);
    dom.canvas.addEventListener('pointercancel', onPointerCancel);
    dom.canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    dom.canvas.addEventListener('touchstart', function (ev) { ev.preventDefault(); }, { passive: false });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', function () { persistSave(); });

    on('btn-pause', function () { if (state && state.phase === 'paused') { resumeGame(); } else { pauseGame(); } });
    on('btn-inventory', toggleInventory);
    on('btn-sound', toggleSound);
    on('btn-help', function () { openHelp(state && state.player ? 'pause' : 'title'); });
    on('btn-retire', confirmRetire);

    on('btn-continue', resumeOrContinue);
    on('btn-new-game', function () { openCharSelect(); });
    on('btn-title-inventory', function () { openInventory('title'); });
    on('btn-title-help', function () { openHelp('title'); });
    on('btn-wipe-save', wipeSave);

    on('btn-char-confirm', function () {
      if (!save.chars[selectedCharId]) { return; }
      if (!save.party) { save.party = { main: selectedCharId, subs: [] }; }
      save.party.main = selectedCharId;
      save.party.subs = (save.party.subs || []).filter(function (id) { return id !== selectedCharId; });
      persistSave();
      startRun(selectedCharId);
    });
    on('btn-char-back', function () { showTitle(); });
    on('btn-evolve', evolveChar);
    on('btn-party-sub', function () {
      if (!selectedCharId) { return; }
      assignPartySub(selectedCharId);
    });
    on('btn-auto-sell', function () {
      if (autoSellItems() > 0) { renderInventory(); }
      else { renderInventory(); }
    });
    on('btn-evolution-ok', function () {
      closeModal('evolution');
      openModal('charselect');
      renderCharSelect();
      renderCharDetail(selectedCharId, !!save.chars[selectedCharId]);
    });

    on('btn-skill-reroll', rerollSkills);
    on('btn-skill-skip', skipSkill);

    on('btn-close-inventory', closeInventory);
    on('btn-result-next', proceedFromResult);
    on('btn-gameover-retry', function () { continueFromGameover(true); });
    on('btn-gameover-title', function () { continueFromGameover(false); });
    on('btn-resume', resumeGame);
    on('btn-pause-inventory', function () { openInventory('pause'); });
    on('btn-pause-sound', toggleSound);
    on('btn-pause-retire', confirmRetire);
    on('btn-close-help', closeHelp);

    if (dom.charList) { dom.charList.addEventListener('click', onCharListClick); }
    if (dom.invCharList) { dom.invCharList.addEventListener('click', onInvCharListClick); }
    if (dom.skillList) { dom.skillList.addEventListener('click', onSkillListClick); }
    if (dom.inventoryList) { dom.inventoryList.addEventListener('click', onInventoryClick); }

    var tabs = [['inv-tab-equip', 'equip'], ['inv-tab-items', 'items'], ['inv-tab-chars', 'chars']];
    for (var i = 0; i < tabs.length; i += 1) {
      (function (entry) {
        var btn = $(entry[0]);
        if (!btn) { return; }
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          Sfx.ui();
          setInventoryTab(entry[1]);
        });
      })(tabs[i]);
    }

    var slotIds = ['equip-slot-weapon', 'equip-slot-relic'];
    for (var s = 0; s < slotIds.length; s += 1) {
      var slotEl = $(slotIds[s]);
      if (!slotEl) { continue; }
      slotEl.addEventListener('click', onInventoryClick);
    }
  }

  /* ---- 更新 ---- */
  function update(dt) {
    if (!state || !state.player) { return; }
    if (anyModalOpen()) {
      updateParticles(dt);
      updateTexts(dt);
      updateEffects(dt);
      return;
    }
    if (state.phase === 'gameover' || state.phase === 'title' || state.phase === 'charselect') { return; }
    if (state.hitStop > 0) {
      state.hitStop -= dt * 1000;
      return;
    }
    state.time += dt;
    if (state.timeScaleTimer > 0) {
      state.timeScaleTimer -= dt;
      if (state.timeScaleTimer <= 0) { state.timeScale = 1; }
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { resetCombo(); }
    }
    if (state.warpCooldown > 0) { state.warpCooldown -= dt; }
    if (state.friendChainTimer > 0) {
      state.friendChainTimer -= dt;
      if (state.friendChainTimer <= 0) {
        state.friendChain = 0;
        state.duoMembers = {};
        state.duoFired = false;
      }
    }

    var i;
    for (i = 0; i < state.obstacles.length; i += 1) {
      if (state.obstacles[i].flash > 0) { state.obstacles[i].flash -= dt; }
    }
    for (i = 0; i < state.barrels.length; i += 1) {
      if (state.barrels[i].hitFlash > 0) { state.barrels[i].hitFlash -= dt; }
    }
    for (i = 0; i < state.gears.length; i += 1) {
      if (state.gears[i].glow > 0) { state.gears[i].glow -= dt; }
      if (state.gears[i].cooldown > 0) { state.gears[i].cooldown -= dt; }
    }
    for (i = 0; i < state.warps.length; i += 1) {
      if (state.warps[i].pulse > 0) { state.warps[i].pulse -= dt * 2; }
    }
    for (i = 0; i < state.friends.length; i += 1) {
      if (state.friends[i].pulse > 0) { state.friends[i].pulse -= dt * 2; }
    }

    var sdt = dt * state.timeScale;
    if (state.phase === 'aiming' && state.aim.active) {
      updateAimLock(dt);
      var aimTick = Math.floor(state.time * 30);
      if (state.aim.ghostTick !== aimTick) {
        state.aim.ghostTick = aimTick;
        state.aim.ghost = simulateShot(state.aim.dirX, state.aim.dirY,
          state.aim.locked ? state.aim.lockedPower : state.aim.power);
      }
    }
    updateEnemies(sdt);
    updateBullets(sdt);
    updateMissiles(sdt);
    if (state.phase === 'moving') { updateBall(sdt); }
    if (state.phase === 'enemyturn') {
      state.enemyTurnTimer -= sdt;
      if (state.enemyTurnTimer <= 0 && (state.bullets.length === 0 || state.enemyTurnTimer <= -1.4)) {
        finishEnemyTurn();
      }
    }
    updateParticles(sdt);
    updateTexts(sdt);
    updateEffects(sdt);
  }

  function frame(timestamp) {
    rafId = window.requestAnimationFrame(frame);
    if (!lastFrameTime) { lastFrameTime = timestamp; }
    var dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    if (dt <= 0) { return; }
    if (dt > 0.05) { dt = 0.05; }
    update(dt);
    renderCanvas();
  }

  /* ---- 初期化 ---- */
  function init() {
    cacheDom();
    loadSave();
    Sound.setEnabled(save.soundEnabled !== false);
    state = createState();
    state.player = null;
    buildStageField(1);
    setInventoryTab('equip');
    bindEvents();
    setSoundUi();
    refreshTitleInfo();
    showTitle();
    renderCanvas();
    if (!rafId) { rafId = window.requestAnimationFrame(frame); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
