import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Building,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const accRes = await api.get('/accounts/my-accounts');
      setAccounts(accRes.data);

      if (accRes.data.length > 0) {
        const postRes = await api.get(`/ledger/account/${accRes.data[0].id}/postings?limit=10`);
        setRecentEntries(postRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalBalance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                ESPACE {user?.role}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <ShieldCheck className="h-3.5 w-3.5" /> Grand Livre Synchronisé
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Bonjour, {user?.firstName} {user?.lastName} 👋
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Bienvenue sur votre espace bancaire nouvelle génération propulsé par un grand livre en partie double.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Actualiser"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <Link
              to="/transfers"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition shadow-lg shadow-sky-600/20"
            >
              <ArrowUpRight className="h-4 w-4" />
              Effectuer un virement
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Liquidity */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Solde Total Détenu</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">
                {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">{accounts.length} compte(s)</span>
            <span>détenu(s) chez AuraBank</span>
          </div>
        </div>

        {/* Checking Accounts */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Comptes Courants</p>
              <h2 className="text-3xl font-extrabold text-sky-400 mt-1 font-mono">
                {accounts
                  .filter((a) => a.accountType === 'CHECKING')
                  .reduce((acc, a) => acc + Number(a.balance), 0)
                  .toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span>Disponible pour paiements et virements</span>
          </div>
        </div>

        {/* Savings */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Comptes Épargne</p>
              <h2 className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
                {accounts
                  .filter((a) => a.accountType === 'SAVINGS')
                  .reduce((acc, a) => acc + Number(a.balance), 0)
                  .toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </h2>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span>Rémunéré à 3.00% annuel</span>
          </div>
        </div>
      </div>

      {/* Accounts & Cards section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts List */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base text-white flex items-center gap-2">
              <Building className="h-4 w-4 text-sky-400" /> Vos Comptes Bancaires
            </h3>
            <Link to="/accounts" className="text-xs text-sky-400 hover:text-sky-300 font-medium">
              Gérer les comptes →
            </Link>
          </div>

          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">
                      {acc.accountType === 'CHECKING' ? 'Compte Courant Principal' : 'Livret Épargne'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                      {acc.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-0.5 tracking-wider">{acc.accountNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-white">
                    {Number(acc.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                  <span className="text-[11px] text-slate-500">EUR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Ledger Engine Status */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="font-semibold text-base text-white">Sécurité & Moteur</h3>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Contrôle de concurrence :</span>
              <span className="text-emerald-400 font-mono font-semibold">SELECT FOR UPDATE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Règle de partie double :</span>
              <span className="text-sky-400 font-mono font-semibold">∑ Débits = ∑ Crédits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Protection idempotence :</span>
              <span className="text-indigo-400 font-mono font-semibold">Idempotency-Key</span>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              to="/transfers"
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
              Verser / Déposer des espèces
            </Link>
            <Link
              to="/loans"
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <TrendingUp className="h-4 w-4 text-purple-400" />
              Simuler un prêt bancaire
            </Link>
            {user?.role !== 'CLIENT' && (
              <Link
                to="/ledger"
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                <RefreshCw className="h-4 w-4 text-sky-400" />
                Vérifier la réconciliation du Grand Livre
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ledger Postings */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base text-white">Derniers Mouvements Comptables (Grand Livre)</h3>
          <Link to="/ledger" className="text-xs text-sky-400 hover:text-sky-300 font-medium">
            Voir le Grand Livre complet →
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Aucune opération récente sur ce compte.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Description / Réf</th>
                  <th className="pb-2">Sens</th>
                  <th className="pb-2 text-right">Montant</th>
                  <th className="pb-2 text-right">Solde Après</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentEntries.map((p) => {
                  const isCredit = p.direction === 'CREDIT';
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/50">
                      <td className="py-2.5 text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 text-slate-300 font-sans">
                        {p.journalEntry?.description || 'Écriture comptable'}
                        <span className="block text-[10px] font-mono text-slate-500">{p.journalEntry?.reference}</span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isCredit
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {p.direction}
                        </span>
                      </td>
                      <td className={`py-2.5 text-right font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isCredit ? '+' : '-'}{Number(p.amount).toFixed(2)} €
                      </td>
                      <td className="py-2.5 text-right text-slate-300">
                        {Number(p.balanceAfter).toFixed(2)} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
