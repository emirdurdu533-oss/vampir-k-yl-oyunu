import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Crosshair,
  Eye,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Send,
  Shield,
  Skull,
  Sun,
  Vote,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { ROLE_META, type ChatChannel, type GamePhase } from '../shared/types.ts';
import { soundFX } from '../utils/sound.ts';
import { AvatarArt, RoleEmblemIcon } from './AvatarArt.tsx';
import { GameOverModal } from './GameOverModal.tsx';
import { RoleCardModal } from './RoleCardModal.tsx';

function getPhaseDisplay(phase: GamePhase, round: number) {
  switch (phase) {
    case 'ROLE_REVEAL':
      return { title: 'Roller Dağıtıldı', subtitle: 'Gizli kartını incele', tone: 'slate' };
    case 'NIGHT':
      return { title: `Gece ${round}`, subtitle: 'Gölgeler uyanıyor', tone: 'night' };
    case 'MORNING':
      return { title: `Sabah ${round}`, subtitle: 'Gece raporu açıklandı', tone: 'dawn' };
    case 'DAY':
      return { title: `Gündüz ${round}`, subtitle: 'Tartışma ve çıkarım', tone: 'day' };
    case 'VOTING':
      return { title: `Oylama ${round}`, subtitle: 'Köy meclisi karar veriyor', tone: 'vote' };
    case 'HUNTER_REVENGE':
      return { title: 'Avcı İntikamı', subtitle: 'Son atış yapılıyor', tone: 'vote' };
    case 'GAME_OVER':
      return { title: 'Oyun Sona Erdi', subtitle: 'Tüm roller açıklandı', tone: 'slate' };
    default:
      return { title: 'Lobi', subtitle: '', tone: 'slate' };
  }
}

