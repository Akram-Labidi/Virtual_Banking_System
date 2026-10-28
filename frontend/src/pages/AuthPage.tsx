import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Building2, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage = ({ register = false }: { register?: boolean }) => {
  const { user, login, register: signUp } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (register) {
        await signUp(values);
      } else {
        await login(values.email, values.password);
      }
      navigate('/', { replace: true });
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          'Impossible de vous connecter. Vérifiez vos informations et réessayez.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <section className="glass-panel w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-sky-600 p-3"><Building2 /></div>
          <div>
            <p className="text-xl font-bold">AuraBank</p>
            <p className="text-xs text-slate-400">Banque virtuelle sécurisée</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold">{register ? 'Créer un compte' : 'Connexion'}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-400">
          {register ? 'Ouvrez votre espace client en quelques instants.' : 'Accédez à votre espace bancaire.'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {register && (
            <div className="grid grid-cols-2 gap-3">
              <input required autoComplete="given-name" placeholder="Prénom" value={values.firstName}
                onChange={(e) => setValues({ ...values, firstName: e.target.value })}
                className="field" />
              <input required autoComplete="family-name" placeholder="Nom" value={values.lastName}
                onChange={(e) => setValues({ ...values, lastName: e.target.value })}
                className="field" />
            </div>
          )}
          <input required type="email" autoComplete="email" placeholder="Adresse e-mail" value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            className="field" />
          <input required type="password" minLength={6}
            autoComplete={register ? 'new-password' : 'current-password'}
            placeholder="Mot de passe" value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            className="field" />
          {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-sky-600 py-3 font-semibold hover:bg-sky-500 disabled:opacity-50">
            <span className="inline-flex items-center gap-2"><LockKeyhole size={16} />{loading ? 'Veuillez patienter…' : register ? 'Créer mon espace client' : 'Se connecter'}</span>
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          {register ? 'Déjà inscrit ? ' : 'Nouveau chez AuraBank ? '}
          <Link className="text-sky-400 hover:text-sky-300" to={register ? '/login' : '/register'}>
            {register ? 'Se connecter' : 'Créer un compte'}
          </Link>
        </p>
        {import.meta.env.DEV && !register && (
          <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
            Démo locale : alice@aurabank.fr / BankSecret2026!
          </p>
        )}
      </section>
    </main>
  );
};
