import React, { useState } from 'react';
import {
  Award,
  DoorOpen,
  Edit3,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { AVATAR_LIST, ROLE_META, type AvatarId, type Role } from '../shared/types.ts';
import { AvatarArt, RoleEmblemIcon } from './AvatarArt.tsx';
import { CreateRoomModal } from './CreateRoomModal.tsx';

export function MainHub({ onOpenFriends }: { onOpenFriends: () => void }) {
  const {
    user,
    publicRooms,
    friends,
    soundEnabled,
    toggleSound,
    logout,
    joinRoom,
    updateProfile,
    showToast,
  } = useGame();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [passwordTargetRoom, setPasswordTargetRoom] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [editAvatar, setEditAvatar] = useState<AvatarId>(user?.avatarId ?? 'count');
  const [hubTab, setHubTab] = useState<'rooms' | 'roles'>('rooms');

  if (!user) return null;

  const incomingCount = friends.filter((f) => f.relationship === 'incoming').length;
  const xpProgress = ((user.xp % 150) / 150) * 100;

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length !== 6) {
      showToast('Lütfen 6 haneli oda kodunu eksiksiz girin.', 'error');
      return;
    }
    const res = await joinRoom(cleaned, joinPassword.trim() || undefined);
    if (!res.ok) {
      if (res.error?.includes('şifre')) {
        setPasswordTargetRoom(cleaned);
      }
      showToast(res.error || 'Odaya katılınamadı.', 'error');
    }
  };

  const handleJoinPublicRoom = async (code: string, hasPassword: boolean) => {
    if (hasPassword) {
      setPasswordTargetRoom(code);
      setJoinPassword('');
      return;
    }
    const res = await joinRoom(code);
    if (!res.ok) {
      showToast(res.error || 'Odaya katılınamadı.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateProfile(editName, editAvatar);
    if (ok) setEditingProfile(false);
  };

  const roleList: Role[] = ['VAMPIRE', 'DOCTOR', 'DETECTIVE', 'HUNTER', 'JESTER', 'VILLAGER'];

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070913]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Zone 1: Brand wordmark */}
          <span className="font-display text-lg sm:text-xl font-bold tracking-wide text-slate-50 whitespace-nowrap shrink-0">
            Kanlı Köy
          </span>

          {/* Zone 2: Clean text nav links */}
          <nav aria-label="Ana gezinme" className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setHubTab('rooms')}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                hubTab === 'rooms' ? 'text-amber-300' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Açık Odalar
            </button>
            <button
              type="button"
              onClick={() => setHubTab('roles')}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                hubTab === 'roles' ? 'text-amber-300' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Roller Rehberi
            </button>
          </nav>

          {/* Zone 3: Friends trigger + Sound + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Ses efektlerini kapat' : 'Ses efektlerini aç'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0d1222] text-slate-300 hover:text-amber-200"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenFriends}
              className="min-h-[40px] rounded-xl border border-slate-700 bg-[#0d1222] hover:border-amber-500/60 px-3.5 text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Users className="h-4 w-4 text-amber-400" />
              <span>Arkadaşlar{incomingCount > 0 ? ` (${incomingCount})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={logout}
              aria-label="Çıkış yap"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0d1222] text-slate-400 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {/* Mobile Tab Switcher */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#0d1222] p-1 border border-slate-800 md:hidden">
          <button
            type="button"
            onClick={() => setHubTab('rooms')}
            className={`min-h-[42px] rounded-lg text-xs font-semibold ${
              hubTab === 'rooms' ? 'bg-slate-800 text-amber-200' : 'text-slate-400'
            }`}
          >
            Açık Odalar
          </button>
          <button
            type="button"
            onClick={() => setHubTab('roles')}
            className={`min-h-[42px] rounded-lg text-xs font-semibold ${
              hubTab === 'roles' ? 'bg-slate-800 text-amber-200' : 'text-slate-400'
            }`}
          >
            Roller Rehberi
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 8 Columns: Rooms / Roles */}
          <div className="lg:col-span-8 space-y-6">
            {hubTab === 'rooms' ? (
              <>
                {/* Action Bar: Create Room + Quick Join by 6-char Code */}
                <section className="rounded-2xl border border-slate-800/90 bg-[#0d1222] p-4 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-slate-50 text-balance">
                        Köy Meydanı Lobileri
                      </h1>
                      <p className="mt-1 text-sm text-slate-400">
                        Açık bir masaya katıl, oda koduyla giriş yap veya kendi oyununu kur.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="min-h-[46px] rounded-xl bg-red-800 hover:bg-red-700 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-lg shadow-red-950/40 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Yeni Oda Kur</span>
                    </button>
                  </div>

                  {/* Quick Join Form */}
                  <form
                    onSubmit={handleQuickJoin}
                    className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-800/80"
                  >
                    <label htmlFor="quick-join-code" className="sr-only">
                      6 Haneli Oda Kodu
                    </label>
                    <input
                      id="quick-join-code"
                      type="text"
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="6 haneli oda kodu (ör. X7K9M2)"
                      className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-4 font-mono-tabular text-sm uppercase tracking-widest text-slate-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-5 text-sm font-semibold text-slate-100 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <DoorOpen className="h-4 w-4 text-amber-400" />
                      <span>Koda Katıl</span>
                    </button>
                  </form>
                </section>

                {/* Open Public Rooms */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-slate-300">
                      Açık Odalar ({publicRooms.length})
                    </h2>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" />
                      <span>Canlı güncellenir</span>
                    </span>
                  </div>

                  {publicRooms.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1222]/60 p-8 text-center space-y-3">
                      <p className="text-sm text-slate-300">
                        Şu anda açık bir lobi bulunmuyor. İlk odayı sen kurabilirsin!
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="min-h-[44px] rounded-xl border border-red-800/70 bg-red-950/40 hover:bg-red-900/50 px-4 text-xs font-semibold text-amber-100"
                      >
                        İlk Odayı Kur
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {publicRooms.map((room) => (
                        <div
                          key={room.code}
                          className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0d1222] p-4 hover:border-slate-700 transition-colors"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-base font-semibold text-slate-100 truncate">
                                {room.name}
                              </h3>
                              {room.hasPassword && (
                                <Lock
                                  className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"
                                  aria-label="Şifreli oda"
                                />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              <span>Kurucu: {room.hostName}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono-tabular">{room.code}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                            <span className="font-mono-tabular text-xs font-medium text-slate-300">
                              {room.playerCount}/{room.capacity} Oyuncu ·{' '}
                              {room.phase === 'LOBBY' ? 'Lobide' : 'Oyunda'}
                            </span>
                            <button
                              type="button"
                              disabled={room.phase !== 'LOBBY' || room.playerCount >= room.capacity}
                              onClick={() => handleJoinPublicRoom(room.code, room.hasPassword)}
                              className="min-h-[40px] rounded-xl bg-slate-800 hover:bg-red-800 px-3.5 text-xs font-semibold text-slate-100 disabled:opacity-40 whitespace-nowrap"
                            >
                              {room.phase === 'LOBBY' ? 'Katıl' : 'Başladı'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              /* Roles Guide Tab */
              <section className="space-y-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-50">
                    Köy Rolleri ve Kurallar
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Her gece gölgeler uyanır; gündüz meydanda sesler yükselir.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleList.map((roleKey) => {
                    const meta = ROLE_META[roleKey];
                    return (
                      <article
                        key={roleKey}
                        className="rounded-2xl border border-slate-800/90 bg-[#0d1222] p-4 space-y-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <RoleEmblemIcon role={roleKey} size={28} />
                          <div>
                            <h2 className="font-display text-base font-bold text-slate-100">
                              {meta.name}
                            </h2>
                            <p className="text-xs text-slate-400">
                              {meta.team === 'VAMPIRES'
                                ? 'Vampir Tarafı'
                                : meta.team === 'SOLO'
                                ? 'Tek Başına'
                                : 'Köy Tarafı'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300">{meta.shortDesc}</p>
                        <p className="text-xs text-amber-300/90">{meta.objective}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right 4 Columns: Profile & Stats */}
          <aside className="lg:col-span-4 space-y-4">
            <section className="rounded-2xl border border-slate-800/90 bg-[#0d1222] p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarArt avatarId={user.avatarId} size={52} />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-100 truncate">
                      {user.displayName}
                    </h2>
                    <p className="font-mono-tabular text-xs text-amber-300 truncate">{user.tag}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {user.isGuest ? 'Misafir Hesap' : 'Kayıtlı Üye'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditName(user.displayName);
                    setEditAvatar(user.avatarId);
                    setEditingProfile((v) => !v);
                  }}
                  aria-label="Profili düzenle"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#070913] text-slate-400 hover:text-amber-300 shrink-0"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>

              {editingProfile && (
                <form
                  onSubmit={handleSaveProfile}
                  className="space-y-3 rounded-xl border border-slate-800 bg-[#070913] p-3.5"
                >
                  <div>
                    <label htmlFor="edit-name" className="block text-xs text-slate-400 mb-1">
                      Görünen Ad
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      maxLength={24}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-3 text-sm text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AVATAR_LIST.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setEditAvatar(av.id)}
                        aria-label={`Avatar seç: ${av.label}`}
                        className={`flex items-center justify-center rounded-lg p-1.5 border ${
                          editAvatar === av.id
                            ? 'border-amber-500 bg-amber-950/30'
                            : 'border-slate-800 bg-[#0d1222]'
                        }`}
                      >
                        <AvatarArt avatarId={av.id} size={32} />
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="min-h-[36px] rounded-lg px-3 text-xs text-slate-400 hover:text-slate-200"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      className="min-h-[36px] rounded-lg bg-amber-600 hover:bg-amber-500 px-3 text-xs font-semibold text-slate-950"
                    >
                      Kaydet
                    </button>
                  </div>
                </form>
              )}

              {/* Level & XP Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    <span>Seviye {user.level}</span>
                  </span>
                  <span className="font-mono-tabular text-slate-400">{user.xp % 150} / 150 XP</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-red-700 to-amber-500 transition-all"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>

              {/* Match Stats */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                <div className="rounded-xl bg-[#070913] p-3">
                  <p className="text-[11px] text-slate-400">Oynanan Maç</p>
                  <p className="mt-0.5 font-mono-tabular text-lg font-bold text-slate-100">
                    {user.stats.gamesPlayed}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070913] p-3">
                  <p className="text-[11px] text-slate-400">Kazanılan</p>
                  <p className="mt-0.5 font-mono-tabular text-lg font-bold text-amber-300">
                    {user.stats.gamesWon}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070913] p-3">
                  <p className="text-[11px] text-slate-400">Vampir Zaferi</p>
                  <p className="mt-0.5 font-mono-tabular text-base font-semibold text-red-300">
                    {user.stats.vampireWins}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070913] p-3">
                  <p className="text-[11px] text-slate-400">Köy Zaferi</p>
                  <p className="mt-0.5 font-mono-tabular text-base font-semibold text-emerald-300">
                    {user.stats.villagerWins}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* Password prompt modal for protected rooms */}
      {passwordTargetRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Oda Şifresi"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await joinRoom(passwordTargetRoom, joinPassword);
              if (res.ok) {
                setPasswordTargetRoom(null);
              } else {
                showToast(res.error || 'Şifre hatalı.', 'error');
              }
            }}
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0d1222] p-5 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-slate-100">
              Şifreli Oda ({passwordTargetRoom})
            </h2>
            <div>
              <label htmlFor="modal-room-pass" className="block text-xs text-slate-400 mb-1.5">
                Oda Şifresi
              </label>
              <input
                id="modal-room-pass"
                type="password"
                autoFocus
                required
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-3.5 text-sm text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasswordTargetRoom(null)}
                className="min-h-[40px] rounded-xl border border-slate-700 px-4 text-xs font-medium text-slate-300"
              >
                İptal
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-red-800 hover:bg-red-700 px-4 text-xs font-semibold text-amber-50"
              >
                Odaya Gir
              </button>
            </div>
          </form>
        </div>
      )}

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
