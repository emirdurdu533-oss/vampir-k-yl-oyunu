export type Role =
  | 'VAMPIRE'
  | 'VILLAGER'
  | 'DOCTOR'
  | 'DETECTIVE'
  | 'HUNTER'
  | 'JESTER';

export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'MORNING'
  | 'DAY'
  | 'VOTING'
  | 'HUNTER_REVENGE'
  | 'GAME_OVER';

export type AvatarId =
  | 'count'
  | 'healer'
  | 'watcher'
  | 'hunter'
  | 'jester'
  | 'raven'
  | 'guard'
  | 'shadow';

export type UserStatus = 'online' | 'in_game' | 'offline';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  vampireWins: number;
  villagerWins: number;
  jesterWins: number;
}

export interface UserProfile {
  id: string;
  tag: string;
  displayName: string;
  avatarId: AvatarId;
  isGuest: boolean;
  level: number;
  xp: number;
  stats: UserStats;
}

export interface FriendEntry {
  id: string;
  tag: string;
  displayName: string;
  avatarId: AvatarId;
  level: number;
  status: UserStatus;
  roomCode?: string;
  relationship: 'friend' | 'incoming' | 'outgoing';
}

export interface RoleDistribution {
  VAMPIRE: number;
  DOCTOR: number;
  DETECTIVE: number;
  HUNTER: number;
  JESTER: number;
}

export interface RoomSettings {
  name: string;
  capacity: number; // 6 - 16
  isPublic: boolean;
  hasPassword: boolean;
  nightDuration: number; // seconds
  dayDuration: number; // seconds
  voteDuration: number; // seconds
  roles: RoleDistribution;
}

export interface PublicPlayerView {
  userId: string;
  tag: string;
  displayName: string;
  avatarId: AvatarId;
  seatIndex: number;
  isHost: boolean;
  isAlive: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  revealedRole: Role | null;
  votesReceived: number;
  hasVoted: boolean;
}

export interface DetectiveFinding {
  round: number;
  targetId: string;
  targetName: string;
  alignment: 'VAMPIRE' | 'INNOCENT';
}

export interface PrivatePlayerState {
  myRole: Role | null;
  teammates: string[];
  doctorLastProtectedId: string | null;
  detectiveResults: DetectiveFinding[];
  myNightTargetId: string | null;
  myVoteTargetId: string | null;
  vampireVotes: Record<string, string>;
}

export type ChatChannel = 'LOBBY' | 'DAY' | 'VAMPIRE' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  senderAvatar: AvatarId | 'system';
  text: string;
  timestamp: number;
}

export interface WinResult {
  winner: 'VILLAGERS' | 'VAMPIRES' | 'JESTER';
  reason: string;
  jesterWinnerId?: string;
}

export interface RoomSummary {
  code: string;
  name: string;
  hostName: string;
  playerCount: number;
  capacity: number;
  isPublic: boolean;
  hasPassword: boolean;
  phase: GamePhase;
}

export interface ClientRoomSnapshot {
  code: string;
  settings: RoomSettings;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number | null;
  players: PublicPlayerView[];
  morningReport: string | null;
  hunterRevengeUserId: string | null;
  hunterRevengeNextPhase: 'DAY' | 'NIGHT' | null;
  winResult: WinResult | null;
  publicMessages: ChatMessage[];
  vampireMessages: ChatMessage[];
  privateState: PrivatePlayerState;
}

export interface LobbyInvitePayload {
  id: string;
  roomCode: string;
  roomName: string;
  fromUserId: string;
  fromTag: string;
  fromDisplayName: string;
  fromAvatarId: AvatarId;
  createdAt: number;
}

export const ROLE_META: Record<
  Role,
  {
    name: string;
    team: 'VAMPIRES' | 'VILLAGERS' | 'SOLO';
    shortDesc: string;
    objective: string;
    nightActionDesc: string;
  }
> = {
  VAMPIRE: {
    name: 'Vampir',
    team: 'VAMPIRES',
    shortDesc: 'Geceleri avlanır, gündüzleri masum köylü gibi davranır.',
    objective: 'Sayıca hayatta kalan masumlardan eşit veya fazla olduğunda kazanırsın.',
    nightActionDesc: 'Diğer vampirlerle gizlice konuş ve avlanacak kurbanı seç.',
  },
  VILLAGER: {
    name: 'Köylü',
    team: 'VILLAGERS',
    shortDesc: 'Özel gece gücü yoktur; tek silahı keskin gözlemi ve oyudur.',
    objective: 'Tüm vampirleri gündüz oylamalarında ortaya çıkarıp köyü kurtar.',
    nightActionDesc: 'Gece boyunca güvende kalmaya çalış ve sabah raporunu bekle.',
  },
  DOCTOR: {
    name: 'Doktor',
    team: 'VILLAGERS',
    shortDesc: 'Her gece seçtiği bir kişiyi vampir saldırısından korur.',
    objective: 'Kilit rolleri ve köylüleri hayatta tutarak vampirleri alt et.',
    nightActionDesc: 'Korumak istediğin kişiyi seç (üst üste aynı kişiyi koruyamazsın).',
  },
  DETECTIVE: {
    name: 'Dedektif',
    team: 'VILLAGERS',
    shortDesc: 'Her gece bir oyuncunun tarafını gizlice soruşturur.',
    objective: 'Vampirleri tespit et ve köyü doğru hedefe yönlendir.',
    nightActionDesc: 'Soruşturmak istediğin oyuncuyu seç; sonucun anında gizli gelir.',
  },
  HUNTER: {
    name: 'Avcı',
    team: 'VILLAGERS',
    shortDesc: 'Elendiğinde son nefesiyle seçtiği bir oyuncuyu yanında götürür.',
    objective: 'Köyü koru; eğer düşersen namlunu doğru şüpheliden şaşma.',
    nightActionDesc: 'Gece pasif kalırsın, ancak ölürsen son atış hakkın tetiklenir.',
  },
  JESTER: {
    name: 'Soytarı',
    team: 'SOLO',
    shortDesc: 'Kaosun ustasıdır; amacı kendini gündüz oylamasında astırmaktır.',
    objective: 'Köylüleri veya vampirleri kandırarak gündüz oylamasında asılmayı başar.',
    nightActionDesc: 'Gece hedefin yoktur; gündüz şüpheleri üzerine çekmeye odaklan.',
  },
};

export const AVATAR_LIST: { id: AvatarId; label: string }[] = [
  { id: 'count', label: 'Kont' },
  { id: 'healer', label: 'Hekim' },
  { id: 'watcher', label: 'Gözcü' },
  { id: 'hunter', label: 'Avcı' },
  { id: 'jester', label: 'Soytarı' },
  { id: 'raven', label: 'Kuzgun' },
  { id: 'guard', label: 'Muhafız' },
  { id: 'shadow', label: 'Gölge' },
];
