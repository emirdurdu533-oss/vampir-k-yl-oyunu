import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  AvatarId,
  ChatChannel,
  ClientRoomSnapshot,
  FriendEntry,
  GamePhase,
  LobbyInvitePayload,
  RoomSettings,
  RoomSummary,
  UserProfile,
} from '../shared/types.ts';
import { soundFX } from '../utils/sound.ts';

interface GameContextValue {
  user: UserProfile | null;
  token: string | null;
  socketConnected: boolean;
  publicRooms: RoomSummary[];
  activeRoom: ClientRoomSnapshot | null;
  friends: FriendEntry[];
  invites: LobbyInvitePayload[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  toast: { type: 'error' | 'info' | 'success'; text: string } | null;
  clearToast: () => void;
  showToast: (text: string, type?: 'error' | 'info' | 'success') => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
  loginAsGuest: (displayName: string, avatarId: AvatarId) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    avatarId: AvatarId
  ) => Promise<boolean>;
  logout: () => void;
  updateProfile: (displayName: string, avatarId: AvatarId) => Promise<boolean>;
  refreshFriends: () => Promise<void>;
  searchUsers: (query: string) => Promise<
    Array<{
      id: string;
      tag: string;
      displayName: string;
      avatarId: AvatarId;
      level: number;
      status: string;
      relationship: string;
    }>
  >;
  sendFriendRequest: (targetUserId: string) => Promise<boolean>;
  respondFriendRequest: (targetUserId: string, action: 'accept' | 'decline') => Promise<boolean>;
  removeFriend: (targetUserId: string) => Promise<boolean>;
  createRoom: (settings: RoomSettings, password?: string) => Promise<{ ok: boolean; error?: string }>;
  joinRoom: (code: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  leaveRoom: () => Promise<void>;
  updateRoomSettings: (settings: RoomSettings) => Promise<{ ok: boolean; error?: string }>;
  startGame: () => Promise<{ ok: boolean; error?: string }>;
  returnToLobby: () => Promise<{ ok: boolean; error?: string }>;
  submitNightAction: (targetId: string) => Promise<{ ok: boolean; error?: string }>;
  submitDayVote: (targetId: string | 'ABSTAIN') => Promise<{ ok: boolean; error?: string }>;
  submitHunterRevenge: (targetId: string) => Promise<{ ok: boolean; error?: string }>;
  sendChat: (channel: ChatChannel, text: string) => Promise<{ ok: boolean; error?: string }>;
  sendInvite: (targetUserId: string) => Promise<{ ok: boolean; error?: string }>;
  dismissInvite: (inviteId: string) => void;
  acceptInvite: (invite: LobbyInvitePayload) => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<ClientRoomSnapshot | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [invites, setInvites] = useState<LobbyInvitePayload[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [toast, setToast] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(
    null
  );

  const socketRef = useRef<Socket | null>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (text: string, type: 'error' | 'info' | 'success' = 'info') => {
      setToast({ text, type });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 4200);
    },
    []
  );

