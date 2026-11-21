import type { AvatarId, Role } from '../shared/types.ts';

export const GENERATED_ASSETS = {
  heroBackdrop: '/src/assets/images/gothic_village_hero_1795279384869.jpg',
  roleVampire: '/src/assets/images/role_card_vampire_1795279385205.jpg',
  roleVillager: '/src/assets/images/role_card_villager_1795279384954.jpg',
  roleDetective: '/src/assets/images/role_card_detective_1795279384757.jpg',
};

const AVATAR_PALETTE: Record<
  AvatarId,
  { bg: string; ring: string; accent: string; secondary: string }
> = {
  count: { bg: '#1e1018', ring: '#991b1b', accent: '#dc2626', secondary: '#fbbf24' },
  healer: { bg: '#0c1f1c', ring: '#0f766e', accent: '#2dd4bf', secondary: '#fde68a' },
  watcher: { bg: '#0f172a', ring: '#1d4ed8', accent: '#60a5fa', secondary: '#e2e8f0' },
  hunter: { bg: '#1f160c', ring: '#b45309', accent: '#f59e0b', secondary: '#fed7aa' },
  jester: { bg: '#1f1024', ring: '#7e22ce', accent: '#c084fc', secondary: '#facc15' },
  raven: { bg: '#111827', ring: '#475569', accent: '#94a3b8', secondary: '#f8fafc' },
  guard: { bg: '#171923', ring: '#ca8a04', accent: '#eab308', secondary: '#cbd5e1' },
  shadow: { bg: '#090b12', ring: '#be123c', accent: '#f43f5e', secondary: '#94a3b8' },
};

export function AvatarArt({
  avatarId,
  size = 44,
  dead = false,
  className = '',
}: {
  avatarId: AvatarId;
  size?: number;
  dead?: boolean;
  className?: string;
}) {
  const palette = AVATAR_PALETTE[avatarId] ?? AVATAR_PALETTE.count;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 rounded-full ${dead ? 'grayscale opacity-55' : ''} ${className}`}
    >
      <circle cx="32" cy="32" r="30" fill={palette.bg} stroke={palette.ring} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25" stroke={palette.secondary} strokeOpacity="0.16" strokeWidth="1" />

      {/* Hood / cloak silhouette */}
      <path
        d="M14 54C16 42 23 36 32 36C41 36 48 42 50 54"
        fill={palette.ring}
        fillOpacity="0.45"
      />
      <path
        d="M18 32C18 20 24 14 32 14C40 14 46 20 46 32C46 39 40 44 32 44C24 44 18 39 18 32Z"
        fill="#0b0f1c"
        stroke={palette.accent}
        strokeWidth="1.6"
      />

      {/* Character motif */}
      {avatarId === 'count' && (
        <>
          <path d="M24 27L28 29L24 31Z" fill={palette.accent} />
          <path d="M40 27L36 29L40 31Z" fill={palette.accent} />
          <path d="M27 36L29 39L31 36H33L35 39L37 36" stroke={palette.secondary} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {avatarId === 'healer' && (
        <>
          <path d="M32 21V35M25 28H39" stroke={palette.accent} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="32" cy="28" r="9" stroke={palette.secondary} strokeOpacity="0.4" strokeWidth="1.2" />
        </>
      )}
      {avatarId === 'watcher' && (
        <>
          <path d="M20 28C24 23 40 23 44 28C40 33 24 33 20 28Z" stroke={palette.accent} strokeWidth="1.8" />
          <circle cx="32" cy="28" r="3.2" fill={palette.secondary} />
        </>
      )}
      {avatarId === 'hunter' && (
        <>
          <path d="M22 36L42 20M36 20H42V26" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="25" cy="33" r="4" stroke={palette.secondary} strokeWidth="1.4" />
        </>
      )}
      {avatarId === 'jester' && (
        <>
          <path d="M22 25L27 20L32 25L37 20L42 25" stroke={palette.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 33C29 36 35 36 38 33" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {avatarId === 'raven' && (
        <>
          <path d="M23 30C25 24 34 21 41 25L36 28L42 30C36 33 28 34 23 30Z" fill={palette.accent} />
          <circle cx="33" cy="26" r="1.4" fill="#0b0f1c" />
        </>
      )}
      {avatarId === 'guard' && (
        <>
          <path d="M32 20L41 24V31C41 36 36.5 39.5 32 41C27.5 39.5 23 36 23 31V24L32 20Z" stroke={palette.accent} strokeWidth="1.8" />
          <path d="M32 23V37" stroke={palette.secondary} strokeOpacity="0.6" strokeWidth="1.4" />
        </>
      )}
      {avatarId === 'shadow' && (
        <>
          <path d="M34 20A9 9 0 1 0 41 34A7 7 0 1 1 34 20Z" fill={palette.accent} />
        </>
      )}
    </svg>
  );
}

export function RoleEmblemIcon({ role, size = 24 }: { role: Role; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {role === 'VAMPIRE' && (
        <>
          <path
            d="M12 19C12 19 5 14.5 5 9C5 6.8 6.8 5 9 5C10.4 5 11.4 5.7 12 6.8C12.6 5.7 13.6 5 15 5C17.2 5 19 6.8 19 9C19 14.5 12 19 12 19Z"
            fill="#991b1b"
            stroke="#fca5a5"
            strokeWidth="1.5"
          />
          <path d="M9.5 10L10.5 13L11.5 10M12.5 10L13.5 13L14.5 10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {role === 'VILLAGER' && (
        <>
          <path d="M12 4L4 10V20H20V10L12 4Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 20V14H14V20" stroke="#fde68a" strokeWidth="1.5" />
        </>
      )}
      {role === 'DOCTOR' && (
        <>
          <circle cx="12" cy="12" r="9" fill="#0f3f3c" stroke="#5eead4" strokeWidth="1.6" />
          <path d="M12 7.5V16.5M7.5 12H16.5" stroke="#99f6e4" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {role === 'DETECTIVE' && (
        <>
          <circle cx="10.5" cy="10.5" r="5.5" fill="#172554" stroke="#93c5fd" strokeWidth="1.7" />
          <path d="M14.8 14.8L20 20" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {role === 'HUNTER' && (
        <>
          <circle cx="12" cy="12" r="8" stroke="#f59e0b" strokeWidth="1.6" />
          <path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.2" fill="#ef4444" />
        </>
      )}
      {role === 'JESTER' && (
        <>
          <path d="M4 17L7 8L12 13L17 8L20 17H4Z" fill="#4c1d95" stroke="#d8b4fe" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="7" cy="6.5" r="1.5" fill="#fbbf24" />
          <circle cx="12" cy="5.5" r="1.5" fill="#fbbf24" />
          <circle cx="17" cy="6.5" r="1.5" fill="#fbbf24" />
        </>
      )}
    </svg>
  );
}
