import React from 'react';
import { 
  Building2, 
  Coins, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Blocks, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowUpRight,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { ContractTypeStats, PropertyStats } from '../types';
import { cn } from '../lib/utils';

interface ContractTypeStatsSectionProps {
  royaltiesStats?: ContractTypeStats;
  obligationsStats?: ContractTypeStats;
  onFilterContract?: (type: 'all' | 'royalties' | 'obligations') => void;
  currentFilter?: 'all' | 'royalties' | 'obligations' | 'without_royalties' | 'without_obligations';
}

const formatEuro = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatPercent = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '0,00 %';
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val / 100);
};

export const ContractTypeStatsSection: React.FC<ContractTypeStatsSectionProps> = ({
  royaltiesStats,
  obligationsStats,
  onFilterContract,
  currentFilter
}) => {
  if (!royaltiesStats && !obligationsStats) return null;

  return (
    <div id="section-contract-types" className="space-y-8 mb-8">
      {/* -------------------- SECTION ROYALTIES -------------------- */}
      {royaltiesStats && royaltiesStats.totalProjectsCount > 0 && (
        <div 
          id="section-royalties-stats"
          className="bg-white rounded-2xl shadow-xs border border-blue-100/90 overflow-hidden"
        >
          {/* Header Royalties */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-blue-200 border border-white/10">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-white">
                      Section Royalties (Revenus Locatifs & Plus-Values)
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      Immobilier locatif
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/90 mt-0.5">
                    Statistiques consolidées des {royaltiesStats.totalProjectsCount} projets en contrat de royalties
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-xs">
                  <span className="text-blue-200 font-medium">Briques détenues : </span>
                  <strong className="text-white font-mono">{royaltiesStats.ownedBricks}</strong>
                </div>
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-xs">
                  <span className="text-blue-200 font-medium">Projets actifs : </span>
                  <strong className="text-white">{royaltiesStats.activeProjectsCount}/{royaltiesStats.totalProjectsCount}</strong>
                </div>
                {onFilterContract && (
                  <button
                    type="button"
                    onClick={() => onFilterContract(currentFilter === 'royalties' ? 'all' : 'royalties')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5",
                      currentFilter === 'royalties'
                        ? "bg-white text-blue-900 shadow-sm"
                        : "bg-blue-600/60 hover:bg-blue-600 text-white border border-blue-400/30"
                    )}
                  >
                    <span>{currentFilter === 'royalties' ? 'Filtre actif' : 'Filtrer le tableau'}</span>
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* KPI Grid Royalties */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50">
            {/* Card 1: Valeur Actuelle des Briques & Plus/Moins Value */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Valeur Actuelle des Briques</span>
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    royaltiesStats.latentCapitalGain >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}>
                    <Blocks size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {formatEuro(royaltiesStats.currentTotalValue)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Prix unitaire x {royaltiesStats.ownedBricks} briques détenues
                </div>
              </div>

              <div className={cn(
                "mt-3 pt-2.5 border-t text-xs font-semibold flex items-center justify-between",
                royaltiesStats.latentCapitalGain >= 0 ? "border-emerald-100 text-emerald-700" : "border-rose-100 text-rose-700"
              )}>
                <span className="text-[11px] text-slate-500 font-normal">Plus / Moins-value :</span>
                <span className="font-mono">
                  {royaltiesStats.latentCapitalGain >= 0 ? '+' : ''}{formatEuro(royaltiesStats.latentCapitalGain)} ({royaltiesStats.latentCapitalGainPercent >= 0 ? '+' : ''}{formatPercent(royaltiesStats.latentCapitalGainPercent)})
                </span>
              </div>
            </div>

            {/* Card 2: Montant Investi & Encours */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Capital Investi (Encours)</span>
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Coins size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {formatEuro(royaltiesStats.currentCapital)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Sur {royaltiesStats.activeProjectsCount} projet(s) en cours
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between text-slate-600">
                <span className="text-[11px] text-slate-500">Total investi historique :</span>
                <span className="font-semibold font-mono text-slate-800">{formatEuro(royaltiesStats.totalInvested)}</span>
              </div>
            </div>

            {/* Card 3: Répartition des Plus/Moins-Values Projets */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Santé du Portefeuille Royalties</span>
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Scale size={16} />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
                    <TrendingUp size={12} />
                    {royaltiesStats.positiveGainProjectsCount} en PV
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold font-mono">
                    <TrendingDown size={12} />
                    {royaltiesStats.negativeGainProjectsCount} en MV
                  </span>
                  {royaltiesStats.neutralGainProjectsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold font-mono">
                      {royaltiesStats.neutralGainProjectsCount} stable
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  Sur les {royaltiesStats.activeProjectsCount} projets royalties actifs
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Prix de revient (PRU) :</span>
                <span className="font-semibold font-mono text-slate-800">{formatEuro(royaltiesStats.costForOwnedBricks)}</span>
              </div>
            </div>

            {/* Card 4: Loyers Nets & Rendements */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Loyers Nets & Rendement</span>
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <Percent size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-amber-700">
                  {formatEuro(royaltiesStats.netRevenues)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Rendement annualisé moyen : <strong className="text-slate-700">{formatPercent(royaltiesStats.averageAnnualYield)}</strong>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Délai moyen 1er loyer :</span>
                <span className="font-semibold font-mono text-blue-600">
                  {royaltiesStats.averageDaysBeforeFirstRevenue !== undefined ? `~${royaltiesStats.averageDaysBeforeFirstRevenue} jours` : (royaltiesStats.projectsWithRevenueCount ? '0 jour' : '-')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- SECTION OBLIGATIONS -------------------- */}
      {obligationsStats && obligationsStats.totalProjectsCount > 0 && (
        <div 
          id="section-obligations-stats"
          className="bg-white rounded-2xl shadow-xs border border-purple-100/90 overflow-hidden"
        >
          {/* Header Obligations */}
          <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 p-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-purple-200 border border-white/10">
                  <Percent size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-white">
                      Section Obligations (Prêts Obligataires & Remboursements)
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                      Financement participatif
                    </span>
                  </div>
                  <p className="text-xs text-purple-200/90 mt-0.5">
                    Statistiques consolidées des {obligationsStats.totalProjectsCount} projets obligataires avec suivi du capital et des coupons
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-xs">
                  <span className="text-purple-200 font-medium">Briques détenues : </span>
                  <strong className="text-white font-mono">{obligationsStats.ownedBricks}</strong>
                </div>
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-xs">
                  <span className="text-purple-200 font-medium">Projets en cours : </span>
                  <strong className="text-white">{obligationsStats.activeProjectsCount}/{obligationsStats.totalProjectsCount}</strong>
                </div>
                {onFilterContract && (
                  <button
                    type="button"
                    onClick={() => onFilterContract(currentFilter === 'obligations' ? 'all' : 'obligations')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5",
                      currentFilter === 'obligations'
                        ? "bg-white text-purple-900 shadow-sm"
                        : "bg-purple-600/60 hover:bg-purple-600 text-white border border-purple-400/30"
                    )}
                  >
                    <span>{currentFilter === 'obligations' ? 'Filtre actif' : 'Filtrer le tableau'}</span>
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* KPI Grid Obligations */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50">
            {/* Card 1: Capital Restant Dû & Total Investi */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Capital Restant Dû (Encours)</span>
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Coins size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {formatEuro(obligationsStats.currentCapital)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Sur {obligationsStats.activeProjectsCount} prêt(s) en cours ({obligationsStats.ownedBricks} briques)
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Total investi initialement :</span>
                <span className="font-semibold font-mono text-slate-800">{formatEuro(obligationsStats.totalInvested)}</span>
              </div>
            </div>

            {/* Card 2: Taux de Remboursement du Capital */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Taux de Remboursement Capital</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ShieldCheck size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {formatPercent(obligationsStats.repaymentRate || 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Capital remboursé : <strong className="text-slate-700 font-mono">{formatEuro(Math.max(0, obligationsStats.totalInvested - obligationsStats.currentCapital))}</strong>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Projets remboursés à 100% :</span>
                <span className="font-semibold font-mono text-emerald-700">{obligationsStats.refundedProjectsCount} projet(s)</span>
              </div>
            </div>

            {/* Card 3: Statut Temporel des Remboursements */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Ponctualité des Remboursements</span>
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="space-y-1 mt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      En anticipation :
                    </span>
                    <strong className="font-mono text-slate-900">{obligationsStats.repaidInAdvanceCount || 0}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium inline-flex items-center gap-1">
                      <Clock size={12} />
                      Dans les délais / à terme :
                    </span>
                    <strong className="font-mono text-slate-900">{obligationsStats.repaidOnTimeCount || 0}</strong>
                  </div>
                  {obligationsStats.repaidLateCount !== undefined && obligationsStats.repaidLateCount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-600 font-medium inline-flex items-center gap-1">
                        <AlertCircle size={12} />
                        En retard :
                      </span>
                      <strong className="font-mono text-rose-700">{obligationsStats.repaidLateCount}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between text-slate-500">
                <span className="text-[11px]">En cours de prêt :</span>
                <span className="font-semibold text-slate-800">{obligationsStats.activeProjectsCount} projet(s)</span>
              </div>
            </div>

            {/* Card 4: Intérêts / Coupons & Rendement */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Intérêts Nets Perçus (Coupons)</span>
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Percent size={16} />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-purple-700">
                  {formatEuro(obligationsStats.netRevenues)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Taux contractuel annualisé moyen : <strong className="text-slate-700">{formatPercent(obligationsStats.averageAnnualYield)}</strong>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Délai moyen 1er coupon :</span>
                <span className="font-semibold font-mono text-purple-600">
                  {obligationsStats.averageDaysBeforeFirstRevenue !== undefined ? `~${obligationsStats.averageDaysBeforeFirstRevenue} jours` : (obligationsStats.projectsWithRevenueCount ? '0 jour' : '-')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
