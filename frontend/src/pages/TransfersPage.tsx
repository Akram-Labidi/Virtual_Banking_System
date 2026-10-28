import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Key,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import api from '../api/client';

export const TransfersPage: React.FC = () => {
  const [tab, setTab] = useState<'transfer' | 'deposit' | 'withdraw'>('transfer');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationIdentifier, setDestinationIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(`key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get('/accounts/my-accounts');
        setAccounts(res.data);
        if (res.data.length > 0) {
          setSourceAccountId(res.data[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAccounts();
  }, []);

  const refreshIdempotencyKey = () => {
    setIdempotencyKey(`key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headers = { 'Idempotency-Key': idempotencyKey };

      if (tab === 'transfer') {
        const res = await api.post(
          '/transactions/transfer',
          {
            sourceAccountId,
            destinationIdentifier,
            amount: parseFloat(amount),
            description: description || undefined,
          },
          { headers },
        );
        setResult(res.data);
      } else if (tab === 'deposit') {
        const res = await api.post(
          '/transactions/deposit',
          {
            accountId: sourceAccountId,
            amount: parseFloat(amount),
            description: description || undefined,
          },
          { headers },
        );
        setResult(res.data);
      } else if (tab === 'withdraw') {
        const res = await api.post(
          '/transactions/withdraw',
          {
            accountId: sourceAccountId,
            amount: parseFloat(amount),
            description: description || undefined,
          },
          { headers },
        );
        setResult(res.data);
      }

      // Reset form on success but keep key to demonstrate idempotency if clicked again
      setAmount('');
      setDescription('');

      // Refresh accounts balances
      const accRes = await api.get('/accounts/my-accounts');
      setAccounts(accRes.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Une erreur est survenue lors de l’exécution de l’opération financière.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-sky-400" /> Opérations & Mouvements Financiers
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Chaque mouvement est exécuté sous verrouillage pessimiste avec écriture en partie double dans le grand livre.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => { setTab('transfer'); setResult(null); setError(null); }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 ${
            tab === 'transfer'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" /> Virement Bancaire
        </button>
        <button
          onClick={() => { setTab('deposit'); setResult(null); setError(null); }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 ${
            tab === 'deposit'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" /> Dépôt d’espèces
        </button>
        <button
          onClick={() => { setTab('withdraw'); setResult(null); setError(null); }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 ${
            tab === 'withdraw'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" /> Retrait d’espèces
        </button>
      </div>

      {/* Form Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              {tab === 'deposit' ? 'Compte à créditer' : 'Compte débiteur source'}
            </label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountType} ({acc.accountNumber}) — Solde : {Number(acc.balance).toFixed(2)} €
                </option>
              ))}
            </select>
          </div>

          {/* Destination Account (Only for transfers) */}
          {tab === 'transfer' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Compte Destinataire (IBAN ou UUID de compte)
              </label>
              <input
                type="text"
                required
                placeholder="ex: FR76 3000 6000 0100 8000 9000 501 ou UUID"
                value={destinationIdentifier}
                onChange={(e) => setDestinationIdentifier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Astuce pour tester : copiez l’IBAN d’un de vos autres comptes ou d’un client test (Bob : FR76 3000 6000 0100 8000 9000 501).
              </p>
            </div>
          )}

          {/* Amount & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Montant de l’opération (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Motif / Libellé
              </label>
              <input
                type="text"
                placeholder={tab === 'transfer' ? 'Virement loyer, etc.' : 'Dépôt / Retrait agence'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Idempotency Key Feature Spotlight */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Key className="h-4 w-4 text-amber-400" />
              <div>
                <span className="text-xs font-semibold text-slate-300">Clé d’Idempotence transmise :</span>
                <span className="block text-xs font-mono text-amber-400/90">{idempotencyKey}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshIdempotencyKey}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" /> Régénérer
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              tab === 'transfer'
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20 text-white'
                : tab === 'deposit'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 text-white'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20 text-white'
            }`}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {tab === 'transfer' && 'Exécuter le Virement Immédiat'}
                {tab === 'deposit' && 'Enregistrer le Dépôt'}
                {tab === 'withdraw' && 'Valider le Retrait'}
              </>
            )}
          </button>
        </form>

        {/* Error Feedback */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Échec de l’opération :</p>
              <p className="text-xs text-rose-200 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Opération enregistrée avec succès dans le Grand Livre !
            </div>
            <div className="text-xs font-mono text-emerald-200/90 pl-7 space-y-1">
              <p>Référence : <span className="font-bold text-white">{result.reference}</span></p>
              <p>Montant : {Number(result.amount).toFixed(2)} EUR</p>
              <p>Statut : {result.status}</p>
              <p>Écritures de partie double : {result.postings?.length || 2} lignes équilibrées générées (∑ Débit = ∑ Crédit)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
