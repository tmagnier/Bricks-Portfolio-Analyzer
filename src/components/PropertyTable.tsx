import React, { useState, useMemo, useRef } from 'react';
import { PropertyStats } from '../types';
import { 
  PropertyColumnKey, 
  PROPERTY_COLUMNS, 
  DEFAULT_VISIBLE_COLUMNS 
} from '../data/columnsConfig';
import { ColumnSelector } from './ColumnSelector';
import { 
  Building2, 
  ArrowUpRight, 
  Search, 
  X, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown, 
  MapPin, 
  Blocks, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Coins,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';
import { parse } from 'date-fns';

interface PropertyTableProps {
  properties: PropertyStats[];
  totalPortfolioCapital: number;
  onSelectProperty: (property: PropertyStats) => void;
  formatEuro: (val: number) => string;
  formatPercent: (val: number) => string;
  visibleColumns: PropertyColumnKey[];
  onVisibleColumnsChange: (columns: PropertyColumnKey[]) => void;
}

export function PropertyTable({
  properties,
  totalPortfolioCapital,
  onSelectProperty,
  formatEuro,
  formatPercent,
  visibleColumns,
  onVisibleColumnsChange
}: PropertyTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<PropertyColumnKey>('currentCapital');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Drag and Drop column reordering states
  const [draggedColumn, setDraggedColumn] = useState<PropertyColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<PropertyColumnKey | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);
  const isDraggingRef = useRef(false);

  const handleSort = (field: PropertyColumnKey) => {
    if (isDraggingRef.current) return;
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Move column left or right by 1 step
  const moveColumnStep = (colKey: PropertyColumnKey, direction: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = visibleColumns.indexOf(colKey);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visibleColumns.length) return;

    const newCols = [...visibleColumns];
    const [removed] = newCols.splice(currentIndex, 1);
    newCols.splice(targetIndex, 0, removed);
    onVisibleColumnsChange(newCols);
  };

  // Drag & drop handlers for table headers
  const handleDragStart = (e: React.DragEvent, colKey: PropertyColumnKey) => {
    isDraggingRef.current = true;
    setDraggedColumn(colKey);
    e.dataTransfer.setData('text/plain', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colKey: PropertyColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedColumn || draggedColumn === colKey) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x < rect.width / 2 ? 'left' : 'right';
    setDragOverColumn(colKey);
    setDropPosition(position);
  };

  const handleDragLeave = (e: React.DragEvent, colKey: PropertyColumnKey) => {
    if (dragOverColumn === colKey) {
      setDragOverColumn(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColKey: PropertyColumnKey) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetColKey) {
      const fromIndex = visibleColumns.indexOf(draggedColumn);
      let toIndex = visibleColumns.indexOf(targetColKey);
      if (fromIndex !== -1 && toIndex !== -1) {
        const newCols = [...visibleColumns];
        const [removed] = newCols.splice(fromIndex, 1);
        toIndex = newCols.indexOf(targetColKey);
        if (dropPosition === 'right') {
          newCols.splice(toIndex + 1, 0, removed);
        } else {
          newCols.splice(toIndex, 0, removed);
        }
        onVisibleColumnsChange(newCols);
      }
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
    setDropPosition(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
    setDropPosition(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase().trim();
    return properties.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const addrFr = p.metadata?.address?.fr?.toLowerCase() || '';
      const addrEn = p.metadata?.address?.en?.toLowerCase() || '';
      const addrRaw = typeof p.metadata?.address === 'string' ? (p.metadata.address as string).toLowerCase() : '';
      const contractMatch = (p.contractType || '').toLowerCase().includes(q);
      return nameMatch || addrFr.includes(q) || addrEn.includes(q) || addrRaw.includes(q) || contractMatch;
    });
  }, [properties, searchQuery]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base', numeric: true });
          break;

        case 'contractType':
          comparison = (a.contractType || '').localeCompare(b.contractType || '', 'fr');
          break;

        case 'status': {
          const isAActive = a.currentCapital > 0.01;
          const isBActive = b.currentCapital > 0.01;
          comparison = isAActive === isBActive ? 0 : isAActive ? -1 : 1;
          break;
        }

        case 'share': {
          const valA = totalPortfolioCapital > 0 ? (a.currentCapital / totalPortfolioCapital) : 0;
          const valB = totalPortfolioCapital > 0 ? (b.currentCapital / totalPortfolioCapital) : 0;
          comparison = valA - valB;
          break;
        }

        case 'firstInvestmentDate':
        case 'firstRevenueDate':
        case 'lastRevenueDate':
        case 'expectedEndDate':
        case 'capitalZeroDate': {
          const dateStrA = a[sortField as keyof PropertyStats] as string | undefined;
          const dateStrB = b[sortField as keyof PropertyStats] as string | undefined;
          const timeA = dateStrA ? parse(dateStrA, "dd/MM/yyyy", new Date()).getTime() : 0;
          const timeB = dateStrB ? parse(dateStrB, "dd/MM/yyyy", new Date()).getTime() : 0;
          if (!timeA && !timeB) comparison = 0;
          else if (!timeA) return 1;
          else if (!timeB) return -1;
          else comparison = timeA - timeB;
          break;
        }

        case 'investmentDuration':
          comparison = (a.daysSinceLastRevenue || 0) - (b.daysSinceLastRevenue || 0);
          break;

        case 'daysBeforeFirstRevenue':
          comparison = (a.daysBeforeFirstRevenue ?? 99999) - (b.daysBeforeFirstRevenue ?? 99999);
          break;

        case 'daysSinceLastRevenue':
          comparison = (a.daysSinceLastRevenue ?? 0) - (b.daysSinceLastRevenue ?? 0);
          break;

        case 'repaymentTiming':
          comparison = (a.repaymentTimingLabel || '').localeCompare(b.repaymentTimingLabel || '', 'fr');
          break;

        default: {
          const rawA = (a as any)[sortField];
          const rawB = (b as any)[sortField];
          const valA = typeof rawA === 'number' ? rawA : Number(rawA) || 0;
          const valB = typeof rawB === 'number' ? rawB : Number(rawB) || 0;
          comparison = valA - valB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredProperties, sortField, sortDirection, totalPortfolioCapital]);

  // Lookup map for column metadata
  const columnDefsMap = useMemo(() => {
    const map = new Map<PropertyColumnKey, typeof PROPERTY_COLUMNS[0]>();
    PROPERTY_COLUMNS.forEach(c => map.set(c.id, c));
    return map;
  }, []);

  const renderSortableHeader = (columnKey: PropertyColumnKey, index: number) => {
    const colDef = columnDefsMap.get(columnKey);
    if (!colDef) return null;

    const isSorted = sortField === columnKey;
    const isBeingDragged = draggedColumn === columnKey;
    const isHoveredTarget = dragOverColumn === columnKey && draggedColumn !== columnKey;
    const label = colDef.shortLabel || colDef.label;
    const canMoveLeft = index > 0;
    const canMoveRight = index < visibleColumns.length - 1;

    return (
      <th 
        key={columnKey}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, columnKey)}
        onDragOver={(e) => handleDragOver(e, columnKey)}
        onDragLeave={(e) => handleDragLeave(e, columnKey)}
        onDrop={(e) => handleDrop(e, columnKey)}
        onDragEnd={handleDragEnd}
        onClick={() => handleSort(columnKey)}
        className={cn(
          "relative px-3.5 py-3.5 cursor-pointer select-none group whitespace-nowrap transition-all",
          isBeingDragged 
            ? "opacity-30 bg-blue-50/80 border-dashed border-2 border-blue-400" 
            : "hover:bg-slate-100/90",
          colDef.align === 'right' ? 'text-right' : colDef.align === 'center' ? 'text-center' : 'text-left'
        )}
        title={`Glisser-déposer pour déplacer • Cliquer pour trier par ${colDef.label}`}
      >
        {/* Drop indicator vertical line */}
        {isHoveredTarget && dropPosition === 'left' && (
          <span className="absolute left-0 top-1 bottom-1 w-1 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] z-30 pointer-events-none animate-pulse" />
        )}
        {isHoveredTarget && dropPosition === 'right' && (
          <span className="absolute right-0 top-1 bottom-1 w-1 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] z-30 pointer-events-none animate-pulse" />
        )}

        <div className={cn(
          "inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider",
          colDef.align === 'right' ? 'justify-end' : colDef.align === 'center' ? 'justify-center' : 'justify-start'
        )}>
          {/* Drag Handle Icon */}
          <span 
            className="text-slate-300 group-hover:text-blue-500 cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-blue-50 transition-colors"
            title="Glisser pour déplacer à gauche/droite"
          >
            <GripVertical size={13} />
          </span>

          {/* Quick nudge Left button on hover */}
          {canMoveLeft && (
            <button
              type="button"
              onClick={(e) => moveColumnStep(columnKey, 'left', e)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200/80 rounded transition-all cursor-pointer hidden md:inline-flex"
              title="Déplacer vers la gauche"
            >
              <ChevronLeft size={12} />
            </button>
          )}

          <span>{label}</span>

          {/* Quick nudge Right button on hover */}
          {canMoveRight && (
            <button
              type="button"
              onClick={(e) => moveColumnStep(columnKey, 'right', e)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200/80 rounded transition-all cursor-pointer hidden md:inline-flex"
              title="Déplacer vers la droite"
            >
              <ChevronRight size={12} />
            </button>
          )}

          {/* Sort Indicator */}
          <span className={cn(
            "transition-opacity ml-0.5",
            isSorted ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-40"
          )}>
            {isSorted ? (
              sortDirection === 'asc' ? <TrendingUp size={13} /> : <TrendingDown size={13} />
            ) : (
              <ArrowUpDown size={13} />
            )}
          </span>
        </div>
      </th>
    );
  };

  const renderCellContent = (p: PropertyStats, colKey: PropertyColumnKey) => {
    switch (colKey) {
      case 'name':
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            {p.metadata?.thumbnailUrl ? (
              <img 
                src={p.metadata.thumbnailUrl} 
                alt={p.name} 
                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                <span className="truncate max-w-[220px]" title={p.name}>{p.name}</span>
                <ArrowUpRight size={13} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              {p.metadata?.address?.fr ? (
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{p.metadata.address.fr}</span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {p.contractType || "Immobilier fractionné"}
                </div>
              )}
            </div>
          </div>
        );

      case 'contractType':
        return (
          <span className={cn(
            "px-2 py-0.5 rounded-md text-xs font-bold inline-flex items-center gap-1",
            p.isObligation
              ? "bg-purple-50 text-purple-700 border border-purple-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          )}>
            <Layers size={11} />
            <span>{p.contractType || 'Royalty'}</span>
          </span>
        );

      case 'status': {
        const isFinished = p.currentCapital <= 0.01;
        return (
          <span className={cn(
            "px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1",
            isFinished
              ? "bg-slate-100 text-slate-600 border border-slate-200"
              : p.isPaymentDelayed
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )}>
            {isFinished ? (
              <>
                <CheckCircle2 size={11} className="text-slate-500" />
                <span>Remboursé</span>
              </>
            ) : p.isPaymentDelayed ? (
              <>
                <AlertCircle size={11} className="text-amber-600" />
                <span>En cours</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>En cours</span>
              </>
            )}
          </span>
        );
      }

      case 'share': {
        const sharePct = totalPortfolioCapital > 0 ? (p.currentCapital / totalPortfolioCapital) * 100 : 0;
        return (
          <span className="font-mono text-xs text-slate-600 font-semibold">
            {formatPercent(sharePct)}
          </span>
        );
      }

      case 'firstInvestmentDate':
        return <span className="font-mono text-xs text-slate-600">{p.firstInvestmentDate || '-'}</span>;

      case 'startCapital':
        return <span className="font-medium text-slate-600 text-xs font-mono">{formatEuro(p.startCapital)}</span>;

      case 'currentCapital':
        return (
          <span className={cn(
            "font-semibold text-xs font-mono",
            p.currentCapital > 0 ? "text-slate-900" : "text-slate-400"
          )}>
            {formatEuro(p.currentCapital)}
          </span>
        );

      case 'totalInvested':
        return <span className="font-mono text-xs text-slate-700 font-medium">{formatEuro(p.totalInvested)}</span>;

      case 'capitalGain': {
        const cg = Math.round((p.capitalGain || 0) * 100) / 100;
        return (
          <span className={cn(
            "font-semibold text-xs font-mono",
            cg > 0 ? "text-emerald-600" : cg < 0 ? "text-rose-600" : "text-slate-400"
          )}>
            {cg > 0 ? '+' : ''}{formatEuro(cg)}
          </span>
        );
      }

      case 'periodSales':
        return (
          <span className="font-mono text-xs text-slate-700 font-medium">
            {p.periodSales > 0 ? formatEuro(p.periodSales) : '-'}
          </span>
        );

      case 'ownedBricks':
        return (
          <div className="flex flex-col items-end">
            <span className={cn(
              "px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold text-xs font-mono",
              p.ownedBricks > 0 
                ? "bg-amber-500/10 text-amber-900 border border-amber-500/20" 
                : "text-slate-400"
            )}>
              {p.ownedBricks > 0 && <Blocks size={12} className="text-amber-500 shrink-0" />}
              <span>{p.ownedBricks}</span>
            </span>
            {p.ownedBricks > 0 && (
              <span className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                @{formatEuro(p.currentBrickPrice)}
              </span>
            )}
          </div>
        );

      case 'currentBrickPrice':
        return <span className="font-mono text-xs text-slate-700">{formatEuro(p.currentBrickPrice)}</span>;

      case 'averageBuyBrickPrice':
        return (
          <span className="font-mono text-xs font-semibold text-slate-800">
            {p.averageBuyBrickPrice > 0 ? `${formatEuro(p.averageBuyBrickPrice)}/br.` : '-'}
          </span>
        );

      case 'costForOwnedBricks':
        return <span className="font-mono text-xs text-slate-700">{formatEuro(p.costForOwnedBricks)}</span>;

      case 'netCostForOwnedBricks':
        return <span className="font-mono text-xs text-indigo-600 font-semibold">{formatEuro(p.netCostForOwnedBricks || 0)}</span>;

      case 'netBrickPrice':
        return (
          <span className="font-mono text-xs text-indigo-700 font-semibold">
            {(p.netBrickPrice || 0) > 0 ? `${formatEuro(p.netBrickPrice || 0)}/br.` : '-'}
          </span>
        );

      case 'currentTotalValue':
        return <span className="font-mono text-xs font-bold text-slate-900">{formatEuro(p.currentTotalValue)}</span>;

      case 'latentCapitalGain': {
        const lcg = p.latentCapitalGain || 0;
        const lcgPct = p.latentCapitalGainPercent || 0;
        return (
          <div className="flex flex-col items-end">
            <span className={cn(
              "font-mono text-xs font-semibold",
              lcg > 0 ? "text-emerald-600" : lcg < 0 ? "text-rose-600" : "text-slate-400"
            )}>
              {lcg > 0 ? '+' : ''}{formatEuro(lcg)}
            </span>
            {p.costForOwnedBricks > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                ({formatPercent(lcgPct)})
              </span>
            )}
          </div>
        );
      }

      case 'netRevenues':
        return (
          <span className={cn(
            "font-semibold font-mono text-xs",
            p.netRevenues > 0 ? "text-emerald-600" : "text-slate-400"
          )}>
            {formatEuro(p.netRevenues)}
          </span>
        );

      case 'totalRevenues':
        return <span className="font-mono text-xs text-slate-700 font-medium">{formatEuro(p.totalRevenues)}</span>;

      case 'commercialAdjustments':
        return (
          <span className={cn(
            "font-mono text-xs font-medium",
            (p.commercialAdjustments || 0) > 0 ? "text-blue-600" : "text-slate-400"
          )}>
            {(p.commercialAdjustments || 0) > 0 ? formatEuro(p.commercialAdjustments || 0) : '-'}
          </span>
        );

      case 'marketplaceFees':
        return (
          <span className={cn(
            "font-mono text-xs",
            (p.marketplaceFees || 0) > 0 ? "text-rose-600" : "text-slate-400"
          )}>
            {(p.marketplaceFees || 0) > 0 ? formatEuro(p.marketplaceFees || 0) : '-'}
          </span>
        );

      case 'yield':
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden xl:block">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${Math.min(100, Math.max(0, p.yield))}%` }} 
              />
            </div>
            <span className="font-semibold text-slate-900 text-xs font-mono">{formatPercent(p.yield)}</span>
          </div>
        );

      case 'annualYield':
        return (
          <span className="font-semibold text-slate-900 text-xs font-mono">
            {formatPercent(p.annualYield)}
          </span>
        );

      case 'investmentDuration':
        return (
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
              {p.investmentDurationText || '-'}
            </span>
            {p.firstInvestmentDate && (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {p.firstInvestmentDate} → {p.capitalZeroDate || p.finalRepaymentDate || 'actuel'}
              </span>
            )}
          </div>
        );

      case 'firstRevenueDate':
        return <span className="font-mono text-xs text-slate-600">{p.firstRevenueDate || '-'}</span>;

      case 'lastRevenueDate':
        return <span className="font-mono text-xs text-slate-600">{p.lastRevenueDate || '-'}</span>;

      case 'daysBeforeFirstRevenue':
        return (
          <div className="flex flex-col items-end">
            <span className="font-mono text-xs font-semibold text-slate-800">
              {p.daysBeforeFirstRevenue !== undefined ? `${p.daysBeforeFirstRevenue} jours` : '-'}
            </span>
            {p.daysBeforeFirstRevenue !== undefined && p.daysBeforeFirstRevenue >= 30 && (
              <span className="text-[10px] text-slate-400 font-mono">
                (~{(p.daysBeforeFirstRevenue / 30.4375).toFixed(1)} mois)
              </span>
            )}
          </div>
        );

      case 'daysSinceLastRevenue':
        return (
          <div className="flex flex-col items-end">
            <span className={cn(
              "font-mono text-xs font-bold inline-flex items-center gap-1",
              p.isPaymentDelayed ? "text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" : "text-slate-600"
            )}>
              {p.isPaymentDelayed && <AlertCircle size={11} className="text-amber-600" />}
              {p.daysSinceLastRevenue !== undefined ? `${p.daysSinceLastRevenue} j.` : '-'}
            </span>
            {p.isPaymentDelayed && (
              <span className="text-[9px] font-bold text-amber-600 mt-0.5">
                Sans versement
              </span>
            )}
          </div>
        );

      case 'expectedEndDate':
        return (
          <div className="flex flex-col items-center">
            <span className="font-mono text-xs font-medium text-slate-700">
              {p.expectedEndDate || '-'}
            </span>
            {p.metadata?.investmentHorizonInMonths && (
              <span className="text-[10px] text-slate-400">
                Horizon {p.metadata.investmentHorizonInMonths} mois
              </span>
            )}
          </div>
        );

      case 'repaymentTiming': {
        const isFinished = p.currentCapital <= 0.01;
        if (isFinished) {
          if (p.repaymentTimingStatus === 'anticipation') {
            return (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>En anticipation {p.finalRepaymentDate || p.capitalZeroDate ? `(${p.finalRepaymentDate || p.capitalZeroDate})` : ''}</span>
              </span>
            );
          }
          if (p.repaymentTimingStatus === 'retard') {
            return (
              <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/80 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                <AlertCircle size={12} className="text-rose-600" />
                <span>En retard {p.finalRepaymentDate || p.capitalZeroDate ? `(${p.finalRepaymentDate || p.capitalZeroDate})` : ''}</span>
              </span>
            );
          }
          return (
            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap">
              <CheckCircle2 size={12} className="text-slate-500" />
              <span>Remboursé {p.finalRepaymentDate || p.capitalZeroDate ? `le ${p.finalRepaymentDate || p.capitalZeroDate}` : ''}</span>
            </span>
          );
        }

        if (p.expectedEndDate) {
          return (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-flex items-center gap-1 whitespace-nowrap">
              <Clock size={11} className="text-blue-600" />
              <span>Échéance : {p.expectedEndDate}</span>
            </span>
          );
        }

        return (
          <span className="text-[11px] text-slate-500 font-medium">
            En cours
          </span>
        );
      }

      case 'capitalZeroDate':
        return <span className="font-mono text-xs text-slate-600">{p.capitalZeroDate || '-'}</span>;

      default:
        return '-';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Table Toolbar Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-slate-900">Détails par Immeuble</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {sortedProperties.length} projet{sortedProperties.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Cliquez pour trier</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
              <MoveHorizontal size={13} className="text-blue-600" />
              Glissez-déposez les colonnes pour les réorganiser
            </span>
          </p>
        </div>

        {/* Action Controls: Search & Columns Customizer */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input 
              id="input-search-properties"
              type="text" 
              placeholder="Rechercher un immeuble..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                id="btn-clear-prop-search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all cursor-pointer"
                title="Effacer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Columns Selector Dropdown */}
          <ColumnSelector 
            visibleColumns={visibleColumns}
            onChange={onVisibleColumnsChange}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200/80">
              {visibleColumns.map((colKey, index) => renderSortableHeader(colKey, index))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedProperties.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-50 text-slate-400" />
                  <p className="font-semibold text-sm text-slate-700">Aucun immeuble ne correspond aux critères</p>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Effacer la recherche
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              sortedProperties.map((p) => (
                <tr 
                  key={p.name} 
                  id={`row-property-${p.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  onClick={() => onSelectProperty(p)}
                  className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                >
                  {visibleColumns.map(colKey => {
                    const colDef = columnDefsMap.get(colKey);
                    return (
                      <td 
                        key={colKey}
                        className={cn(
                          "px-4 py-3.5",
                          colDef?.align === 'right' ? 'text-right' : colDef?.align === 'center' ? 'text-center' : 'text-left'
                        )}
                      >
                        {renderCellContent(p, colKey)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer / Summary bar */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-2">
        <span>
          Affichage de <strong className="text-slate-800">{sortedProperties.length}</strong> immeuble{sortedProperties.length > 1 ? 's' : ''} sur <strong className="text-slate-800">{properties.length}</strong>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            {visibleColumns.length} colonnes actives
          </span>
        </div>
      </div>
    </div>
  );
}
