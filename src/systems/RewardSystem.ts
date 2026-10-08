import type { GameSave } from './SaveSystem';
import type { RaceResults, ResultRow } from '../stores/game';
import type { Racer } from '../entities/Racer';
import type { GameMode } from '../core/types';
import type { Standing } from './RacingSystem';
import { CAREER, careerIndex, eliminationUnlocked } from '../data/career';
import { checkAchievements } from '../data/achievements';
import { TRACKS, getTrack } from '../tracks/TrackConfig';

const PLACE_COINS = [300, 200, 150, 80, 60, 45, 30, 20];

export interface RewardInput {
  mode: GameMode;
  trackId: string;
  player: Racer;
  standings: Standing[];
  raceTime: number;
  distance: number;
  shortcutIds: string[];
}

/** 结算：计算金币、星级、解锁并写入存档（PRD 14.1 金币获取） */
export function applyRewards(save: GameSave, inp: RewardInput): RaceResults {
  const p = inp.player;
  const track = getTrack(inp.trackId);
  const breakdown: { label: string; amount: number }[] = [];
  const unlocks: string[] = [];
  const finished = p.finished;
  const place = p.place;
  const isRace = inp.mode !== 'timetrial' && inp.mode !== 'endless';
  const stat = p.stat;
  const bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : 0;

  if (inp.mode === 'endless') {
    const d = Math.floor(inp.distance);
    breakdown.push({ label: `行驶 ${(d / 1000).toFixed(2)} 公里`, amount: Math.floor(d / 15) });
  } else if (finished || inp.mode === 'elimination') {
    if (finished) breakdown.push({ label: '完成比赛', amount: 50 });
    if (isRace) {
      const pc = PLACE_COINS[place - 1] ?? 0;
      if (pc) breakdown.push({ label: place <= 3 ? `获得第 ${place} 名（前三奖励）` : `第 ${place} 名`, amount: inp.mode === 'elimination' ? Math.round(pc * 1.2) : pc });
    }
  }
  if (inp.mode === 'timetrial' && finished) {
    breakdown.push({ label: '计时挑战完成', amount: 100 });
  }
  const hitsCoins = Math.min(stat.hits, 40) * 5;
  if (hitsCoins) breakdown.push({ label: `攻击命中 ×${stat.hits}`, amount: hitsCoins });
  if (stat.kos) breakdown.push({ label: `击倒对手 ×${stat.kos}`, amount: stat.kos * 20 });
  if (stat.tricks) breakdown.push({ label: `空中特技 ×${stat.tricks}`, amount: stat.tricks * 10 });

  // 捷径：首次发现奖励
  for (const id of inp.shortcutIds) {
    if (!save.discoveredShortcuts.includes(id)) {
      save.discoveredShortcuts.push(id);
      const sc = TRACKS.flatMap((t) => t.shortcuts).find((s) => s.id === id);
      breakdown.push({ label: `发现隐藏捷径：${sc?.name ?? id}`, amount: 100 });
    }
  }

  // 生涯：星级与额外挑战
  let stars = 0;
  let prevStars = 0;
  let challenge = '';
  let challengeDone = false;
  if (inp.mode === 'career') {
    const lv = CAREER[careerIndex(inp.trackId)];
    prevStars = save.careerProgress[inp.trackId] ?? 0;
    challenge = lv.challenge.desc;
    const c = lv.challenge;
    challengeDone =
      c.type === 'ko' ? stat.kos >= c.target :
      c.type === 'drift' ? stat.driftDist >= c.target :
      c.type === 'special' ? stat.specialHits >= c.target :
      c.type === 'shortcut' ? stat.shortcuts.size >= c.target :
      c.type === 'trick' ? stat.tricks >= c.target :
      stat.crashes === 0 && finished;
    if (finished) stars = 1;
    if (finished && place <= 3) stars = 2;
    if (finished && place === 1 && challengeDone) stars = 3;
    if (challengeDone) breakdown.push({ label: `完成特殊挑战：${c.desc}`, amount: 150 });
    if (stars > prevStars) {
      const gain = Math.round((lv.reward * (stars - prevStars)) / 3);
      breakdown.push({ label: `生涯关卡 ${stars}★ 首次达成`, amount: gain });
      save.careerProgress[inp.trackId] = stars;
      // 解锁下一关与赛道
      const i = careerIndex(inp.trackId);
      if (prevStars === 0 && stars >= 1) {
        const next = CAREER[i + 1];
        if (next && !save.unlockedTracks.includes(next.trackId)) {
          save.unlockedTracks.push(next.trackId);
          unlocks.push(`新赛道：${getTrack(next.trackId).name}`);
        }
        const before = eliminationUnlocked({ ...save.careerProgress, [inp.trackId]: prevStars });
        if (!before && eliminationUnlocked(save.careerProgress)) unlocks.push('新模式：暴力淘汰赛');
      }
    }
  }

  let coins = breakdown.reduce((a, b) => a + b.amount, 0);
  if (inp.mode === 'chaos') {
    const bonus = Math.round(coins * 0.2);
    breakdown.push({ label: '疯狂混战加成 +20%', amount: bonus });
    coins += bonus;
  }
  if (p.pelicanDef.id === 'golden') {
    const bonus = Math.round(coins * 0.2);
    breakdown.push({ label: '黄金鹈鹕加成 +20%', amount: bonus });
    coins += bonus;
  }

  // 纪录
  let newRecord = false;
  if (bestLap > 0 && inp.mode !== 'endless') {
    const old = save.bestLapTimes[inp.trackId];
    if (!old || bestLap < old) {
      save.bestLapTimes[inp.trackId] = bestLap;
      newRecord = true;
      if (inp.mode === 'timetrial') {
        breakdown.push({ label: '刷新最快圈速', amount: 150 });
        coins += 150;
      }
    }
  }
  if (finished && p.finishTime > 0 && inp.mode !== 'endless') {
    const old = save.bestRaceTimes[inp.trackId];
    if (!old || p.finishTime < old) save.bestRaceTimes[inp.trackId] = p.finishTime;
  }

  save.coins += coins;
  // 统计
  const st = save.stats;
  st.races++;
  if (isRace && finished && place === 1) st.wins++;
  if (isRace && finished && place <= 3) st.podiums++;
  if (isRace && finished && place === 1 && stat.crashes === 0) st.perfectWins++;
  if (inp.mode === 'elimination' && place === 1) st.eliminationWins++;
  st.kos += stat.kos;
  st.hits += stat.hits;
  st.driftDistance += stat.driftDist;
  st.tricks += stat.tricks;
  st.clampHits += stat.clampHits;
  st.coinsEarned += coins;
  st.distance += inp.distance;
  if (inp.mode === 'endless') st.endlessBest = Math.max(st.endlessBest, inp.distance);
  for (const it of stat.itemsUsed) if (!st.itemsUsed.includes(it)) st.itemsUsed.push(it);
  if (!save.seenTracks.includes(inp.trackId)) save.seenTracks.push(inp.trackId);

  const achievements = checkAchievements(save);
  for (const a of achievements) unlocks.push(`成就「${a.name}」+${a.reward} 金币`);

  const rows: ResultRow[] = inp.standings.map((s) => ({
    name: s.racer.name,
    pelican: s.racer.pelicanDef.name,
    bike: s.racer.bikeDef.name,
    place: s.place,
    time: s.time,
    estimated: s.estimated,
    isPlayer: s.racer.isPlayer,
    kos: s.racer.stat.kos,
    eliminated: s.racer.state === 'eliminated',
  }));

  return {
    mode: inp.mode,
    trackId: inp.trackId,
    trackName: inp.mode === 'endless' ? '无尽公路' : track.name,
    rows,
    place,
    time: p.finished ? p.finishTime : inp.raceTime,
    bestLap,
    hits: stat.hits,
    kos: stat.kos,
    drift: stat.driftDist,
    tricks: stat.tricks,
    crashes: stat.crashes,
    coins,
    breakdown,
    unlocks,
    stars,
    prevStars,
    challenge,
    challengeDone,
    newRecord,
    achievements,
    distance: inp.distance,
    score: Math.floor(inp.distance + stat.kos * 100 + stat.tricks * 50),
  };
}
