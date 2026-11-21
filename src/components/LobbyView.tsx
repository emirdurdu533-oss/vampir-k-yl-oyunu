import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Send,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { validateRoomSettings } from '../game/engine.ts';
import type { RoomSettings } from '../shared/types.ts';
import { AvatarArt } from './AvatarArt.tsx';

export function LobbyView({ onOpenFriends }: { onOpenFriends: () => void }) {
  const {
    user,
    activeRoom,
    leaveRoom,
    updateRoomSettings,
    startGame,
    sendChat,
    showToast,
  } = useGame();

  const [copied, setCopied] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<RoomSettings | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeRoom) {
      setDraftSettings(activeRoom.settings);
    }
  }, [activeRoom?.code, activeRoom?.settings]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.publicMessages.length]);

  if (!activeRoom || !user) return null;

  const me = activeRoom.players.find((p) => p.userId === user.id);
  const isHost = Boolean(me?.isHost);
  const readyToStart = activeRoom.players.length >= 6;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeRoom.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast(`Oda kodu: ${activeRoom.code}`, 'info');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const res = await sendChat('LOBBY', chatText);
    if (res.ok) {
      setChatText('');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftSettings) return;
    const validation = validateRoomSettings(draftSettings);
    if (!validation.valid) {
      showToast(validation.error || 'Ayarlar geçersiz.', 'error');
      return;
    }
    const res = await updateRoomSettings(draftSettings);
    if (res.ok) {
      showToast('Oda ayarları güncellendi.', 'success');
      setShowSettings(false);
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleStart = async () => {
    const res = await startGame();
    if (!res.ok && res.error) {
      showToast(res.error, 'error');
    }
  };

  const settingsToShow = draftSettings ?? activeRoom.settings;
  const specialCount =
    settingsToShow.roles.VAMPIRE +
    settingsToShow.roles.DOCTOR +
    settingsToShow.roles.DETECTIVE +
    settingsToShow.roles.HUNTER +
    settingsToShow.roles.JESTER;
  const villagerPreview = Math.max(0, settingsToShow.capacity - specialCount);

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col">
      {/* Lobby Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070913]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={leaveRoom}
              aria-label="Odadan ayrıl"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0d1222] text-slate-300 hover:text-red-300 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-50 truncate">
                {activeRoom.settings.name}
              </h1>
              <p className="text-xs text-slate-400 font-mono-tabular truncate">
                {activeRoom.players.length}/{activeRoom.settings.capacity} Oyuncu ·{' '}
                {activeRoom.settings.isPublic ? 'Açık Oda' : 'Özel Oda'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label={`Oda kodunu kopyala: ${activeRoom.code}`}
              className="min-h-[40px] rounded-xl border border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/50 px-3 font-mono-tabular text-xs sm:text-sm font-bold tracking-widest text-amber-200 flex items-center gap-2"
            >
              <span>{activeRoom.code}</span>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onOpenFriends}
              className="min-h-[40px] rounded-xl border border-slate-700 bg-[#0d1222] hover:border-amber-500/60 px-3 text-xs font-semibold text-slate-100 flex items-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Davet Et</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Seats & Host Controls (7 cols) */}
          <section className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl border border-slate-800/90 bg-[#0d1222] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>Masadaki Oyuncular ({activeRoom.players.length}/{activeRoom.settings.capacity})</span>
                </h2>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => setShowSettings((v) => !v)}
                    className="min-h-[38px] rounded-xl border border-slate-700 bg-[#070913] px-3 text-xs font-medium text-slate-200 hover:border-amber-500/60 flex items-center gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>{showSettings ? 'Ayarları Gizle' : 'Oda Ayarları'}</span>
                  </button>
                )}
              </div>

              {/* Host Settings Editor */}
              {isHost && showSettings && draftSettings && (
                <form
                  onSubmit={handleSaveSettings}
                  className="rounded-xl border border-slate-800 bg-[#070913] p-4 space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="lobby-cap" className="block text-[11px] text-slate-400 mb-1">
                        Kapasite (6–16)
                      </label>
                      <input
                        id="lobby-cap"
                        type="number"
                        min={Math.max(6, activeRoom.players.length)}
                        max={16}
                        value={draftSettings.capacity}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, capacity: Number(e.target.value) })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="lobby-vamp" className="block text-[11px] text-slate-400 mb-1">
                        Vampir
                      </label>
                      <input
                        id="lobby-vamp"
                        type="number"
                        min={1}
                        max={5}
                        value={draftSettings.roles.VAMPIRE}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            roles: { ...draftSettings.roles, VAMPIRE: Number(e.target.value) },
                          })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="lobby-doc" className="block text-[11px] text-slate-400 mb-1">
                        Doktor
                      </label>
                      <input
                        id="lobby-doc"
                        type="number"
                        min={0}
                        max={2}
                        value={draftSettings.roles.DOCTOR}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            roles: { ...draftSettings.roles, DOCTOR: Number(e.target.value) },
                          })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="lobby-det" className="block text-[11px] text-slate-400 mb-1">
                        Dedektif
                      </label>
                      <input
                        id="lobby-det"
                        type="number"
                        min={0}
                        max={2}
                        value={draftSettings.roles.DETECTIVE}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            roles: { ...draftSettings.roles, DETECTIVE: Number(e.target.value) },
                          })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="lobby-hunt" className="block text-[11px] text-slate-400 mb-1">
                        Avcı
                      </label>
                      <input
                        id="lobby-hunt"
                        type="number"
                        min={0}
                        max={2}
                        value={draftSettings.roles.HUNTER}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            roles: { ...draftSettings.roles, HUNTER: Number(e.target.value) },
                          })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="lobby-jest" className="block text-[11px] text-slate-400 mb-1">
                        Soytarı
                      </label>
                      <input
                        id="lobby-jest"
                        type="number"
                        min={0}
                        max={2}
                        value={draftSettings.roles.JESTER}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            roles: { ...draftSettings.roles, JESTER: Number(e.target.value) },
                          })
                        }
                        className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-[#0d1222] px-2.5 font-mono-tabular text-sm text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">
                      Köylü Sayısı: <strong className="text-slate-200">{villagerPreview}</strong>
                    </span>
                    <button
                      type="submit"
                      className="min-h-[38px] rounded-xl bg-amber-600 hover:bg-amber-500 px-4 text-xs font-semibold text-slate-950"
                    >
                      Ayarları Uygula
                    </button>
                  </div>
                </form>
              )}

              {/* Seats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {activeRoom.players.map((p) => (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                      p.userId === user.id
                        ? 'border-amber-500/60 bg-amber-950/15'
                        : 'border-slate-800 bg-[#070913]/80'
                    }`}
                  >
                    <AvatarArt avatarId={p.avatarId} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                          {p.displayName}
                        </p>
                        {p.isHost && (
                          <Crown
                            className="h-3.5 w-3.5 text-amber-400 shrink-0"
                            aria-label="Oda kurucusu"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {p.connected ? p.tag : 'Bağlantı koptu'}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Empty seats */}
                {Array.from({
                  length: Math.max(0, activeRoom.settings.capacity - activeRoom.players.length),
                }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="flex items-center justify-center rounded-xl border border-dashed border-slate-800/80 bg-[#070913]/30 p-3 min-h-[60px]"
                  >
                    <span className="text-xs text-slate-600">Boş Koltuk</span>
                  </div>
                ))}
              </div>

              {/* Role Distribution Summary + Start CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-400 font-mono-tabular">
                  {settingsToShow.roles.VAMPIRE} Vampir · {settingsToShow.roles.DOCTOR} Doktor ·{' '}
                  {settingsToShow.roles.DETECTIVE} Dedektif · {settingsToShow.roles.HUNTER} Avcı ·{' '}
                  {settingsToShow.roles.JESTER} Soytarı
                </p>

                {isHost ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={!readyToStart}
                    className="min-h-[46px] rounded-xl bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 px-5 text-sm font-semibold text-amber-50 disabled:opacity-45 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-4 w-4" />
                    <span>
                      {readyToStart
                        ? 'Oyunu Başlat'
                        : `Oyunu Başlat (${activeRoom.players.length}/6)`}
                    </span>
                  </button>
                ) : (
                  <span className="text-xs font-medium text-amber-300/90">
                    Oda kurucusunun oyunu başlatması bekleniyor...
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Lobby Chat (5 cols) */}
          <section className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800/90 bg-[#0d1222] h-[420px] lg:h-[540px]">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-200">Lobi Sohbeti</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {activeRoom.publicMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.channel === 'SYSTEM'
                      ? 'text-xs text-amber-300/90 py-1'
                      : 'rounded-xl bg-[#070913]/85 border border-slate-800/70 px-3 py-2'
                  }
                >
                  {msg.channel !== 'SYSTEM' && (
                    <p className="text-[11px] font-semibold text-slate-400 mb-0.5">
                      {msg.senderName}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-slate-100 break-words">{msg.text}</p>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="flex items-center gap-2 p-3 border-t border-slate-800"
            >
              <label htmlFor="lobby-chat-input" className="sr-only">
                Lobi mesajı
              </label>
              <input
                id="lobby-chat-input"
                type="text"
                maxLength={280}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Lobiye mesaj yaz..."
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Mesaj gönder"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-800 hover:bg-red-700 text-amber-50 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
