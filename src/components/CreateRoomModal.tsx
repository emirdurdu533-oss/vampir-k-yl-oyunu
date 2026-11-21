import React, { useMemo, useState } from 'react';
import { Lock, Unlock, X } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { validateRoomSettings } from '../game/engine.ts';
import type { RoomSettings } from '../shared/types.ts';

export function CreateRoomModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { createRoom, showToast } = useGame();

  const [name, setName] = useState('Kuzgun Meydanı');
  const [capacity, setCapacity] = useState(8);
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [nightDuration, setNightDuration] = useState(30);
  const [dayDuration, setDayDuration] = useState(60);
  const [voteDuration, setVoteDuration] = useState(30);
  const [vampires, setVampires] = useState(2);
  const [doctors, setDoctors] = useState(1);
  const [detectives, setDetectives] = useState(1);
  const [hunters, setHunters] = useState(1);
  const [jesters, setJesters] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const settings: RoomSettings = useMemo(
    () => ({
      name,
      capacity,
      isPublic,
      hasPassword: password.trim().length > 0,
      nightDuration,
      dayDuration,
      voteDuration,
      roles: {
        VAMPIRE: vampires,
        DOCTOR: doctors,
        DETECTIVE: detectives,
        HUNTER: hunters,
        JESTER: jesters,
      },
    }),
    [
      name,
      capacity,
      isPublic,
      password,
      nightDuration,
      dayDuration,
      voteDuration,
      vampires,
      doctors,
      detectives,
      hunters,
      jesters,
    ]
  );

  const validation = useMemo(() => validateRoomSettings(settings), [settings]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      showToast(validation.error || 'Ayarları kontrol edin.', 'error');
      return;
    }
    setSubmitting(true);
    const res = await createRoom(settings, password.trim() || undefined);
    setSubmitting(false);
    if (res.ok) {
      onClose();
    } else {
      showToast(res.error || 'Oda kurulamadı.', 'error');
    }
  };

  const RoleStepper = ({
    label,
    value,
    min,
    max,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (n: number) => void;
  }) => (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070913] px-3 py-2">
      <span className="text-xs font-medium text-slate-200">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${label} azalt`}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-slate-200 hover:bg-slate-700"
        >
          -
        </button>
        <span className="w-5 text-center font-mono-tabular text-sm font-semibold text-amber-200">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${label} artır`}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-slate-200 hover:bg-slate-700"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-room-title"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d1222] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 id="create-room-title" className="font-display text-xl font-bold text-slate-100">
            Yeni Oyun Odası Kur
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="room-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Oda Adı
              </label>
              <input
                id="room-name"
                type="text"
                maxLength={36}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-3.5 text-sm text-slate-100 focus:border-amber-500/70 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">Görünürlük</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#070913] p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`min-h-[36px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    isPublic ? 'bg-slate-800 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Açık</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`min-h-[36px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    !isPublic ? 'bg-slate-800 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Özel</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="room-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Oda Şifresi (İsteğe Bağlı)
              </label>
              <input
                id="room-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifresiz bırakmak için boş geç"
                className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-[#070913] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="room-capacity" className="text-xs font-medium text-slate-300">
                  Oyuncu Kapasitesi
                </label>
                <span className="font-mono-tabular text-xs font-bold text-amber-300">
                  {capacity} Kişi
                </span>
              </div>
              <input
                id="room-capacity"
                type="range"
                min={6}
                max={16}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full accent-red-600 h-10 cursor-pointer"
              />
            </div>
          </div>

          {/* Role Distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-300">Rol Dağılımı</h3>
              <span className="font-mono-tabular text-xs text-slate-400">
                Köylü: {validation.valid ? validation.villagerCount : 0}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RoleStepper label="Vampir" value={vampires} min={1} max={5} onChange={setVampires} />
              <RoleStepper label="Doktor" value={doctors} min={0} max={2} onChange={setDoctors} />
              <RoleStepper label="Dedektif" value={detectives} min={0} max={2} onChange={setDetectives} />
              <RoleStepper label="Avcı (İsteğe Bağlı)" value={hunters} min={0} max={2} onChange={setHunters} />
              <RoleStepper label="Soytarı (İsteğe Bağlı)" value={jesters} min={0} max={2} onChange={setJesters} />
            </div>
          </div>

          {/* Phase Timers */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="dur-night" className="block text-xs text-slate-400 mb-1">
                Gece (sn)
              </label>
              <input
                id="dur-night"
                type="number"
                min={15}
                max={90}
                value={nightDuration}
                onChange={(e) => setNightDuration(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-[#070913] px-3 font-mono-tabular text-sm text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="dur-day" className="block text-xs text-slate-400 mb-1">
                Gündüz (sn)
              </label>
              <input
                id="dur-day"
                type="number"
                min={30}
                max={180}
                value={dayDuration}
                onChange={(e) => setDayDuration(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-[#070913] px-3 font-mono-tabular text-sm text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="dur-vote" className="block text-xs text-slate-400 mb-1">
                Oylama (sn)
              </label>
              <input
                id="dur-vote"
                type="number"
                min={15}
                max={60}
                value={voteDuration}
                onChange={(e) => setVoteDuration(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-[#070913] px-3 font-mono-tabular text-sm text-slate-100"
              />
            </div>
          </div>

          {!validation.valid && (
            <p role="alert" className="rounded-xl border border-red-800/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              {validation.error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!validation.valid || submitting}
              className="min-h-[44px] rounded-xl bg-red-800 hover:bg-red-700 px-5 text-sm font-semibold text-amber-50 disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? 'Kuruluyor...' : 'Odayı Kur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
