import React from 'react';
import { Award, RotateCcw, Trophy } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { ROLE_META } from '../shared/types.ts';
import { AvatarArt, RoleEmblemIcon } from './AvatarArt.tsx';

export function GameOverModal() {
  const { user, activeRoom, returnToLobby, leaveRoom, showToast } = useGame();

  if (!activeRoom || activeRoom.phase !== 'GAME_OVER' || !activeRoom.winResult || !user) {
    return null;
  }

  const me = activeRoom.players.find((p) => p.userId === user.id);
  const isHost = Boolean(me?.isHost);
  const { winner, reason } = activeRoom.winResult;

  const title =
    winner === 'VILLAGERS'
      ? 'Köy Halkı Kazandı'
      : winner === 'VAMPIRES'
      ? 'Vampirler Kazandı'
      : 'Soytarı Kazandı';

  const accentBorder =
    winner === 'VILLAGERS'
      ? 'border-amber-500/50'
      : winner === 'VAMPIRES'
      ? 'border-red-600/60'
      : 'border-purple-500/60';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Oyun Sonu"
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border ${accentBorder} bg-[#0d1222] p-5 sm:p-7 shadow-2xl space-y-6`}
      >
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#070913] border border-amber-500/40">
            <Trophy className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">{title}</h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">{reason}</p>
        </div>

        {/* Full Role Reveal Roster */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tüm Oyuncuların Rolleri
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeRoom.players.map((p) => {
              const role = p.revealedRole ?? 'VILLAGER';
              const meta = ROLE_META[role];
              return (
                <div
                  key={p.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070913]/90 p-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarArt avatarId={p.avatarId} size={38} dead={!p.isAlive} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {p.displayName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.isAlive ? 'Hayatta' : 'Elendi'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <RoleEmblemIcon role={role} size={20} />
                    <span className="text-xs font-semibold text-amber-200">{meta.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Award className="h-4 w-4 text-amber-400" />
            <span>Seviye {user.level} · İstatistiklerin güncellendi</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={leaveRoom}
              className="flex-1 sm:flex-none min-h-[44px] rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Ana Menü
            </button>
            {isHost && (
              <button
                type="button"
                onClick={async () => {
                  const res = await returnToLobby();
                  if (!res.ok && res.error) showToast(res.error, 'error');
                }}
                data-start="true"
                className="flex-1 sm:flex-none min-h-[44px] rounded-xl bg-red-800 hover:bg-red-700 px-5 text-sm font-semibold text-amber-50 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Lobiye Dön</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
