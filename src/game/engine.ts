import type {
  AvatarId,
  ChatMessage,
  ClientRoomSnapshot,
  DetectiveFinding,
  GamePhase,
  Role,
  RoomSettings,
  WinResult,
} from '../shared/types.ts';

export interface EnginePlayer {
  userId: string;
  tag: string;
  displayName: string;
  avatarId: AvatarId;
  seatIndex: number;
  isHost: boolean;
  isAlive: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  role: Role | null;
  doctorLastProtectedId: string | null;
  detectiveResults: DetectiveFinding[];
}

export interface ServerRoomState {
  code: string;
  settings: RoomSettings;
  passwordHash: string | null;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number | null;
  players: EnginePlayer[];
  vampireVotes: Record<string, string>;
  doctorTargetId: string | null;
  detectiveTargetId: string | null;
  dayVotes: Record<string, string | 'ABSTAIN'>;
  morningReport: string | null;
  hunterRevengeUserId: string | null;
  hunterRevengeNextPhase: 'DAY' | 'NIGHT' | null;
  winResult: WinResult | null;
  publicMessages: ChatMessage[];
  vampireMessages: ChatMessage[];
}

export function validateRoomSettings(
  settings: RoomSettings,
  currentPlayerCount?: number
): { valid: boolean; error?: string; villagerCount: number } {
  if (!settings.name || settings.name.trim().length < 2 || settings.name.trim().length > 36) {
    return { valid: false, error: 'Oda adı 2 ile 36 karakter arasında olmalıdır.', villagerCount: 0 };
  }
  if (!Number.isInteger(settings.capacity) || settings.capacity < 4 || settings.capacity > 16) {
    return { valid: false, error: 'Oda kapasitesi 4 ile 16 kişi arasında olmalıdır.', villagerCount: 0 };
  }
  if (settings.nightDuration < 15 || settings.nightDuration > 90) {
    return { valid: false, error: 'Gece süresi 15-90 saniye arası olmalıdır.', villagerCount: 0 };
  }
  if (settings.dayDuration < 30 || settings.dayDuration > 180) {
    return { valid: false, error: 'Gündüz süresi 30-180 saniye arası olmalıdır.', villagerCount: 0 };
  }
  if (settings.voteDuration < 15 || settings.voteDuration > 60) {
    return { valid: false, error: 'Oylama süresi 15-60 saniye arası olmalıdır.', villagerCount: 0 };
  }

  const r = settings.roles;
  if (r.VAMPIRE < 1) {
    return { valid: false, error: 'En az 1 Vampir seçilmelidir.', villagerCount: 0 };
  }
  if (r.VAMPIRE < 0 || r.DOCTOR < 0 || r.DETECTIVE < 0 || r.HUNTER < 0 || r.JESTER < 0) {
    return { valid: false, error: 'Rol sayıları negatif olamaz.', villagerCount: 0 };
  }

  const specialTotal = r.VAMPIRE + r.DOCTOR + r.DETECTIVE + r.HUNTER + r.JESTER;
  const referenceCount = currentPlayerCount && currentPlayerCount >= 4 ? currentPlayerCount : settings.capacity;

  if (specialTotal >= referenceCount) {
    return {
      valid: false,
      error: 'Özel rollerin toplamı oyuncu sayısından en az 1 eksik olmalıdır (en az 1 Köylü kalmalı).',
      villagerCount: 0,
    };
  }
  if (r.VAMPIRE * 2 >= referenceCount) {
    return {
      valid: false,
      error: 'Vampir sayısı toplam oyuncu sayısının yarısından az olmalıdır.',
      villagerCount: 0,
    };
  }

  return {
    valid: true,
    villagerCount: referenceCount - specialTotal,
  };
}

