import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Transaction, 
  PropertyStats, 
  ProjectMetadata, 
  ProjectGroup, 
  isPurchaseType, 
  isRevenueType, 
  isRepaymentOrSaleType, 
  isFeeType, 
  isTaxType 
} from './types';
import { 
  calculateStats, 
  getAvailableYears, 
  getSoldeImpact, 
  parseDate, 
  getPatrimoineTimeline 
} from './services/dataService';
import * as XLSX from 'xlsx';
import { 
  startOfYear, 
  endOfYear, 
  startOfQuarter, 
  endOfQuarter, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  parse, 
  isAfter, 
  isBefore, 
  startOfDay, 
  endOfDay 
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';
import { 
  LayoutDashboard, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  FileJson,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  Percent,
  Upload,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Settings,
  Search,
  CheckCircle2,
  Coins,
  Blocks,
  LogOut,
  MapPin,
  Clock,
  Sparkles,
  ShieldAlert,
  Receipt,
  Layers,
  Briefcase
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { StatCard } from './components/StatCard';
import { FilterTab } from './components/FilterTab';
import { PropertyDetail, FilterMode } from './components/PropertyDetail';
import { ProjectNotFound } from './components/ProjectNotFound';
import { getProjectIdentifierFromUrl, findPropertyByIdOrSlug, updateProjectUrl } from './lib/router';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

type PropertySortField = 'name' | 'firstInvestmentDate' | 'startCapital' | 'currentCapital' | 'ownedBricks' | 'capitalGain' | 'netRevenues' | 'periodSales' | 'yield' | 'annualYield' | 'share';

export default function App() {
  const [rawData, setRawData] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata[]>([]);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // URL routing state
  const [activeProjectParam, setActiveProjectParam] = useState<string | null>(() => getProjectIdentifierFromUrl());
  const [selectedProperty, setSelectedProperty] = useState<PropertyStats | null>(null);

  // Search & Sorting state for Property Table
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<PropertySortField>('currentCapital');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Debounce effect for property search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchInputValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInputValue]);

  // Transaction History states
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<'all' | 'purchases' | 'revenues' | 'sales' | 'wallet' | 'taxes'>('all');
  const [txPage, setTxPage] = useState<number>(1);
  const txsPerPage = 10;

  // Filter states
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [rollingMonths, setRollingMonths] = useState<number>(12);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 0-11
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'all'>('all'); // 1-4

  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (filterMode === 'all') return { start: null, end: null };
    
    if (filterMode === 'rolling') {
      return { 
        start: startOfMonth(subMonths(now, rollingMonths)),
        end: endOfMonth(subMonths(now, 1))
      };
    }

    if (filterMode === 'calendar') {
      let start = startOfYear(new Date(selectedYear, 0, 1));
      let end = endOfYear(new Date(selectedYear, 0, 1));

      if (selectedQuarter !== 'all') {
        start = startOfQuarter(new Date(selectedYear, (selectedQuarter - 1) * 3, 1));
        end = endOfQuarter(new Date(selectedYear, (selectedQuarter - 1) * 3, 1));
      } else if (selectedMonth !== 'all') {
        start = startOfMonth(new Date(selectedYear, selectedMonth as number, 1));
        end = endOfMonth(new Date(selectedYear, selectedMonth as number, 1));
      }
      return { start, end };
    }

    return { start: null, end: null };
  }, [filterMode, rollingMonths, selectedYear, selectedMonth, selectedQuarter]);

  const processData = useCallback((data: any[]) => {
    if (Array.isArray(data)) {
      const requiredKeys = ['id', 'date', 'type', 'statut'];
      const firstItem = data[0];
      const hasKeys = firstItem && requiredKeys.every(k => k in firstItem);
      
      if (hasKeys) {
        const normalized = data.map(item => ({
          ...item,
          "montant (€)": String(item["montant (€)"] || "0"),
          "prix de la brick (€)": String(item["prix de la brick (€)"] || ""),
          date: String(item.date)
        }));
        setTransactions(normalized);
        setError(null);
        const years = getAvailableYears(normalized);
        if (years.length > 0) setSelectedYear(years[0]);
      } else {
        setError("Le fichier ne semble pas contenir les colonnes attendues (id, date, type, statut...).");
      }
    } else {
      setError("Le format des données est invalide.");
    }
  }, []);

  const processMetadata = useCallback((data: any) => {
    try {
      let flattened: ProjectMetadata[] = [];
      if (Array.isArray(data)) {
        if (data[0] && 'projects' in data[0]) {
          flattened = data.flatMap((group: ProjectGroup) => group.projects);
        } else {
          flattened = data;
        }
        setProjectMetadata(flattened);
        setError(null);
      }
    } catch (e) {
      setError("Erreur lors de l'importation de la configuration.");
    }
  }, []);

  // Auto load data.json by default if it exists in root
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data) {
          if (Array.isArray(data)) {
            const requiredKeys = ['id', 'date', 'type', 'statut'];
            if (data[0] && requiredKeys.every(k => k in data[0])) {
              processData(data);
            } else {
              processMetadata(data);
            }
            setLoadedFileName("data.json");
          }
        }
      })
      .catch(() => {
        // silent fallback if data.json is not present
      });
  }, [processData, processMetadata]);

  // Listen to browser Back / Forward events and update active project state
  useEffect(() => {
    const handleLocationChange = () => {
      const param = getProjectIdentifierFromUrl();
      setActiveProjectParam(param);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleParseText = () => {
    try {
      const parsed = JSON.parse(rawData);
      processData(parsed);
    } catch (e) {
      setError("Erreur de parsing JSON. Vérifiez le format du texte collé.");
    }
  };

  const handleFileUpload = (file: File, type: 'transactions' | 'metadata' = 'transactions') => {
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isJson = file.name.endsWith('.json');

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (isExcel && type === 'transactions') {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          processData(json);
          setLoadedFileName(file.name);
        } else if (isJson) {
          const json = JSON.parse(data as string);
          if (type === 'transactions') processData(json);
          else processMetadata(json);
          setLoadedFileName(file.name);
        } else {
          setError("Format de fichier non supporté.");
        }
      } catch (err) {
        setError("Erreur lors de la lecture du fichier.");
      }
    };

    if (isExcel) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const { properties, global } = useMemo(() => 
    calculateStats(transactions, dateRange.start, dateRange.end, projectMetadata), 
  [transactions, dateRange, projectMetadata]);

  // Synchronize active project from URL identifier whenever properties are calculated or activeProjectParam changes
  useEffect(() => {
    if (!activeProjectParam) {
      setSelectedProperty(null);
      return;
    }

    if (properties.length > 0) {
      const found = findPropertyByIdOrSlug(activeProjectParam, properties);
      setSelectedProperty(found || null);
    }
  }, [activeProjectParam, properties]);

  // Navigation handlers
  const handleSelectProperty = useCallback((property: PropertyStats) => {
    setSelectedProperty(property);
    setActiveProjectParam(property.name);
    updateProjectUrl(property.name);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setSelectedProperty(null);
    setActiveProjectParam(null);
    updateProjectUrl(null);
  }, []);

  const patrimoineTimeline = useMemo(() => 
    getPatrimoineTimeline(transactions, dateRange.start, dateRange.end),
  [transactions, dateRange]);

  const topRevenuesChartData = useMemo(() => {
    const sorted = properties
      .filter(p => p.netRevenues > 0)
      .sort((a, b) => b.netRevenues - a.netRevenues);

    if (sorted.length <= 5) {
      return sorted.map(p => ({ 
        name: p.name, 
        netRevenues: p.netRevenues,
        items: [{ name: p.name, netRevenues: p.netRevenues }]
      }));
    }

    const top5 = sorted.slice(0, 5).map(p => ({ 
      name: p.name, 
      netRevenues: p.netRevenues,
      items: [{ name: p.name, netRevenues: p.netRevenues }]
    }));
    const others = sorted.slice(5);
    const othersSum = others.reduce((acc, p) => acc + p.netRevenues, 0);

    if (othersSum > 0) {
      top5.push({ 
        name: "Autres", 
        netRevenues: othersSum,
        items: others.map(p => ({ name: p.name, netRevenues: p.netRevenues }))
      });
    }

    return top5;
  }, [properties]);

  const getTxPropertyName = useCallback((t: any): string => {
    if (!t) return "";
    const prop = t.propriété || t.property || t.immeuble || t.projet;
    if (prop && typeof prop === 'string' && prop.trim()) return prop.trim();

    if (t.type && typeof t.type === 'string' && t.type.includes(" - ")) {
      const parts = t.type.split(" - ");
      if (parts.length > 1) {
        return parts.slice(1).join(" - ").trim();
      }
    }
    return "";
  }, []);

  const findPropertyByName = useCallback((name: string): PropertyStats | undefined => {
    if (!name || !properties.length) return undefined;
    return findPropertyByIdOrSlug(name, properties);
  }, [properties]);

  const transactionsWithSolde = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const sortedAsc = transactions.map((t, originalIdx) => ({
      ...t,
      originalIdx,
      parsedDate: parseDate(t.date)
    })).sort((a, b) => {
      const diff = a.parsedDate.getTime() - b.parsedDate.getTime();
      if (diff !== 0) return diff;
      return b.originalIdx - a.originalIdx;
    });

    let runningSolde = 0;
    const soldeMap = new Map<string | number, { soldeAfter: number; impact: number }>();

    sortedAsc.forEach(t => {
      let impact = 0;
      if (t.statut === "Validée") {
        const rawVal = typeof t["montant (€)"] === "number" 
          ? t["montant (€)"] 
          : parseFloat(String(t["montant (€)"] || "0").replace(",", "."));
        if (!isNaN(rawVal)) {
          const amount = Math.abs(rawVal);
          impact = getSoldeImpact(t.type);
          runningSolde += amount * impact;
          if (runningSolde < 0) runningSolde = 0;
        }
      }
      const key = t.id || `${t.date}-${t.originalIdx}`;
      soldeMap.set(key, { soldeAfter: runningSolde, impact });
    });

    return transactions.map((t, idx) => {
      const key = t.id || `${t.date}-${idx}`;
      const res = soldeMap.get(key);
      return {
        ...t,
        originalIdx: idx,
        soldeAfter: res?.soldeAfter ?? 0,
        soldeImpact: res?.impact ?? 0
      };
    });
  }, [transactions]);

  const periodTransactions = useMemo(() => {
    return transactionsWithSolde.filter(t => {
      const tDate = parse(t.date, "dd/MM/yyyy", new Date());
      const isInRange = (!dateRange.start || isAfter(tDate, startOfDay(dateRange.start)) || tDate.getTime() === startOfDay(dateRange.start).getTime()) &&
                        (!dateRange.end || isBefore(tDate, endOfDay(dateRange.end)) || tDate.getTime() === endOfDay(dateRange.end).getTime());
      return isInRange;
    }).sort((a, b) => {
      const d1 = parse(a.date, "dd/MM/yyyy", new Date());
      const d2 = parse(b.date, "dd/MM/yyyy", new Date());
      if (d2.getTime() !== d1.getTime()) return d2.getTime() - d1.getTime();
      return (a.originalIdx ?? 0) - (b.originalIdx ?? 0);
    });
  }, [transactionsWithSolde, dateRange]);

  // Reset transaction page on filter changes
  useEffect(() => {
    setTxPage(1);
  }, [txSearchQuery, txCategoryFilter, dateRange]);

  const filteredPeriodTransactions = useMemo(() => {
    return periodTransactions.filter(t => {
      const normType = (t.type || '').toLowerCase();
      const normStatut = (t.statut || '').toLowerCase();
      const propName = getTxPropertyName(t);
      const normProp = propName.toLowerCase();
      
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase().trim();
        const matchesQuery = normType.includes(q) || normProp.includes(q) || normStatut.includes(q) || t.date.includes(q) || String(t["montant (€)"]).includes(q);
        if (!matchesQuery) return false;
      }

      if (txCategoryFilter === 'purchases') {
        return normType.includes("achat");
      }
      if (txCategoryFilter === 'revenues') {
        return (normType.includes("revenus") || normType.includes("solde boosté") || normType.includes("parrainage") || normType.includes("loyer")) && !normType.includes("revente");
      }
      if (txCategoryFilter === 'sales') {
        return normType.includes("vente") || normType.includes("remboursement") || normType.includes("revente");
      }
      if (txCategoryFilter === 'wallet') {
        return normType.includes("crédit") || normType.includes("credit") || normType.includes("dépôt") || normType.includes("depot") || normType.includes("retrait") || normType.includes("virement") || normType.includes("carte cadeau");
      }
      if (txCategoryFilter === 'taxes') {
        return normType.includes("prélèvement") || normType.includes("prelevement") || normType.includes("frais");
      }

      return true;
    });
  }, [periodTransactions, txSearchQuery, txCategoryFilter, getTxPropertyName]);

  const totalTxPages = Math.max(1, Math.ceil(filteredPeriodTransactions.length / txsPerPage));
  const paginatedTransactions = useMemo(() => {
    const startIdx = (txPage - 1) * txsPerPage;
    return filteredPeriodTransactions.slice(startIdx, startIdx + txsPerPage);
  }, [filteredPeriodTransactions, txPage]);

  const handleSort = (field: PropertySortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedProperties = useMemo(() => {
    let filtered = properties;
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      filtered = properties.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const addrFr = p.metadata?.address?.fr?.toLowerCase() || '';
        const addrEn = p.metadata?.address?.en?.toLowerCase() || '';
        const addrRaw = typeof p.metadata?.address === 'string' ? (p.metadata.address as string).toLowerCase() : '';
        const addressMatch = addrFr.includes(q) || addrEn.includes(q) || addrRaw.includes(q);
        return nameMatch || addressMatch;
      });
    }

    return [...filtered].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'firstInvestmentDate') {
        const dateA = a.firstInvestmentDate ? parse(a.firstInvestmentDate, "dd/MM/yyyy", new Date()).getTime() : 0;
        const dateB = b.firstInvestmentDate ? parse(b.firstInvestmentDate, "dd/MM/yyyy", new Date()).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [properties, sortField, sortDirection, debouncedSearchQuery]);

  const formatEuro = (val: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

  const formatPercent = (val: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);

  const formatLongDateFr = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = parse(dateStr, "dd/MM/yyyy", new Date());
    if (isNaN(d.getTime())) return dateStr;
    const monthsFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${d.getDate()} ${monthsFr[d.getMonth()]} ${d.getFullYear()}`;
  };

  const renderSortHeader = (field: PropertySortField, label: React.ReactNode) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
      >
        <div className="flex items-center gap-1.5 font-bold">
          <span>{label}</span>
          <span className={cn(
            "transition-opacity",
            isSorted ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-40"
          )}>
            {isSorted ? (
              sortDirection === 'asc' ? <TrendingUp size={14} /> : <TrendingDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </span>
        </div>
      </th>
    );
  };

  // If no transactions loaded yet
  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                <Building2 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Analyseur Bricks.co</h1>
                <p className="text-slate-500">Importez vos données pour commencer l'analyse</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                id="btn-upload-meta-initial"
                onClick={() => document.getElementById('metaInput')?.click()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                  projectMetadata.length > 0 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                <Settings size={16} />
                {projectMetadata.length > 0 ? "Config chargée" : "Charger Config (Optionnel)"}
                <input 
                  id="metaInput"
                  type="file" 
                  className="hidden" 
                  accept=".json"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'metadata')}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div 
              id="drop-zone-transactions"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group",
                isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
              )}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input 
                id="fileInput"
                type="file" 
                className="hidden" 
                accept=".json,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Déposez vos transactions</h3>
              <p className="text-sm text-slate-500 mb-4">Supporte les formats .json et .xlsx</p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <FileJson size={12} /> JSON
                </span>
                <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <FileSpreadsheet size={12} /> EXCEL
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileJson size={18} className="text-blue-600" />
                Ou collez le JSON des transactions
              </h3>
              <textarea
                id="textarea-json-paste"
                className="flex-1 min-h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-xs mb-4 transition-all resize-none"
                placeholder='[{"id": "...", "date": "...", ...}]'
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
              />
              <button
                id="btn-parse-text"
                onClick={handleParseText}
                disabled={!rawData}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                Analyser le texte
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <ArrowDownRight size={16} />
                {error}
              </div>
              <button onClick={() => setError(null)} className="hover:bg-red-100 p-1 rounded cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Active view: Error (invalid project URL), Property Detail, or Dashboard
  const isInvalidProjectUrl = activeProjectParam !== null && selectedProperty === null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {isInvalidProjectUrl ? (
            <ProjectNotFound
              key="project-not-found"
              identifier={activeProjectParam || ''}
              onBack={handleBackToDashboard}
              onSelectProperty={handleSelectProperty}
              availableProperties={properties}
            />
          ) : selectedProperty ? (
            <PropertyDetail 
              key={`detail-${selectedProperty.name}`}
              property={selectedProperty} 
              onBack={handleBackToDashboard} 
              formatEuro={formatEuro}
              formatPercent={formatPercent}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
              rollingMonths={rollingMonths}
              setRollingMonths={setRollingMonths}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              selectedQuarter={selectedQuarter}
              setSelectedQuarter={setSelectedQuarter}
              availableYears={availableYears}
            />
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Header */}
              <header className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                      <LayoutDashboard size={32} />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold tracking-tight">Mon tableau de bord bricks</h1>
                      <p className="text-slate-500 flex items-center gap-2 text-sm mt-1">
                        <Calendar size={16} />
                        <span>{transactions.length} transactions analysées</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      id="btn-load-meta-header"
                      onClick={() => document.getElementById('metaInputHeader')?.click()}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer",
                        projectMetadata.length > 0 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Settings size={15} />
                      {projectMetadata.length > 0 ? "Config OK" : "Charger Config"}
                      <input 
                        id="metaInputHeader"
                        type="file" 
                        className="hidden" 
                        accept=".json"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'metadata')}
                      />
                    </button>

                    {/* Merged File Name & Reset Control */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-semibold overflow-hidden">
                      <div className="px-3 py-2 text-slate-700 flex items-center gap-1.5 border-r border-slate-100 bg-slate-50">
                        <FileSpreadsheet size={14} className="text-blue-600" />
                        <span className="truncate max-w-[140px] sm:max-w-[200px]" title={loadedFileName || "Données importées"}>
                          {loadedFileName ? loadedFileName : "Données importées"}
                        </span>
                      </div>
                      <button 
                        id="btn-close-session"
                        onClick={() => { 
                          setTransactions([]); 
                          setProjectMetadata([]); 
                          setLoadedFileName(null); 
                          setSelectedProperty(null); 
                          setActiveProjectParam(null);
                          updateProjectUrl(null);
                        }}
                        className="px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5 font-medium group cursor-pointer"
                        title="Fermer la session"
                      >
                        <LogOut size={13} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                        <span>Fermer session</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <FilterTab active={filterMode === 'all'} onClick={() => setFilterMode('all')}>Tout</FilterTab>
                    <FilterTab active={filterMode === 'rolling'} onClick={() => setFilterMode('rolling')}>Période glissante</FilterTab>
                    <FilterTab active={filterMode === 'calendar'} onClick={() => setFilterMode('calendar')}>Calendrier</FilterTab>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {filterMode === 'rolling' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 font-medium">Derniers :</span>
                        <select 
                          id="select-rolling-months"
                          value={rollingMonths} 
                          onChange={(e) => setRollingMonths(Number(e.target.value))}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                          <span className="text-sm text-slate-500 font-medium">Année :</span>
                          <select 
                            id="select-calendar-year"
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 font-medium">Précision :</span>
                          <select 
                            id="select-calendar-precision"
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
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
              </header>

              {/* Dashboard Key Indicators & KPI Cards */}
              <div className="space-y-6 mb-8">
                {/* 1. Synthèse Patrimoine & Capital */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Patrimoine & Capital
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-4">
                    <StatCard 
                      id="card-patrimoine-total"
                      title="Patrimoine Total" 
                      value={formatEuro(global.totalCurrentBalanceAndInvestments)} 
                      icon={<Wallet className="text-blue-600" />}
                      description={`Capital (${formatEuro(global.totalCurrentCapital)}) + Solde (${formatEuro(global.currentSolde)})`}
                      badge="Global"
                    />
                    <StatCard 
                      id="card-capital-debut"
                      title="Capital (Début)" 
                      value={formatEuro(global.totalStartCapital)} 
                      icon={<Building2 className="text-slate-500" />}
                      description="Début de période"
                    />
                    <StatCard 
                      id="card-capital-fin"
                      title="Capital Investi (Fin)" 
                      value={formatEuro(global.totalCurrentCapital)} 
                      icon={<Building2 className="text-indigo-600" />}
                      description={`Sur ${global.activeProjectsCount} projet(s) actif(s)`}
                      badge={`${global.totalOwnedBricks} briques`}
                    />
                    <StatCard 
                      id="card-capital-royalties"
                      title="Capital Royalties" 
                      value={formatEuro(global.totalCurrentRoyaltyCapital)} 
                      icon={<Coins className="text-blue-600" />}
                      description={`${global.royaltyActiveProjectsCount || 0} projet(s) • ${formatPercent(global.totalCurrentCapital > 0 ? (global.totalCurrentRoyaltyCapital / global.totalCurrentCapital) * 100 : 0)} du capital`}
                      badge={`${global.royaltyOwnedBricks || 0} briques`}
                    />
                    <StatCard 
                      id="card-capital-obligations"
                      title="Capital Obligations" 
                      value={formatEuro(global.totalCurrentObligationCapital)} 
                      icon={<Percent className="text-purple-600" />}
                      description={`${global.obligationActiveProjectsCount || 0} projet(s) • ${formatPercent(global.totalCurrentCapital > 0 ? (global.totalCurrentObligationCapital / global.totalCurrentCapital) * 100 : 0)} du capital`}
                      badge={`${global.obligationOwnedBricks || 0} briques`}
                    />
                    <StatCard 
                      id="card-gain-capital"
                      title="Gain Capital" 
                      value={`${global.totalCapitalGain >= 0 ? '+' : ''}${formatEuro(global.totalCapitalGain)}`} 
                      icon={<TrendingUp className={global.totalCapitalGain >= 0 ? "text-emerald-600" : "text-rose-600"} />}
                      description="Variation sur la période"
                      trend={global.totalCapitalGain >= 0 ? "positive" : "negative"}
                    />
                    <StatCard 
                      id="card-solde-disponible"
                      title="Solde Disponible" 
                      value={formatEuro(global.currentSolde)} 
                      icon={<Coins className="text-emerald-600" />}
                      description="Trésorerie non investie"
                      trend={global.currentSolde > 0 ? "positive" : undefined}
                    />
                    <StatCard 
                      id="card-total-briques"
                      title="Briques Détenues" 
                      value={`${global.totalOwnedBricks}`} 
                      icon={<Blocks className="text-amber-600" />}
                      description="En portefeuille actuel"
                    />
                    <StatCard 
                      id="card-projets-actifs"
                      title="Projets Actifs" 
                      value={`${global.activeProjectsCount}`} 
                      icon={<Layers className="text-blue-600" />}
                      description={`${global.newProjectsCount} nouveau(x) • ${global.totalRefundedProjectsCount} remboursé(s)`}
                    />
                  </div>
                </div>

                {/* 2. Revenus & Performance Financière */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Coins size={16} className="text-amber-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Revenus & Performance
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard 
                      id="card-revenus-nets"
                      title="Revenus Nets" 
                      value={formatEuro(global.totalNetRevenues)} 
                      icon={<Coins className="text-amber-600" />}
                      description={`Royalties (${formatEuro(global.periodRoyaltyRevenues)}) + Obligations (${formatEuro(global.periodObligationRevenues)}) + Solde boosté (${formatEuro(global.periodBoostedBalance)}) + Parrainage (${formatEuro(global.periodReferralBonuses)}) + Ajustements (${formatEuro(global.periodCommercialAdjustments)})`}
                      trend={global.totalNetRevenues > 0 ? "positive" : undefined}
                    />
                    <StatCard 
                      id="card-rendement-periode"
                      title="Rendement Période" 
                      value={formatPercent(global.averageYield)} 
                      icon={<Percent className="text-emerald-600" />}
                      description="Sur total investi"
                      trend={global.averageYield > 0 ? "positive" : undefined}
                    />
                    <StatCard 
                      id="card-rendement-an"
                      title="Rendement / An" 
                      value={formatPercent(global.averageAnnualYield || 0)} 
                      icon={<TrendingUp className="text-indigo-600" />}
                      description={`Annualisé moyen depuis ${global.investmentDurationText || global.accountAgeText || 'la période'}`}
                      trend={(global.averageAnnualYield || 0) > 0 ? "positive" : undefined}
                    />
                    <StatCard 
                      id="card-loyers-royalties"
                      title="Loyers (Royalties)" 
                      value={formatEuro(global.periodRoyaltyRevenues)} 
                      icon={<Coins className="text-blue-600" />}
                      description="Revenus locatifs perçus"
                    />
                    <StatCard 
                      id="card-interets-obligations"
                      title="Intérêts (Obligations)" 
                      value={formatEuro(global.periodObligationRevenues)} 
                      icon={<Percent className="text-purple-600" />}
                      description="Coupons obligataires"
                    />
                    <StatCard 
                      id="card-ajustements-commerciaux"
                      title="Ajustements Commerciaux" 
                      value={formatEuro(global.periodCommercialAdjustments)} 
                      icon={<Sparkles className="text-amber-600" />}
                      description={`${global.periodCommercialAdjustmentsCount} ajustement(s) sur la période (Total depuis le début : ${formatEuro(global.totalCommercialAdjustments)})`}
                    />
                  </div>
                </div>

                {/* 3. Flux de Trésorerie, Fiscalité & Projets */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Flux de Trésorerie & Portefeuille
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard 
                      id="card-depots-entrees"
                      title="Ajout d'argent" 
                      value={formatEuro(global.periodCashIn)} 
                      icon={<ArrowDownLeft className="text-emerald-600" />}
                      description={`Dépôts bancaires (${formatEuro(Math.max(0, global.periodCashIn - (global.periodGiftCardsIn || 0)))}) + Cartes cadeaux (${formatEuro(global.periodGiftCardsIn || 0)})`}
                    />
                    <StatCard 
                      id="card-retraits-sorties"
                      title="Sortie d'argent" 
                      value={formatEuro(global.periodCashOut)} 
                      icon={<ArrowUpRight className="text-rose-600" />}
                      description={`Retraits bancaires (${formatEuro(global.periodBankWithdrawals)}) + Cartes cadeaux (${formatEuro(global.periodGiftCardsOut || 0)})`}
                    />
                    <StatCard 
                      id="card-ventes-remboursements"
                      title="Ventes & Rembours." 
                      value={formatEuro(global.totalPeriodSales)} 
                      icon={<Receipt className="text-indigo-600" />}
                      description="Capital & PV récupérés"
                    />
                    <StatCard 
                      id="card-frais-fiscalite"
                      title="Frais & Fiscalité" 
                      value={formatEuro(global.periodFeesAndTaxes)} 
                      icon={<ShieldAlert className="text-rose-600" />}
                      description={`Frais marketplace (${formatEuro(global.periodFees)}) + Fiscalité (${formatEuro(global.periodTaxes)})`}
                    />
                    <StatCard 
                      id="card-delai-moyen-premier-revenu"
                      title="Délai Moyen 1er Revenu" 
                      value={global.averageDaysBeforeFirstRevenue !== undefined ? `~${global.averageDaysBeforeFirstRevenue} jours` : (global.projectsWithRevenueCount ? '0 jour' : '-')} 
                      icon={<Calendar className="text-blue-600" />}
                      description={global.projectsWithRevenueCount ? `Sur ${global.projectsWithRevenueCount} projet(s) ayant versé` : 'Aucun versement'}
                    />
                    <StatCard 
                      id="card-age-du-compte"
                      title="Âge du compte" 
                      value={global.accountAgeText || global.investmentDurationText || '-'} 
                      icon={<Clock className="text-slate-600" />}
                      description={global.firstInvestmentDate ? `1er investissement le ${formatLongDateFr(global.firstInvestmentDate)}` : 'Aucun investissement'}
                    />
                  </div>
                </div>

                {/* Bricks Company Investment (si applicable) */}
                {global.hasBricksCompanyInvestment && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-900">Investissement Société Bricks</h4>
                        <p className="text-xs text-amber-700">
                          Investi : {formatEuro(global.bricksCompanyInvested || 0)} • Remboursé : {formatEuro(global.bricksCompanyRefunded || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-amber-700 font-semibold block">Encours restant</span>
                      <span className="text-lg font-bold text-amber-900 font-mono">
                        {formatEuro(global.bricksCompanyNetInvested || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Patrimoine & Solde Timeline Evolution */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp size={20} className="text-blue-600" />
                      Évolution du Patrimoine Total, Capital & Solde
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Historique mois par mois de votre valorisation globale
                    </p>
                  </div>
                </div>

                <div className="h-80">
                  {patrimoineTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={patrimoineTimeline} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="formattedDate" tickLine={false} stroke="#94a3b8" fontSize={12} />
                        <YAxis tickFormatter={(val) => `${val}€`} stroke="#94a3b8" fontSize={12} tickLine={false} />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const dateStr = payload[0]?.payload?.formattedDate || label;
                            const sortedPayload = [...payload].sort((a: any, b: any) => {
                              const order = ["Patrimoine Total", "Capital Investi", "Solde Non Investi"];
                              return order.indexOf(a.name) - order.indexOf(b.name);
                            });

                            return (
                              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xl text-xs font-medium space-y-1.5 min-w-[200px]">
                                <p className="font-bold text-slate-800 pb-1 border-b border-slate-100">Date : {dateStr}</p>
                                {sortedPayload.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || item.stroke }} />
                                      <span className="text-slate-600">{item.name} :</span>
                                    </div>
                                    <span className="font-bold font-mono text-slate-900">{formatEuro(item.value)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="patrimoine" 
                          name="Patrimoine Total" 
                          stroke="#2563eb" 
                          strokeWidth={3} 
                          dot={patrimoineTimeline.length < 30} 
                          activeDot={{ r: 6 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="capital" 
                          name="Capital Investi" 
                          stroke="#6366f1" 
                          strokeWidth={2} 
                          strokeDasharray="4 4" 
                          dot={false} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="solde" 
                          name="Solde Non Investi" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          strokeDasharray="2 2" 
                          dot={false} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                      <Coins size={28} className="text-slate-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">Aucune donnée sur cette période</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    Répartition par Immeuble (Capital)
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={properties.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" hide />
                        <YAxis tickFormatter={(val) => `${val}€`} />
                        <Tooltip 
                          allowEscapeViewBox={{ x: true, y: true }}
                          offset={15}
                          wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0];
                            const item = data?.payload as PropertyStats;
                            if (!item) return null;

                            const totalCap = global.totalCurrentCapital || properties.reduce((acc, p) => acc + p.currentCapital, 0);
                            const pct = totalCap > 0 ? (item.currentCapital / totalCap) * 100 : 0;
                            const top10 = properties.slice(0, 10);
                            const itemIndex = top10.findIndex(p => p.name === item.name);
                            const fillColor = itemIndex !== -1 ? COLORS[itemIndex % COLORS.length] : (data.fill || data.color || '#6366f1');

                            return (
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xl text-xs font-medium space-y-2.5 min-w-[250px] max-w-sm pointer-events-none select-none">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fillColor }} />
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={item.name}>
                                      {item.name}
                                    </h4>
                                  </div>
                                </div>

                                <div className="flex items-baseline justify-between gap-3 text-xs">
                                  <span className="text-slate-500 font-medium">Capital investi :</span>
                                  <div className="text-right whitespace-nowrap">
                                    <span className="font-bold font-mono text-indigo-600">{formatEuro(item.currentCapital)}</span>
                                    <span className="text-[11px] text-slate-400 font-medium ml-1.5">({formatPercent(pct)})</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-[11px]">
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="text-slate-500">Briques détenues :</span>
                                    <span className="font-semibold font-mono text-slate-800">{item.ownedBricks} brique{item.ownedBricks > 1 ? 's' : ''}</span>
                                  </div>
                                  {item.averageBuyBrickPrice > 0 && (
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-500">Prix moyen (PRU) :</span>
                                      <span className="font-semibold font-mono text-slate-800">{formatEuro(item.averageBuyBrickPrice)}/br.</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="text-slate-500">Rendement / an :</span>
                                    <span className="font-semibold font-mono text-emerald-600">{formatPercent(item.annualYield || 0)}</span>
                                  </div>
                                  {item.netRevenues > 0 && (
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-500">Revenus nets perçus :</span>
                                      <span className="font-semibold font-mono text-slate-800">{formatEuro(item.netRevenues)}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-1.5 border-t border-slate-100 text-[10px] text-indigo-500 font-medium text-center">
                                  Cliquez sur la barre pour ouvrir la fiche
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar 
                          dataKey="currentCapital" 
                          radius={[6, 6, 0, 0]} 
                          className="cursor-pointer"
                          onClick={(data) => {
                            if (data && data.name) {
                              const found = findPropertyByName(data.name);
                              if (found) handleSelectProperty(found);
                            }
                          }}
                        >
                          {properties.slice(0, 10).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <ArrowUpRight size={20} className="text-emerald-600" />
                    Top Revenus (Période)
                  </h3>
                  <div className="h-80">
                    {topRevenuesChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={topRevenuesChartData}
                            dataKey="netRevenues"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            className="cursor-pointer"
                            onClick={(data) => {
                              if (data && data.name && data.name !== "Autres") {
                                const found = findPropertyByName(data.name);
                                if (found) handleSelectProperty(found);
                              }
                            }}
                          >
                            {topRevenuesChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                          </Pie>
                          <Tooltip 
                            allowEscapeViewBox={{ x: true, y: true }}
                            offset={15}
                            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const data = payload[0];
                              const item = data?.payload;
                              if (!item) return null;

                              const isOthers = item.name === "Autres" || item.name === "Autre";
                              const totalRev = global.totalNetRevenues || topRevenuesChartData.reduce((acc, it) => acc + it.netRevenues, 0);
                              const pct = totalRev > 0 ? (item.netRevenues / totalRev) * 100 : 0;
                              const sliceIndex = topRevenuesChartData.findIndex(it => it.name === item.name);
                              const fillColor = sliceIndex !== -1 ? COLORS[sliceIndex % COLORS.length] : (data.fill || data.color || '#10b981');

                              return (
                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xl text-xs font-medium space-y-2 min-w-[240px] max-w-sm pointer-events-none select-none">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fillColor }} />
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={item.name}>
                                        {isOthers ? `Autres (${item.items?.length || 0} projets)` : item.name}
                                      </h4>
                                    </div>
                                  </div>

                                  <div className="flex items-baseline justify-between gap-3 text-xs">
                                    <span className="text-slate-500 font-medium">Revenus nets :</span>
                                    <div className="text-right whitespace-nowrap">
                                      <span className="font-bold font-mono text-emerald-600">{formatEuro(item.netRevenues)}</span>
                                      <span className="text-[11px] text-slate-400 font-medium ml-1.5">({formatPercent(pct)})</span>
                                    </div>
                                  </div>

                                  {isOthers && item.items && item.items.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                                        <span>Détail ({item.items.length} projets) :</span>
                                        <span className="text-[10px] text-slate-400 font-mono">{formatPercent(pct)} du total</span>
                                      </div>
                                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1 text-xs">
                                        {item.items.map((sub: any, idx: number) => {
                                          const subPct = totalRev > 0 ? (sub.netRevenues / totalRev) * 100 : 0;
                                          return (
                                            <div key={idx} className="flex items-center justify-between gap-3 py-1 px-1.5 rounded-lg bg-slate-50/60 border border-slate-100/80">
                                              <span className="text-slate-700 font-medium truncate max-w-[150px]" title={sub.name}>
                                                {sub.name}
                                              </span>
                                              <div className="text-right whitespace-nowrap flex items-center gap-1.5 flex-shrink-0">
                                                <span className="font-semibold font-mono text-slate-900">{formatEuro(sub.netRevenues)}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">({formatPercent(subPct)})</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                        <div className="p-3 bg-amber-50 text-amber-500 rounded-full mb-3">
                          <Coins size={24} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Aucun revenu sur cette période</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                          Aucun loyer ou gain n'a été perçu entre les dates sélectionnées.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Property Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Détails par Immeuble</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {debouncedSearchQuery.trim() ? `${sortedProperties.length} / ${properties.length} immeuble(s)` : `${properties.length} immeuble(s)`} • Cliquez sur une en-tête pour trier
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input 
                      id="input-search-properties"
                      type="text" 
                      placeholder="Rechercher un immeuble..."
                      value={searchInputValue}
                      onChange={(e) => setSearchInputValue(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    />
                    {searchInputValue && (
                      <button 
                        id="btn-clear-prop-search"
                        onClick={() => {
                          setSearchInputValue('');
                          setDebouncedSearchQuery('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all cursor-pointer"
                        title="Effacer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                        {renderSortHeader('name', 'Immeuble')}
                        {renderSortHeader('firstInvestmentDate', '1er Achat')}
                        {renderSortHeader('startCapital', 'Capital (Début)')}
                        {renderSortHeader('currentCapital', 'Capital (Fin)')}
                        {renderSortHeader('ownedBricks', <span className="inline-flex items-center gap-1.5"><Blocks size={13} className="text-amber-500" /> Briques</span>)}
                        {renderSortHeader('capitalGain', 'Gain Capital')}
                        {renderSortHeader('netRevenues', 'Revenus Nets')}
                        {renderSortHeader('periodSales', 'Ventes')}
                        {renderSortHeader('yield', 'Rendement Total')}
                        {renderSortHeader('annualYield', 'Rendement / An')}
                        {renderSortHeader('share', 'Part')}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedProperties.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                            <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="font-medium text-sm">Aucun immeuble ne correspond à "{searchInputValue || debouncedSearchQuery}"</p>
                            <button 
                              onClick={() => {
                                setSearchInputValue('');
                                setDebouncedSearchQuery('');
                              }}
                              className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                            >
                              Effacer la recherche
                            </button>
                          </td>
                        </tr>
                      ) : (
                        sortedProperties.map((p) => (
                        <tr 
                          key={p.name} 
                          id={`row-property-${p.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          onClick={() => handleSelectProperty(p)}
                          className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {p.metadata?.thumbnailUrl && (
                                <img 
                                  src={p.metadata.thumbnailUrl} 
                                  alt={p.name} 
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div>
                                <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                  <span>{p.name}</span>
                                  <ArrowUpRight size={13} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                                {p.metadata?.address && (
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin size={10} />
                                    {p.metadata.address.fr}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                            {p.firstInvestmentDate || '-'}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600 text-sm">{formatEuro(p.startCapital)}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900 text-sm">{formatEuro(p.currentCapital)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-800 font-mono">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 border border-amber-500/20 inline-flex items-center gap-1 font-bold text-xs">
                                  <Blocks size={13} className="text-amber-500 shrink-0" />
                                  <span>{p.ownedBricks}</span>
                                </span>
                              </div>
                              {p.ownedBricks > 0 && (
                                <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                                  @{formatEuro(p.currentBrickPrice)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-sm">
                            {(() => {
                              const cg = Math.round((p.capitalGain || 0) * 100) / 100;
                              return (
                                <span className={cn(
                                  cg > 0 ? "text-emerald-600 font-semibold" : cg < 0 ? "text-rose-600" : "text-slate-400"
                                )}>
                                  {cg > 0 ? '+' : ''}{formatEuro(cg)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={cn(
                              "font-semibold",
                              p.netRevenues > 0 ? "text-emerald-600" : "text-slate-400"
                            )}>
                              {formatEuro(p.netRevenues)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                            {p.periodSales > 0 ? formatEuro(p.periodSales) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden xl:block">
                                <div 
                                  className="h-full bg-blue-500" 
                                  style={{ width: `${Math.min(100, Math.max(0, p.yield))}%` }} 
                                />
                              </div>
                              <span className="font-semibold text-slate-900 text-sm">{formatPercent(p.yield)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900 text-sm">
                            {formatPercent(p.annualYield)}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                            {(() => {
                              const totalCap = global.totalCurrentCapital || properties.reduce((acc, item) => acc + item.currentCapital, 0);
                              const sharePct = totalCap > 0 ? (p.currentCapital / totalCap) * 100 : 0;
                              return formatPercent(sharePct);
                            })()}
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions Global History Table */}
              <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Historique des Transactions (Période)</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {filteredPeriodTransactions.length} transaction(s) • Suivi chronologique avec solde calculé
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Category Filter Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        id="btn-tx-cat-all"
                        onClick={() => setTxCategoryFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'all' ? "bg-white text-slate-900 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Toutes
                      </button>
                      <button
                        id="btn-tx-cat-purchases"
                        onClick={() => setTxCategoryFilter('purchases')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'purchases' ? "bg-white text-blue-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Achats
                      </button>
                      <button
                        id="btn-tx-cat-revenues"
                        onClick={() => setTxCategoryFilter('revenues')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'revenues' ? "bg-white text-emerald-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Revenus
                      </button>
                      <button
                        id="btn-tx-cat-sales"
                        onClick={() => setTxCategoryFilter('sales')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'sales' ? "bg-white text-purple-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Ventes
                      </button>
                      <button
                        id="btn-tx-cat-wallet"
                        onClick={() => setTxCategoryFilter('wallet')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'wallet' ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Mouvements Solde
                      </button>
                      <button
                        id="btn-tx-cat-taxes"
                        onClick={() => setTxCategoryFilter('taxes')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          txCategoryFilter === 'taxes' ? "bg-white text-rose-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Prélèvements & Frais
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full md:w-56">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        id="input-search-transactions"
                        type="text" 
                        placeholder="Filtrer transactions..."
                        value={txSearchQuery}
                        onChange={(e) => setTxSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                      {txSearchQuery && (
                        <button 
                          id="btn-clear-tx-search"
                          onClick={() => setTxSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all cursor-pointer"
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
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Statut</th>
                        <th className="px-6 py-3">Immeuble</th>
                        <th className="px-6 py-3 text-right">Montant</th>
                        <th className="px-6 py-3 text-right">Solde Après</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                            Aucune transaction ne correspond aux filtres appliqués.
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((tx, idx) => {
                          const amtVal = typeof tx["montant (€)"] === "number" ? tx["montant (€)"] : parseFloat(String(tx["montant (€)"] || "0").replace(",", "."));
                          const normType = (tx.type || '').toLowerCase();
                          const propName = getTxPropertyName(tx);
                          const isRevenue = isRevenueType(tx.type);
                          const isPurchase = isPurchaseType(tx.type);
                          const isSale = isRepaymentOrSaleType(tx.type);
                          const isTax = isTaxType(tx.type);
                          const isCommercialAdj = normType.includes("ajustement commercial");
                          const isSoldeBooste = normType.includes("solde boosté") || normType.includes("solde booste");
                          const statut = tx.statut || "Validée";
                          const normStatut = statut.toLowerCase();
                          const isValidated = normStatut === "validée" || normStatut === "validee";
                          const isCancelledOrRefused = normStatut.includes("refus") || normStatut.includes("annul");

                          return (
                            <tr key={tx.id || `${tx.date}-${idx}`} className={cn("hover:bg-slate-50/80 transition-colors", !isValidated && "bg-slate-50/40")}>
                              <td className="px-6 py-3 text-xs font-mono text-slate-500">{tx.date}</td>
                              <td className="px-6 py-3 text-xs">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border font-medium",
                                  isCommercialAdj ? "bg-amber-50 text-amber-800 border-amber-200" :
                                  isRevenue ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                  isSoldeBooste ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                                  isPurchase ? "bg-blue-50 text-blue-700 border-blue-100" :
                                  isSale ? "bg-purple-50 text-purple-700 border-purple-100" :
                                  isTax ? "bg-rose-50 text-rose-700 border-rose-100" :
                                  "bg-slate-50 text-slate-700 border-slate-200"
                                )}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border",
                                  isValidated ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  isCancelledOrRefused ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {statut}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs font-semibold text-slate-800">
                                {propName ? (
                                  <button 
                                    onClick={() => {
                                      const targetProp = findPropertyByName(propName);
                                      if (targetProp) handleSelectProperty(targetProp);
                                    }}
                                    className={cn(
                                      "text-left transition-colors inline-flex items-center gap-1 group/btn",
                                      findPropertyByName(propName) 
                                        ? "text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer" 
                                        : "text-slate-800 cursor-default"
                                    )}
                                    title={findPropertyByName(propName) ? "Voir le détail de cet immeuble" : undefined}
                                  >
                                    <span>{propName}</span>
                                    {findPropertyByName(propName) && (
                                      <ArrowUpRight size={12} className="text-blue-500 opacity-70 group-hover/btn:opacity-100 transition-opacity shrink-0" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">Compte Bricks (Solde)</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-xs font-bold text-right font-mono">
                                <span className={cn(
                                  isRevenue || isSale ? "text-emerald-600" : isPurchase || isTax ? "text-slate-800" : "text-slate-700",
                                  !isValidated && "line-through decoration-rose-500 decoration-2 text-slate-400 opacity-70"
                                )}>
                                  {isRevenue || isSale ? '+' : isTax ? '-' : ''}{formatEuro(amtVal)}
                                </span>
                              </td>
                              <td className={cn("px-6 py-3 text-xs font-bold text-right font-mono", !isValidated ? "text-slate-400 font-normal" : "text-slate-700")}>
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <span>{formatEuro(tx.soldeAfter ?? 0)}</span>
                                  {isValidated && tx.soldeImpact > 0 && (
                                    <span className="p-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0" title="Solde en hausse (+)">
                                      <TrendingUp size={13} />
                                    </span>
                                  )}
                                  {isValidated && tx.soldeImpact < 0 && (
                                    <span className="p-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0" title="Solde en baisse (-)">
                                      <TrendingDown size={13} />
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalTxPages > 1 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Page {txPage} sur {totalTxPages} ({filteredPeriodTransactions.length} transactions)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        id="btn-tx-prev-page"
                        disabled={txPage === 1}
                        onClick={() => setTxPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Précédent</span>
                      </button>
                      <button
                        id="btn-tx-next-page"
                        disabled={txPage === totalTxPages}
                        onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Suivant</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
