import React from 'react';
import { 
  Filter, 
  Layers, 
  Coins, 
  CheckCircle2, 
  Clock, 
  Building2, 
  X, 
  RotateCcw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';

export type ContractFilterType = 
  | 'all' 
  | 'royalties_only' 
  | 'obligations_only' 
  | 'exclude_royalties' 
  | 'exclude_obligations';

export type ReimbursementFilterType = 
  | 'all' 
  | 'active_only' 
  | 'refunded_only';

interface GlobalTopFiltersProps {
  contractFilter: ContractFilterType;
  onContractFilterChange: (val: ContractFilterType) => void;
  reimbursementFilter: ReimbursementFilterType;
  onReimbursementFilterChange: (val: ReimbursementFilterType) => void;
  totalPropertiesCount: number;
  filteredPropertiesCount: number;
  royaltyCount: number;
  obligationCount: number;
  activeCount: number;
  refundedCount: number;
}

export function GlobalTopFilters({
  contractFilter,
  onContractFilterChange,
  reimbursementFilter,
  onReimbursementFilterChange,
  totalPropertiesCount,
  filteredPropertiesCount,
  royaltyCount,
  obligationCount,
  activeCount,
  refundedCount
}: GlobalTopFiltersProps) {
  const isFiltered = contractFilter !== 'all' || reimbursementFilter !== 'all';

  const handleReset = () => {
    onContractFilterChange('all');
    onReimbursementFilterChange('all');
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Filter size={15} className="text-blue-600" />
          <span>Filtres Immeubles :</span>
        </div>

        {/* 1. Type de Contrat Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">Contrat :</span>
          <div className="relative">
            <select
              id="select-contract-filter"
              value={contractFilter}
              onChange={(e) => onContractFilterChange(e.target.value as ContractFilterType)}
              className={cn(
                "pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold transition-all outline-none border cursor-pointer appearance-none",
                contractFilter !== 'all'
                  ? "bg-blue-50/80 border-blue-300 text-blue-800 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
              )}
            >
              <option value="all">Tous les types (Royalties & Obligations)</option>
              <option value="royalties_only">Royalties uniquement ({royaltyCount})</option>
              <option value="obligations_only">Obligations uniquement ({obligationCount})</option>
              <option value="exclude_royalties">Masquer les Royalties (Sans Royalties)</option>
              <option value="exclude_obligations">Masquer les Obligations (Sans Obligations)</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Layers size={13} />
            </div>
          </div>
        </div>

        {/* 2. Statut Remboursement Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">Statut :</span>
          <div className="relative">
            <select
              id="select-reimbursement-filter"
              value={reimbursementFilter}
              onChange={(e) => onReimbursementFilterChange(e.target.value as ReimbursementFilterType)}
              className={cn(
                "pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold transition-all outline-none border cursor-pointer appearance-none",
                reimbursementFilter !== 'all'
                  ? "bg-indigo-50/80 border-indigo-300 text-indigo-800 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
              )}
            >
              <option value="all">Tous les statuts (En cours & Remboursés)</option>
              <option value="active_only">En cours uniquement ({activeCount})</option>
              <option value="refunded_only">Totalement remboursés ({refundedCount})</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <CheckCircle2 size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Status Badge & Reset Button */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5",
            isFiltered ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-600"
          )}>
            <Building2 size={13} className={isFiltered ? "text-amber-600" : "text-slate-400"} />
            <span>{filteredPropertiesCount} / {totalPropertiesCount} immeuble{totalPropertiesCount > 1 ? 's' : ''}</span>
          </span>
        </div>

        {isFiltered && (
          <button
            id="btn-reset-top-filters"
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Réinitialiser tous les filtres d'immeubles"
          >
            <RotateCcw size={12} />
            <span>Réinitialiser</span>
          </button>
        )}
      </div>
    </div>
  );
}