export function assignRoles(
  playerIds: string[],
  settings: RoomSettings,
  rng: () => number = Math.random
): Record<string, Role> {
  const n = playerIds.length;
  const deck: Role[] = [];
  const { VAMPIRE, DOCTOR, DETECTIVE, HUNTER, JESTER } = settings.roles;

  // Scale special roles safely if fewer than capacity joined (minimum 4 players)
  const vampCount = Math.min(VAMPIRE, Math.max(1, Math.floor((n - 1) / 2)));
  for (let i = 0; i < vampCount; i++) deck.push('VAMPIRE');

  const remainingSlots = n - deck.length - 1; // keep at least 1 Villager
  const addLimited = (role: Role, requested: number) => {
    for (let i = 0; i < requested && deck.length < n - 1 && remainingSlots > 0; i++) {
      deck.push(role);
    }
  };

  addLimited('DOCTOR', DOCTOR);
  addLimited('DETECTIVE', DETECTIVE);
  addLimited('HUNTER', HUNTER);
  addLimited('JESTER', JESTER);

  while (deck.length < n) {
    deck.push('VILLAGER');
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  const assigned: Record<string, Role> = {};
  playerIds.forEach((id, idx) => {
    assigned[id] = deck[idx];
  });
  return assigned;
}

export function checkWinCondition(players: EnginePlayer[]): WinResult | null {
  const alive = players.filter((p) => p.isAlive);
  const aliveVampires = alive.filter((p) => p.role === 'VAMPIRE');
  const aliveOthers = alive.filter((p) => p.role !== 'VAMPIRE');

  if (aliveVampires.length === 0) {
    return {
      winner: 'VILLAGERS',
      reason: 'Köydeki tüm vampirler etkisiz hale getirildi. Masumlar zafer kazandı!',
    };
  }

  if (aliveVampires.length >= aliveOthers.length) {
    return {
      winner: 'VAMPIRES',
      reason: 'Vampirler köyde sayısal üstünlüğü ele geçirdi. Karanlık hüküm sürüyor!',
    };
  }

  return null;
}

export function performNightAction(
  room: ServerRoomState,
  actorId: string,
  targetId: string
): {
  ok: boolean;
  reason?: string;
  detectiveFinding?: DetectiveFinding;
} {
  if (room.phase !== 'NIGHT') {
    return { ok: false, reason: 'Gece aksiyonu yalnızca Gece fazında yapılabilir.' };
  }

  const actor = room.players.find((p) => p.userId === actorId);
  if (!actor || !actor.isAlive || !actor.role) {
    return { ok: false, reason: 'Geçersiz veya elenmiş oyuncu.' };
  }

  const target = room.players.find((p) => p.userId === targetId);
  if (!target || !target.isAlive) {
    return { ok: false, reason: 'Hedef oyuncu hayatta değil.' };
  }

  if (actor.role === 'VAMPIRE') {
    if (target.role === 'VAMPIRE') {
      return { ok: false, reason: 'Başka bir vampiri hedef alamazsın.' };
    }
    room.vampireVotes[actorId] = targetId;
    return { ok: true };
  }

  if (actor.role === 'DOCTOR') {
    if (actor.doctorLastProtectedId && actor.doctorLastProtectedId === targetId) {
      return { ok: false, reason: 'Üst üste iki gece aynı oyuncuyu koruyamazsın.' };
    }
    room.doctorTargetId = targetId;
    return { ok: true };
  }

  if (actor.role === 'DETECTIVE') {
    if (targetId === actorId) {
      return { ok: false, reason: 'Kendini soruşturamazsın.' };
    }
    const alreadyInvestigatedThisRound = actor.detectiveResults.some(
      (r) => r.round === room.round
    );
    if (alreadyInvestigatedThisRound) {
      return { ok: false, reason: 'Bu gece zaten bir soruşturma yaptın.' };
    }
    room.detectiveTargetId = targetId;
    const finding: DetectiveFinding = {
      round: room.round,
      targetId: target.userId,
      targetName: target.displayName,
      alignment: target.role === 'VAMPIRE' ? 'VAMPIRE' : 'INNOCENT',
    };
    actor.detectiveResults.push(finding);
    return { ok: true, detectiveFinding: finding };
  }

  return { ok: false, reason: 'Rolünün gece aktif bir hamlesi yok.' };
}

export function resolveNightPhase(
  room: ServerRoomState,
  rng: () => number = Math.random
): {
  killedId: string | null;
  savedByDoctor: boolean;
  triggerHunterRevenge: boolean;
  morningReport: string;
  winResult: WinResult | null;
} {
  // Commit doctor's last protected ID for next round constraint
  const doctor = room.players.find((p) => p.isAlive && p.role === 'DOCTOR');
  if (doctor) {
    doctor.doctorLastProtectedId = room.doctorTargetId;
  }

  // Tally vampire votes
  const counts = new Map<string, number>();
  for (const targetId of Object.values(room.vampireVotes)) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }

  let selectedTargetId: string | null = null;
  if (counts.size > 0) {
    let maxVotes = 0;
    let tiedTargets: string[] = [];
    for (const [tid, count] of counts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        tiedTargets = [tid];
      } else if (count === maxVotes) {
        tiedTargets.push(tid);
      }
    }
    selectedTargetId = tiedTargets[Math.floor(rng() * tiedTargets.length)];
  }

  let killedId: string | null = null;
  let savedByDoctor = false;
  let triggerHunterRevenge = false;
  let morningReport = 'Gece köyde derin bir sessizlik hakimdi. Kimse saldırıya uğramadı.';

  if (selectedTargetId) {
    if (room.doctorTargetId === selectedTargetId) {
      savedByDoctor = true;
      morningReport =
        'Gece karanlıkta bir saldırı gerçekleşti, ancak köyün doktoru zamanında yetişip kurbanı kurtardı!';
    } else {
      const victim = room.players.find((p) => p.userId === selectedTargetId);
      if (victim && victim.isAlive) {
        victim.isAlive = false;
        killedId = victim.userId;
        morningReport = `Şafak söktüğünde ${victim.displayName} cansız bulundu!`;
        if (victim.role === 'HUNTER') {
          triggerHunterRevenge = true;
        }
      }
    }
  }

  // Clear night selections
  room.vampireVotes = {};
  room.doctorTargetId = null;
  room.detectiveTargetId = null;
  room.morningReport = morningReport;

  if (triggerHunterRevenge && killedId) {
    room.hunterRevengeUserId = killedId;
    room.hunterRevengeNextPhase = 'DAY';
    return {
      killedId,
      savedByDoctor,
      triggerHunterRevenge: true,
      morningReport,
      winResult: null,
    };
  }

  const winResult = checkWinCondition(room.players);
  if (winResult) {
    room.winResult = winResult;
  }

  return {
    killedId,
    savedByDoctor,
    triggerHunterRevenge: false,
    morningReport,
    winResult,
  };
}

