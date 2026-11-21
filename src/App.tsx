import React, { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { AuthTitleScreen } from './components/AuthTitleScreen.tsx';
import { FriendsDrawer } from './components/FriendsDrawer.tsx';
import { GameTableView } from './components/GameTableView.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { MainHub } from './components/MainHub.tsx';
import { GameProvider, useGame } from './context/GameContext.tsx';

function AppShell() {
  const { user, activeRoom, invites, acceptInvite, dismissInvite, toast, clearToast } = useGame();
  const [friendsOpen, setFriendsOpen] = useState(false);

  return (
    <>
      {!user ? (
        <AuthTitleScreen />
      ) : !activeRoom ? (
        <MainHub onOpenFriends={() => setFriendsOpen(true)} />
      ) : activeRoom.phase === 'LOBBY' ? (
        <LobbyView onOpenFriends={() => setFriendsOpen(true)} />
      ) : (
        <GameTableView />
      )}

      <FriendsDrawer open={friendsOpen} onClose={() => setFriendsOpen(false)} />

      {/* Live Lobby Invites */}
      {invites.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
        >
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl border border-amber-500/50 bg-[#0d1222] p-4 shadow-2xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="h-5 w-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-200">Oda Daveti</p>
                  <p className="text-xs text-slate-200 truncate">
                    <strong>{inv.fromDisplayName}</strong> seni{' '}
                    <strong>{inv.roomName}</strong> ({inv.roomCode}) odasına davet etti.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => acceptInvite(inv)}
                  aria-label="Daveti kabul et"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => dismissInvite(inv.id)}
                  aria-label="Daveti reddet"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] ${
            toast.type === 'error'
              ? 'border-red-700/80 bg-red-950/95 text-red-100'
              : toast.type === 'success'
              ? 'border-emerald-700/80 bg-emerald-950/95 text-emerald-100'
              : 'border-slate-700 bg-[#0d1222]/95 text-slate-100'
          }`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={clearToast}
            aria-label="Bildirimi kapat"
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}
