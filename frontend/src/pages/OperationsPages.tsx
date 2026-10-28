import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Play, RefreshCw, Shield, Square, WalletCards } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const panel = 'glass-panel rounded-2xl border border-slate-800 p-5';
const field = 'field';
const money = (value: number | string) =>
  `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const ErrorMessage = ({ children }: { children: string }) =>
  <p role="alert" className="mt-3 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">{children}</p>;

const useRequest = () => {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useCallback(async (operation: () => Promise<unknown>, success?: string) => {
    setError('');
    setNotice('');
    try {
      const result = await operation();
      if (success) setNotice(success);
      return result;
    } catch (error: any) {
      setError(error.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
      return null;
    }
  }, []);
  return { error, notice, request };
};

export const AccountsPage = () => {
  const { user } = useAuth();
  const { error, notice, request } = useRequest();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<Record<string, any[]>>({});
  const [accountType, setAccountType] = useState('CHECKING');
  const [initialDeposit, setInitialDeposit] = useState('0');
  const staff = user?.role !== 'CLIENT';

  const load = useCallback(async () => {
    const result = await request(() => api.get(staff ? '/accounts/all' : '/accounts/my-accounts'));
    if (result) setAccounts((result as any).data);
  }, [request, staff]);

  useEffect(() => { void load(); }, [load]);

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    const result = await request(() => api.post('/accounts', {
      accountType, initialDeposit: Number(initialDeposit),
    }), 'Compte ouvert avec succès.');
    if (result) await load();
  };

  const createCard = async (accountId: string) => {
    const result = await request(() => api.post('/cards', { accountId }), 'Carte virtuelle créée.');
    if (result) await loadCards(accountId);
  };

  const loadCards = async (accountId: string) => {
    const result = await request(() => api.get(`/cards/account/${accountId}`));
    if (result) setCards((current) => ({ ...current, [accountId]: (result as any).data }));
  };

  const toggleCard = async (cardId: string, accountId: string) => {
    const result = await request(() => api.patch(`/cards/${cardId}/toggle-freeze`), 'Statut de la carte mis à jour.');
    if (result) await loadCards(accountId);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Comptes & cartes virtuelles</h1>
        <p className="mt-1 text-sm text-slate-400">Gérez vos comptes et les plafonds de paiement de vos cartes.</p>
      </header>
      {!staff && <form onSubmit={createAccount} className={`${panel} grid gap-3 md:grid-cols-4 md:items-end`}>
        <label className="text-xs text-slate-400">Type de compte
          <select className={field} value={accountType} onChange={(e) => setAccountType(e.target.value)}>
            <option value="CHECKING">Compte courant</option><option value="SAVINGS">Compte épargne</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">Dépôt initial (€)
          <input className={field} type="number" min="0" step="0.01" value={initialDeposit} onChange={(e) => setInitialDeposit(e.target.value)} />
        </label>
        <span className="text-xs text-slate-500">Le dépôt initial est inscrit au grand livre.</span>
        <button className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold">Ouvrir un compte</button>
      </form>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      <section className="space-y-4">
        {accounts.map((account) => (
          <article key={account.id} className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="font-semibold">{account.accountType === 'CHECKING' ? 'Compte courant' : account.accountType === 'SAVINGS' ? 'Compte épargne' : account.accountType}</p>
                <p className="mt-1 font-mono text-sm text-slate-400">{account.accountNumber}</p>
                {staff && <p className="mt-1 text-xs text-slate-500">{account.user?.firstName} {account.user?.lastName} · {account.user?.email}</p>}
                <span className="mt-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{account.status}</span>
              </div>
              <p className="text-xl font-bold">{money(account.balance)}</p>
            </div>
            {!staff && <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void createCard(account.id)} className="button-secondary"><WalletCards size={15} /> Commander une carte</button>
              <button onClick={() => void loadCards(account.id)} className="button-secondary"><RefreshCw size={14} /> Voir les cartes</button>
            </div>}
            {(cards[account.id] || []).map((card) =>
              <div key={card.id} className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 p-3 text-sm">
                <div><p>•••• •••• •••• {card.cardNumber.slice(-4)} · Exp. {card.expiry}</p>
                  <p className="text-xs text-slate-500">Plafonds jour/mois : {money(card.dailyLimit)} / {money(card.monthlyLimit)} · {card.status}</p>
                </div>
                <button onClick={() => void toggleCard(card.id, account.id)} className="button-secondary">
                  {card.status === 'ACTIVE' ? 'Geler' : 'Réactiver'}
                </button>
              </div>,
            )}
          </article>
        ))}
        {!accounts.length && <p className={`${panel} text-center text-sm text-slate-400`}>Aucun compte disponible.</p>}
      </section>
    </div>
  );
};

export const LoansPage = () => {
  const { user } = useAuth();
  const { error, notice, request } = useRequest();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [simulation, setSimulation] = useState<any>(null);
  const [form, setForm] = useState({ principalAmount: '10000', annualInterestRate: '3.8', termMonths: '24', accountId: '' });
  const staff = user?.role !== 'CLIENT';

  const load = useCallback(async () => {
    const result = await request(() => api.get(staff ? '/loans/all' : '/loans/my-loans'));
    if (result) setLoans((result as any).data);
    if (!staff) {
      const accountsResult = await request(() => api.get('/accounts/my-accounts'));
      if (accountsResult) {
        const ownAccounts = (accountsResult as any).data;
        setAccounts(ownAccounts);
        setForm((value) => ({ ...value, accountId: value.accountId || ownAccounts[0]?.id || '' }));
      }
    }
  }, [request, staff]);
  useEffect(() => { void load(); }, [load]);

  const terms = () => ({
    principalAmount: Number(form.principalAmount),
    annualInterestRate: Number(form.annualInterestRate),
    termMonths: Number(form.termMonths),
  });
  const simulate = async () => {
    const result = await request(() => api.post('/loans/simulate', terms()));
    if (result) setSimulation((result as any).data);
  };
  const apply = async () => {
    const result = await request(() => api.post('/loans/apply', { ...terms(), accountId: form.accountId }), 'Demande de prêt envoyée au conseiller.');
    if (result) await load();
  };
  const approve = async (id: string) => {
    const result = await request(() => api.patch(`/loans/${id}/approve`), 'Prêt approuvé et fonds versés.');
    if (result) await load();
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-bold">Prêts & amortissement</h1><p className="mt-1 text-sm text-slate-400">Simulez une mensualité ou suivez vos demandes.</p></header>
    {!staff && <section className={`${panel} space-y-4`}>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-slate-400">Capital (€)<input className={field} type="number" min="1" value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: e.target.value })} /></label>
        <label className="text-xs text-slate-400">Taux annuel (%)<input className={field} type="number" min="0.1" max="30" step="0.1" value={form.annualInterestRate} onChange={(e) => setForm({ ...form, annualInterestRate: e.target.value })} /></label>
        <label className="text-xs text-slate-400">Durée (mois)<input className={field} type="number" min="6" max="360" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} /></label>
        <label className="text-xs text-slate-400">Compte de versement<select className={field} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.accountNumber}</option>)}</select></label>
      </div>
      <div className="flex gap-2"><button className="button-secondary" onClick={() => void simulate()}>Calculer l’échéancier</button><button disabled={!simulation || !form.accountId} className="rounded-xl bg-sky-600 px-4 py-2 text-sm disabled:opacity-40" onClick={() => void apply()}>Demander ce prêt</button></div>
      {simulation && <div className="rounded-xl bg-slate-900 p-4 text-sm">
        <p>Mensualité estimée : <strong>{money(simulation.monthlyPayment)}</strong> · Coût total : {money(simulation.totalCost)} · Intérêts : {money(simulation.totalInterest)}</p>
        <div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Mois</th><th>Mensualité</th><th>Capital</th><th>Intérêts</th><th>Restant</th></tr></thead><tbody>{simulation.schedule.map((item: any) => <tr key={item.month}><td>{item.month}</td><td>{money(item.monthlyPayment)}</td><td>{money(item.principalPayment)}</td><td>{money(item.interestPayment)}</td><td>{money(item.remainingBalance)}</td></tr>)}</tbody></table></div>
      </div>}
    </section>}
    {error && <ErrorMessage>{error}</ErrorMessage>}{notice && <p className="text-sm text-emerald-400">{notice}</p>}
    <section className="space-y-3">{loans.map((loan) => <article key={loan.id} className={`${panel} flex flex-wrap items-center justify-between gap-3`}>
      <div><p className="font-semibold">{money(loan.principalAmount)} · {loan.termMonths} mois · {loan.annualInterestRate}%</p><p className="mt-1 text-xs text-slate-400">{loan.account?.accountNumber} · Mensualité {money(loan.monthlyPayment)} · {loan.status}</p></div>
      {staff && loan.status === 'PENDING' && <button className="button-secondary" onClick={() => void approve(loan.id)}><Check size={15} /> Approuver et verser</button>}
    </article>)}</section>
  </div>;
};

export const LedgerPage = () => {
  const { user } = useAuth();
  const { error, request } = useRequest();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const staff = user?.role !== 'CLIENT';

  const load = useCallback(async () => {
    if (staff) {
      const result = await request(() => api.get('/ledger/entries?limit=100'));
      if (result) setEntries((result as any).data);
    } else {
      const result = await request(() => api.get('/accounts/my-accounts'));
      if (result) {
        const own = (result as any).data;
        setAccounts(own);
        const id = selected || own[0]?.id;
        if (id) {
          setSelected(id);
          const postings = await request(() => api.get(`/ledger/account/${id}/postings?limit=100`));
          if (postings) setEntries((postings as any).data);
        }
      }
    }
  }, [request, selected, staff]);
  useEffect(() => { void load(); }, [load]);

  const reconcile = async () => {
    const result = await request(() => api.get(`/ledger/account/${selected}/reconcile`));
    if (result) window.alert(JSON.stringify((result as any).data, null, 2));
  };
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold">Grand livre</h1><p className="mt-1 text-sm text-slate-400">Historique des écritures comptables et soldes après mouvement.</p></header>
    {!staff && <div className="flex gap-2"><select className={field} value={selected} onChange={(e) => setSelected(e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.accountNumber}</option>)}</select><button className="button-secondary" onClick={() => void reconcile()}>Réconcilier</button></div>}
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <div className={`${panel} overflow-x-auto`}><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Date</th><th>Référence / motif</th><th>Sens</th><th>Compte</th><th className="text-right">Montant</th></tr></thead><tbody className="divide-y divide-slate-800">{entries.map((entry) => {
      const posting = entry.direction ? entry : null;
      const journal = posting?.journalEntry || entry;
      return <tr key={entry.id}><td className="py-3 text-slate-400">{new Date(entry.createdAt).toLocaleString('fr-FR')}</td><td>{journal.description}<span className="block font-mono text-xs text-slate-500">{journal.reference}</span></td><td>{posting?.direction || entry.transactionType}</td><td>{posting?.account?.accountNumber || entry.postings?.map((p: any) => `${p.direction} ${p.account?.accountNumber}`).join(' · ')}</td><td className="text-right">{money(posting?.amount || entry.amount)}</td></tr>;
    })}</tbody></table>{!entries.length && <p className="py-8 text-center text-sm text-slate-500">Aucune écriture.</p>}</div>
  </div>;
};

export const FraudPage = () => {
  const { error, notice, request } = useRequest();
  const [alerts, setAlerts] = useState<any[]>([]);
  const load = useCallback(async () => { const result = await request(() => api.get('/fraud/alerts?limit=100')); if (result) setAlerts((result as any).data); }, [request]);
  useEffect(() => { void load(); }, [load]);
  const resolve = async (id: string) => { const result = await request(() => api.patch(`/fraud/alerts/${id}/resolve`, { notes: 'Examiné depuis le tableau de conformité.' }), 'Alerte clôturée.'); if (result) await load(); };
  return <div className="space-y-5"><header><h1 className="flex items-center gap-2 text-2xl font-bold"><Shield className="text-amber-400" /> Surveillance fraude</h1><p className="mt-1 text-sm text-slate-400">Alertes de montant inhabituel, de vélocité et d’anomalie statistique.</p></header>
    {error && <ErrorMessage>{error}</ErrorMessage>}{notice && <p className="text-sm text-emerald-400">{notice}</p>}
    <section className="space-y-3">{alerts.map((alert) => <article key={alert.id} className={panel}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{alert.ruleName} <span className="ml-2 text-xs text-amber-300">{alert.severity}</span></p><p className="mt-1 text-sm text-slate-300">{alert.description}</p><p className="mt-1 font-mono text-xs text-slate-500">{alert.accountId} · {new Date(alert.createdAt).toLocaleString('fr-FR')}</p></div>
      {!alert.isResolved ? <button className="button-secondary" onClick={() => void resolve(alert.id)}>Marquer comme traitée</button> : <span className="text-xs text-emerald-400">Résolue</span>}</div>
    </article>)}</section>
  </div>;
};

export const SimulatorPage = () => {
  const { error, notice, request } = useRequest();
  const [status, setStatus] = useState<any>(null);
  const [interval, setIntervalValue] = useState(3000);
  const load = useCallback(async () => { const result = await request(() => api.get('/simulator/status')); if (result) setStatus((result as any).data); }, [request]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 3000); return () => window.clearInterval(timer); }, [load]);
  const toggle = async () => { const result = await request(() => api.post(`/simulator/${status?.isRunning ? 'stop' : 'start'}`, { intervalMs: interval }), status?.isRunning ? 'Simulateur arrêté.' : 'Simulateur démarré.'); if (result) await load(); };
  return <div className="mx-auto max-w-3xl space-y-5"><header><h1 className="text-2xl font-bold">Simulateur de trafic</h1><p className="mt-1 text-sm text-slate-400">Générez des opérations de test sur les comptes actifs.</p></header>
    <section className={`${panel} space-y-5`}><div className="flex items-center justify-between"><div><p className="text-lg font-semibold">{status?.isRunning ? 'Simulation active' : 'Simulation arrêtée'}</p><p className="text-xs text-slate-400">Dernier événement : {status?.stats?.lastTickAt ? new Date(status.stats.lastTickAt).toLocaleString('fr-FR') : '—'}</p></div><button onClick={() => void toggle()} className="button-secondary">{status?.isRunning ? <Square size={15} /> : <Play size={15} />}{status?.isRunning ? 'Arrêter' : 'Démarrer'}</button></div>
      {!status?.isRunning && <label className="block text-xs text-slate-400">Intervalle entre opérations (ms)<input className={field} type="number" min="500" max="60000" step="500" value={interval} onChange={(e) => setIntervalValue(Number(e.target.value))} /></label>}
      <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-slate-900 p-4"><p className="text-xs text-slate-500">Opérations</p><strong className="text-xl">{status?.stats?.totalGenerated || 0}</strong></div><div className="rounded-xl bg-slate-900 p-4"><p className="text-xs text-slate-500">Volume simulé</p><strong className="text-xl">{money(status?.stats?.totalVolumeEur)}</strong></div><div className="rounded-xl bg-slate-900 p-4"><p className="text-xs text-slate-500">Erreurs</p><strong className="text-xl">{status?.stats?.errors || 0}</strong></div></div>
    </section>{error && <ErrorMessage>{error}</ErrorMessage>}{notice && <p className="text-sm text-emerald-400">{notice}</p>}</div>;
};

export const AuditPage = () => {
  const { user } = useAuth();
  const { error, request } = useRequest();
  const [logs, setLogs] = useState<any[]>([]);
  const load = useCallback(async () => { const result = await request(() => api.get('/audit/logs?limit=100')); if (result) setLogs((result as any).data); }, [request]);
  useEffect(() => { void load(); }, [load]);
  const verify = async (id: string) => {
    const result = await request(() => api.get(`/audit/logs/${id}/verify`));
    if (result) {
      const verification = (result as any).data;
      window.alert(verification.isAuthentic ? 'Intégrité confirmée : empreinte valide.' : 'ALERTE : l’entrée a été modifiée.');
    }
  };
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Journal d’audit</h1><p className="mt-1 text-sm text-slate-400">Journal chronologique des actions, empreintes SHA-256 vérifiables.</p></header>{error && <ErrorMessage>{error}</ErrorMessage>}
    <section className="space-y-3">{logs.map((log) => <article key={log.id} className={panel}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{log.action} <span className="ml-2 text-xs text-slate-500">{log.userRole}</span></p><p className="mt-1 text-sm text-slate-300">{log.details}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleString('fr-FR')} · {log.resource || '—'}</p></div>
        {user?.role === 'ADMIN' && <button className="button-secondary" onClick={() => void verify(log.id)}>Vérifier</button>}</div>
    </article>)}</section>
  </div>;
};