  const clearToast = useCallback(() => setToast(null), []);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}, overrideToken?: string) => {
      const activeToken = overrideToken ?? token;
      const headers = new Headers(options.headers);
      headers.set('Content-Type', 'application/json');
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  const refreshFriends = useCallback(
    async (overrideToken?: string) => {
      const activeToken = overrideToken ?? token;
      if (!activeToken) return;
      try {
        const res = await authFetch('/api/friends', {}, activeToken);
        if (res.ok) {
          const data = (await res.json()) as { friends: FriendEntry[] };
          setFriends(data.friends);
        }
      } catch {
        // Ignore transient network errors
      }
    },
    [authFetch, token]
  );

  // Sync body dataset state for testing & accessibility state
  useEffect(() => {
    if (!user) {
      document.body.dataset.state = 'title';
    } else if (activeRoom?.phase === 'GAME_OVER') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [user, activeRoom?.phase]);

  // Phase transition sound & haptic effects
  useEffect(() => {
    const phase = activeRoom?.phase ?? null;
    if (phase && phase !== prevPhaseRef.current) {
      if (phase === 'NIGHT') {
        soundFX.playNightTransition();
      } else if (phase === 'MORNING' || phase === 'DAY') {
        soundFX.playMorningTransition();
      } else if (phase === 'GAME_OVER') {
        soundFX.playVictory();
      } else if (phase === 'HUNTER_REVENGE') {
        soundFX.playElimination();
      }
    }
    prevPhaseRef.current = phase;
  }, [activeRoom?.phase]);

  // Manage Socket.io connection when authenticated
  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      setActiveRoom(null);
      return;
    }

    const s = io({
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 3000,
    });

    socketRef.current = s;

    s.on('connect', () => {
      setSocketConnected(true);
      s.emit('rooms:fetch');
      refreshFriends(token);
    });

    s.on('disconnect', () => {
      setSocketConnected(false);
    });

    s.on('rooms:list', (rooms: RoomSummary[]) => {
      setPublicRooms(rooms);
    });

    s.on('room:state', (snapshot: ClientRoomSnapshot) => {
      setActiveRoom(snapshot);
    });

    s.on('room:left', () => {
      setActiveRoom(null);
    });

    s.on('profile:updated', (profile: UserProfile) => {
      setUser(profile);
    });

    s.on('friends:refresh', () => {
      refreshFriends(token);
    });

    s.on('invite:received', (invite: LobbyInvitePayload) => {
      setInvites((prev) => {
        if (prev.some((i) => i.id === invite.id)) return prev;
        return [invite, ...prev].slice(0, 4);
      });
      soundFX.playVoteTick();
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token, refreshFriends]);

  const loginAsGuest = useCallback(
    async (displayName: string, avatarId: AvatarId): Promise<boolean> => {
      try {
        const res = await fetch('/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, avatarId }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Misafir girişi başarısız.', 'error');
          return false;
        }
        setToken(data.token);
        setUser(data.user);
        return true;
      } catch {
        showToast('Sunucuya bağlanılamadı.', 'error');
        return false;
      }
    },
    [showToast]
  );

  // ?autostart=1 support for direct hub entry
  const autostartRan = useRef(false);
  useEffect(() => {
    if (autostartRan.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !user) {
      autostartRan.current = true;
      loginAsGuest('Kuzgun Gezgin', 'raven');
    }
  }, [user, loginAsGuest]);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Giriş başarısız.', 'error');
          return false;
        }
        setToken(data.token);
        setUser(data.user);
        return true;
      } catch {
        showToast('Sunucuya bağlanılamadı.', 'error');
        return false;
      }
    },
    [showToast]
  );

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      avatarId: AvatarId
    ): Promise<boolean> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName, avatarId }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Kayıt başarısız.', 'error');
          return false;
        }
        setToken(data.token);
        setUser(data.user);
        return true;
      } catch {
        showToast('Sunucuya bağlanılamadı.', 'error');
        return false;
      }
    },
    [showToast]
  );

  const logout = useCallback(() => {
    socketRef.current?.emit('room:leave');
    socketRef.current?.disconnect();
    setToken(null);
    setUser(null);
    setActiveRoom(null);
    setFriends([]);
    setInvites([]);
  }, []);

  const updateProfile = useCallback(
    async (displayName: string, avatarId: AvatarId): Promise<boolean> => {
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, avatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Profil güncellenemedi.', 'error');
        return false;
      }
      setUser(data.user);
      showToast('Profil güncellendi.', 'success');
      return true;
    },
    [authFetch, showToast]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const res = await authFetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.users ?? [];
    },
    [authFetch]
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string) => {
      const res = await authFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'İstek gönderilemedi.', 'error');
        return false;
      }
      await refreshFriends();
      showToast('Arkadaşlık isteği gönderildi.', 'success');
      return true;
    },
    [authFetch, refreshFriends, showToast]
  );

  const respondFriendRequest = useCallback(
    async (targetUserId: string, action: 'accept' | 'decline') => {
      const res = await authFetch('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, action }),
      });
      if (!res.ok) return false;
      await refreshFriends();
      return true;
    },
    [authFetch, refreshFriends]
  );

  const removeFriend = useCallback(
    async (targetUserId: string) => {
      const res = await authFetch(`/api/friends/${encodeURIComponent(targetUserId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return false;
      await refreshFriends();
      return true;
    },
    [authFetch, refreshFriends]
  );

  const emitAck = useCallback(
    <T extends { ok: boolean; error?: string }>(event: string, payload?: unknown): Promise<T> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve({ ok: false, error: 'Sunucu bağlantısı yok.' } as T);
          return;
        }
        socketRef.current.emit(event, payload, (res: T) => {
          resolve(res ?? ({ ok: false, error: 'Yanıt alınamadı.' } as T));
        });
      });
    },
    []
  );

  const createRoom = useCallback(
    (settings: RoomSettings, password?: string) =>
      emitAck('room:create', { settings, password }),
    [emitAck]
  );

  const joinRoom = useCallback(
    (code: string, password?: string) => emitAck('room:join', { code, password }),
    [emitAck]
  );

  const leaveRoom = useCallback(async () => {
    await emitAck('room:leave');
    setActiveRoom(null);
  }, [emitAck]);

  const updateRoomSettings = useCallback(
    (settings: RoomSettings) => emitAck('room:update_settings', { settings }),
    [emitAck]
  );

  const startGame = useCallback(() => emitAck('game:start'), [emitAck]);
  const returnToLobby = useCallback(() => emitAck('room:return_to_lobby'), [emitAck]);

  const submitNightAction = useCallback(
    (targetId: string) => emitAck('game:night_action', { targetId }),
    [emitAck]
  );

  const submitDayVote = useCallback(
    (targetId: string | 'ABSTAIN') => emitAck('game:vote', { targetId }),
    [emitAck]
  );

  const submitHunterRevenge = useCallback(
    (targetId: string) => emitAck('game:hunter_revenge', { targetId }),
    [emitAck]
  );

  const sendChat = useCallback(
    (channel: ChatChannel, text: string) => emitAck('chat:send', { channel, text }),
    [emitAck]
  );

  const sendInvite = useCallback(
    (targetUserId: string) => emitAck('invite:send', { targetUserId }),
    [emitAck]
  );

  const dismissInvite = useCallback((inviteId: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  const acceptInvite = useCallback(
    async (invite: LobbyInvitePayload) => {
      dismissInvite(invite.id);
      const res = await joinRoom(invite.roomCode);
      if (!res.ok) {
        showToast(res.error || 'Odaya katılınamadı.', 'error');
      }
    },
    [dismissInvite, joinRoom, showToast]
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundFX.enabled = next;
      return next;
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setHapticsEnabled((prev) => {
      const next = !prev;
      soundFX.hapticsEnabled = next;
      return next;
    });
  }, []);

  return (
    <GameContext.Provider
      value={{
        user,
        token,
        socketConnected,
        publicRooms,
        activeRoom,
        friends,
        invites,
        soundEnabled,
        hapticsEnabled,
        toast,
        clearToast,
        showToast,
        toggleSound,
        toggleHaptics,
        loginAsGuest,
        loginWithEmail,
        registerWithEmail,
        logout,
        updateProfile,
        refreshFriends,
        searchUsers,
        sendFriendRequest,
        respondFriendRequest,
        removeFriend,
        createRoom,
        joinRoom,
        leaveRoom,
        updateRoomSettings,
        startGame,
        returnToLobby,
        submitNightAction,
        submitDayVote,
        submitHunterRevenge,
        sendChat,
        sendInvite,
        dismissInvite,
        acceptInvite,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
