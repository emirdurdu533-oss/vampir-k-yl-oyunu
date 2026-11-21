import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignRoles,
  castDayVote,
  checkWinCondition,
  performNightAction,
  resolveHunterRevenge,
  resolveNightPhase,
  resolveVotingPhase,
  sanitizeRoomForClient,
  validateRoomSettings,
  type ServerRoomState,
} from './engine.ts';
import type { Role, RoomSettings } from '../shared/types.ts';

function makeSettings(overrides: Partial<RoomSettings> = {}): RoomSettings {
  return {
    name: 'Gece Meclisi',
    capacity: 6,
    isPublic: true,
    hasPassword: false,
    nightDuration: 30,
    dayDuration: 60,
    voteDuration: 30,
    roles: {
      VAMPIRE: 2,
      DOCTOR: 1,
      DETECTIVE: 1,
      HUNTER: 0,
      JESTER: 0,
    },
    ...overrides,
  };
}

function makeRoom(roles: Role[]): ServerRoomState {
  return {
    code: 'ABC123',
    settings: makeSettings({ capacity: roles.length }),
    passwordHash: null,
    phase: 'NIGHT',
    round: 1,
    phaseEndsAt: Date.now() + 30000,
    players: roles.map((role, idx) => ({
      userId: `u${idx + 1}`,
      tag: `@oyuncu${idx + 1}#100${idx + 1}`,
      displayName: `Oyuncu ${idx + 1}`,
      avatarId: 'count',
      seatIndex: idx,
      isHost: idx === 0,
      isAlive: true,
      connected: true,
      disconnectedAt: null,
      role,
      doctorLastProtectedId: null,
      detectiveResults: [],
    })),
    vampireVotes: {},
    doctorTargetId: null,
    detectiveTargetId: null,
    dayVotes: {},
    morningReport: null,
    hunterRevengeUserId: null,
    hunterRevengeNextPhase: null,
    winResult: null,
    publicMessages: [
      {
        id: 'm1',
        channel: 'DAY',
        senderId: 'u1',
        senderName: 'Oyuncu 1',
        senderAvatar: 'count',
        text: 'Herkese merhaba',
        timestamp: 1000,
      },
    ],
    vampireMessages: [
      {
        id: 'vm1',
        channel: 'VAMPIRE',
        senderId: 'u1',
        senderName: 'Oyuncu 1',
        senderAvatar: 'count',
        text: 'u3 hedef olsun',
        timestamp: 1001,
      },
    ],
  };
}

test('validateRoomSettings enforces capacity 4-16 and vampire majority guard', () => {
  const valid6 = validateRoomSettings(makeSettings({ capacity: 6 }));
  assert.equal(valid6.valid, true);
  assert.equal(valid6.villagerCount, 2);

  const valid4 = validateRoomSettings(
    makeSettings({
      capacity: 4,
      roles: { VAMPIRE: 1, DOCTOR: 1, DETECTIVE: 1, HUNTER: 0, JESTER: 0 },
    })
  );
  assert.equal(valid4.valid, true);
  assert.equal(valid4.villagerCount, 1);

  const valid5 = validateRoomSettings(
    makeSettings({
      capacity: 5,
      roles: { VAMPIRE: 1, DOCTOR: 1, DETECTIVE: 1, HUNTER: 1, JESTER: 0 },
    })
  );
  assert.equal(valid5.valid, true);
  assert.equal(valid5.villagerCount, 1);

  const tooSmall = validateRoomSettings(makeSettings({ capacity: 3 }));
  assert.equal(tooSmall.valid, false);

  const tooManyVamps = validateRoomSettings(
    makeSettings({
      capacity: 4,
      roles: { VAMPIRE: 2, DOCTOR: 1, DETECTIVE: 0, HUNTER: 0, JESTER: 0 },
    })
  );
  assert.equal(tooManyVamps.valid, false);
});

test('assignRoles distributes exact requested counts and scales safely for 4-5 players', () => {
  const playerIds6 = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
  const assigned6 = assignRoles(playerIds6, makeSettings());
  const counts6 = Object.values(assigned6).reduce<Record<string, number>>((acc, role) => {
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});
  assert.equal(counts6.VAMPIRE, 2);
  assert.equal(counts6.DOCTOR, 1);
  assert.equal(counts6.DETECTIVE, 1);
  assert.equal(counts6.VILLAGER, 2);

  // Even if room settings had 2 vampires for 8 capacity, starting with 4 players scales to 1 vampire + >=1 villager
  const assigned4 = assignRoles(['p1', 'p2', 'p3', 'p4'], makeSettings({ capacity: 8 }));
  const counts4 = Object.values(assigned4).reduce<Record<string, number>>((acc, role) => {
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});
  assert.equal(counts4.VAMPIRE, 1);
  assert.ok((counts4.VILLAGER ?? 0) >= 1);

  const assigned5 = assignRoles(['p1', 'p2', 'p3', 'p4', 'p5'], makeSettings({ capacity: 5 }));
  assert.equal(Object.keys(assigned5).length, 5);
});

