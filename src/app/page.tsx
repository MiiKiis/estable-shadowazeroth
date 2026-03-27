'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, Shield, Radio } from 'lucide-react';
import StatCards from '@/components/StatCards';

// reCAPTCHA v3 site key (set in .env.local)
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';


  export default function Home() {
      // Username validation utility
      function isValidForumUsername(username: string) {
        return /^[a-zA-Z0-9]{3,16}$/.test(username);
      }

      // Username validation state for UI feedback
      const [usernameForValidation, setUsernameForValidation] = useState('');
      const usernameIsValid = isValidForumUsername(usernameForValidation);

    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [isLogin, setIsLogin] = useState(true);

    // Handle input changes for form fields
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'username') setUsernameForValidation(value);
    };
    const [faction, setFaction] = useState<'horde' | 'alliance' | null>(null);
    const [formData, setFormData] = useState({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      pin: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recaptchaReady, setRecaptchaReady] = useState(false);

    // ── Load reCAPTCHA v3 script ──────────────────────────────
    useEffect(() => {
      if (!RECAPTCHA_SITE_KEY) return;
      // Don't load twice
      if (document.getElementById('recaptcha-v3-script')) {
        setRecaptchaReady(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'recaptcha-v3-script';
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.onload = () => setRecaptchaReady(true);
      document.head.appendChild(script);
    }, []);

    // ── Get reCAPTCHA token ──────────────────────────────────
    const getRecaptchaToken = useCallback(async (): Promise<string> => {
      if (!RECAPTCHA_SITE_KEY) return '';
      try {
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha) {
          console.error('reCAPTCHA: grecaptcha not loaded');
          return '';
        }
        // Wait for grecaptcha to be ready
        return new Promise<string>((resolve) => {
          grecaptcha.ready(async () => {
            try {
              const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' });
              console.log('reCAPTCHA token obtained:', token ? 'yes' : 'no');
              resolve(token || '');
            } catch (err) {
              console.error('reCAPTCHA execute error:', err);
              resolve('');
            }
          });
        });
      } catch (err) {
        console.error('reCAPTCHA error:', err);
        return '';
      }
    }, [recaptchaReady]);

    // Validación y submit de login/registro
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!isLogin && !formData.email.trim()) {
        setError('El correo electronico es requerido');
        setLoading(false);
        return;
      }

      if (!isLogin && !isValidForumUsername(formData.username)) {
        setError('El usuario debe tener 3-16 caracteres y solo letras o numeros (sin espacios ni simbolos).');
        setLoading(false);
        return;
      }

      if (!isLogin && formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }

      if (!isLogin && !/^[0-9]{4}$/.test(formData.pin.trim())) {
        setError('Debes ingresar un PIN de 4 digitos');
        setLoading(false);
        return;
      }

      if (!isLogin && !faction) {
        setError('Debes seleccionar una facción');
        setLoading(false);
        return;
      }

      try {
        const endpoint = isLogin ? '/api/login' : '/api/register';

        // Get reCAPTCHA token for registration
        let recaptchaToken = '';
        if (!isLogin && RECAPTCHA_SITE_KEY) {
          recaptchaToken = await getRecaptchaToken();
          if (!recaptchaToken) {
            setError('Error al verificar reCAPTCHA. Recarga la página.');
            setLoading(false);
            return;
          }
        }

        const body = isLogin
          ? { username: formData.username, password: formData.password }
          : {
              email: formData.email,
              username: formData.username,
              password: formData.password,
              pin: formData.pin,
              recaptchaToken,
              faction: faction || 'horde',
            };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.message || 'Error en la autenticación');
        }

        if (!isLogin) {
          // Guardar facción elegida para la nueva cuenta
          localStorage.setItem('pending_faction', faction || 'horde');
          setError('');
          setFormData({ email: '', username: '', password: '', confirmPassword: '', pin: '' });
          setIsLogin(true);
          setError('Cuenta creada! Ahora inicia sesión');
        } else {
          // Al iniciar sesión, intentar recuperar la facción guardada
          const savedFaction = localStorage.getItem(`faction_${data.user?.username?.toLowerCase()}`) ||
                               localStorage.getItem('pending_faction') ||
                               'horde';
          localStorage.removeItem('pending_faction');
          localStorage.setItem(
            `faction_${data.user?.username?.toLowerCase()}`,
            savedFaction
          );
          localStorage.setItem('user', JSON.stringify({
            id: data.user?.id,
            username: data.user?.username,
            faction: savedFaction,
          }));
          setTimeout(() => {
            router.push('/dashboard');
          }, 500);
        }
      } catch (err: any) {
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

  return (
    <main className="relative min-h-screen overflow-x-hidden pt-28 sm:pt-32 pb-14 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_85%_8%,rgba(168,85,247,0.26),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,0.78),rgba(2,6,23,0.92))]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black/40" />
      <div className="pointer-events-none absolute -z-10 top-20 left-[58%] -translate-x-1/2 h-72 w-[60vw] rounded-full bg-purple-500/20 blur-3xl" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12 items-start">
          <div className="pt-4 sm:pt-8 lg:pt-14">
            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-black text-white leading-[0.95] tracking-tight drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
              ÚNETE A LA LUCHA
              <span className="block">POR AZEROTH</span>
            </h1>
            <p className="mt-5 max-w-xl text-xl text-slate-200/95 leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              Forja tu destino en IronBlood
            </p>
            <div className="mt-6 max-w-xl space-y-2 text-lg text-slate-200/95 leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
             <p className="flex items-center gap-2">
             <span className="text-amber-400 font-bold">⚡ Rates Leveo:</span> <span>x8</span>
             </p>
             <p className="flex items-center gap-2">
             <span className="text-emerald-400 font-bold">🛠️ Profesiones:</span> <span>x2 <small className="text-xs italic opacity-80">(Temporal)</small></span>
             </p>
            <p className="flex items-center gap-2">
    <span className="text-purple-400 font-bold">💎 Drop:</span> <span>Mítico x1 / grises y verde x 3</span>
  </p>
  <p className="mt-4 font-semibold text-white pt-2 border-t border-white/10 italic">
    ¡Regístrate ahora y reclama tu legado!
  </p>
</div>
            <div className="mt-10 rounded-2xl border border-cyan-200/35 bg-gradient-to-r from-cyan-950/80 via-slate-900/85 to-indigo-950/80 backdrop-blur-sm p-4 sm:p-5 max-w-2xl shadow-[0_14px_35px_rgba(0,0,0,0.45)]">
              <h3 className="text-xl font-black uppercase tracking-wide text-white mb-4">Estadísticas del Realm</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-300" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Realm</p>
                    <p className="text-white font-black">wow.shadowazeroth.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-12">
                  <Radio className="w-5 h-5 text-emerald-300" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Estado</p>
                    <p className="text-emerald-300 font-black">Online</p>
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <StatCards />
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-3xl border border-red-300/50 bg-[#120208] p-6 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.5)] overflow-hidden`}>
            <div className="mb-6 rounded-full border border-red-200/40 bg-[#6e1a2b] p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`h-10 flex-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wide transition-all ${
                  isLogin ? 'bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-[0_8px_18px_rgba(190,24,93,0.45)]' : 'bg-[#7b2738] text-slate-200 hover:text-white'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`h-10 flex-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wide transition-all ${
                  !isLogin ? 'bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-[0_8px_18px_rgba(190,24,93,0.45)]' : 'bg-[#7b2738] text-slate-200 hover:text-white'
                }`}
              >
                Crear cuenta
              </button>
            </div>

            <h2 className="text-center text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] mb-6">
              {isLogin ? 'Iniciar sesión ahora' : 'Crear cuenta ahora'}
            </h2>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {!isLogin && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full h-12 rounded-xl px-4 bg-[#741f31] border border-red-100/35 text-white placeholder:text-red-100/70 focus:outline-none focus:border-red-200/70 focus:ring-2 focus:ring-red-300/30"
                    placeholder="tu-correo@ejemplo.com"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full h-12 rounded-xl px-4 bg-[#741f31] border border-red-100/35 text-white placeholder:text-red-100/70 caret-red-100 focus:outline-none focus:border-red-200/70 focus:ring-2 focus:ring-red-300/30"
                  placeholder="Nombre para el foro (ej: Miikiis123)"
                />
                {!isLogin && (
                  <p className={`mt-2 text-xs font-semibold ${
                    usernameForValidation.length === 0
                      ? 'text-slate-400'
                      : usernameIsValid
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                  }`}>
                    {usernameForValidation.length === 0
                      ? 'Usa 3-16 caracteres: solo letras y números.'
                      : usernameIsValid
                        ? 'Nombre válido para crear cuenta.'
                        : 'Formato inválido: no se permiten espacios, guiones, tildes ni símbolos.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full h-12 rounded-xl px-4 bg-[#741f31] border border-red-100/35 text-white placeholder:text-red-100/70 focus:outline-none focus:border-red-200/70 focus:ring-2 focus:ring-red-300/30"
                  placeholder="Tu contraseña"
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full h-12 rounded-xl px-4 bg-[#741f31] border border-red-100/35 text-white placeholder:text-red-100/70 focus:outline-none focus:border-red-200/70 focus:ring-2 focus:ring-red-300/30"
                    placeholder="Repite tu contraseña"
                  />
                </div>
              )}

              {!isLogin && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-2 uppercase tracking-wide">
                    PIN de seguridad (4 digitos)
                  </label>
                  <input
                    type="password"
                    name="pin"
                    value={formData.pin}
                    onChange={handleChange}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    className="w-full h-12 rounded-xl px-4 bg-[#741f31] border border-red-100/35 text-white placeholder:text-red-100/70 focus:outline-none focus:border-red-200/70 focus:ring-2 focus:ring-red-300/30"
                    placeholder="Ej: 1234"
                  />
                  <p className="mt-2 text-xs text-slate-400">Este PIN se usara como capa extra de seguridad de tu cuenta.</p>
                </div>
              )}

              <p className="text-center text-xs text-slate-400 pt-4 border-t border-white/10">
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-cyan-300 hover:text-cyan-200 font-bold underline decoration-cyan-300/40 underline-offset-2"
                >
                  {isLogin ? 'Crea una aquí' : 'Inicia sesión aquí'}
                </button>
              </p>

              {isLogin && (
                <p className="text-center text-xs text-slate-400">
                  ¿Olvidaste tu contraseña?
                </p>
              )}
            </form>

            <div className="mt-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-center">
              {isLogin ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => formRef.current?.requestSubmit()}
                  className={`h-12 min-w-[220px] w-full px-6 rounded-xl inline-flex items-center justify-center gap-2 text-base font-black uppercase tracking-wide transition-all border border-red-200/40 bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-[0_10px_26px_rgba(190,24,93,0.45)] hover:from-red-600 hover:to-rose-600 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? 'CARGANDO...' : 'INICIAR SESIÓN AHORA'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setFaction('horde');
                      setTimeout(() => formRef.current?.requestSubmit(), 0);
                    }}
                    className={`h-12 min-w-[220px] px-6 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wide transition-all bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white border border-red-400/60 shadow-[0_8px_22px_rgba(220,38,38,0.55)] ${
                      faction === 'horde' ? 'ring-2 ring-red-300/70' : ''
                    } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading && faction === 'horde' ? 'CARGANDO...' : 'ÚNETE A LA HORDA'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setFaction('alliance');
                      setTimeout(() => formRef.current?.requestSubmit(), 0);
                    }}
                    className={`h-12 min-w-[220px] px-6 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wide transition-all bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white border border-blue-400/60 shadow-[0_8px_22px_rgba(59,130,246,0.55)] ${
                      faction === 'alliance' ? 'ring-2 ring-blue-300/70' : ''
                    } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading && faction === 'alliance' ? 'CARGANDO...' : 'ÚNETE A LA ALIANZA'}
                  </button>
                </>
              )}
            </div>

            <div className="mt-7 pt-6 border-t border-white/10 space-y-3 text-sm">
              <div className="flex items-start gap-3 text-slate-300">
                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-cyan-300 shrink-0" />
                <p>Acceso a tu personaje y estadísticas.</p>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-purple-300 shrink-0" />
                <p>Participa en el foro de la comunidad.</p>
              </div>
              <div className="flex items-start gap-3 text-slate-300">
                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-cyan-300 shrink-0" />
                <p>Apoya el servidor con donaciones.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
