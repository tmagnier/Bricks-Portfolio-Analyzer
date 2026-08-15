import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, 
  ArrowLeft, 
  SearchX, 
  Search, 
  MapPin, 
  ArrowUpRight,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { PropertyStats } from '../types';

export interface ProjectNotFoundProps {
  key?: React.Key;
  identifier: string;
  onBack: () => void;
  onSelectProperty?: (property: PropertyStats) => void;
  availableProperties?: PropertyStats[];
}

export function ProjectNotFound({
  identifier,
  onBack,
  onSelectProperty,
  availableProperties = []
}: ProjectNotFoundProps) {
  const [searchFilter, setSearchFilter] = useState('');

  const filteredProperties = availableProperties.filter(p => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    const nameMatch = p.name.toLowerCase().includes(q);
    const addrFr = p.metadata?.address?.fr?.toLowerCase() || '';
    const addrEn = p.metadata?.address?.en?.toLowerCase() || '';
    return nameMatch || addrFr.includes(q) || addrEn.includes(q);
  });

  const formatEuro = (val: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <motion.div
      id="project-not-found-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-8"
    >
      {/* Top back button */}
      <button 
        id="btn-back-dashboard-top"
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium self-start cursor-pointer group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>Retour au tableau de bord</span>
      </button>

      {/* Main Error Card */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200 text-center relative overflow-hidden">
        {/* Subtle Background Accent */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
          {/* Icon Badge */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center text-amber-600 shadow-inner">
              <SearchX size={38} strokeWidth={1.75} />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-rose-500 text-white rounded-full shadow">
              <HelpCircle size={14} />
            </div>
          </div>

          <span className="px-3 py-1 bg-amber-100/70 text-amber-800 text-xs font-bold rounded-full mb-3 border border-amber-200">
            Erreur 404 • Projet Inconnu
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
            Projet ou immeuble introuvable
          </h1>

          <p className="text-slate-600 text-sm sm:text-base mb-2 leading-relaxed">
            L'URL demandée ne correspond à aucun projet connu dans vos données importées :
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs sm:text-sm font-mono text-slate-700 font-semibold mb-6 max-w-full truncate">
            « {identifier} »
          </div>

          <p className="text-xs text-slate-400 mb-8 max-w-md">
            Il est possible que le nom du projet soit mal orthographié, ou que vos données de transactions n'incluent pas encore cet investissement.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="btn-return-dashboard-main"
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span>Revenir au tableau de bord</span>
            </button>
          </div>
        </div>
      </div>

      {/* Available Projects Suggestions if any */}
      {availableProperties.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <FolderOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Projets disponibles dans vos données ({availableProperties.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Sélectionnez un projet existant pour ouvrir sa fiche détaillée
                </p>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="search-available-projects-input"
                type="text"
                placeholder="Chercher parmi vos projets..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredProperties.slice(0, 12).map((prop) => (
              <button
                key={prop.name}
                id={`btn-select-suggested-${prop.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                type="button"
                onClick={() => onSelectProperty ? onSelectProperty(prop) : onBack()}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group cursor-pointer"
              >
                {prop.metadata?.thumbnailUrl ? (
                  <img
                    src={prop.metadata.thumbnailUrl}
                    alt={prop.name}
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 shrink-0">
                    <Building2 size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {prop.name}
                  </div>
                  {prop.metadata?.address?.fr ? (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{prop.metadata.address.fr}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {formatEuro(prop.currentCapital)}
                    </div>
                  )}
                </div>
                <ArrowUpRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
