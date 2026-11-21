import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { ROLE_META, type Role } from '../shared/types.ts';
import { GENERATED_ASSETS, RoleEmblemIcon } from './AvatarArt.tsx';

function getRoleArtwork(role: Role): string | null {
  if (role === 'VAMPIRE') return GENERATED_ASSETS.roleVampire;
  if (role === 'DETECTIVE') return GENERATED_ASSETS.roleDetective;
  if (role === 'VILLAGER') return GENERATED_ASSETS.roleVillager;
  return null;
}

export function RoleCardModal({
  open,
  role,
  onClose,
}: {
  open: boolean;
  role: Role | null;
  onClose: () => void;
}) {
  const [hiddenVeil, setHiddenVeil] = useState(false);

  if (!open || !role) return null;
  const meta = ROLE_META[role];
  const artwork = getRoleArtwork(role);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Gizli Rol Kartın"
    >
      <div className="relative w-full max-w-sm perspective-1000">
        <div
          className={`relative transition-transform duration-500 preserve-3d ${
            hiddenVeil ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front: Revealed Role Tarot Card */}
          <div className="backface-hidden rounded-3xl border border-amber-500/40 bg-[#0d1222] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Gizli Rol Kartın
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHiddenVeil(true)}
                  aria-label="Kartı gizle"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Kapat"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Card Artwork Frame */}
            <div className="relative mx-auto aspect-[3/4] w-52 overflow-hidden rounded-2xl border border-amber-500/30 bg-[#070913] flex items-center justify-center">
              {artwork ? (
                <img
                  src={artwork}
                  alt={meta.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.16),#070913)] h-full w-full">
                  <RoleEmblemIcon role={role} size={72} />
                  <span className="font-display text-lg font-bold text-amber-200">
                    {meta.name}
                  </span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 text-center">
                <h2 className="font-display text-2xl font-bold text-slate-50">{meta.name}</h2>
                <p className="text-xs text-amber-300">
                  {meta.team === 'VAMPIRES'
                    ? 'Vampir Tarafı'
                    : meta.team === 'SOLO'
                    ? 'Tek Başına'
                    : 'Köy Tarafı'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-slate-200">{meta.shortDesc}</p>
              <p className="text-xs text-amber-300/90">{meta.objective}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-100"
            >
              Masaya Dön
            </button>
          </div>

          {/* Back: Privacy Veil */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 rounded-3xl border border-slate-700 bg-[#070913] p-6 flex flex-col items-center justify-center gap-4 text-center shadow-2xl">
            <RoleEmblemIcon role={role} size={48} />
            <h3 className="font-display text-xl font-bold text-slate-100">Kart Gizlendi</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              Etrafındakilerin ekranına bakmasını önlemek için rolün gizli tutuluyor.
            </p>
            <button
              type="button"
              onClick={() => setHiddenVeil(false)}
              className="min-h-[44px] rounded-xl bg-red-800 hover:bg-red-700 px-5 text-sm font-semibold text-amber-50 flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              <span>Rolü Göster</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