test('doctor saves target on night 1 and cannot protect same target on night 2', () => {
  const room = makeRoom(['VAMPIRE', 'DOCTOR', 'DETECTIVE', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
  // Vampire targets u4, Doctor protects u4
  assert.equal(performNightAction(room, 'u1', 'u4').ok, true);
  assert.equal(performNightAction(room, 'u2', 'u4').ok, true);
  // Detective investigates u1 -> VAMPIRE
  const det = performNightAction(room, 'u3', 'u1');
  assert.equal(det.ok, true);
  assert.equal(det.detectiveFinding?.alignment, 'VAMPIRE');

  const morning = resolveNightPhase(room);
  assert.equal(morning.savedByDoctor, true);
  assert.equal(morning.killedId, null);
  assert.equal(room.players.find((p) => p.userId === 'u4')?.isAlive, true);

  // Night 2: doctor tries u4 again -> rejected
  room.round = 2;
  room.phase = 'NIGHT';
  const secondProtect = performNightAction(room, 'u2', 'u4');
  assert.equal(secondProtect.ok, false);

  // Night 2: doctor protects u5 -> allowed, u4 dies
  assert.equal(performNightAction(room, 'u2', 'u5').ok, true);
  assert.equal(performNightAction(room, 'u1', 'u4').ok, true);
  const morning2 = resolveNightPhase(room);
  assert.equal(morning2.savedByDoctor, false);
  assert.equal(morning2.killedId, 'u4');
  assert.equal(room.players.find((p) => p.userId === 'u4')?.isAlive, false);
});

test('jester wins solo immediately when lynched during day vote', () => {
  const room = makeRoom(['VAMPIRE', 'DOCTOR', 'JESTER', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
  room.phase = 'VOTING';
  assert.equal(castDayVote(room, 'u1', 'u3').ok, true);
  assert.equal(castDayVote(room, 'u2', 'u3').ok, true);
  assert.equal(castDayVote(room, 'u4', 'u3').ok, true);

  const voteResult = resolveVotingPhase(room);
  assert.equal(voteResult.lynchedId, 'u3');
  assert.equal(voteResult.jesterWonId, 'u3');
  assert.equal(voteResult.winResult?.winner, 'JESTER');
});

test('hunter triggers revenge when killed at night and eliminates chosen target', () => {
  const room = makeRoom(['VAMPIRE', 'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
  assert.equal(performNightAction(room, 'u1', 'u2').ok, true);
  const morning = resolveNightPhase(room);
  assert.equal(morning.killedId, 'u2');
  assert.equal(morning.triggerHunterRevenge, true);
  assert.equal(room.hunterRevengeUserId, 'u2');

  room.phase = 'HUNTER_REVENGE';
  const revenge = resolveHunterRevenge(room, 'u2', 'u1');
  assert.equal(revenge.ok, true);
  assert.equal(revenge.killedId, 'u1');
  assert.equal(revenge.winResult?.winner, 'VILLAGERS');
});

test('vampire win condition triggers when vampires equal alive innocents', () => {
  const room = makeRoom(['VAMPIRE', 'VAMPIRE', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER']);
  room.players[2].isAlive = false;
  room.players[3].isAlive = false;
  // Alive: 2 vampires, 2 villagers -> Vampires win
  const win = checkWinCondition(room.players);
  assert.equal(win?.winner, 'VAMPIRES');
});

test('sanitizeRoomForClient never leaks secret roles or vampire chat to villagers', () => {
  const room = makeRoom(['VAMPIRE', 'VAMPIRE', 'DOCTOR', 'DETECTIVE', 'VILLAGER', 'JESTER']);
  room.vampireVotes = { u1: 'u5' };

  const villagerView = sanitizeRoomForClient(room, 'u5');
  assert.equal(villagerView.privateState.myRole, 'VILLAGER');
  assert.equal(villagerView.privateState.teammates.length, 0);
  assert.deepEqual(villagerView.privateState.vampireVotes, {});
  assert.equal(villagerView.vampireMessages.length, 0);

  // Other alive players' roles must be null!
  const u1Public = villagerView.players.find((p) => p.userId === 'u1');
  const u3Public = villagerView.players.find((p) => p.userId === 'u3');
  assert.equal(u1Public?.revealedRole, null);
  assert.equal(u3Public?.revealedRole, null);

  // Vampire DOES see fellow vampire and vampire chat, but NOT doctor/detective
  const vampView = sanitizeRoomForClient(room, 'u1');
  assert.equal(vampView.privateState.myRole, 'VAMPIRE');
  assert.deepEqual(vampView.privateState.teammates, ['u2']);
  assert.equal(vampView.vampireMessages.length, 1);
  assert.equal(vampView.players.find((p) => p.userId === 'u2')?.revealedRole, 'VAMPIRE');
  assert.equal(vampView.players.find((p) => p.userId === 'u3')?.revealedRole, null);
});
