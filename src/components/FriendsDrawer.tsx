import React, { useEffect, useState } from 'react';
import { Check, Search, Send, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import type { AvatarId } from '../shared/types.ts';
import { AvatarArt } from './AvatarArt.tsx';

type DrawerTab = 'friends' | 'requests' | 'search';

export function FriendsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    friends,
    activeRoom,
    refreshFriends,
    searchUsers,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    sendInvite,
    showToast,
  } = useGame();

  const [tab, setTab] = useState<DrawerTab>('friends');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      tag: string;
      displayName: string;
      avatarId: AvatarId;
      level: number;
      status: string;
      relationship: string;
    }>
  >([]);
  const [searching, setSearching] = useState(false);

  const acceptedFriends = friends.filter((f) => f.relationship === 'friend');
  const incomingRequests = friends.filter((f) => f.relationship === 'incoming');
  const outgoingRequests = friends.filter((f) => f.relationship === 'outgoing');

  useEffect(() => {
    if (!open) return;
    refreshFriends();
  }, [open, refreshFriends]);

  useEffect(() => {
    if (!open || tab !== 'search') return;
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const res = await searchUsers(query);
      if (!cancelled) {
        setSearchResults(res);
        setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, tab, query, searchUsers]);

  if (!open) return null;

  const statusLabel = (status: string, roomCode?: string) => {
    if (status === 'in_game') return roomCode ? `Oyunda · ${roomCode}` : 'Oyunda';
    if (status === 'online') return 'Çevrimiçi';
    return 'Çevrimdışı';
  };

  const statusTextColor = (status: string) => {
    if (status === 'in_game') return 'text-amber-300';
    if (status === 'online') return 'text-emerald-300';
    return 'text-slate-500';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Arkadaşlar Çekmecesi"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex w-full max-w-md flex-col bg-[#0b0f1d] border-l border-slate-800 shadow-2xl h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-slate-100">Arkadaşlar</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Arkadaş çekmecesini kapat"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#070913] p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setTab('friends')}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'friends'
                  ? 'bg-slate-800 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Liste ({acceptedFriends.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('requests')}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'requests'
                  ? 'bg-slate-800 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              İstekler ({incomingRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'search'
                  ? 'bg-slate-800 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kişi Ekle
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'friends' && (
            <>
              {acceptedFriends.length === 0 ? (
                <div className="rounded-xl border border-slate-800/80 bg-[#070913]/70 p-6 text-center space-y-3">
                  <p className="text-sm text-slate-300">Henüz arkadaş listen boş.</p>
                  <button
                    type="button"
                    onClick={() => setTab('search')}
                    className="min-h-[44px] rounded-xl bg-red-800/80 hover:bg-red-700 px-4 py-2 text-xs font-semibold text-amber-50"
                  >
                    Oyuncu Ara ve Ekle
                  </button>
                </div>
              ) : (
                acceptedFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#101628] p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarArt avatarId={friend.avatarId} size={42} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">
                          {friend.displayName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          <span>{friend.tag}</span>
                          <span aria-hidden="true"> · </span>
                          <span className={statusTextColor(friend.status)}>
                            {statusLabel(friend.status, friend.roomCode)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeRoom && friend.status !== 'offline' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await sendInvite(friend.id);
                            if (res.ok) {
                              showToast(`${friend.displayName} lobiye davet edildi.`, 'success');
                            } else if (res.error) {
                              showToast(res.error, 'error');
                            }
                          }}
                          aria-label={`${friend.displayName} adlı arkadaşı lobiye davet et`}
                          className="min-h-[40px] rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 px-2.5 text-xs font-semibold text-amber-200 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Davet Et</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFriend(friend.id)}
                        aria-label={`${friend.displayName} adlı arkadaşı çıkar`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-950/50 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'requests' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 mb-2">
                  Gelen İstekler ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">Bekleyen gelen istek yok.</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#101628] p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarArt avatarId={req.avatarId} size={38} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-100 truncate">
                              {req.displayName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{req.tag}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => respondFriendRequest(req.id, 'accept')}
                            aria-label={`${req.displayName} isteğini kabul et`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 hover:bg-emerald-800"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => respondFriendRequest(req.id, 'decline')}
                            aria-label={`${req.displayName} isteğini reddet`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/60 text-red-200 hover:bg-red-900"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {outgoingRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">
                    Gönderilen İstekler ({outgoingRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/70 bg-[#0d1222] p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarArt avatarId={req.avatarId} size={36} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {req.displayName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{req.tag} · Bekleniyor</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Kullanıcı adı veya etiket ile ara"
                  placeholder="Örn. @geceavcisi#1042 veya isim..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#070913] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none"
                />
              </div>

              {searching ? (
                <p className="text-xs text-slate-400 py-4 text-center">Oyuncular aranıyor...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Aramayla eşleşen oyuncu bulunamadı.
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#101628] p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarArt avatarId={u.avatarId} size={38} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {u.displayName}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {u.tag} · Seviye {u.level}
                          </p>
                        </div>
                      </div>

                      {u.relationship === 'friend' ? (
                        <span className="text-xs font-medium text-emerald-300 shrink-0">
                          Arkadaş
                        </span>
                      ) : u.relationship === 'outgoing' ? (
                        <span className="text-xs font-medium text-amber-300 shrink-0">
                          İstek Gönderildi
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await sendFriendRequest(u.id);
                            if (ok) {
                              const refreshed = await searchUsers(query);
                              setSearchResults(refreshed);
                            }
                          }}
                          aria-label={`${u.displayName} adlı kişiye arkadaşlık isteği gönder`}
                          className="min-h-[40px] rounded-lg bg-red-800/80 hover:bg-red-700 px-3 text-xs font-semibold text-amber-50 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Ekle</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