export function GameTableView() {
  const {
    user,
    activeRoom,
    socketConnected,
    soundEnabled,
    toggleSound,
    leaveRoom,
    submitNightAction,
    submitDayVote,
    submitHunterRevenge,
    sendChat,
    showToast,
  } = useGame();

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [roleCardOpen, setRoleCardOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<'PUBLIC' | 'VAMPIRE'>('PUBLIC');
  const [chatInput, setChatInput] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'table' | 'chat'>('table');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  // Live 250ms tick for crisp tabular-nums countdown
  useEffect(() => {
    const endsAt = activeRoom?.phaseEndsAt ?? null;
    if (!endsAt) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [activeRoom?.phaseEndsAt, activeRoom?.phase]);

  // Open Role Card automatically during ROLE_REVEAL, switch chat to Vampire at Night for Vampires
  useEffect(() => {
    if (!activeRoom) return;
    if (activeRoom.phase !== prevPhaseRef.current) {
      if (activeRoom.phase === 'ROLE_REVEAL') {
        setRoleCardOpen(true);
      } else if (prevPhaseRef.current === 'ROLE_REVEAL') {
        setRoleCardOpen(false);
      }

      if (
        activeRoom.phase === 'NIGHT' &&
        activeRoom.privateState.myRole === 'VAMPIRE'
      ) {
        setChatChannel('VAMPIRE');
      } else if (activeRoom.phase === 'DAY' || activeRoom.phase === 'MORNING') {
        setChatChannel('PUBLIC');
      }
      prevPhaseRef.current = activeRoom.phase;
    }
  }, [activeRoom?.phase, activeRoom?.privateState.myRole]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.publicMessages.length, activeRoom?.vampireMessages.length, chatChannel]);

  if (!activeRoom || !user) return null;

  const me = activeRoom.players.find((p) => p.userId === user.id);
  const myRole = activeRoom.privateState.myRole;
  const isVampire = myRole === 'VAMPIRE';
  const isAlive = Boolean(me?.isAlive);
  const phaseInfo = getPhaseDisplay(activeRoom.phase, activeRoom.round);

  const canActAtNight =
    activeRoom.phase === 'NIGHT' &&
    isAlive &&
    (myRole === 'VAMPIRE' || myRole === 'DOCTOR' || myRole === 'DETECTIVE');

  const isHunterRevengeActor =
    activeRoom.phase === 'HUNTER_REVENGE' && activeRoom.hunterRevengeUserId === user.id;

  const canVote = activeRoom.phase === 'VOTING' && isAlive;

  const myNightTarget = activeRoom.privateState.myNightTargetId;
  const myVoteTarget = activeRoom.privateState.myVoteTargetId;
  const detectiveLatest =
    activeRoom.privateState.detectiveResults[
      activeRoom.privateState.detectiveResults.length - 1
    ];

  const handlePlayerTileClick = async (targetUserId: string) => {
    if (isHunterRevengeActor) {
      const res = await submitHunterRevenge(targetUserId);
      if (!res.ok && res.error) showToast(res.error, 'error');
      else soundFX.playVoteTick();
      return;
    }

    if (canActAtNight) {
      const res = await submitNightAction(targetUserId);
      if (!res.ok && res.error) {
        showToast(res.error, 'error');
      } else {
        soundFX.playVoteTick();
        showToast('Gece hamlen kaydedildi.', 'success');
      }
      return;
    }

    if (canVote) {
      const res = await submitDayVote(targetUserId);
      if (!res.ok && res.error) {
        showToast(res.error, 'error');
      } else {
        soundFX.playVoteTick();
      }
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const channel: ChatChannel = chatChannel === 'VAMPIRE' ? 'VAMPIRE' : 'DAY';
    const res = await sendChat(channel, chatInput);
    if (res.ok) {
      setChatInput('');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const canTypeChat =
    chatChannel === 'VAMPIRE'
      ? isVampire && isAlive && activeRoom.phase === 'NIGHT'
      : isAlive &&
        (activeRoom.phase === 'DAY' ||
          activeRoom.phase === 'MORNING' ||
          activeRoom.phase === 'VOTING' ||
          activeRoom.phase === 'ROLE_REVEAL');

  const displayedMessages =
    chatChannel === 'VAMPIRE' ? activeRoom.vampireMessages : activeRoom.publicMessages;

  const bgAtmosphere =
    activeRoom.phase === 'NIGHT'
      ? 'bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.22),#070913_65%)]'
      : activeRoom.phase === 'MORNING' || activeRoom.phase === 'DAY'
      ? 'bg-[radial-gradient(circle_at_top,rgba(217,119,6,0.14),#070913_65%)]'
      : 'bg-[#070913]';

  return (
    <div className={`min-h-screen ${bgAtmosphere} text-slate-100 flex flex-col transition-colors duration-700`}>
      {/* Compact Game HUD Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070913]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          {/* Phase Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                activeRoom.phase === 'NIGHT'
                  ? 'border-red-700/60 bg-red-950/40 text-red-300'
                  : activeRoom.phase === 'VOTING' || activeRoom.phase === 'HUNTER_REVENGE'
                  ? 'border-amber-600/60 bg-amber-950/40 text-amber-300'
                  : 'border-slate-700 bg-[#0d1222] text-amber-200'
              }`}
            >
              {activeRoom.phase === 'NIGHT' ? (
                <Moon className="h-5 w-5" />
              ) : activeRoom.phase === 'VOTING' ? (
                <Vote className="h-5 w-5" />
              ) : activeRoom.phase === 'HUNTER_REVENGE' ? (
                <Crosshair className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold text-slate-50 whitespace-nowrap">
                {phaseInfo.title}
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 truncate">
                {phaseInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Center Countdown Timer */}
          {activeRoom.phaseEndsAt && (
            <div
              aria-live="polite"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono-tabular text-sm sm:text-base font-bold ${
                secondsLeft <= 10
                  ? 'border-red-600/80 bg-red-950/60 text-red-200'
                  : 'border-slate-700 bg-[#0d1222] text-amber-200'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>{secondsLeft}s</span>
            </div>
          )}

          {/* Right Utilities */}
          <div className="flex items-center gap-1.5 shrink-0">
            {myRole && (
              <button
                type="button"
                onClick={() => setRoleCardOpen(true)}
                className="min-h-[40px] rounded-xl border border-amber-500/40 bg-amber-950/25 hover:bg-amber-950/45 px-2.5 sm:px-3 text-xs font-semibold text-amber-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">{ROLE_META[myRole].name}</span>
                <span className="sm:hidden">Rolüm</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Sesi kapat' : 'Sesi aç'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0d1222] text-slate-300 hover:text-amber-200"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={leaveRoom}
              aria-label="Oyundan ayrıl"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0d1222] text-slate-400 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Reconnecting Banner */}
      {!socketConnected && (
        <div
          role="status"
          className="bg-amber-950/80 border-b border-amber-700/60 px-4 py-2 text-center text-xs font-medium text-amber-200 flex items-center justify-center gap-2"
        >
          <WifiOff className="h-4 w-4" />
          <span>Bağlantı koptu. 45 saniyelik geri bağlanma hakkın korunuyor...</span>
        </div>
      )}

      {/* Mobile Table / Chat Switcher */}
      <div className="px-3 pt-3 lg:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0d1222] p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setMobilePanel('table')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold ${
              mobilePanel === 'table' ? 'bg-slate-800 text-amber-200' : 'text-slate-400'
            }`}
          >
            Oyun Masası
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('chat')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
              mobilePanel === 'chat' ? 'bg-slate-800 text-amber-200' : 'text-slate-400'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Sohbet</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Arena */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 lg:py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left 8 Cols: Context Prompt + Player Table + Action Bar */}
          <section
            className={`lg:col-span-8 space-y-4 ${
              mobilePanel === 'chat' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Morning Report / Private Action Banner */}
            {(activeRoom.morningReport ||
              isHunterRevengeActor ||
              (myRole === 'DETECTIVE' && detectiveLatest)) && (
              <div className="space-y-2">
                {activeRoom.morningReport &&
                  (activeRoom.phase === 'MORNING' || activeRoom.phase === 'DAY') && (
                    <div className="rounded-2xl border border-amber-500/35 bg-[#0d1222] px-4 py-3 text-sm text-amber-100">
                      <span className="font-semibold text-amber-300">Sabah Raporu: </span>
                      {activeRoom.morningReport}
                    </div>
                  )}

                {isHunterRevengeActor && (
                  <div className="rounded-2xl border border-red-600/70 bg-red-950/50 px-4 py-3 text-sm text-red-100 flex items-center gap-2">
                    <Crosshair className="h-4 w-4 text-red-300 shrink-0" />
                    <span>
                      Elendin! Son nefesini vermeden önce masadan yanında götüreceğin bir oyuncu seç.
                    </span>
                  </div>
                )}

                {myRole === 'DETECTIVE' && detectiveLatest && (
                  <div className="rounded-2xl border border-blue-700/50 bg-blue-950/30 px-4 py-3 text-xs sm:text-sm text-blue-100 flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-300 shrink-0" />
                    <span>
                      Son Soruşturma (Tur {detectiveLatest.round}):{' '}
                      <strong>{detectiveLatest.targetName}</strong> →{' '}
                      <strong
                        className={
                          detectiveLatest.alignment === 'VAMPIRE'
                            ? 'text-red-300'
                            : 'text-emerald-300'
                        }
                      >
                        {detectiveLatest.alignment === 'VAMPIRE' ? 'VAMPİR' : 'MASUM'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Guidance Strip */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#0d1222] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs sm:text-sm text-slate-200">
                {!isAlive ? (
                  <span className="text-slate-400">
                    Oyundan elendin. İzleyici olarak oyunun gidişatını takip ediyorsun.
                  </span>
                ) : activeRoom.phase === 'NIGHT' ? (
                  canActAtNight ? (
                    <span className="text-amber-200 font-medium">
                      {myRole ? ROLE_META[myRole].nightActionDesc : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Gece boyunca bekle. Vampirler, Doktor ve Dedektif hamle yapıyor.
                    </span>
                  )
                ) : activeRoom.phase === 'VOTING' ? (
                  <span className="text-amber-200 font-medium">
                    Şüphelendiğin oyuncunun kartına dokunarak oy ver veya pas geç.
                  </span>
                ) : (
                  <span className="text-slate-300">
                    Gündüz sohbetinde iddiaları tartış ve vampirleri ortaya çıkar.
                  </span>
                )}
              </div>

              {canVote && (
                <button
                  type="button"
                  onClick={() => submitDayVote('ABSTAIN')}
                  className={`min-h-[38px] rounded-xl px-3.5 text-xs font-semibold border shrink-0 whitespace-nowrap ${
                    myVoteTarget === 'ABSTAIN'
                      ? 'border-amber-500 bg-amber-950/40 text-amber-200'
                      : 'border-slate-700 bg-[#070913] text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {myVoteTarget === 'ABSTAIN' ? 'Pas Seçildi' : 'Pas Geç'}
                </button>
              )}
            </div>

            {/* Player Table Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activeRoom.players.map((p) => {
                const isSelf = p.userId === user.id;
                const isTeammate = activeRoom.privateState.teammates.includes(p.userId);
                const isDoctorBlocked =
                  activeRoom.phase === 'NIGHT' &&
                  myRole === 'DOCTOR' &&
                  activeRoom.privateState.doctorLastProtectedId === p.userId;

                const isInteractiveTarget =
                  (isHunterRevengeActor && p.isAlive && !isSelf) ||
                  (canVote && p.isAlive) ||
                  (canActAtNight &&
                    p.isAlive &&
                    !(myRole === 'VAMPIRE' && (isSelf || p.revealedRole === 'VAMPIRE')) &&
                    !(myRole === 'DETECTIVE' && isSelf) &&
                    !isDoctorBlocked);

                const isSelectedNight = myNightTarget === p.userId;
                const isSelectedVote = myVoteTarget === p.userId;
                const isSelected = isSelectedNight || isSelectedVote;

                // Vampire co-vote count at night
                const vampireVoteCount =
                  isVampire && activeRoom.phase === 'NIGHT'
                    ? Object.values(activeRoom.privateState.vampireVotes).filter(
                        (tid) => tid === p.userId
                      ).length
                    : 0;

                return (
                  <button
                    key={p.userId}
                    type="button"
                    disabled={!isInteractiveTarget}
                    onClick={() => isInteractiveTarget && handlePlayerTileClick(p.userId)}
                    className={`relative flex flex-col items-center text-center rounded-2xl border p-3.5 transition-all min-h-[144px] justify-between ${
                      !p.isAlive
                        ? 'border-slate-800/60 bg-[#070913]/50 opacity-60 cursor-default'
                        : isSelected
                        ? 'border-red-500 bg-red-950/35 ring-2 ring-red-500/40'
                        : isInteractiveTarget
                        ? 'border-slate-700/90 bg-[#0d1222] hover:border-amber-500/70 hover:-translate-y-0.5 cursor-pointer'
                        : 'border-slate-800/80 bg-[#0d1222] cursor-default'
                    }`}
                  >
                    {/* Top row indicators */}
                    <div className="flex w-full items-center justify-between text-[11px] min-h-[18px]">
                      <span className="font-mono-tabular text-slate-500">#{p.seatIndex + 1}</span>
                      {!p.isAlive ? (
                        <span className="flex items-center gap-1 text-red-400 font-semibold">
                          <Skull className="h-3.5 w-3.5" />
                          <span>Elendi</span>
                        </span>
                      ) : !p.connected ? (
                        <span className="text-amber-300 font-medium">Koptu</span>
                      ) : isTeammate ? (
                        <span className="text-red-300 font-semibold">Müttefik</span>
                      ) : isDoctorBlocked ? (
                        <span className="text-slate-500">Korumalıydı</span>
                      ) : (
                        <span className="text-slate-500">{isSelf ? 'Sen' : ''}</span>
                      )}
                    </div>

                    <AvatarArt avatarId={p.avatarId} size={50} dead={!p.isAlive} />

                    <div className="w-full space-y-0.5">
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {p.displayName}
                      </p>

                      {/* Only reveal role if dead, self, teammate vampire, or game over */}
                      {p.revealedRole && (
                        <div className="flex items-center justify-center gap-1 text-[11px] text-amber-300">
                          <RoleEmblemIcon role={p.revealedRole} size={14} />
                          <span>{ROLE_META[p.revealedRole].name}</span>
                        </div>
                      )}
                    </div>

                    {/* Vote / Night Target Counter */}
                    {activeRoom.phase === 'VOTING' && p.isAlive && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono-tabular">
                        <span
                          className={
                            p.votesReceived > 0 ? 'text-red-300 font-bold' : 'text-slate-500'
                          }
                        >
                          {p.votesReceived} Oy
                        </span>
                        {p.hasVoted && (
                          <span className="text-emerald-400">· Oy Verdi</span>
                        )}
                      </div>
                    )}

                    {vampireVoteCount > 0 && (
                      <span className="mt-1 text-[11px] font-semibold text-red-300 font-mono-tabular">
                        Vampir Hedefi ({vampireVoteCount})
                      </span>
                    )}

                    {isSelected && (
                      <span className="mt-1 text-[11px] font-semibold text-amber-200 flex items-center gap-1">
                        {myRole === 'DOCTOR' ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <Crosshair className="h-3 w-3" />
                        )}
                        <span>Seçildi</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right 4 Cols: Dual-Channel Chat (Day/Public + Vampire Secret Night Chat) */}
          <aside
            className={`lg:col-span-4 flex flex-col rounded-2xl border border-slate-800/90 bg-[#0d1222] h-[460px] lg:h-[640px] ${
              mobilePanel === 'table' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-2 border-b border-slate-800">
              {isVampire ? (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#070913] p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChatChannel('PUBLIC')}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                      chatChannel === 'PUBLIC'
                        ? 'bg-slate-800 text-amber-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Köy Sohbeti
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatChannel('VAMPIRE')}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                      chatChannel === 'VAMPIRE'
                        ? 'bg-red-950 text-red-200 border border-red-800/60'
                        : 'text-red-300/70 hover:text-red-200'
                    }`}
                  >
                    Vampir Gece Sohbeti
                  </button>
                </div>
              ) : (
                <div className="px-2 py-1.5">
                  <h2 className="text-sm font-semibold text-slate-200">Köy Sohbeti</h2>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {displayedMessages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  {chatChannel === 'VAMPIRE'
                    ? 'Diğer vampirlerle gizli gece sohbeti burada görünür.'
                    : 'Henüz mesaj yok.'}
                </p>
              ) : (
                displayedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={
                      msg.channel === 'SYSTEM'
                        ? 'text-xs text-amber-300/90 py-1'
                        : msg.channel === 'VAMPIRE'
                        ? 'rounded-xl bg-red-950/35 border border-red-900/50 px-3 py-2'
                        : 'rounded-xl bg-[#070913]/90 border border-slate-800/70 px-3 py-2'
                    }
                  >
                    {msg.channel !== 'SYSTEM' && (
                      <p
                        className={`text-[11px] font-semibold mb-0.5 ${
                          msg.channel === 'VAMPIRE' ? 'text-red-300' : 'text-slate-400'
                        }`}
                      >
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm text-slate-100 break-words">{msg.text}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleChatSubmit}
              className="flex items-center gap-2 p-3 border-t border-slate-800"
            >
              <label htmlFor="game-chat-input" className="sr-only">
                Oyun sohbet mesajı
              </label>
              <input
                id="game-chat-input"
                type="text"
                maxLength={280}
                disabled={!canTypeChat}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  canTypeChat
                    ? chatChannel === 'VAMPIRE'
                      ? 'Vampirlere gizli mesaj...'
                      : 'Köye mesaj yaz...'
                    : 'Şu anda bu kanalda yazamazsın'
                }
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-3 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-50 focus:border-amber-500/70 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!canTypeChat}
                aria-label="Gönder"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-800 hover:bg-red-700 text-amber-50 disabled:opacity-40 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        </div>
      </main>

      <RoleCardModal
        open={roleCardOpen}
        role={myRole}
        onClose={() => setRoleCardOpen(false)}
      />
      <GameOverModal />
    </div>
  );
}
