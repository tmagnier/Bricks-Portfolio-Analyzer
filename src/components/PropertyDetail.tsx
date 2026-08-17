import React, { useState, useMemo } from 'react';
import { parse, differenceInDays } from 'date-fns';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  Building2, 
  Calendar, 
  Clock, 
  MapPin, 
  Blocks, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Wallet, 
  ArrowUpRight, 
  ArrowLeft, 
  Info, 
  History, 
  Download, 
  ExternalLink, 
  Search, 
  X, 
  FileText, 
  Percent,
  Receipt,
  AlertTriangle 
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  PropertyStats, 
  PropertyTimelinePoint, 
  isPurchaseType, 
  isRevenueType, 
  isRepaymentOrSaleType, 
  isFeeType, 
  isTaxType 
} from '../types';
import { getPropertyTimeline, formatInvestmentDuration } from '../services/dataService';
import { cn } from '../lib/utils';
import { StatCard } from './StatCard';
import { FilterTab } from './FilterTab';
import { DetailItem } from './DetailItem';

export type FilterMode = 'all' | 'rolling' | 'calendar';

export interface PropertyDetailProps {
  key?: React.Key;
  property: PropertyStats;
  onBack: () => void;
  formatEuro: (v: number) => string;
  formatPercent: (v: number) => string;
  filterMode: FilterMode;
  setFilterMode: (m: FilterMode) => void;
  rollingMonths: number;
  setRollingMonths: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  selectedMonth: number | 'all';
  setSelectedMonth: (m: number | 'all') => void;
  selectedQuarter: number | 'all';
  setSelectedQuarter: (q: number | 'all') => void;
  availableYears: number[];
}

