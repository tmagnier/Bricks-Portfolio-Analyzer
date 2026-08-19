import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  Check, 
  X, 
  RotateCcw, 
  Search, 
  Eye, 
  Layers, 
  Sparkles, 
  Building2, 
  TrendingUp, 
  Coins, 
  Calendar,
  CheckCheck,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  MoveVertical,
  MoveHorizontal,
  Trash2
} from 'lucide-react';
import { 
  PROPERTY_COLUMNS, 
  PropertyColumnKey, 
  COLUMN_PRESETS, 
  DEFAULT_VISIBLE_COLUMNS,
  ColumnCategory
} from '../data/columnsConfig';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ColumnSelectorProps {
  visibleColumns: PropertyColumnKey[];
  onChange: (columns: PropertyColumnKey[]) => void;
}

const CATEGORY_META: Record<ColumnCategory, { label: string; icon: React.ReactNode; color: string }> = {
  general: { label: 'Général & Portefeuille', icon: <Building2 size={14} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  capital: { label: 'Capital & Ventes', icon: <Coins size={14} />, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  bricks: { label: 'Briques & Valorisation', icon: <Layers size={14} />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  revenues: { label: 'Revenus & Rendements', icon: <TrendingUp size={14} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  dates: { label: 'Dates & Calendrier', icon: <Calendar size={14} />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export function ColumnSelector({ visibleColumns, onChange }: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'select' | 'reorder'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ColumnCategory | 'all'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Drag & drop state for the reorder list inside modal
  const [draggedModalKey, setDraggedModalKey] = useState<PropertyColumnKey | null>(null);
  const [dragOverModalKey, setDragOverModalKey] = useState<PropertyColumnKey | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleColumn = (key: PropertyColumnKey) => {
    // 'name' column can always remain or be required
    if (key === 'name' && visibleColumns.includes('name') && visibleColumns.length === 1) {
      return; // Keep at least one column
    }

    if (visibleColumns.includes(key)) {
      if (visibleColumns.length > 1) {
        onChange(visibleColumns.filter(c => c !== key));
      }
    } else {
      onChange([...visibleColumns, key]);
    }
  };

  const moveColumnModal = (colKey: PropertyColumnKey, direction: 'up' | 'down') => {
    const currentIndex = visibleColumns.indexOf(colKey);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visibleColumns.length) return;

    const newCols = [...visibleColumns];
    const [removed] = newCols.splice(currentIndex, 1);
    newCols.splice(targetIndex, 0, removed);
    onChange(newCols);
  };

  const handleModalDragStart = (e: React.DragEvent, colKey: PropertyColumnKey) => {
    setDraggedModalKey(colKey);
    e.dataTransfer.setData('text/plain', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleModalDragOver = (e: React.DragEvent, colKey: PropertyColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedModalKey && draggedModalKey !== colKey) {
      setDragOverModalKey(colKey);
    }
  };

  const handleModalDrop = (e: React.DragEvent, targetKey: PropertyColumnKey) => {
    e.preventDefault();
    if (draggedModalKey && draggedModalKey !== targetKey) {
      const fromIndex = visibleColumns.indexOf(draggedModalKey);
      const toIndex = visibleColumns.indexOf(targetKey);
      if (fromIndex !== -1 && toIndex !== -1) {
        const newCols = [...visibleColumns];
        const [removed] = newCols.splice(fromIndex, 1);
        newCols.splice(toIndex, 0, removed);
        onChange(newCols);
      }
    }
    setDraggedModalKey(null);
    setDragOverModalKey(null);
  };

  const applyPreset = (presetColumns: PropertyColumnKey[]) => {
    onChange(presetColumns);
  };

  const selectAll = () => {
    onChange(PROPERTY_COLUMNS.map(c => c.id));
  };

  const resetToDefault = () => {
    onChange(DEFAULT_VISIBLE_COLUMNS);
  };

  // Map for fast column lookup
  const columnDefsMap = useMemo(() => {
    const map = new Map<PropertyColumnKey, typeof PROPERTY_COLUMNS[0]>();
    PROPERTY_COLUMNS.forEach(c => map.set(c.id, c));
    return map;
  }, []);

  const filteredColumns = useMemo(() => {
    return PROPERTY_COLUMNS.filter(col => {
      const matchesSearch = 
        col.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        col.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (col.shortLabel && col.shortLabel.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || col.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const groupedColumns = useMemo(() => {
    const groups: Record<ColumnCategory, typeof PROPERTY_COLUMNS> = {
      general: [],
      capital: [],
      bricks: [],
      revenues: [],
      dates: [],
    };

    filteredColumns.forEach(col => {
      if (groups[col.category]) {
        groups[col.category].push(col);
      }
    });

    return groups;
  }, [filteredColumns]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        id="btn-customize-columns"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs cursor-pointer select-none",
          isOpen 
            ? "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-500/20" 
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
        )}
        title="Personnaliser et réorganiser les colonnes calculées"
      >
        <SlidersHorizontal size={14} className={isOpen ? "text-blue-600" : "text-slate-500"} />
        <span>Colonnes</span>
        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
          {visibleColumns.length}/{PROPERTY_COLUMNS.length}
        </span>
      </button>

      {/* Popover Dropdown / Mobile Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 sm:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal dialog wrapper */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="pointer-events-auto w-full max-w-[calc(100vw-24px)] sm:w-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh]"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                        <SlidersHorizontal size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Gestion des colonnes</h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Sélectionnez et réorganisez l'ordre d'affichage
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                      title="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Navigation Tabs (Select vs Reorder) */}
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTab('select')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                        activeTab === 'select'
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Eye size={13} />
                      <span>Sélection & Filtres</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reorder')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                        activeTab === 'reorder'
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <MoveHorizontal size={13} />
                      <span>Ordre gauche-droite ({visibleColumns.length})</span>
                    </button>
                  </div>

                  {/* Presets Chips (if in select tab) */}
                  {activeTab === 'select' && (
                    <div className="pt-2.5 mt-2.5 border-t border-slate-200/70">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Vues rapides :
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                        {COLUMN_PRESETS.map((preset) => {
                          const isCurrent = 
                            preset.columns.length === visibleColumns.length &&
                            preset.columns.every(col => visibleColumns.includes(col));

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyPreset(preset.columns)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap",
                                isCurrent
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                              )}
                              title={preset.description}
                            >
                              {preset.name.split(' (')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* TAB 1: Column Selection & Filters */}
                {activeTab === 'select' && (
                  <>
                    {/* Controls & Search */}
                    <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-2 bg-white shrink-0">
                      <div className="relative w-full">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Rechercher un indicateur (loyer, délai, briques...)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 font-medium"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={selectAll}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Tout ({PROPERTY_COLUMNS.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={resetToDefault}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="Rétablir les colonnes par défaut"
                        >
                          <RotateCcw size={12} />
                          <span>Défaut</span>
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="px-3 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer text-xs",
                          selectedCategory === 'all'
                            ? "bg-slate-800 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-200/60 bg-white border border-slate-200/60"
                        )}
                      >
                        Toutes ({PROPERTY_COLUMNS.length})
                      </button>
                      {(Object.keys(CATEGORY_META) as ColumnCategory[]).map((cat) => {
                        const count = PROPERTY_COLUMNS.filter(c => c.category === cat).length;
                        const activeInCat = PROPERTY_COLUMNS.filter(c => c.category === cat && visibleColumns.includes(c.id)).length;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer text-xs",
                              selectedCategory === cat
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-700 hover:bg-slate-200/60 bg-white border border-slate-200/60"
                            )}
                          >
                            <span>{CATEGORY_META[cat].label.split(' & ')[0]}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.2 rounded-md font-bold",
                              selectedCategory === cat ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                            )}>
                              {activeInCat}/{count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Columns Checkbox Grid */}
                    <div className="overflow-y-auto p-3 space-y-4 max-h-[350px] divide-y divide-slate-100">
                      {filteredColumns.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          <p>Aucune colonne ne correspond à "{searchQuery}"</p>
                        </div>
                      ) : (
                        (Object.keys(groupedColumns) as ColumnCategory[]).map((cat) => {
                          const colsInGroup = groupedColumns[cat];
                          if (colsInGroup.length === 0) return null;

                          return (
                            <div key={cat} className="pt-3 first:pt-0">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className={cn("p-1 rounded-md text-xs", CATEGORY_META[cat].color)}>
                                  {CATEGORY_META[cat].icon}
                                </span>
                                <h5 className="font-bold text-xs text-slate-700">{CATEGORY_META[cat].label}</h5>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {colsInGroup.map((col) => {
                                  const isChecked = visibleColumns.includes(col.id);
                                  const isName = col.id === 'name';

                                  return (
                                    <label
                                      key={col.id}
                                      id={`column-option-${col.id}`}
                                      className={cn(
                                        "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-left",
                                        isChecked
                                          ? "bg-blue-50/50 border-blue-200 text-slate-900 shadow-2xs"
                                          : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50/60"
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleColumn(col.id)}
                                        disabled={isName && isChecked && visibleColumns.length === 1}
                                        className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className={cn(
                                            "font-semibold text-xs truncate",
                                            isChecked ? "text-slate-900" : "text-slate-600"
                                          )}>
                                            {col.label}
                                          </span>
                                          {col.defaultVisible && (
                                            <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded font-medium shrink-0">
                                              Défaut
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-tight">
                                          {col.description}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}

                {/* TAB 2: Column Reordering (Left to Right) */}
                {activeTab === 'reorder' && (
                  <div className="p-3 flex-1 overflow-y-auto max-h-[400px]">
                    <div className="mb-3 p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-center justify-between text-xs text-blue-800">
                      <div className="flex items-center gap-2">
                        <MoveHorizontal size={15} className="text-blue-600 shrink-0" />
                        <span>Glissez-déposez les cartes ou utilisez les flèches pour changer l'ordre de gauche à droite.</span>
                      </div>
                      <button
                        type="button"
                        onClick={resetToDefault}
                        className="px-2 py-1 text-[11px] font-bold bg-white text-blue-700 hover:bg-blue-100 rounded-lg transition-colors shrink-0 shadow-2xs border border-blue-200 cursor-pointer"
                      >
                        Ordre par défaut
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {visibleColumns.map((colKey, index) => {
                        const colDef = columnDefsMap.get(colKey);
                        if (!colDef) return null;
                        const isDragging = draggedModalKey === colKey;
                        const isDragOver = dragOverModalKey === colKey;
                        const canMoveUp = index > 0;
                        const canMoveDown = index < visibleColumns.length - 1;

                        return (
                          <div
                            key={colKey}
                            draggable={true}
                            onDragStart={(e) => handleModalDragStart(e, colKey)}
                            onDragOver={(e) => handleModalDragOver(e, colKey)}
                            onDrop={(e) => handleModalDrop(e, colKey)}
                            onDragEnd={() => {
                              setDraggedModalKey(null);
                              setDragOverModalKey(null);
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border bg-white transition-all select-none group",
                              isDragging ? "opacity-30 border-dashed border-2 border-blue-400 bg-blue-50" : "hover:border-blue-300 hover:shadow-2xs",
                              isDragOver ? "border-t-2 border-t-blue-600 bg-blue-50/40" : "border-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Grab Handle */}
                              <span 
                                className="text-slate-400 group-hover:text-blue-600 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100 transition-colors"
                                title="Glisser pour déplacer"
                              >
                                <GripVertical size={15} />
                              </span>

                              {/* Index Order Badge */}
                              <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                                {index + 1}
                              </span>

                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-slate-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">{colDef.label}</span>
                                  {colDef.shortLabel && colDef.shortLabel !== colDef.label && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      ({colDef.shortLabel})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {CATEGORY_META[colDef.category].label}
                                </div>
                              </div>
                            </div>

                            {/* Move Up/Down Controls & Remove */}
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => moveColumnModal(colKey, 'up')}
                                disabled={!canMoveUp}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-colors cursor-pointer",
                                  canMoveUp 
                                    ? "text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200 bg-white" 
                                    : "text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed"
                                )}
                                title="Déplacer vers la gauche (plus tôt)"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveColumnModal(colKey, 'down')}
                                disabled={!canMoveDown}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-colors cursor-pointer",
                                  canMoveDown 
                                    ? "text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200 bg-white" 
                                    : "text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed"
                                )}
                                title="Déplacer vers la droite (plus tard)"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleColumn(colKey)}
                                disabled={colKey === 'name' && visibleColumns.length === 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer ml-1"
                                title="Masquer cette colonne"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between text-xs shrink-0">
                  <span className="text-slate-500 font-medium">
                    <strong className="text-slate-900">{visibleColumns.length}</strong> colonne{visibleColumns.length > 1 ? 's' : ''} active{visibleColumns.length > 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors cursor-pointer text-xs shadow-xs"
                  >
                    Valider & Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
