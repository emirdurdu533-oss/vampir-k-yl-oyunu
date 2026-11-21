import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  requireAuth,
  signSessionToken,
  verifyPassword,
  type AuthRequest,
} from './src/server/auth.ts';
import { GameManager } from './src/server/gameManager.ts';
import { store } from './src/server/store.ts';
import type { AvatarId, FriendEntry } from './src/shared/types.ts';

dotenv.config();

const PORT = 3000;
const VALID_AVATARS: AvatarId[] = [
  'count',
  'healer',
  'watcher',
  'hunter',
  'jester',
  'raven',
  'guard',
  'shadow',
];

function sanitizeAvatar(val: unknown): AvatarId {
  if (typeof val === 'string' && VALID_AVATARS.includes(val as AvatarId)) {
    return val as AvatarId;
  }
  return 'count';
}

async function bootstrap() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: false,
    },
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  app.use(express.json({ limit: '64kb' }));

  const gameManager = new GameManager(io);

  // --- Auth Routes ---
  app.post('/api/auth/guest', (req, res) => {
    const rawName = String(req.body?.displayName || '').trim();
    const displayName = rawName.length >= 2 ? rawName.slice(0, 24) : `Gezgin ${Math.floor(100 + Math.random() * 899)}`;
    const avatarId = sanitizeAvatar(req.body?.avatarId);

    const user = store.insertUser({
      id: `gst_${crypto.randomUUID()}`,
      email: null,
      passwordHash: null,
      tag: store.createUniqueTag(displayName),
      displayName,
      avatarId,
      isGuest: true,
      level: 1,
      xp: 0,
      stats: { gamesPlayed: 0, gamesWon: 0, vampireWins: 0, villagerWins: 0, jesterWins: 0 },
      createdAt: Date.now(),
    });

    const token = signSessionToken(user.id);
    res.json({ token, user: store.toPublicProfile(user) });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim().slice(0, 24);
    const avatarId = sanitizeAvatar(req.body?.avatarId);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (displayName.length < 2) {
      res.status(400).json({ error: 'Kullanıcı adı en az 2 karakter olmalıdır.' });
      return;
    }
    if (store.findUserByEmail(email)) {
      res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
      return;
    }

    const user = store.insertUser({
      id: `usr_${crypto.randomUUID()}`,
      email,
      passwordHash: hashPassword(password),
      tag: store.createUniqueTag(displayName),
      displayName,
      avatarId,
      isGuest: false,
      level: 1,
      xp: 0,
      stats: { gamesPlayed: 0, gamesWon: 0, vampireWins: 0, villagerWins: 0, jesterWins: 0 },
      createdAt: Date.now(),
    });

    const token = signSessionToken(user.id);
    res.status(201).json({ token, user: store.toPublicProfile(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = store.findUserByEmail(email);
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
      return;
    }

    const token = signSessionToken(user.id);
    res.json({ token, user: store.toPublicProfile(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: store.toPublicProfile(req.user!) });
  });

  app.patch('/api/profile', requireAuth, (req: AuthRequest, res) => {
    const displayName = req.body?.displayName
      ? String(req.body.displayName).trim().slice(0, 24)
      : undefined;
    const avatarId = req.body?.avatarId ? sanitizeAvatar(req.body.avatarId) : undefined;

    if (displayName !== undefined && displayName.length < 2) {
      res.status(400).json({ error: 'Görünen ad en az 2 karakter olmalıdır.' });
      return;
    }

    const updated = store.updateUserProfile(req.user!.id, { displayName, avatarId });
    if (!updated) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    gameManager.syncUserProfileInRooms(updated);
    res.json({ user: store.toPublicProfile(updated) });
  });

  // --- Friends Routes ---
  app.get('/api/friends', requireAuth, (req: AuthRequest, res) => {
    const me = req.user!;
    const rels = store.getFriendshipsForUser(me.id);
    const list: FriendEntry[] = [];

    for (const rel of rels) {
      const otherId = rel.fromUserId === me.id ? rel.toUserId : rel.fromUserId;
      const other = store.findUserById(otherId);
      if (!other) continue;
      const presence = gameManager.getUserPresence(other.id);
      const relationship =
        rel.status === 'accepted'
          ? 'friend'
          : rel.fromUserId === me.id
          ? 'outgoing'
          : 'incoming';

      list.push({
        id: other.id,
        tag: other.tag,
        displayName: other.displayName,
        avatarId: other.avatarId,
        level: other.level,
        status: presence.status,
        roomCode: presence.roomCode,
        relationship,
      });
    }

    res.json({ friends: list });
  });

  app.get('/api/friends/search', requireAuth, (req: AuthRequest, res) => {
    const me = req.user!;
    const q = String(req.query.q || '');
    const results = store.searchUsers(q, me.id).map((u) => {
      const rel = store.findFriendshipBetween(me.id, u.id);
      const presence = gameManager.getUserPresence(u.id);
      return {
        id: u.id,
        tag: u.tag,
        displayName: u.displayName,
        avatarId: u.avatarId,
        level: u.level,
        status: presence.status,
        relationship: rel
          ? rel.status === 'accepted'
            ? 'friend'
            : rel.fromUserId === me.id
            ? 'outgoing'
            : 'incoming'
          : 'none',
      };
    });
    res.json({ users: results });
  });

  app.post('/api/friends/request', requireAuth, (req: AuthRequest, res) => {
    const me = req.user!;
    const targetUserId = String(req.body?.targetUserId || '');
    if (!targetUserId || targetUserId === me.id) {
      res.status(400).json({ error: 'Geçersiz kullanıcı seçimi.' });
      return;
    }
    const target = store.findUserById(targetUserId);
    if (!target) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    store.createFriendRequest(me.id, targetUserId);
    gameManager.notifyUsersFriendsRefresh(me.id, targetUserId);
    res.json({ ok: true });
  });

  app.post('/api/friends/respond', requireAuth, (req: AuthRequest, res) => {
    const me = req.user!;
    const targetUserId = String(req.body?.targetUserId || '');
    const action = req.body?.action === 'accept' ? 'accept' : 'decline';
    const ok = store.respondToFriendRequest(me.id, targetUserId, action);
    if (!ok) {
      res.status(404).json({ error: 'Bekleyen arkadaşlık isteği bulunamadı.' });
      return;
    }
    gameManager.notifyUsersFriendsRefresh(me.id, targetUserId);
    res.json({ ok: true });
  });

  app.delete('/api/friends/:targetUserId', requireAuth, (req: AuthRequest, res) => {
    const me = req.user!;
    const targetUserId = String(req.params.targetUserId);
    store.removeFriend(me.id, targetUserId);
    gameManager.notifyUsersFriendsRefresh(me.id, targetUserId);
    res.json({ ok: true });
  });

  // --- Rooms REST fallback ---
  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: gameManager.getPublicRooms() });
  });

  // --- Vite / Static Serving ---
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Kanlı Köy sunucusu http://0.0.0.0:${PORT} adresinde hazır.`);
  });
}

bootstrap().catch((err) => {
  console.error('Server bootstrap failed:', err);
  process.exit(1);
});
