import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
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
} from '../game/engine.ts';
import type {
  ChatChannel,
  ChatMessage,
  LobbyInvitePayload,
  RoomSettings,
  RoomSummary,
  UserStatus,
} from '../shared/types.ts';
import { hashPassword, verifyPassword, verifySessionToken } from './auth.ts';
import { store, type StoredUser } from './store.ts';

const RECONNECT_GRACE_MS = 45_000;
const LOBBY_DISCONNECT_GRACE_MS = 12_000;
const ROLE_REVEAL_MS = 6_000;
const MORNING_MS = 6_000;
const HUNTER_REVENGE_MS = 20_000;

interface RoomInternal extends ServerRoomState {
  phaseTimer: NodeJS.Timeout | null;
  earlyAdvanceTimer: NodeJS.Timeout | null;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  statsRecorded: boolean;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function makeSystemMsg(text: string): ChatMessage {
  return {
    id: `sys_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    channel: 'SYSTEM',
    senderId: 'system',
    senderName: 'Köy Meclisi',
    senderAvatar: 'system',
    text,
    timestamp: Date.now(),
  };
}

export class GameManager {
  private io: Server;
  private rooms = new Map<string, RoomInternal>();
  private userSockets = new Map<string, Set<string>>();
  private userRoomMap = new Map<string, string>(); // userId -> roomCode

  constructor(io: Server) {
    this.io = io;
    this.setupSocketAuthAndHandlers();
  }

  public getUserPresence(userId: string): { status: UserStatus; roomCode?: string } {
    const sockets = this.userSockets.get(userId);
    const roomCode = this.userRoomMap.get(userId);
    if (!sockets || sockets.size === 0) {
      return { status: 'offline' };
    }
    if (roomCode) {
      return { status: 'in_game', roomCode };
    }
    return { status: 'online' };
  }

  public getPublicRooms(): RoomSummary[] {
    const summaries: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (!room.settings.isPublic) continue;
      const host = room.players.find((p) => p.isHost);
      summaries.push({
        code: room.code,
        name: room.settings.name,
        hostName: host?.displayName ?? 'Kurucu',
        playerCount: room.players.length,
        capacity: room.settings.capacity,
        isPublic: room.settings.isPublic,
        hasPassword: Boolean(room.passwordHash),
        phase: room.phase,
      });
    }
    return summaries.sort((a, b) => b.playerCount - a.playerCount);
  }

  private setupSocketAuthAndHandlers(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') {
        return next(new Error('Oturum doğrulaması gerekli.'));
      }
      const userId = verifySessionToken(token);
      if (!userId) {
        return next(new Error('Geçersiz veya süresi dolmuş oturum.'));
      }
      const user = store.findUserById(userId);
      if (!user) {
        return next(new Error('Kullanıcı bulunamadı.'));
      }
      socket.data.userId = user.id;
      next();
    });

    this.io.on('connection', (socket) => {
      const userId = socket.data.userId as string;
      this.registerSocket(userId, socket);

      // Auto-restore active room on reconnect!
      const existingRoomCode = this.userRoomMap.get(userId);
      if (existingRoomCode) {
        const room = this.rooms.get(existingRoomCode);
        if (room) {
          this.handlePlayerReconnected(room, userId, socket);
        } else {
          this.userRoomMap.delete(userId);
        }
      }

      socket.emit('rooms:list', this.getPublicRooms());

      socket.on('rooms:fetch', () => {
        socket.emit('rooms:list', this.getPublicRooms());
      });

      socket.on(
        'room:create',
        (
          payload: { settings: RoomSettings; password?: string },
          cb?: (res: { ok: boolean; code?: string; error?: string }) => void
        ) => {
          const user = store.findUserById(userId);
          if (!user) return cb?.({ ok: false, error: 'Kullanıcı bulunamadı.' });

          const settings = payload?.settings;
          if (!settings) return cb?.({ ok: false, error: 'Geçersiz oda ayarları.' });

          const cleanSettings: RoomSettings = {
            name: String(settings.name || '').trim().slice(0, 36),
            capacity: Number(settings.capacity) || 8,
            isPublic: Boolean(settings.isPublic),
            hasPassword: Boolean(payload.password && payload.password.trim().length > 0),
            nightDuration: Number(settings.nightDuration) || 30,
            dayDuration: Number(settings.dayDuration) || 60,
            voteDuration: Number(settings.voteDuration) || 30,
            roles: {
              VAMPIRE: Number(settings.roles?.VAMPIRE ?? 2),
              DOCTOR: Number(settings.roles?.DOCTOR ?? 1),
              DETECTIVE: Number(settings.roles?.DETECTIVE ?? 1),
              HUNTER: Number(settings.roles?.HUNTER ?? 0),
              JESTER: Number(settings.roles?.JESTER ?? 0),
            },
          };

          const validation = validateRoomSettings(cleanSettings);
          if (!validation.valid) {
            return cb?.({ ok: false, error: validation.error });
          }

          // Leave any prior room first
          this.leaveCurrentRoom(userId);

          let code = generateRoomCode();
          while (this.rooms.has(code)) {
            code = generateRoomCode();
          }

          const room: RoomInternal = {
            code,
            settings: cleanSettings,
            passwordHash:
              payload.password && payload.password.trim().length > 0
                ? hashPassword(payload.password.trim())
                : null,
            phase: 'LOBBY',
            round: 0,
            phaseEndsAt: null,
            players: [
              {
                userId: user.id,
                tag: user.tag,
                displayName: user.displayName,
                avatarId: user.avatarId,
                seatIndex: 0,
                isHost: true,
                isAlive: true,
                connected: true,
                disconnectedAt: null,
                role: null,
                doctorLastProtectedId: null,
                detectiveResults: [],
              },
            ],
            vampireVotes: {},
            doctorTargetId: null,
            detectiveTargetId: null,
            dayVotes: {},
            morningReport: null,
            hunterRevengeUserId: null,
            hunterRevengeNextPhase: null,
            winResult: null,
            publicMessages: [makeSystemMsg(`${user.displayName} odayı kurdu.`)],
            vampireMessages: [],
            phaseTimer: null,
            earlyAdvanceTimer: null,
            disconnectTimers: new Map(),
            statsRecorded: false,
          };

          this.rooms.set(code, room);
          this.userRoomMap.set(userId, code);
          this.joinUserSocketsToRoom(userId, code);
          this.broadcastRoomState(room);
          this.broadcastPublicRooms();
          this.notifyFriendsPresence(userId);
          cb?.({ ok: true, code });
        }
      );

      socket.on(
        'room:join',
        (
          payload: { code: string; password?: string },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const user = store.findUserById(userId);
          if (!user) return cb?.({ ok: false, error: 'Kullanıcı bulunamadı.' });

          const code = String(payload?.code || '').trim().toUpperCase();
          const room = this.rooms.get(code);
          if (!room) {
            return cb?.({ ok: false, error: 'Bu koda sahip aktif bir oda bulunamadı.' });
          }

          // Reconnecting player already seated in room
          const existingPlayer = room.players.find((p) => p.userId === userId);
          if (existingPlayer) {
            this.handlePlayerReconnected(room, userId, socket);
            return cb?.({ ok: true });
          }

          if (room.phase !== 'LOBBY') {
            return cb?.({ ok: false, error: 'Bu odada oyun halihazırda başlamış.' });
          }
          if (room.players.length >= room.settings.capacity) {
            return cb?.({ ok: false, error: 'Oda kapasitesi dolu.' });
          }
          if (room.passwordHash) {
            const pass = String(payload?.password || '').trim();
            if (!pass || !verifyPassword(pass, room.passwordHash)) {
              return cb?.({ ok: false, error: 'Oda şifresi hatalı.' });
            }
          }

          this.leaveCurrentRoom(userId);

          room.players.push({
            userId: user.id,
            tag: user.tag,
            displayName: user.displayName,
            avatarId: user.avatarId,
            seatIndex: room.players.length,
            isHost: false,
            isAlive: true,
            connected: true,
            disconnectedAt: null,
            role: null,
            doctorLastProtectedId: null,
            detectiveResults: [],
          });
          room.publicMessages.push(makeSystemMsg(`${user.displayName} odaya katıldı.`));

          this.userRoomMap.set(userId, code);
          this.joinUserSocketsToRoom(userId, code);
          this.broadcastRoomState(room);
          this.broadcastPublicRooms();
          this.notifyFriendsPresence(userId);
          cb?.({ ok: true });
        }
      );

      socket.on('room:leave', (cb?: (res: { ok: boolean }) => void) => {
        this.leaveCurrentRoom(userId);
        cb?.({ ok: true });
      });

      socket.on(
        'room:update_settings',
        (
          payload: { settings: RoomSettings },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });
          const player = room.players.find((p) => p.userId === userId);
          if (!player?.isHost) {
            return cb?.({ ok: false, error: 'Yalnızca oda kurucusu ayarları değiştirebilir.' });
          }
          if (room.phase !== 'LOBBY') {
            return cb?.({ ok: false, error: 'Oyun başladıktan sonra ayarlar değiştirilemez.' });
          }

          const s = payload?.settings;
          if (!s) return cb?.({ ok: false, error: 'Geçersiz ayarlar.' });

          const updated: RoomSettings = {
            ...room.settings,
            name: String(s.name || room.settings.name).trim().slice(0, 36),
            capacity: Math.max(room.players.length, Math.min(16, Number(s.capacity) || 8)),
            isPublic: Boolean(s.isPublic),
            nightDuration: Number(s.nightDuration) || 30,
            dayDuration: Number(s.dayDuration) || 60,
            voteDuration: Number(s.voteDuration) || 30,
            roles: {
              VAMPIRE: Number(s.roles?.VAMPIRE ?? 2),
              DOCTOR: Number(s.roles?.DOCTOR ?? 1),
              DETECTIVE: Number(s.roles?.DETECTIVE ?? 1),
              HUNTER: Number(s.roles?.HUNTER ?? 0),
              JESTER: Number(s.roles?.JESTER ?? 0),
            },
          };

          const validation = validateRoomSettings(updated);
          if (!validation.valid) {
            return cb?.({ ok: false, error: validation.error });
          }

          room.settings = updated;
          room.publicMessages.push(makeSystemMsg('Oda kurucusu oyun ayarlarını güncelledi.'));
          this.broadcastRoomState(room);
          this.broadcastPublicRooms();
          cb?.({ ok: true });
        }
      );

      socket.on('game:start', (cb?: (res: { ok: boolean; error?: string }) => void) => {
        const room = this.getRoomForUser(userId);
        if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });
        const player = room.players.find((p) => p.userId === userId);
        if (!player?.isHost) {
          return cb?.({ ok: false, error: 'Oyunu yalnızca oda kurucusu başlatabilir.' });
        }
        if (room.phase !== 'LOBBY') {
          return cb?.({ ok: false, error: 'Oyun zaten devam ediyor.' });
        }
        if (room.players.length < 6) {
          return cb?.({
            ok: false,
            error: `Oyunu başlatmak için en az 6 oyuncu gerekli (şu an ${room.players.length}/6).`,
          });
        }

        const validation = validateRoomSettings(room.settings, room.players.length);
        if (!validation.valid) {
          return cb?.({ ok: false, error: validation.error });
        }

        this.startMatch(room);
        cb?.({ ok: true });
      });

      socket.on('room:return_to_lobby', (cb?: (res: { ok: boolean; error?: string }) => void) => {
        const room = this.getRoomForUser(userId);
        if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });
        const player = room.players.find((p) => p.userId === userId);
        if (!player?.isHost) {
          return cb?.({ ok: false, error: 'Yalnızca oda kurucusu lobiye döndürebilir.' });
        }
        if (room.phase !== 'GAME_OVER') {
          return cb?.({ ok: false, error: 'Oyun henüz bitmedi.' });
        }

        this.clearTimers(room);
        room.phase = 'LOBBY';
        room.round = 0;
        room.phaseEndsAt = null;
        room.vampireVotes = {};
        room.doctorTargetId = null;
        room.detectiveTargetId = null;
        room.dayVotes = {};
        room.morningReport = null;
        room.hunterRevengeUserId = null;
        room.hunterRevengeNextPhase = null;
        room.winResult = null;
        room.vampireMessages = [];
        room.statsRecorded = false;
        room.players.forEach((p, idx) => {
          p.seatIndex = idx;
          p.isAlive = true;
          p.role = null;
          p.doctorLastProtectedId = null;
          p.detectiveResults = [];
        });
        room.publicMessages.push(makeSystemMsg('Yeni oyun için lobiye dönüldü.'));
        this.broadcastRoomState(room);
        this.broadcastPublicRooms();
        cb?.({ ok: true });
      });

      socket.on(
        'game:night_action',
        (
          payload: { targetId: string },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });

          const result = performNightAction(room, userId, String(payload?.targetId || ''));
          if (!result.ok) {
            return cb?.({ ok: false, error: result.reason });
          }

          this.broadcastRoomState(room);
          this.checkNightEarlyComplete(room);
          cb?.({ ok: true });
        }
      );

      socket.on(
        'game:vote',
        (
          payload: { targetId: string | 'ABSTAIN' },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });

          const result = castDayVote(room, userId, payload?.targetId);
          if (!result.ok) {
            return cb?.({ ok: false, error: result.reason });
          }

          this.broadcastRoomState(room);
          this.checkVotingEarlyComplete(room);
          cb?.({ ok: true });
        }
      );

      socket.on(
        'game:hunter_revenge',
        (
          payload: { targetId: string },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });

          const result = resolveHunterRevenge(room, userId, String(payload?.targetId || ''));
          if (!result.ok) {
            return cb?.({ ok: false, error: result.reason });
          }

          this.clearTimers(room);
          room.publicMessages.push(
            makeSystemMsg(`Avcı son nefesinde ${result.killedName} adlı oyuncuyu da yanında götürdü!`)
          );

          if (result.winResult) {
            this.finishMatch(room);
          } else if (room.hunterRevengeNextPhase === 'NIGHT') {
            this.enterNightPhase(room);
          } else {
            this.enterDayPhase(room);
          }
          cb?.({ ok: true });
        }
      );

      socket.on(
        'chat:send',
        (
          payload: { channel: ChatChannel; text: string },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Odada değilsin.' });

          const player = room.players.find((p) => p.userId === userId);
          if (!player) return cb?.({ ok: false, error: 'Oyuncu bulunamadı.' });

          const text = String(payload?.text || '').trim().slice(0, 280);
          if (!text) return cb?.({ ok: false, error: 'Boş mesaj gönderilemez.' });

          const channel = payload.channel;
          if (channel === 'VAMPIRE') {
            if (room.phase !== 'NIGHT' || player.role !== 'VAMPIRE' || !player.isAlive) {
              return cb?.({
                ok: false,
                error: 'Vampir sohbetini yalnızca hayattaki vampirler gece kullanabilir.',
              });
            }
            const msg: ChatMessage = {
              id: `vm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              channel: 'VAMPIRE',
              senderId: player.userId,
              senderName: player.displayName,
              senderAvatar: player.avatarId,
              text,
              timestamp: Date.now(),
            };
            room.vampireMessages.push(msg);
            if (room.vampireMessages.length > 100) room.vampireMessages.shift();
            this.broadcastRoomState(room);
            return cb?.({ ok: true });
          }