export function PropertyDetail({ 
  property, 
  onBack, 
  formatEuro, 
  formatPercent,
  filterMode,
  setFilterMode,
  rollingMonths,
  setRollingMonths,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedQuarter,
  setSelectedQuarter,
  availableYears
}: PropertyDetailProps) {
  const sortedTxs = (() => {
    const rawTxs = [...property.transactions].map((t, _idx) => ({ ...t, _idx }));
    
    // Sort chronological (oldest first) to compute running capital
    const ascTxs = [...rawTxs].sort((a, b) => {
      const d1 = parse(a.date, "dd/MM/yyyy", new Date());
      const d2 = parse(b.date, "dd/MM/yyyy", new Date());
      if (d1.getTime() !== d2.getTime()) return d1.getTime() - d2.getTime();
      return b._idx - a._idx;
    });

    let runningCapital = 0;
    let runningBricks = 0;
    const capitalMap = new Map<number, number>();
    const txBricksMap = new Map<number, { bricks: number | null; isBuy: boolean; isSell: boolean; unitPrice: number }>();

    ascTxs.forEach((t) => {
      const amount = parseFloat(t["montant (€)"].replace(",", "."));
      const statut = t.statut || "Validée";
      const normStatut = statut.toLowerCase();
      const isValidated = normStatut === "validée" || normStatut === "validee" || normStatut === "";

      let rawTxBrickPrice = parseFloat((t["prix de la brick (€)"] || "").replace(",", "."));
      if (isNaN(rawTxBrickPrice) || rawTxBrickPrice <= 0) {
        rawTxBrickPrice = property.currentBrickPrice || 10;
      }

      let txBricks: number | null = null;
      let isBuy = false;
      let isSell = false;
      let unitPrice = rawTxBrickPrice;

      if (isValidated) {
        const normType = t.type.toLowerCase();
        const isFrais = normType.includes("frais");
        const isRevenus = normType.includes("revenus");
        const absAmount = Math.abs(amount);

        if (normType.includes("achat") && !isFrais) {
          const bought = absAmount / rawTxBrickPrice;
          runningCapital += absAmount;
          runningBricks += bought;
          txBricks = Math.round(bought * 1000) / 1000;
          isBuy = true;
        } else if (!isRevenus && normType.includes("vente") && !normType.includes("remboursement") && !isFrais) {
          const sold = absAmount / rawTxBrickPrice;
          runningCapital = Math.max(0, runningCapital - absAmount);
          runningBricks = Math.max(0, runningBricks - sold);
          txBricks = Math.round(sold * 1000) / 1000;
          isSell = true;
        } else if (!isRevenus && normType.includes("remboursement") && !isFrais) {
          const prevBricks = runningBricks;
          runningCapital = Math.max(0, runningCapital - absAmount);

          if (runningCapital <= 0.01 || normType.includes("revente totale") || normType.includes("revente-totale")) {
            txBricks = Math.round(prevBricks * 1000) / 1000;
            if (txBricks > 0) {
              isSell = true;
              unitPrice = prevBricks > 0 ? Math.round((absAmount / prevBricks) * 100) / 100 : rawTxBrickPrice;
            }
            runningBricks = 0;
            runningCapital = 0;
          } else {
            txBricks = null;
          }
        } else if (normType.includes("revente totale") || normType.includes("revente-totale")) {
          const prevBricks = runningBricks;
          txBricks = Math.round(prevBricks * 1000) / 1000;
          if (txBricks > 0) {
            isSell = true;
            unitPrice = prevBricks > 0 ? Math.round((absAmount / prevBricks) * 100) / 100 : rawTxBrickPrice;
          }
          runningBricks = 0;
          runningCapital = 0;
        }
      }

      capitalMap.set(t._idx, runningCapital);
      txBricksMap.set(t._idx, { bricks: txBricks, isBuy, isSell, unitPrice });
    });

    // Return sorted descending (newest first) with capitalAfter and computed brick info attached
    return rawTxs.sort((a, b) => {
      const d1 = parse(a.date, "dd/MM/yyyy", new Date());
      const d2 = parse(b.date, "dd/MM/yyyy", new Date());
      if (d2.getTime() !== d1.getTime()) return d2.getTime() - d1.getTime();
      return a._idx - b._idx;
    }).map(t => {
      const bInfo = txBricksMap.get(t._idx);
      return {
        ...t,
        capitalAfter: capitalMap.get(t._idx) ?? 0,
        txBricksComputed: bInfo?.bricks ?? null,
        isBuyComputed: bInfo?.isBuy ?? false,
        isSellComputed: bInfo?.isSell ?? false,
        unitPriceComputed: bInfo?.unitPrice ?? 10
      };
    });
  })();

  const [detailTxCategory, setDetailTxCategory] = useState<'all' | 'purchases' | 'revenues' | 'sales'>('all');
  const [detailTxSearch, setDetailTxSearch] = useState('');
  const [propertyRevenueMode, setPropertyRevenueMode] = useState<'cumulative' | 'monthly' | 'both'>('cumulative');

  // Automatically scroll to the top of the page when opening or switching property detail
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [property.name]);

  const propertyTimeline = useMemo(() => {
    return getPropertyTimeline(sortedTxs);
  }, [sortedTxs]);

  const filteredDetailTxs = useMemo(() => {
    return sortedTxs.filter(t => {
      const q = detailTxSearch.trim().toLowerCase();
      const matchesSearch = !q || 
        (t.type || '').toLowerCase().includes(q) || 
        t.date.includes(q) || 
        (t.statut || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (detailTxCategory === 'purchases') {
        return isPurchaseType(t.type);
      }
      if (detailTxCategory === 'revenues') {
        return isRevenueType(t.type);
      }
      if (detailTxCategory === 'sales') {
        return isRepaymentOrSaleType(t.type);
      }
      return true;
    });
  }, [sortedTxs, detailTxCategory, detailTxSearch]);

  const meta = property.metadata;
  const contractType = meta?.investorContractType || sortedTxs.find(t => t["type de contrat"])?.["type de contrat"] || property.contractType;
  const isObligation = contractType 
    ? (contractType.toLowerCase().includes("obligation") || contractType.toLowerCase().includes("pret") || contractType.toLowerCase().includes("loan")) 
    : (property.isObligation ?? false);
  const isRoyalty = !isObligation;

  const totalSalesEver = useMemo(() => {
    return sortedTxs.filter(t => {
      const norm = t.type.toLowerCase();
      return norm.includes("vente") || norm.includes("remboursement") || norm.includes("revente");
    }).reduce((acc, t) => acc + Math.abs(parseFloat(t["montant (€)"].replace(",", "."))), 0);
  }, [sortedTxs]);

  const salesForGain = property.periodSales > 0 ? property.periodSales : totalSalesEver;
  const plusMoinsValue = salesForGain - property.totalInvested;

  const getFileNameFromUrl = (url: string) => {
    if (!url) return '';
    try {
      const clean = url.split('?')[0].split('#')[0];
      const parts = clean.split('/');
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last);
    } catch (e) {
      // fallback
    }
    return url;
  };

  const handleDownloadAllDocuments = () => {
    if (!meta?.documents || meta.documents.length === 0) return;
    meta.documents.forEach((doc, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = doc.url;
        link.target = '_blank';
        link.download = getFileNameFromUrl(doc.url) || `${property.name}_${doc.type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 300);
    });
  };

  const isRefundedOrSold = property.ownedBricks === 0 || property.currentCapital === 0;

  const totalMarketplaceFees = useMemo(() => {
    if (property.marketplaceFees !== undefined && property.marketplaceFees > 0) {
      return property.marketplaceFees;
    }
    return sortedTxs
      .filter(t => isFeeType(t.type) || (t.type || '').toLowerCase().includes('frais'))
      .reduce((sum, t) => sum + Math.abs(parseFloat((t["montant (€)"] || "0").replace(",", "."))), 0);
  }, [property.marketplaceFees, sortedTxs]);

  const latestRevenueInfo = useMemo(() => {
    if (isRefundedOrSold) return null;
    const now = new Date();
    const revTxs = sortedTxs.filter(t => isRevenueType(t.type));

    if (revTxs.length > 0) {
      // sortedTxs is sorted descending by date, so revTxs[0] is the most recent
      const lastRevTx = revTxs[0];
      try {
        const d = parse(lastRevTx.date, "dd/MM/yyyy", new Date());
        if (!isNaN(d.getTime())) {
          const days = Math.max(0, differenceInDays(now, d));
          if (days > 31) {
            return {
              hasDelay: true,
              daysSince: days,
              durationText: formatInvestmentDuration(d, now),
              lastDate: lastRevTx.date,
              hasNeverReceived: false
            };
          }
        }
      } catch (e) {}
    } else if (property.firstInvestmentDate) {
      try {
        const d = parse(property.firstInvestmentDate, "dd/MM/yyyy", new Date());
        if (!isNaN(d.getTime())) {
          const days = Math.max(0, differenceInDays(now, d));
          if (days > 31) {
            return {
              hasDelay: true,
              daysSince: days,
              durationText: formatInvestmentDuration(d, now),
              lastDate: null,
              hasNeverReceived: true
            };
          }
        }
      } catch (e) {}
    }
    return null;
  }, [isRefundedOrSold, sortedTxs, property.firstInvestmentDate]);

  const ongoingDurationText = useMemo(() => {
    if (property.investmentDurationText) return property.investmentDurationText;
    if (property.firstInvestmentDate) {
      try {
        const d = parse(property.firstInvestmentDate, "dd/MM/yyyy", new Date());
        if (!isNaN(d.getTime())) {
          return formatInvestmentDuration(d, new Date());
        }
      } catch (e) {
        // fallback
      }
    }
    if (property.projectOpeningDate) {
      try {
        const d = parse(property.projectOpeningDate, "dd/MM/yyyy", new Date());
        if (!isNaN(d.getTime())) {
          return formatInvestmentDuration(d, new Date());
        }
      } catch (e) {
        // fallback
      }
    }
    return null;
  }, [property.investmentDurationText, property.firstInvestmentDate, property.projectOpeningDate]);

  return (
    <motion.div
      id="property-detail-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      <button 
        id="btn-back-to-dashboard"
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium self-start cursor-pointer group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>Retour au tableau de bord</span>
      </button>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {meta?.thumbnailUrl ? (
            <img src={meta.thumbnailUrl} alt={property.name} className="w-20 h-20 rounded-2xl object-cover shadow-lg border border-slate-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg">
              <Building2 size={32} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{property.name}</h1>
            </div>
            
            {meta?.address && (
              <p className="text-slate-500 flex items-center gap-1 text-sm mb-3">
                <MapPin size={16} />
                {meta.address.fr || meta.address.en || (typeof meta.address === 'string' ? meta.address : '')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {contractType && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200/80 shadow-xs">
                  <FileText size={14} className="text-amber-600" />
                  <span>Contrat : {contractType}</span>
                </div>
              )}
              {property.projectOpeningDate && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg border border-purple-100">
                  <Calendar size={14} className="text-purple-600" />
                  <span>Ouverture du projet : {property.projectOpeningDate}</span>
                </div>
              )}
              {property.firstInvestmentDate && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                  <Clock size={14} className="text-blue-600" />
                  <span>Mon 1er achat : {property.firstInvestmentDate}</span>
                </div>
              )}
              {isRefundedOrSold && (
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border shadow-xs",
                  property.repaymentTimingStatus === 'retard'
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : plusMoinsValue >= 0 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                      : "bg-rose-50 text-rose-800 border-rose-200"
                )}>
                  <TrendingUp size={14} className={
                    property.repaymentTimingStatus === 'retard'
                      ? "text-amber-600"
                      : plusMoinsValue >= 0 ? "text-emerald-600" : "text-rose-600"
                  } />
                  <span>
                    Projet revendu / remboursé
                    {(property.finalRepaymentDate || property.capitalZeroDate) && (
                      <>
                        {" • "}
                        {property.repaymentTimingStatus === 'anticipation' && (
                          <span className="text-emerald-700 font-extrabold">en anticipation le {property.finalRepaymentDate || property.capitalZeroDate}</span>
                        )}
                        {property.repaymentTimingStatus === 'retard' && (
                          <span className="text-amber-800 font-extrabold">en retard le {property.finalRepaymentDate || property.capitalZeroDate}</span>
                        )}
                        {(property.repaymentTimingStatus === 'on_time' || !property.repaymentTimingStatus) && (
                          <span>le {property.finalRepaymentDate || property.capitalZeroDate}</span>
                        )}
                      </>
                    )}
                    {isRoyalty ? ` • Plus/Moins-value : ${plusMoinsValue >= 0 ? '+' : ''}${formatEuro(plusMoinsValue)}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter Bar inside Detail Page */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Calendar size={18} className="text-blue-600" />
          <span>Période d'analyse :</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <FilterTab active={filterMode === 'all'} onClick={() => setFilterMode('all')}>Tout</FilterTab>
            <FilterTab active={filterMode === 'rolling'} onClick={() => setFilterMode('rolling')}>Période glissante</FilterTab>
            <FilterTab active={filterMode === 'calendar'} onClick={() => setFilterMode('calendar')}>Calendrier</FilterTab>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filterMode === 'rolling' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Derniers :</span>
                <select 
                  value={rollingMonths} 
                  onChange={(e) => setRollingMonths(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 mois</option>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={12}>12 mois</option>
                  <option value={24}>24 mois</option>
                </select>
              </div>
            )}

            {filterMode === 'calendar' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Année :</span>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Précision :</span>
                  <select 
                    value={selectedQuarter === 'all' ? (selectedMonth === 'all' ? 'all' : `m-${selectedMonth}`) : `q-${selectedQuarter}`} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'all') {
                        setSelectedQuarter('all');
                        setSelectedMonth('all');
                      } else if (val.startsWith('q-')) {
                        setSelectedQuarter(Number(val.split('-')[1]));
                        setSelectedMonth('all');
                      } else {
                        setSelectedMonth(Number(val.split('-')[1]));
                        setSelectedQuarter('all');
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Année complète</option>
                    <optgroup label="Trimestres">
                      <option value="q-1">T1 (Jan-Mar)</option>
                      <option value="q-2">T2 (Avr-Juin)</option>
                      <option value="q-3">T3 (Juil-Sept)</option>
                      <option value="q-4">T4 (Oct-Déc)</option>
                    </optgroup>
                    <optgroup label="Mois">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={`m-${i}`}>
                          {new Date(2000, i).toLocaleString('fr-FR', { month: 'long' })}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bricks & Latent Valuation Card */}
      {isRoyalty && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 rounded-2xl shadow-md border border-slate-700/80 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Building2 size={200} />
          </div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Blocks size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span>Mes Briques & Valorisation Latente</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Calcul basé sur vos briques possédées, le prix payé dans vos transactions et le prix actuel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
                  <Blocks size={14} className="text-amber-400 shrink-0" />
                  <span>{property.ownedBricks} {property.ownedBricks > 1 ? 'briques détenues' : 'brique détenue'}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                  Briques Détenues
                </span>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    <Blocks size={16} />
                  </div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {property.ownedBricks}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  en portefeuille
                </span>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                  Prix Actuel / <Blocks size={11} className="inline text-amber-400 align-baseline" />
                </span>
                <span className="text-2xl font-bold font-mono text-blue-400">
                  {formatEuro(property.currentBrickPrice)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  valeur unitaire actuelle
                </span>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                  Prix Moyen Achat / <Blocks size={11} className="inline text-amber-400 align-baseline" />
                </span>
                <span className="text-2xl font-bold font-mono text-slate-200">
                  {property.ownedBricks > 0 ? formatEuro(property.averageBuyBrickPrice) : '-'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  coût unitaire moyen
                </span>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                  Valeur Actuelle Totale
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {formatEuro(property.currentTotalValue)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Coût d'achat: {formatEuro(property.costForOwnedBricks)}
                </span>
              </div>

              <div className={cn(
                "p-4 rounded-xl border col-span-2 sm:col-span-1",
                property.latentCapitalGain >= 0
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              )}>
                <span className="text-[10px] uppercase font-semibold tracking-wider block mb-1 opacity-80">
                  Plus / Moins-value Latente
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono">
                    {property.latentCapitalGain >= 0 ? '+' : ''}{formatEuro(property.latentCapitalGain)}
                  </span>
                </div>
                <span className="text-[11px] font-bold block mt-1 opacity-90">
                  ({property.latentCapitalGainPercent >= 0 ? '+' : ''}{property.latentCapitalGainPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard 
          id="stat-card-start-capital"
          title="Capital (Début)" 
          value={formatEuro(property.startCapital)} 
          icon={<Clock className="text-slate-600" />}
          description="Début de période"
        />
        <StatCard 
          id="stat-card-current-capital"
          title="Capital (Fin)" 
          value={formatEuro(property.currentCapital)} 
          icon={<Wallet className="text-blue-600" />}
          description={isRefundedOrSold ? "Capital soldé / Remboursé" : "Encours fin de période"}
        />
        {isRefundedOrSold ? (
          <StatCard 
            id="stat-card-loan-duration"
            title="Durée du prêt" 
            value={property.investmentDurationText || ongoingDurationText || '-'} 
            icon={<Clock className="text-indigo-600" />}
            description={
              property.repaymentTimingStatus === 'anticipation'
                ? `Remboursé en anticipation le ${property.finalRepaymentDate || property.capitalZeroDate}`
                : property.repaymentTimingStatus === 'retard'
                ? `Remboursé en retard le ${property.finalRepaymentDate || property.capitalZeroDate}`
                : property.firstInvestmentDate && (property.finalRepaymentDate || property.capitalZeroDate)
                ? `${property.firstInvestmentDate} → ${property.finalRepaymentDate || property.capitalZeroDate}`
                : "Du 1er achat au capital à 0"
            }
            badge={
              property.repaymentTimingStatus === 'anticipation'
                ? "En anticipation"
                : property.repaymentTimingStatus === 'retard'
                ? "En retard"
                : "Prêt terminé"
            }
          />
        ) : (
          <StatCard 
            id="stat-card-loan-duration"
            title="Durée du prêt" 
            value={ongoingDurationText || property.investmentDurationText || '-'} 
            icon={<Clock className="text-indigo-600" />}
            badge="Toujours en cours"
            description={
              property.firstInvestmentDate
                ? (property.expectedEndDate
                    ? `Depuis le ${property.firstInvestmentDate} • Fin prévue : ${property.expectedEndDate}`
                    : (meta?.investmentHorizonInMonths
                        ? `Depuis le ${property.firstInvestmentDate} • Horizon : ${meta.investmentHorizonInMonths} mois`
                        : `Depuis le 1er achat (${property.firstInvestmentDate})`
                      )
                  )
                : (property.projectOpeningDate
                    ? `Depuis le ${property.projectOpeningDate}`
                    : "Projet toujours en cours"
                  )
            }
          />
        )}
        {isRefundedOrSold && isRoyalty && (
          <StatCard 
            id="stat-card-gain-loss"
            title="Plus / Moins-value" 
            value={`${plusMoinsValue >= 0 ? '+' : ''}${formatEuro(plusMoinsValue)}`} 
            icon={<Coins className={plusMoinsValue >= 0 ? "text-emerald-600" : "text-rose-600"} />}
            description={`Ventes (${formatEuro(salesForGain)}) - Inves. (${formatEuro(property.totalInvested)})`}
            trend={plusMoinsValue >= 0 ? "positive" : "negative"}
            badge="Revente / Remboursé"
          />
        )}
        {latestRevenueInfo?.hasDelay && (
          <StatCard 
            id="stat-card-payment-delay"
            title="Depuis dernier Revenu" 
            value={latestRevenueInfo.durationText} 
            icon={<AlertTriangle className="text-amber-600" />}
            badge="Retard de paiement"
            description={
              latestRevenueInfo.lastDate
                ? `Dernier versement le ${latestRevenueInfo.lastDate} (${latestRevenueInfo.daysSince} j)`
                : `Aucun versement depuis l'achat (${property.firstInvestmentDate})`
            }
            trend="negative"
          />
        )}
        {isRoyalty && (
          <StatCard 
            id="stat-card-capital-gain"
            title="Gain Capital" 
            value={`${property.capitalGain >= 0 ? '+' : ''}${formatEuro(property.capitalGain)}`} 
            icon={<TrendingUp className={property.capitalGain >= 0 ? "text-emerald-600" : "text-rose-600"} />}
            description="Variation période"
            trend={property.capitalGain >= 0 ? "positive" : "negative"}
          />
        )}
        <StatCard 
          id="stat-card-total-invested"
          title="Inves. Total" 
          value={formatEuro(property.totalInvested)} 
          icon={<Building2 className="text-emerald-600" />}
          description="Achats cumulés"
        />
        {isRoyalty && (
          <StatCard 
            id="stat-card-cost-price"
            title="Prix de Revient (PRU)" 
            value={formatEuro(property.costForOwnedBricks > 0 ? property.costForOwnedBricks : (property.totalPurchaseCost || property.totalInvested))} 
            icon={<Coins className="text-amber-600" />}
            badge={
              property.ownedBricks > 0
                ? `${formatEuro(property.averageBuyBrickPrice)} / brique`
                : property.historicalAverageBuyBrickPrice
                ? `${formatEuro(property.historicalAverageBuyBrickPrice)} / brique`
                : undefined
            }
            description={
              property.ownedBricks > 0
                ? `PRU moyen de ${property.ownedBricks} brique${property.ownedBricks > 1 ? 's' : ''}`
                : `Coût d'achat total (${property.totalBoughtBricks || '-'} briques)`
            }
          />
        )}
        {isRoyalty && totalMarketplaceFees > 0 && (
          <StatCard 
            id="stat-card-marketplace-fees"
            title="Frais Marketplace" 
            value={formatEuro(totalMarketplaceFees)} 
            icon={<Receipt className="text-rose-600" />}
            description="Frais de transaction prélevés"
            badge="Marketplace"
          />
        )}
        <StatCard 
          id="stat-card-net-revenues"
          title="Revenus Nets" 
          value={formatEuro(property.netRevenues)} 
          icon={<ArrowUpRight className="text-amber-600" />}
          description="Loyers & Intérêts"
          trend={property.netRevenues > 0 ? "positive" : "negative"}
        />
        {property.daysBeforeFirstRevenue !== undefined ? (
          <StatCard 
            id="stat-card-first-revenue-delay"
            title="Délai 1er Revenu" 
            value={`${property.daysBeforeFirstRevenue} j`} 
            icon={<Clock className="text-amber-600" />}
            badge={property.firstRevenueDate ? `le ${property.firstRevenueDate}` : undefined}
            description={
              property.firstInvestmentDate && property.firstRevenueDate
                ? `${property.firstInvestmentDate} → ${property.firstRevenueDate}`
                : "Délai avant 1er versement de revenu"
            }
          />
        ) : (
          <StatCard 
            id="stat-card-first-revenue-pending"
            title="Délai 1er Revenu" 
            value="En attente" 
            icon={<Clock className="text-slate-400" />}
            description="Aucun revenu perçu à ce jour"
          />
        )}
        <StatCard 
          id="stat-card-period-sales"
          title="Ventes" 
          value={formatEuro(property.periodSales)} 
          icon={<Building2 className="text-indigo-600" />}
          description="Ventes / Capital"
        />
        <StatCard 
          id="stat-card-total-yield"
          title="Rendement Total" 
          value={formatPercent(property.yield)} 
          icon={<Percent className="text-purple-600" />}
          description="Sur total investi"
        />
        <StatCard 
          id="stat-card-annual-yield"
          title="Rendement / An" 
          value={formatPercent(property.annualYield)} 
          icon={<TrendingUp className="text-indigo-600" />}
          description={
            property.investmentDurationText
              ? `Depuis ${property.investmentDurationText}`
              : "Rendement annuel"
          }
        />
      </div>

      {/* Graphique : Revenus en fonction du temps & Total En-cours (Capital) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Évolution des Revenus & Total En-cours (Capital)
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Suivi chronologique des revenus perçus (axe droit) et du capital restant investi (axe gauche)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Revenue view mode toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                id="btn-revenue-mode-cumulative"
                type="button"
                onClick={() => setPropertyRevenueMode('cumulative')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  propertyRevenueMode === 'cumulative'
                    ? "bg-white text-emerald-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Revenus cumulés
              </button>
              <button
                id="btn-revenue-mode-monthly"
                type="button"
                onClick={() => setPropertyRevenueMode('monthly')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  propertyRevenueMode === 'monthly'
                    ? "bg-white text-emerald-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Revenus mensuels
              </button>
              <button
                id="btn-revenue-mode-both"
                type="button"
                onClick={() => setPropertyRevenueMode('both')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  propertyRevenueMode === 'both'
                    ? "bg-white text-emerald-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Les deux
              </button>
            </div>
          </div>
        </div>

        {propertyTimeline.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={propertyTimeline} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="formattedDate" 
                  tickLine={false} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                />
                <YAxis 
                  yAxisId="left" 
                  orientation="left" 
                  tickFormatter={(val) => `${val}€`} 
                  stroke="#3b82f6" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tickFormatter={(val) => `${val}€`} 
                  stroke="#10b981" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const dataPoint = payload[0]?.payload as PropertyTimelinePoint;
                    if (!dataPoint) return null;

                    return (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xl text-xs font-medium space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <span className="font-bold text-slate-800">Mois : {dataPoint.formattedDate}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{dataPoint.date}</span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                              <span className="text-slate-600">Total En-cours (Capital) :</span>
                            </div>
                            <span className="font-bold font-mono text-blue-600">{formatEuro(dataPoint.capital)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span className="text-slate-600">Revenus cumulés :</span>
                            </div>
                            <span className="font-bold font-mono text-emerald-600">+{formatEuro(dataPoint.cumulativeRevenue)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                              <span className="text-slate-600">Revenus du mois :</span>
                            </div>
                            <span className="font-bold font-mono text-slate-900">+{formatEuro(dataPoint.monthlyRevenue)}</span>
                          </div>

                          {dataPoint.periodInvestment !== undefined && dataPoint.periodInvestment > 0 && (
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 text-[11px]">
                              <span className="text-slate-500">Investissement / Achat :</span>
                              <span className="font-bold font-mono text-blue-700">+{formatEuro(dataPoint.periodInvestment)}</span>
                            </div>
                          )}

                          {dataPoint.periodRepayment !== undefined && dataPoint.periodRepayment > 0 && (
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 text-[11px]">
                              <span className="text-slate-500">Remboursement / Vente :</span>
                              <span className="font-bold font-mono text-indigo-700">-{formatEuro(dataPoint.periodRepayment)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} />

                {/* Courbe 1: Total En-cours (Capital) */}
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="capital" 
                  name="Total En-cours (Capital)" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  dot={propertyTimeline.length < 30} 
                  activeDot={{ r: 6 }} 
                />

                {/* Courbe 2: Revenus (Cumulés et/ou Mensuels) */}
                {(propertyRevenueMode === 'cumulative' || propertyRevenueMode === 'both') && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="cumulativeRevenue" 
                    name="Revenus Cumulés" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    dot={propertyTimeline.length < 30} 
                    activeDot={{ r: 5 }} 
                  />
                )}

                {(propertyRevenueMode === 'monthly' || propertyRevenueMode === 'both') && (
                  <Bar 
                    yAxisId="right"
                    dataKey="monthlyRevenue" 
                    name="Revenus Mensuels" 
                    fill="#f59e0b" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
            <Coins size={28} className="text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Aucune donnée temporelle disponible pour ce projet</p>
          </div>
        )}
      </div>

      {/* Project Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
            <Info size={20} className="text-blue-600" />
            Détails du Projet
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <DetailItem label="Briques détenues" value={
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <Blocks size={15} className="text-amber-500" />
                <span>{property.ownedBricks}</span>
              </span>
            } />
            <DetailItem label="Prix brique actuel" value={formatEuro(property.currentBrickPrice)} />
            {isRoyalty && (
              <>
                <DetailItem 
                  label="Prix de revient (PRU)" 
                  value={`${formatEuro(property.ownedBricks > 0 ? property.averageBuyBrickPrice : (property.historicalAverageBuyBrickPrice || 10))} / br.`} 
                />
                <DetailItem 
                  label="Coût de revient total" 
                  value={formatEuro(property.costForOwnedBricks > 0 ? property.costForOwnedBricks : (property.totalPurchaseCost || property.totalInvested))} 
                />
                {property.ownedBricks > 0 && property.netRevenues > 0 && (
                  <DetailItem 
                    label="Prix de revient net (après loyers)" 
                    value={`${formatEuro(property.netCostForOwnedBricks !== undefined ? property.netCostForOwnedBricks : Math.max(0, property.costForOwnedBricks - property.netRevenues))} (${formatEuro(property.netBrickPrice || ((property.costForOwnedBricks - property.netRevenues) / property.ownedBricks))} / br.)`} 
                  />
                )}
              </>
            )}
            {isRoyalty && (
              <DetailItem label="Plus/Moins-value latente" value={`${property.latentCapitalGain >= 0 ? '+' : ''}${formatEuro(property.latentCapitalGain)}`} />
            )}
            {property.projectOpeningDate && (
              <DetailItem label="Ouverture du projet" value={property.projectOpeningDate} />
            )}
            {property.firstInvestmentDate && (
              <DetailItem label="Mon 1er achat" value={property.firstInvestmentDate} />
            )}
            {property.daysBeforeFirstRevenue !== undefined ? (
              <DetailItem 
                label="Délai avant 1er revenu" 
                value={`${property.daysBeforeFirstRevenue} jours${property.firstRevenueDate ? ` (le ${property.firstRevenueDate})` : ''}`} 
              />
            ) : (
              <DetailItem 
                label="Délai avant 1er revenu" 
                value="En attente (aucun versement)" 
              />
            )}
            {isRefundedOrSold && (property.finalRepaymentDate || property.capitalZeroDate) && (
              <DetailItem 
                label="Remboursement final" 
                value={
                  property.repaymentTimingStatus === 'anticipation'
                    ? `En anticipation le ${property.finalRepaymentDate || property.capitalZeroDate}`
                    : property.repaymentTimingStatus === 'retard'
                    ? `En retard le ${property.finalRepaymentDate || property.capitalZeroDate}`
                    : `Le ${property.finalRepaymentDate || property.capitalZeroDate}`
                } 
              />
            )}
            {isRefundedOrSold && property.investmentDurationText && (
              <DetailItem label="Durée réelle du prêt" value={property.investmentDurationText} />
            )}
            {!isRefundedOrSold && (property.investmentDurationText || ongoingDurationText) && (
              <DetailItem 
                label="Durée du prêt (en cours)" 
                value={`${property.investmentDurationText || ongoingDurationText} (toujours en cours)`} 
              />
            )}
            {!isRefundedOrSold && property.expectedEndDate && (
              <DetailItem label="Fin de prêt estimée" value={property.expectedEndDate} />
            )}
            {meta?.investmentHorizonInMonths && (
              <DetailItem label="Horizon initial prévu" value={`${meta.investmentHorizonInMonths} mois`} />
            )}
            <DetailItem label="Rendement Total" value={formatPercent(property.yield)} />
            <DetailItem label="Rendement Annuel" value={`${formatPercent(property.annualYield)} / an`} />
            {isRoyalty && totalMarketplaceFees > 0 && (
              <DetailItem label="Frais Marketplace" value={formatEuro(totalMarketplaceFees)} />
            )}
            {latestRevenueInfo?.hasDelay && (
              <DetailItem 
                label="Statut des versements" 
                value={
                  <span className="text-amber-600 font-semibold">
                    {latestRevenueInfo.durationText} ({latestRevenueInfo.daysSince} j) sans versement {latestRevenueInfo.lastDate ? `(dernier le ${latestRevenueInfo.lastDate})` : "(aucun versement)"} - Retard
                  </span>
                } 
              />
            )}
            {!isRefundedOrSold && !latestRevenueInfo?.hasDelay && property.lastRevenueDate && (
              <DetailItem label="Dernier versement perçu" value={`Le ${property.lastRevenueDate}`} />
            )}
            {property.commercialAdjustments !== undefined && property.commercialAdjustments > 0 && (
              <DetailItem label="Ajustement commercial" value={`+${formatEuro(property.commercialAdjustments)}`} />
            )}
            {isRefundedOrSold && isRoyalty && (
              <DetailItem label="Plus / Moins-value (Revente)" value={`${plusMoinsValue >= 0 ? '+' : ''}${formatEuro(plusMoinsValue)}`} />
            )}
            {meta && (
              <>
                <DetailItem label="Type de contrat" value={meta.investorContractType || meta.contractType || '-'} />
                <DetailItem label="Statut financier" value={meta.financialStatus || '-'} />
                <DetailItem label="Horizon" value={`${meta.investmentHorizonInMonths || '-'} mois`} />
                <DetailItem label="Cible annuelle" value={formatPercent(meta.yearlyTotalRentabilityPercentage || 0)} />
              </>
            )}
          </div>
        </div>

        {/* Gallery & Documents */}
        <div className="flex flex-col gap-6">
          {meta?.imageGallery && meta.imageGallery.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Galerie Photos</h3>
              <div className="grid grid-cols-2 gap-2">
                {meta.imageGallery.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt={`Gallery ${i}`} className="w-full h-24 rounded-lg object-cover border border-slate-100" referrerPolicy="no-referrer" />
                ))}
              </div>
            </div>
          )}

          {meta?.documents && meta.documents.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Documents du Projet</h3>
                <button 
                  id="btn-download-all-docs"
                  type="button"
                  onClick={handleDownloadAllDocuments}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  title="Télécharger tous les documents du projet"
                >
                  <Download size={14} />
                  <span>Télécharger tout ({meta.documents.length})</span>
                </button>
              </div>
              <div className="space-y-2">
                {meta.documents.map((doc, i) => {
                  const fileName = getFileNameFromUrl(doc.url);
                  return (
                    <a 
                      key={i} 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all text-xs font-semibold group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="capitalize text-slate-800 font-bold group-hover:text-blue-600 transition-colors">
                          {doc.type.replace(/([A-Z])/g, ' $1')}
                        </span>
                        {fileName && (
                          <span className="text-[11px] text-slate-400 font-mono truncate" title={fileName}>
                            {fileName}
                          </span>
                        )}
                      </div>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table - AT THE VERY BOTTOM */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History size={20} className="text-blue-600" />
              Historique des Transactions
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {filteredDetailTxs.length} transaction(s) sur {sortedTxs.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                id="btn-detail-tx-tab-all"
                type="button"
                onClick={() => setDetailTxCategory('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'all' ? "bg-white text-slate-900 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Toutes
              </button>
              <button
                id="btn-detail-tx-tab-purchases"
                type="button"
                onClick={() => setDetailTxCategory('purchases')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'purchases' ? "bg-white text-blue-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Achats
              </button>
              <button
                id="btn-detail-tx-tab-revenues"
                type="button"
                onClick={() => setDetailTxCategory('revenues')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'revenues' ? "bg-white text-emerald-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Revenus
              </button>
              <button
                id="btn-detail-tx-tab-sales"
                type="button"
                onClick={() => setDetailTxCategory('sales')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'sales' ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Remboursements ou Ventes
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                id="input-filter-detail-transactions"
                type="text" 
                placeholder="Filtrer..."
                value={detailTxSearch}
                onChange={(e) => setDetailTxSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
              {detailTxSearch && (
                <button 
                  id="btn-clear-detail-tx-search"
                  type="button"
                  onClick={() => setDetailTxSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Blocks size={13} className="text-amber-500" />
                    <span>Briques (Prix/u)</span>
                  </span>
                </th>
                <th className="px-6 py-4 text-right">Montant</th>
                <th className="px-6 py-4 text-right">Capital Après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDetailTxs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Aucune transaction ne correspond à cette sélection.
                  </td>
                </tr>
              ) : (
                filteredDetailTxs.map((t) => {
                  const amount = parseFloat(t["montant (€)"].replace(",", "."));
                  const statut = t.statut || "Validée";
                  const normStatut = statut.toLowerCase();
                  const isValidated = normStatut === "validée" || normStatut === "validee";
                  const isCancelledOrRefused = normStatut.includes("refus") || normStatut.includes("annul");

                  const txBricks = (t as any).txBricksComputed ?? null;
                  const isBuy = (t as any).isBuyComputed ?? false;
                  const isSell = (t as any).isSellComputed ?? false;
                  const txBrickPrice = ((t as any).unitPriceComputed ?? property.currentBrickPrice) || 10;

                  return (
                    <tr key={t.id} className={cn("hover:bg-slate-50 transition-colors", !isValidated && "bg-slate-50/40")}>
                      <td className="px-6 py-4 text-slate-500 font-mono text-sm">{t.date}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                          isPurchaseType(t.type) ? "bg-blue-50 text-blue-600" :
                          isRevenueType(t.type) ? "bg-emerald-50 text-emerald-600" :
                          isRepaymentOrSaleType(t.type) ? "bg-indigo-50 text-indigo-600" :
                          isFeeType(t.type) ? "bg-rose-50 text-rose-600" :
                          isTaxType(t.type) ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border",
                          isValidated ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          isCancelledOrRefused ? "bg-rose-50 text-rose-700 border-rose-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {statut}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm">
                        {txBricks !== null && txBricks > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                              isBuy ? "bg-blue-50 text-blue-700 border border-blue-200" : isSell ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-800"
                            )}>
                              <Blocks size={12} className={isBuy ? "text-blue-500" : "text-amber-500"} />
                              <span>{isBuy ? `+${txBricks}` : isSell ? `-${txBricks}` : `${txBricks}`}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                              @ {formatEuro(txBrickPrice)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold",
                        amount > 0 ? "text-emerald-600" : "text-slate-900",
                        !isValidated && "line-through decoration-rose-500 decoration-2 text-slate-400 opacity-70"
                      )}>
                        {formatEuro(amount)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-700 font-mono text-sm">
                        {formatEuro(t.capitalAfter)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
