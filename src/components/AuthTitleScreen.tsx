import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Shield, UserPlus, Users } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { AVATAR_LIST, type AvatarId } from '../shared/types.ts';
import { AvatarArt, GENERATED_ASSETS } from './AvatarArt.tsx';

type AuthMode = 'guest' | 'login' | 'register';

export function AuthTitleScreen() {
  const { loginAsGuest, loginWithEmail, registerWithEmail } = useGame();
  const [mode, setMode] = useState<AuthMode>('guest');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarId, setAvatarId] = useState<AvatarId>('count');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (mode === 'guest') {
      const cleanName = displayName.trim() || 'Gece Gezgini';
      if (cleanName.length < 2) {
        setLocalError('Takma ad en az 2 karakter olmalıdır.');
        return;
      }
      setSubmitting(true);
      await loginAsGuest(cleanName, avatarId);
      setSubmitting(false);
      return;
    }

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setLocalError('E-posta ve şifre alanlarını doldurun.');
        return;
      }
      setSubmitting(true);
      await loginWithEmail(email, password);
      setSubmitting(false);
      return;
    }

    if (!displayName.trim() || displayName.trim().length < 2) {
      setLocalError('Kullanıcı adı en az 2 karakter olmalıdır.');
      return;
    }
    if (!email.trim() || password.length < 6) {
      setLocalError('Geçerli e-posta ve en az 6 karakterli şifre giriniz.');
      return;
    }
    setSubmitting(true);
    await registerWithEmail(email, password, displayName.trim(), avatarId);
    setSubmitting(false);
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#070913] text-slate-100 flex items-center">
      {/* Full-bleed Gothic Key-Art Backdrop with fallback */}
      <div className="absolute inset-0 z-0">
        {!imgFailed ? (
          <img
            src={GENERATED_ASSETS.heroBackdrop}
            alt="Ay ışığı altında gotik köy meydanı"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover object-center opacity-45"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_25%,rgba(127,29,29,0.28),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(30,41,59,0.45),#070913)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070913]/95 via-[#070913]/75 to-[#070913]/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070913] via-transparent to-[#070913]/60" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Negative-Space Hero Title Lockup */}
          <section className="lg:col-span-6 space-y-6">
            {/* Bespoke inline SVG crest lockup */}
            <div className="inline-flex items-center gap-4">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle cx="32" cy="32" r="30" fill="#100914" stroke="#991b1b" strokeWidth="2" />
                <circle cx="32" cy="32" r="25" stroke="#d97706" strokeOpacity="0.45" strokeWidth="1" />
                <path
                  d="M32 13L42 22V35C42 42 37 47.5 32 50C27 47.5 22 42 22 35V22L32 13Z"
                  fill="#1f0d16"
                  stroke="#f59e0b"
                  strokeWidth="1.6"
                />
                <path
                  d="M27 28L29.5 34L32 29L34.5 34L37 28"
                  stroke="#fca5a5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <h1 className="font-display text-4xl font-bold tracking-wide text-slate-50 sm:text-5xl text-balance">
                  KANLI KÖY
                </h1>
                <p className="mt-1 text-sm font-medium tracking-wider text-amber-400/90 uppercase">
                  Vampir Köylü · Sosyal Çıkarım
                </p>
              </div>
            </div>

            <p className="max-w-lg text-base leading-relaxed text-slate-300">
              Gündüzleri köy meydanında müttefiklerini seç ve yalanları yakala; geceleri ise
              gölgelerin arasında hayatta kalmaya çalış. 6 ila 16 kişilik gerçek zamanlı masalarda
              vampirler, doktorlar, dedektifler ve avcılar karşı karşıya.
            </p>

            {/* Flat borderless key-feature strip */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400 shrink-0" />
                <span>6–16 Oyuncu</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-400 shrink-0" />
                <span>6 Benzersiz Rol</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Gerçek Zamanlı Gizli Gece Sohbeti</span>
            </div>
          </section>

          {/* Right Auth / Guest Entry Card */}
          <section className="lg:col-span-6">
            <div className="rounded-2xl border border-slate-800/90 bg-[#0d1222]/92 p-5 sm:p-7 shadow-2xl shadow-black/60">
              {/* Segmented Tabs */}
              <div
                role="tablist"
                aria-label="Giriş seçenekleri"
                className="grid grid-cols-3 gap-1 rounded-xl bg-[#070913] p-1 border border-slate-800/80"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'guest'}
                  onClick={() => {
                    setMode('guest');
                    setLocalError(null);
                  }}
                  className={`min-h-[44px] rounded-lg px-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    mode === 'guest'
                      ? 'bg-red-900/80 text-amber-100 border border-red-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Misafir Oyna
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => {
                    setMode('login');
                    setLocalError(null);
                  }}
                  className={`min-h-[44px] rounded-lg px-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-red-900/80 text-amber-100 border border-red-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => {
                    setMode('register');
                    setLocalError(null);
                  }}
                  className={`min-h-[44px] rounded-lg px-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-red-900/80 text-amber-100 border border-red-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Kayıt Ol
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode !== 'login' && (
                  <div>
                    <label
                      htmlFor="auth-displayname"
                      className="block text-sm font-medium text-slate-200 mb-1.5"
                    >
                      {mode === 'guest' ? 'Takma Adın' : 'Kullanıcı Adı'}
                    </label>
                    <input
                      id="auth-displayname"
                      type="text"
                      maxLength={24}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={mode === 'guest' ? 'Örn. Gece Avcısı' : 'Örn. Kont Drakul'}
                      className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#070913] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                )}

                {mode !== 'guest' && (
                  <>
                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-sm font-medium text-slate-200 mb-1.5"
                      >
                        E-posta Adresi
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ornek@eposta.com"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#070913] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-sm font-medium text-slate-200 mb-1.5"
                      >
                        Şifre
                      </label>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="En az 6 karakter"
                          className="w-full min-h-[44px] rounded-xl border border-slate-700/80 bg-[#070913] pl-3.5 pr-11 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {mode !== 'login' && (
                  <div>
                    <span className="block text-sm font-medium text-slate-200 mb-2">
                      Avatarını Seç
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_LIST.map((av) => {
                        const selected = avatarId === av.id;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => setAvatarId(av.id)}
                            aria-label={`Avatar seç: ${av.label}`}
                            aria-pressed={selected}
                            className={`flex flex-col items-center gap-1 rounded-xl p-2 min-h-[68px] border transition-colors ${
                              selected
                                ? 'border-amber-500/80 bg-amber-950/25 text-amber-200'
                                : 'border-slate-800 bg-[#070913]/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <AvatarArt avatarId={av.id} size={36} />
                            <span className="text-[11px] font-medium truncate max-w-full">
                              {av.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {localError && (
                  <p role="alert" className="rounded-lg bg-red-950/60 border border-red-800/70 px-3 py-2 text-xs text-red-200">
                    {localError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  data-start="true"
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 px-5 py-3 text-sm font-semibold text-amber-50 shadow-lg shadow-red-950/50 transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {mode === 'guest' && <LogIn className="h-4 w-4 shrink-0" />}
                  {mode === 'login' && <LogIn className="h-4 w-4 shrink-0" />}
                  {mode === 'register' && <UserPlus className="h-4 w-4 shrink-0" />}
                  <span>
                    {submitting
                      ? 'Bağlanılıyor...'
                      : mode === 'guest'
                      ? 'Misafir Olarak Oyna'
                      : mode === 'login'
                      ? 'Giriş Yap'
                      : 'Hesap Oluştur ve Başla'}
                  </span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
