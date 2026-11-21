import fs from 'node:fs';
import path from 'node:path';
import type { AvatarId, UserProfile, UserStats } from '../shared/types.ts';

export interface StoredUser {
  id: string;
  email: string | null;
  passwordHash: string | null;
  tag: string;
  displayName: string;
  avatarId: AvatarId;
  isGuest: boolean;
  level: number;
  xp: number;
  stats: UserStats;
  createdAt: number;
}

export interface StoredFriendship {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted';
  createdAt: number;
}

interface StoreData {
  users: StoredUser[];
  friendships: StoredFriendship[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const SEEDED_COMMUNITY_USERS: StoredUser[] = [
  {
    id: 'seed-geceavcisi',
    email: null,
    passwordHash: null,
    tag: '@geceavcisi#1042',
    displayName: 'Gece Avcısı',
    avatarId: 'hunter',
    isGuest: false,
    level: 7,
    xp: 640,
    stats: { gamesPlayed: 24, gamesWon: 15, vampireWins: 6, villagerWins: 8, jesterWins: 1 },
    createdAt: 1700000000000,
  },
  {
    id: 'seed-kuzgun',
    email: null,
    passwordHash: null,
    tag: '@kuzgun#4819',
    displayName: 'Kuzgun',
    avatarId: 'raven',
    isGuest: false,
    level: 5,
    xp: 430,
    stats: { gamesPlayed: 18, gamesWon: 10, vampireWins: 5, villagerWins: 5, jesterWins: 0 },
    createdAt: 1700000000001,
  },
  {
    id: 'seed-hekim',
    email: null,
    passwordHash: null,
    tag: '@hekim#7721',
    displayName: 'Şifacı Leyla',
    avatarId: 'healer',
    isGuest: false,
    level: 9,
    xp: 890,
    stats: { gamesPlayed: 31, gamesWon: 21, vampireWins: 4, villagerWins: 16, jesterWins: 1 },
    createdAt: 1700000000002,
  },
  {
    id: 'seed-ayisigi',
    email: null,
    passwordHash: null,
    tag: '@ayisigi#3309',
    displayName: 'Ayışığı Kontu',
    avatarId: 'count',
    isGuest: false,
    level: 6,
    xp: 520,
    stats: { gamesPlayed: 20, gamesWon: 11, vampireWins: 7, villagerWins: 4, jesterWins: 0 },
    createdAt: 1700000000003,
  },
];

class PersistentStore {
  private data: StoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as StoreData;
        if (Array.isArray(parsed.users) && Array.isArray(parsed.friendships)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Store load warning, initializing fresh store:', err);
    }
    const fresh: StoreData = {
      users: [...SEEDED_COMMUNITY_USERS],
      friendships: [],
    };
    this.saveData(fresh);
    return fresh;
  }

  private saveData(data: StoreData = this.data): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  public toPublicProfile(user: StoredUser): UserProfile {
    return {
      id: user.id,
      tag: user.tag,
      displayName: user.displayName,
      avatarId: user.avatarId,
      isGuest: user.isGuest,
      level: user.level,
      xp: user.xp,
      stats: { ...user.stats },
    };
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email === normalized);
  }

  public findUserByTag(tag: string): StoredUser | undefined {
    const normalized = tag.trim().toLowerCase();
    return this.data.users.find((u) => u.tag.toLowerCase() === normalized);
  }

  public createUniqueTag(displayName: string): string {
    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12) || 'oyuncu';
    for (let i = 0; i < 30; i++) {
      const code = Math.floor(1000 + Math.random() * 9000);
      const candidate = `@${slug}#${code}`;
      if (!this.findUserByTag(candidate)) {
        return candidate;
      }
    }
    return `@${slug}#${Date.now().toString().slice(-4)}`;
  }

  public insertUser(user: StoredUser): StoredUser {
    this.data.users.push(user);
    this.saveData();
    return user;
  }

  public updateUserProfile(
    userId: string,
    updates: { displayName?: string; avatarId?: AvatarId }
  ): StoredUser | null {
    const user = this.findUserById(userId);
    if (!user) return null;
    if (updates.displayName) {
      user.displayName = updates.displayName.trim().slice(0, 24);
    }
    if (updates.avatarId) {
      user.avatarId = updates.avatarId;
    }
    this.saveData();
    return user;
  }

  public recordMatchOutcome(
    userId: string,
    won: boolean,
    roleWinnerType: 'VAMPIRES' | 'VILLAGERS' | 'JESTER' | null
  ): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.stats.gamesPlayed += 1;
    if (won) {
      user.stats.gamesWon += 1;
      if (roleWinnerType === 'VAMPIRES') user.stats.vampireWins += 1;
      if (roleWinnerType === 'VILLAGERS') user.stats.villagerWins += 1;
      if (roleWinnerType === 'JESTER') user.stats.jesterWins += 1;
      user.xp += 120;
    } else {
      user.xp += 40;
    }
    user.level = Math.max(1, Math.floor(user.xp / 150) + 1);
    this.saveData();
  }

  public searchUsers(query: string, excludeUserId: string): StoredUser[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.data.users
        .filter((u) => u.id !== excludeUserId && !u.isGuest)
        .slice(0, 12);
    }
    return this.data.users
      .filter(
        (u) =>
          u.id !== excludeUserId &&
          (u.tag.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }

  public getFriendshipsForUser(userId: string): StoredFriendship[] {
    return this.data.friendships.filter(
      (f) => f.fromUserId === userId || f.toUserId === userId
    );
  }

  public findFriendshipBetween(a: string, b: string): StoredFriendship | undefined {
    return this.data.friendships.find(
      (f) =>
        (f.fromUserId === a && f.toUserId === b) ||
        (f.fromUserId === b && f.toUserId === a)
    );
  }

  public areFriends(a: string, b: string): boolean {
    const rel = this.findFriendshipBetween(a, b);
    return Boolean(rel && rel.status === 'accepted');
  }

  public createFriendRequest(fromUserId: string, toUserId: string): StoredFriendship {
    const existing = this.findFriendshipBetween(fromUserId, toUserId);
    if (existing) {
      // If target already sent us a pending request, accept immediately!
      if (existing.status === 'pending' && existing.fromUserId === toUserId) {
        existing.status = 'accepted';
        this.saveData();
      }
      return existing;
    }
    const rel: StoredFriendship = {
      id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.data.friendships.push(rel);
    this.saveData();
    return rel;
  }

  public respondToFriendRequest(
    actorUserId: string,
    otherUserId: string,
    action: 'accept' | 'decline'
  ): boolean {
    const idx = this.data.friendships.findIndex(
      (f) =>
        f.fromUserId === otherUserId &&
        f.toUserId === actorUserId &&
        f.status === 'pending'
    );
    if (idx === -1) return false;
    if (action === 'accept') {
      this.data.friendships[idx].status = 'accepted';
    } else {
      this.data.friendships.splice(idx, 1);
    }
    this.saveData();
    return true;
  }

  public removeFriend(userId: string, otherUserId: string): boolean {
    const before = this.data.friendships.length;
    this.data.friendships = this.data.friendships.filter(
      (f) =>
        !(
          (f.fromUserId === userId && f.toUserId === otherUserId) ||
          (f.fromUserId === otherUserId && f.toUserId === userId)
        )
    );
    if (this.data.friendships.length !== before) {
      this.saveData();
      return true;
    }
    return false;
  }
}

export const store = new PersistentStore();