          // Public / Lobby / Day chat validation
          const canSpeakPublic =
            room.phase === 'LOBBY' ||
            room.phase === 'GAME_OVER' ||
            (player.isAlive &&
              (room.phase === 'DAY' ||
                room.phase === 'MORNING' ||
                room.phase === 'VOTING' ||
                room.phase === 'ROLE_REVEAL'));

          if (!canSpeakPublic) {
            return cb?.({
              ok: false,
              error: player.isAlive
                ? 'Gece fazında genel sohbet kapalıdır.'
                : 'Elenen oyuncular genel sohbette konuşamaz.',
            });
          }

          const msg: ChatMessage = {
            id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            channel: room.phase === 'LOBBY' ? 'LOBBY' : 'DAY',
            senderId: player.userId,
            senderName: player.displayName,
            senderAvatar: player.avatarId,
            text,
            timestamp: Date.now(),
          };
          room.publicMessages.push(msg);
          if (room.publicMessages.length > 120) room.publicMessages.shift();
          this.broadcastRoomState(room);
          cb?.({ ok: true });
        }
      );

      socket.on(
        'invite:send',
        (
          payload: { targetUserId: string },
          cb?: (res: { ok: boolean; error?: string }) => void
        ) => {
          const room = this.getRoomForUser(userId);
          if (!room) return cb?.({ ok: false, error: 'Davet etmek için bir odada olmalısın.' });
          const targetId = String(payload?.targetUserId || '');
          if (!store.areFriends(userId, targetId)) {
            return cb?.({ ok: false, error: 'Yalnızca arkadaşlarını davet edebilirsin.' });
          }
          const targetSockets = this.userSockets.get(targetId);
          if (!targetSockets || targetSockets.size === 0) {
            return cb?.({ ok: false, error: 'Arkadaşın şu anda çevrimdışı.' });
          }

          const sender = store.findUserById(userId);
          if (!sender) return cb?.({ ok: false, error: 'Kullanıcı bulunamadı.' });

          const invite: LobbyInvitePayload = {
            id: `inv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            roomCode: room.code,
            roomName: room.settings.name,
            fromUserId: sender.id,
            fromTag: sender.tag,
            fromDisplayName: sender.displayName,
            fromAvatarId: sender.avatarId,
            createdAt: Date.now(),
          };

          for (const sid of targetSockets) {
            this.io.to(sid).emit('invite:received', invite);
          }
          cb?.({ ok: true });
        }
      );

      socket.on('disconnect', () => {
        this.unregisterSocket(userId, socket);
      });
    });
  }

  private registerSocket(userId: string, socket: Socket): void {
    let set = this.userSockets.get(userId);
    if (!set) {
      set = new Set();
      this.userSockets.set(userId, set);
    }
    set.add(socket.id);
    if (set.size === 1) {
      this.notifyFriendsPresence(userId);
    }
  }

  private unregisterSocket(userId: string, socket: Socket): void {
    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        this.userSockets.delete(userId);
        this.notifyFriendsPresence(userId);
        this.handleUserAllSocketsDisconnected(userId);
      }
    }
  }

  private handleUserAllSocketsDisconnected(userId: string): void {
    const room = this.getRoomForUser(userId);
    if (!room) return;

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return;

    player.connected = false;
    player.disconnectedAt = Date.now();
    this.broadcastRoomState(room);

    const existingTimer = room.disconnectTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);

    const graceMs =
      room.phase === 'LOBBY' || room.phase === 'GAME_OVER'
        ? LOBBY_DISCONNECT_GRACE_MS
        : RECONNECT_GRACE_MS;

    const timer = setTimeout(() => {
      room.disconnectTimers.delete(userId);
      const stillInRoom = this.rooms.get(room.code);
      if (!stillInRoom) return;
      const p = stillInRoom.players.find((x) => x.userId === userId);
      if (!p || p.connected) return;

      if (stillInRoom.phase === 'LOBBY' || stillInRoom.phase === 'GAME_OVER') {
        this.removePlayerFromRoom(stillInRoom, userId);
      } else if (p.isAlive) {
        p.isAlive = false;
        stillInRoom.publicMessages.push(
          makeSystemMsg(`${p.displayName} 45 saniye içinde geri dönemediği için oyundan düştü.`)
        );
        const win = checkWinCondition(stillInRoom.players);
        if (win) {
          stillInRoom.winResult = win;
          this.finishMatch(stillInRoom);
        } else {
          this.broadcastRoomState(stillInRoom);
        }
      }
    }, graceMs);

    room.disconnectTimers.set(userId, timer);
  }

  private handlePlayerReconnected(
    room: RoomInternal,
    userId: string,
    socket: Socket
  ): void {
    const timer = room.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(userId);
    }
    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      player.connected = true;
      player.disconnectedAt = null;
    }
    socket.join(`room:${room.code}`);
    this.broadcastRoomState(room);
  }

  private joinUserSocketsToRoom(userId: string, code: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      const s = this.io.sockets.sockets.get(sid);
      s?.join(`room:${code}`);
    }
  }

  private leaveUserSocketsFromRoom(userId: string, code: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      const s = this.io.sockets.sockets.get(sid);
      s?.leave(`room:${code}`);
    }
  }

  private getRoomForUser(userId: string): RoomInternal | undefined {
    const code = this.userRoomMap.get(userId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  private leaveCurrentRoom(userId: string): void {
    const room = this.getRoomForUser(userId);
    if (!room) return;
    this.removePlayerFromRoom(room, userId);
  }

  private removePlayerFromRoom(room: RoomInternal, userId: string): void {
    const timer = room.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(userId);
    }

    const idx = room.players.findIndex((p) => p.userId === userId);
    if (idx === -1) return;

    const removed = room.players[idx];
    this.userRoomMap.delete(userId);
    this.leaveUserSocketsFromRoom(userId, room.code);

    // Send empty room signal to leaving user's sockets
    const leavingSockets = this.userSockets.get(userId);
    if (leavingSockets) {
      for (const sid of leavingSockets) {
        this.io.to(sid).emit('room:left');
      }
    }

    if (room.phase === 'LOBBY' || room.phase === 'GAME_OVER') {
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        this.clearTimers(room);
        this.rooms.delete(room.code);
        this.broadcastPublicRooms();
        this.notifyFriendsPresence(userId);
        return;
      }
      if (removed.isHost) {
        room.players[0].isHost = true;
        room.publicMessages.push(
          makeSystemMsg(`Kurucu ayrıldı. Yeni oda kurucusu: ${room.players[0].displayName}.`)
        );
      } else {
        room.publicMessages.push(makeSystemMsg(`${removed.displayName} odadan ayrıldı.`));
      }
      room.players.forEach((p, i) => {
        p.seatIndex = i;
      });
    } else {
      // Mid-game voluntary leave
      removed.isAlive = false;
      removed.connected = false;
      room.publicMessages.push(makeSystemMsg(`${removed.displayName} oyundan ayrıldı.`));
      const connectedLeft = room.players.filter((p) => p.connected);
      if (connectedLeft.length === 0) {
        this.clearTimers(room);
        this.rooms.delete(room.code);
        this.broadcastPublicRooms();
        this.notifyFriendsPresence(userId);
        return;
      }
      if (removed.isHost) {
        const nextHost = connectedLeft[0];
        removed.isHost = false;
        nextHost.isHost = true;
      }
      const win = checkWinCondition(room.players);
      if (win) {
        room.winResult = win;
        this.finishMatch(room);
        this.notifyFriendsPresence(userId);
        return;
      }
    }

    this.broadcastRoomState(room);
    this.broadcastPublicRooms();
    this.notifyFriendsPresence(userId);
  }

  private clearTimers(room: RoomInternal): void {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
    if (room.earlyAdvanceTimer) {
      clearTimeout(room.earlyAdvanceTimer);
      room.earlyAdvanceTimer = null;
    }
  }

  private startMatch(room: RoomInternal): void {
    this.clearTimers(room);
    const assigned = assignRoles(
      room.players.map((p) => p.userId),
      room.settings
    );
    room.players.forEach((p, idx) => {
      p.seatIndex = idx;
      p.isAlive = true;
      p.role = assigned[p.userId];
      p.doctorLastProtectedId = null;
      p.detectiveResults = [];
    });
    room.round = 1;
    room.vampireVotes = {};
    room.doctorTargetId = null;
    room.detectiveTargetId = null;
    room.dayVotes = {};
    room.morningReport = null;
    room.hunterRevengeUserId = null;
    room.hunterRevengeNextPhase = null;
    room.winResult = null;
    room.vampireMessages = [];
    room.statsRecorded = false;
    room.publicMessages.push(
      makeSystemMsg('Oyun başladı! Gizli rol kartlarınız dağıtıldı.')
    );

    room.phase = 'ROLE_REVEAL';
    room.phaseEndsAt = Date.now() + ROLE_REVEAL_MS;
    this.broadcastRoomState(room);
    this.broadcastPublicRooms();

    room.phaseTimer = setTimeout(() => {
      this.enterNightPhase(room);
    }, ROLE_REVEAL_MS);
  }

  private enterNightPhase(room: RoomInternal): void {
    this.clearTimers(room);
    room.phase = 'NIGHT';
    room.vampireVotes = {};
    room.doctorTargetId = null;
    room.detectiveTargetId = null;
    room.dayVotes = {};
    room.phaseEndsAt = Date.now() + room.settings.nightDuration * 1000;
    room.publicMessages.push(
      makeSystemMsg(`Gece ${room.round} çöktü. Köy uykuya dalıyor...`)
    );
    this.broadcastRoomState(room);

    room.phaseTimer = setTimeout(() => {
      this.resolveNightAndAdvance(room);
    }, room.settings.nightDuration * 1000);
  }

  private checkNightEarlyComplete(room: RoomInternal): void {
    if (room.phase !== 'NIGHT' || room.earlyAdvanceTimer) return;
    const aliveVampires = room.players.filter((p) => p.isAlive && p.role === 'VAMPIRE');
    const aliveDoctor = room.players.find((p) => p.isAlive && p.role === 'DOCTOR');
    const aliveDetective = room.players.find((p) => p.isAlive && p.role === 'DETECTIVE');

    const vampsDone = aliveVampires.every((v) => Boolean(room.vampireVotes[v.userId]));
    const docDone = !aliveDoctor || Boolean(room.doctorTargetId);
    const detDone =
      !aliveDetective ||
      aliveDetective.detectiveResults.some((r) => r.round === room.round);

    if (vampsDone && docDone && detDone) {
      room.earlyAdvanceTimer = setTimeout(() => {
        this.resolveNightAndAdvance(room);
      }, 2000);
    }
  }

  private resolveNightAndAdvance(room: RoomInternal): void {
    this.clearTimers(room);
    const outcome = resolveNightPhase(room);
    room.publicMessages.push(makeSystemMsg(outcome.morningReport));

    if (outcome.triggerHunterRevenge) {
      room.phase = 'HUNTER_REVENGE';
      room.phaseEndsAt = Date.now() + HUNTER_REVENGE_MS;
      room.publicMessages.push(
        makeSystemMsg('Avcı son nefesini vermeden önce bir kişiyi yanında götürecek!')
      );
      this.broadcastRoomState(room);

      room.phaseTimer = setTimeout(() => {
        room.hunterRevengeUserId = null;
        const win = checkWinCondition(room.players);
        if (win) {
          room.winResult = win;
          this.finishMatch(room);
        } else {
          this.enterDayPhase(room);
        }
      }, HUNTER_REVENGE_MS);
      return;
    }

    if (outcome.winResult) {
      this.finishMatch(room);
      return;
    }

    room.phase = 'MORNING';
    room.phaseEndsAt = Date.now() + MORNING_MS;
    this.broadcastRoomState(room);

    room.phaseTimer = setTimeout(() => {
      this.enterDayPhase(room);
    }, MORNING_MS);
  }

  private enterDayPhase(room: RoomInternal): void {
    this.clearTimers(room);
    room.phase = 'DAY';
    room.phaseEndsAt = Date.now() + room.settings.dayDuration * 1000;
    room.publicMessages.push(
      makeSystemMsg(`Gündüz ${room.round} tartışması başladı. Şüphelileri değerlendirin!`)
    );
    this.broadcastRoomState(room);

    room.phaseTimer = setTimeout(() => {
      this.enterVotingPhase(room);
    }, room.settings.dayDuration * 1000);
  }

  private enterVotingPhase(room: RoomInternal): void {
    this.clearTimers(room);
    room.phase = 'VOTING';
    room.dayVotes = {};
    room.phaseEndsAt = Date.now() + room.settings.voteDuration * 1000;
    room.publicMessages.push(
      makeSystemMsg('Oylama başladı! Köy meclisi kimin eleneceğine karar veriyor.')
    );
    this.broadcastRoomState(room);

    room.phaseTimer = setTimeout(() => {
      this.resolveVotingAndAdvance(room);
    }, room.settings.voteDuration * 1000);
  }

  private checkVotingEarlyComplete(room: RoomInternal): void {
    if (room.phase !== 'VOTING' || room.earlyAdvanceTimer) return;
    const alive = room.players.filter((p) => p.isAlive);
    if (alive.length > 0 && alive.every((p) => Boolean(room.dayVotes[p.userId]))) {
      room.earlyAdvanceTimer = setTimeout(() => {
        this.resolveVotingAndAdvance(room);
      }, 1500);
    }
  }

  private resolveVotingAndAdvance(room: RoomInternal): void {
    this.clearTimers(room);
    const outcome = resolveVotingPhase(room);
    room.publicMessages.push(makeSystemMsg(outcome.summaryText));

    if (outcome.triggerHunterRevenge) {
      room.phase = 'HUNTER_REVENGE';
      room.phaseEndsAt = Date.now() + HUNTER_REVENGE_MS;
      this.broadcastRoomState(room);

      room.phaseTimer = setTimeout(() => {
        room.hunterRevengeUserId = null;
        const win = checkWinCondition(room.players);
        if (win) {
          room.winResult = win;
          this.finishMatch(room);
        } else {
          room.round += 1;
          this.enterNightPhase(room);
        }
      }, HUNTER_REVENGE_MS);
      return;
    }

    if (outcome.winResult) {
      this.finishMatch(room);
      return;
    }

    room.round += 1;
    this.enterNightPhase(room);
  }

  private finishMatch(room: RoomInternal): void {
    this.clearTimers(room);
    room.phase = 'GAME_OVER';
    room.phaseEndsAt = null;
    if (room.winResult) {
      room.publicMessages.push(makeSystemMsg(room.winResult.reason));
    }

    if (!room.statsRecorded && room.winResult) {
      room.statsRecorded = true;
      for (const p of room.players) {
        let won = false;
        if (room.winResult.winner === 'JESTER') {
          won = p.userId === room.winResult.jesterWinnerId;
        } else if (room.winResult.winner === 'VAMPIRES') {
          won = p.role === 'VAMPIRE';
        } else if (room.winResult.winner === 'VILLAGERS') {
          won = p.role !== 'VAMPIRE' && p.role !== 'JESTER';
        }
        store.recordMatchOutcome(p.userId, won, room.winResult.winner);
        const updated = store.findUserById(p.userId);
        if (updated) {
          this.emitToUser(p.userId, 'profile:updated', store.toPublicProfile(updated));
        }
      }
    }

    this.broadcastRoomState(room);
    this.broadcastPublicRooms();
  }

  private broadcastRoomState(room: RoomInternal): void {
    for (const player of room.players) {
      const snapshot = sanitizeRoomForClient(room, player.userId);
      this.emitToUser(player.userId, 'room:state', snapshot);
    }
  }

  private broadcastPublicRooms(): void {
    this.io.emit('rooms:list', this.getPublicRooms());
  }

  private emitToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      this.io.to(sid).emit(event, data);
    }
  }

  private notifyFriendsPresence(userId: string): void {
    const rels = store.getFriendshipsForUser(userId);
    for (const rel of rels) {
      const friendId = rel.fromUserId === userId ? rel.toUserId : rel.fromUserId;
      this.emitToUser(friendId, 'friends:refresh', null);
    }
  }

  public notifyUsersFriendsRefresh(userIdA: string, userIdB: string): void {
    this.emitToUser(userIdA, 'friends:refresh', null);
    this.emitToUser(userIdB, 'friends:refresh', null);
  }

  public syncUserProfileInRooms(user: StoredUser): void {
    const room = this.getRoomForUser(user.id);
    if (!room) return;
    const p = room.players.find((x) => x.userId === user.id);
    if (p) {
      p.displayName = user.displayName;
      p.avatarId = user.avatarId;
      this.broadcastRoomState(room);
    }
  }
}