export function castDayVote(
  room: ServerRoomState,
  voterId: string,
  targetId: string | 'ABSTAIN'
): { ok: boolean; reason?: string } {
  if (room.phase !== 'VOTING') {
    return { ok: false, reason: 'Oy yalnızca Oylama fazında kullanılabilir.' };
  }

  const voter = room.players.find((p) => p.userId === voterId);
  if (!voter || !voter.isAlive) {
    return { ok: false, reason: 'Yalnızca hayattaki oyuncular oy kullanabilir.' };
  }

  if (targetId !== 'ABSTAIN') {
    const target = room.players.find((p) => p.userId === targetId);
    if (!target || !target.isAlive) {
      return { ok: false, reason: 'Yalnızca hayattaki bir oyuncuya oy verilebilir.' };
    }
  }

  room.dayVotes[voterId] = targetId;
  return { ok: true };
}

export function resolveVotingPhase(room: ServerRoomState): {
  lynchedId: string | null;
  isTie: boolean;
  triggerHunterRevenge: boolean;
  jesterWonId: string | null;
  summaryText: string;
  winResult: WinResult | null;
} {
  const counts = new Map<string, number>();
  let abstainCount = 0;

  for (const target of Object.values(room.dayVotes)) {
    if (target === 'ABSTAIN') {
      abstainCount += 1;
    } else {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }

  let topTargetId: string | null = null;
  let topCount = 0;
  let isTie = false;

  for (const [tid, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topTargetId = tid;
      isTie = false;
    } else if (count === topCount) {
      isTie = true;
    }
  }

  room.dayVotes = {};

  if (!topTargetId || isTie || topCount <= abstainCount && counts.size === 0) {
    return {
      lynchedId: null,
      isTie,
      triggerHunterRevenge: false,
      jesterWonId: null,
      summaryText: isTie
        ? 'Oylar eşit çıktı! Köy halkı kararsız kaldığı için kimse asılmadı.'
        : 'Yeterli oy toplanamadı, bugün kimse idam edilmedi.',
      winResult: null,
    };
  }

  const target = room.players.find((p) => p.userId === topTargetId);
  if (!target || !target.isAlive) {
    return {
      lynchedId: null,
      isTie: false,
      triggerHunterRevenge: false,
      jesterWonId: null,
      summaryText: 'Oylama geçersiz kaldı.',
      winResult: null,
    };
  }

  target.isAlive = false;

  // Jester wins immediately on lynch!
  if (target.role === 'JESTER') {
    const winResult: WinResult = {
      winner: 'JESTER',
      reason: `Soytarı (${target.displayName}) kendini köy halkına astırmayı başardı ve oyunu tek başına kazandı!`,
      jesterWinnerId: target.userId,
    };
    room.winResult = winResult;
    return {
      lynchedId: target.userId,
      isTie: false,
      triggerHunterRevenge: false,
      jesterWonId: target.userId,
      summaryText: `${target.displayName} asıldı... Ama yüzünde alaycı bir gülümseme vardı: O bir Soytarıydı!`,
      winResult,
    };
  }

  if (target.role === 'HUNTER') {
    room.hunterRevengeUserId = target.userId;
    room.hunterRevengeNextPhase = 'NIGHT';
    return {
      lynchedId: target.userId,
      isTie: false,
      triggerHunterRevenge: true,
      jesterWonId: null,
      summaryText: `${target.displayName} oylama sonucu elendi. Son nefesini vermeden önce bir avcı atışı yapacak!`,
      winResult: null,
    };
  }

  const winResult = checkWinCondition(room.players);
  if (winResult) {
    room.winResult = winResult;
  }

  return {
    lynchedId: target.userId,
    isTie: false,
    triggerHunterRevenge: false,
    jesterWonId: null,
    summaryText: `Köy meclisi kararını verdi: ${target.displayName} asılarak elendi.`,
    winResult,
  };
}

export function resolveHunterRevenge(
  room: ServerRoomState,
  hunterId: string,
  targetId: string
): {
  ok: boolean;
  reason?: string;
  killedId?: string;
  killedName?: string;
  winResult?: WinResult | null;
} {
  if (room.phase !== 'HUNTER_REVENGE' || room.hunterRevengeUserId !== hunterId) {
    return { ok: false, reason: 'Şu anda avcı intikam hakkın bulunmuyor.' };
  }

  const target = room.players.find((p) => p.userId === targetId);
  if (!target || !target.isAlive) {
    return { ok: false, reason: 'Hedef oyuncu hayatta değil.' };
  }

  target.isAlive = false;
  room.hunterRevengeUserId = null;

  const winResult = checkWinCondition(room.players);
  if (winResult) {
    room.winResult = winResult;
  }

  return {
    ok: true,
    killedId: target.userId,
    killedName: target.displayName,
    winResult,
  };
}

/**
 * STRICT ANTI-CHEAT FILTER:
 * Never leaks alive players' secret roles, vampire night chat,
 * or another player's private detective/doctor state to unauthorized sockets.
 */
export function sanitizeRoomForClient(
  room: ServerRoomState,
  viewerUserId: string
): ClientRoomSnapshot {
  const viewer = room.players.find((p) => p.userId === viewerUserId);
  const viewerRole = viewer?.role ?? null;
  const isViewerVampire = viewerRole === 'VAMPIRE';
  const isGameOver = room.phase === 'GAME_OVER';

  // Count visible day votes per player during VOTING
  const voteCounts = new Map<string, number>();
  if (room.phase === 'VOTING') {
    for (const target of Object.values(room.dayVotes)) {
      if (target !== 'ABSTAIN') {
        voteCounts.set(target, (voteCounts.get(target) ?? 0) + 1);
      }
    }
  }

  const publicPlayers = room.players.map((p) => {
    const canSeeRole =
      isGameOver ||
      !p.isAlive ||
      p.userId === viewerUserId ||
      (isViewerVampire && p.role === 'VAMPIRE');

    return {
      userId: p.userId,
      tag: p.tag,
      displayName: p.displayName,
      avatarId: p.avatarId,
      seatIndex: p.seatIndex,
      isHost: p.isHost,
      isAlive: p.isAlive,
      connected: p.connected,
      disconnectedAt: p.disconnectedAt,
      revealedRole: canSeeRole ? p.role : null,
      votesReceived: voteCounts.get(p.userId) ?? 0,
      hasVoted: room.phase === 'VOTING' ? Boolean(room.dayVotes[p.userId]) : false,
    };
  });

  let myNightTargetId: string | null = null;
  if (viewerRole === 'VAMPIRE') {
    myNightTargetId = room.vampireVotes[viewerUserId] ?? null;
  } else if (viewerRole === 'DOCTOR') {
    myNightTargetId = room.doctorTargetId;
  } else if (viewerRole === 'DETECTIVE') {
    myNightTargetId = room.detectiveTargetId;
  }

  const teammates = isViewerVampire
    ? room.players
        .filter((p) => p.role === 'VAMPIRE' && p.userId !== viewerUserId)
        .map((p) => p.userId)
    : [];

  return {
    code: room.code,
    settings: {
      ...room.settings,
      roles: { ...room.settings.roles },
    },
    phase: room.phase,
    round: room.round,
    phaseEndsAt: room.phaseEndsAt,
    players: publicPlayers,
    morningReport: room.morningReport,
    hunterRevengeUserId: room.hunterRevengeUserId,
    hunterRevengeNextPhase: room.hunterRevengeNextPhase,
    winResult: room.winResult,
    publicMessages: room.publicMessages.slice(-80),
    vampireMessages: isViewerVampire || isGameOver ? room.vampireMessages.slice(-80) : [],
    privateState: {
      myRole: viewerRole,
      teammates,
      doctorLastProtectedId: viewer?.doctorLastProtectedId ?? null,
      detectiveResults: viewer?.detectiveResults ? [...viewer.detectiveResults] : [],
      myNightTargetId,
      myVoteTargetId: room.dayVotes[viewerUserId] ?? null,
      vampireVotes: isViewerVampire ? { ...room.vampireVotes } : {},
    },
  };
}
