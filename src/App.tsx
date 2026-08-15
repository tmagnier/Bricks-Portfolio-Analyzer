import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Transaction, PropertyStats, ProjectMetadata, ProjectGroup, PropertyTimelinePoint, TransactionType, isPurchaseType, isRevenueType, isRepaymentOrSaleType, isFeeType, isTaxType, normalizeTransactionType } from './types';
import { calculateStats, getAvailableYears, getSoldeImpact, parseDate, getPatrimoineTimeline, getPropertyTimeline } from './services/dataService';
import * as XLSX from 'xlsx';
import { startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, subMonths, subYears, parse, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, ComposedChart
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
  Percent,
  Upload,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  ArrowLeft,
  Info,
  History,
  MapPin,
  Clock,
  ExternalLink,
  Settings,
  Search,
  Sparkles,
  CheckCircle2,
  PiggyBank,
  Coins,
  Blocks,
  Download,
  FileText,
  LogOut,
  Receipt,
  HeartHandshake
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

type FilterMode = 'all' | 'rolling' | 'calendar';
type PropertySortField = 'name' | 'firstInvestmentDate' | 'startCapital' | 'currentCapital' | 'ownedBricks' | 'capitalGain' | 'netRevenues' | 'periodSales' | 'yield' | 'annualYield' | 'share';

export default function App() {
  const [rawData, setRawData] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata[]>([]);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
        // Check if it's the grouped format [ { yearMonthDate, projects: [] }, ... ]
        if (data[0] && 'projects' in data[0]) {
          flattened = data.flatMap((group: ProjectGroup) => group.projects);
        } else {
          // Assume it's already a flat list of projects
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

  // Sync selectedProperty when properties recalculated (e.g. date filter changes)
  useEffect(() => {
    if (selectedProperty) {
      const updated = properties.find(p => p.name === selectedProperty.name);
      if (updated) {
        setSelectedProperty(updated);
      }
    }
  }, [properties]);

  const patrimoineTimeline = useMemo(() => 
    getPatrimoineTimeline(transactions, dateRange.start, dateRange.end),
  [transactions, dateRange]);

  const topRevenuesChartData = useMemo(() => {
    const sorted = properties
      .filter(p => p.netRevenues > 0)
      .sort((a, b) => b.netRevenues - a.netRevenues);

    if (sorted.length <= 5) {
      return sorted.map(p => ({ name: p.name, netRevenues: p.netRevenues }));
    }

    const top5 = sorted.slice(0, 5).map(p => ({ name: p.name, netRevenues: p.netRevenues }));
    const othersSum = sorted.slice(5).reduce((acc, p) => acc + p.netRevenues, 0);

    if (othersSum > 0) {
      top5.push({ name: "Autres", netRevenues: othersSum });
    }

    return top5;
  }, [properties]);

  const getTxPropertyName = useCallback((t: any): string => {
    if (!t) return "";
    const prop = t.propriété || t.property || t.immeuble || t.projet;
    if (prop && typeof prop === 'string' && prop.trim()) return prop.trim();

    // Extract property name from type string if structured as "Revenus reversés - Property Name"
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
    const cleanName = name.trim().toLowerCase();
    
    // 1. Exact match
    let match = properties.find(p => p.name.trim().toLowerCase() === cleanName);
    if (match) return match;
    
    // 2. Substring or inclusive match
    match = properties.find(p => {
      const pName = p.name.trim().toLowerCase();
      return pName.includes(cleanName) || cleanName.includes(pName);
    });
    if (match) return match;
    
    // 3. Normalized string match without accents/punctuation
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normClean = normalize(cleanName);
    if (normClean) {
      match = properties.find(p => {
        const normP = normalize(p.name);
        return normP.includes(normClean) || normClean.includes(normP);
      });
    }
    return match;
  }, [properties]);

  const transactionsWithSolde = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Sort ALL transactions chronologically ascending (oldest first)
    // In the imported transactions file, index 0 is newest (top) and index N-1 is oldest (bottom).
    // For same-date transactions, higher originalIdx means older (happened first).
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
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'firstInvestmentDate':
          aVal = a.firstInvestmentDate ? parse(a.firstInvestmentDate, "dd/MM/yyyy", new Date()).getTime() : 0;
          bVal = b.firstInvestmentDate ? parse(b.firstInvestmentDate, "dd/MM/yyyy", new Date()).getTime() : 0;
          break;
        case 'startCapital':
          aVal = a.startCapital;
          bVal = b.startCapital;
          break;
        case 'currentCapital':
          aVal = a.currentCapital;
          bVal = b.currentCapital;
          break;
        case 'ownedBricks':
          aVal = a.ownedBricks;
          bVal = b.ownedBricks;
          break;
        case 'capitalGain':
          aVal = a.capitalGain;
          bVal = b.capitalGain;
          break;
        case 'netRevenues':
          aVal = a.netRevenues;
          bVal = b.netRevenues;
          break;
        case 'periodSales':
          aVal = a.periodSales;
          bVal = b.periodSales;
          break;
        case 'yield':
          aVal = a.yield;
          bVal = b.yield;
          break;
        case 'annualYield':
          aVal = a.annualYield;
          bVal = b.annualYield;
          break;
        case 'share':
          aVal = global.totalCurrentCapital > 0 ? a.currentCapital / global.totalCurrentCapital : 0;
          bVal = global.totalCurrentCapital > 0 ? b.currentCapital / global.totalCurrentCapital : 0;
          break;
        default:
          aVal = a.currentCapital;
          bVal = b.currentCapital;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [properties, debouncedSearchQuery, sortField, sortDirection, global.totalCurrentCapital]);

  const renderSortHeader = (field: PropertySortField, label: React.ReactNode) => {
    const isActive = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? <ChevronUp size={14} className="text-blue-600 font-bold" /> : <ChevronDown size={14} className="text-blue-600 font-bold" />
          ) : (
            <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  const formatEuro = (val: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

  const formatPercent = (val: number) => 
    val.toFixed(2) + '%';

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl text-white">
                <LayoutDashboard size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Analyseur Bricks.co</h1>
                <p className="text-slate-500">Importez vos données pour commencer l'analyse</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => document.getElementById('metaInput')?.click()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
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
                className="flex-1 min-h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-xs mb-4 transition-all resize-none"
                placeholder='[{"id": "...", "date": "...", ...}]'
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
              />
              <button
                onClick={handleParseText}
                disabled={!rawData}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
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
              <button onClick={() => setError(null)} className="hover:bg-red-100 p-1 rounded">
                <X size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {!selectedProperty ? (
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
                      onClick={() => document.getElementById('metaInputHeader')?.click()}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm",
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
                        onClick={() => { setTransactions([]); setProjectMetadata([]); setLoadedFileName(null); setSelectedProperty(null); }}
                        className="px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5 font-medium group"
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

              {/* Global Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                <StatCard 
                  title="Capital Total" 
                  value={formatEuro(global.totalCurrentBalanceAndInvestments)} 
                  icon={<Coins className="text-blue-600" />}
                  description={`Solde (${formatEuro(global.currentSolde)}) + Encours (${formatEuro(global.totalCurrentCapital)})`}
                />
                <StatCard 
                  title="Gain Capital" 
                  value={`${global.totalCapitalGain >= 0 ? '+' : ''}${formatEuro(global.totalCapitalGain)}`} 
                  icon={<TrendingUp className={global.totalCapitalGain >= 0 ? "text-emerald-600" : "text-rose-600"} />}
                  description="Variation sur la période"
                  trend={global.totalCapitalGain >= 0 ? "positive" : "negative"}
                />
                <StatCard 
                  title="Investissements en cours" 
                  value={formatEuro(global.totalCurrentCapital)} 
                  icon={<Building2 className="text-indigo-600" />}
                  badge={`${(global.totalOwnedBricks || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} bricks`}
                  description={`avec ${(global.totalOwnedBricks || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} bricks sur ${global.activeProjectsCount} projet${global.activeProjectsCount > 1 ? 's' : ''}`}
                />
                <StatCard 
                  title="1er Investissement" 
                  value={global.firstInvestmentDate || "-"} 
                  icon={<Calendar className="text-blue-600" />}
                  badge={global.accountAgeText ? `${global.accountAgeText}` : undefined}
                  description={
                    global.accountAgeText 
                      ? `Âge du compte : ${global.accountAgeText}` 
                      : "Date du 1er achat / investissement"
                  }
                />
                {global.averageDaysBeforeFirstRevenue !== undefined && (
                  <StatCard 
                    title="Délai Moyen 1er Revenu" 
                    value={`${global.averageDaysBeforeFirstRevenue} jours`} 
                    icon={<Clock className="text-amber-600" />}
                    badge={
                      global.averageDaysBeforeFirstRevenue >= 25
                        ? `~${(global.averageDaysBeforeFirstRevenue / 30.4).toFixed(1)} mois`
                        : undefined
                    }
                    description={
                      global.projectsWithRevenueCount && global.projectsWithRevenueCount > 0
                        ? `Moyenne sur ${global.projectsWithRevenueCount} projet${global.projectsWithRevenueCount > 1 ? 's' : ''}`
                        : "Délai moyen constaté avant 1er versement"
                    }
                  />
                )}
                {global.hasBricksCompanyInvestment && (
                  <StatCard 
                    title="Investissement Société Bricks" 
                    value={formatEuro(global.bricksCompanyNetInvested || 0)} 
                    icon={<Building2 className="text-purple-600" />}
                    description={
                      (global.bricksCompanyRefunded || 0) > 0
                        ? `Investi : ${formatEuro(global.bricksCompanyInvested || 0)} - Remboursé : ${formatEuro(global.bricksCompanyRefunded || 0)}`
                        : "Investissement capital dans la société Bricks"
                    }
                  />
                )}
                <StatCard 
                  title="Solde non investi" 
                  value={formatEuro(global.currentSolde)} 
                  icon={<PiggyBank className="text-emerald-600" />}
                  description="Disponible sur votre compte"
                />
                <StatCard 
                  title="Ajout d'argent" 
                  value={formatEuro(global.periodCashIn)} 
                  icon={<Wallet className="text-emerald-600" />}
                  description={
                    (global.periodCashIn > 0 || global.periodGiftCardsIn > 0) ? (
                      `Dépôts bancaires (${formatEuro(global.periodCashIn - global.periodGiftCardsIn)}) + Cartes cadeaux (${formatEuro(global.periodGiftCardsIn)})`
                    ) : (
                      "Dépôts & crédits sur la période"
                    )
                  }
                  trend={global.periodCashIn > 0 ? "positive" : undefined}
                />
                <StatCard 
                  title="Sortie d'argent" 
                  value={formatEuro(global.periodCashOut)} 
                  icon={<LogOut className="text-rose-600" />}
                  description={
                    (global.periodBankWithdrawals > 0 || global.periodGiftCardsOut > 0) ? (
                      `Retraits bancaires (${formatEuro(global.periodBankWithdrawals)}) + Cartes cadeaux (${formatEuro(global.periodGiftCardsOut)})`
                    ) : (
                      "Retraits & cartes cadeaux sur la période"
                    )
                  }
                  trend={global.periodCashOut > 0 ? "negative" : undefined}
                />
                <StatCard 
                  title="1ère participation (Période)" 
                  value={`${global.newProjectsCount} nouveau(x) projet(s)`} 
                  icon={<Sparkles className="text-amber-500" />}
                  description="Nouveaux projets rejoints sur la période"
                />
                <StatCard 
                  title="Projets Remboursés" 
                  value={`${global.periodRefundedProjectsCount} projet(s) terminé(s)`} 
                  icon={<CheckCircle2 className="text-purple-600" />}
                  description="Tombé(s) à 0 sur la période"
                />
                <StatCard 
                  title="Revenus Nets" 
                  value={formatEuro(global.totalNetRevenues)} 
                  icon={<ArrowUpRight className="text-amber-600" />}
                  description={
                    (global.periodRoyaltyRevenues > 0 || global.periodObligationRevenues > 0 || global.periodBoostedBalance > 0 || global.periodReferralBonuses > 0 || global.periodCommercialAdjustments > 0) ? (
                      `Royalties (${formatEuro(global.periodRoyaltyRevenues)}) + Obligations (${formatEuro(global.periodObligationRevenues)}) + Solde boosté (${formatEuro(global.periodBoostedBalance)}) + Parrainage (${formatEuro(global.periodReferralBonuses)})${global.periodCommercialAdjustments > 0 ? ` + Ajustements (${formatEuro(global.periodCommercialAdjustments)})` : ''}`
                    ) : (
                      "Royalties, Obligations, Solde boosté & Parrainage"
                    )
                  }
                  trend={global.totalNetRevenues > 0 ? "positive" : "negative"}
                />
                <StatCard 
                  title="Ajustements Commerciaux" 
                  value={formatEuro(global.periodCommercialAdjustments)} 
                  icon={<HeartHandshake className="text-amber-600" />}
                  description={
                    global.periodCommercialAdjustmentsCount > 0
                      ? `${global.periodCommercialAdjustmentsCount} transaction(s) sur la période`
                      : (global.totalCommercialAdjustments > 0 ? `Total historique : ${formatEuro(global.totalCommercialAdjustments)}` : "Gestes & ajustements commerciaux")
                  }
                  badge={
                    global.totalCommercialAdjustments > 0 && filterMode !== 'all' && global.periodCommercialAdjustments !== global.totalCommercialAdjustments
                      ? `Total : ${formatEuro(global.totalCommercialAdjustments)}`
                      : undefined
                  }
                  trend={global.periodCommercialAdjustments > 0 ? "positive" : undefined}
                />
                <StatCard 
                  title="Ventes & Capital Reçu" 
                  value={formatEuro(global.totalPeriodSales)} 
                  icon={<ArrowDownRight className="text-indigo-600" />}
                  description="Ventes & Remboursements"
                />
                <StatCard 
                  title="Frais marketplace & Fiscalité" 
                  value={formatEuro(global.periodFeesAndTaxes)} 
                  icon={<Receipt className="text-rose-600" />}
                  description={`Frais marketplace (${formatEuro(global.periodFees)}) + Fiscalité (${formatEuro(global.periodTaxes)})`}
                  trend={global.periodFeesAndTaxes > 0 ? "negative" : undefined}
                />
                <StatCard 
                  title="Rendement Période" 
                  value={formatPercent(global.averageYield)} 
                  icon={<Percent className="text-purple-600" />}
                  description={
                    global.investmentDurationText 
                      ? `Annualisé : ~${formatPercent(global.averageAnnualYield || 0)} / an (depuis ${global.investmentDurationText})`
                      : `Annualisé : ~${formatPercent(global.averageAnnualYield || 0)} / an`
                  }
                />
              </div>

              {/* Patrimoine Total LineChart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp size={20} className="text-blue-600" />
                      Évolution Historique du Patrimoine Total
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      Évolution de la valeur totale (Solde non investi + Capital investi) sur la période sélectionnée
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                      <span className="text-slate-700">Patrimoine Total</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
                      <span className="text-slate-500">Capital Investi</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="text-slate-500">Solde Non Investi</span>
                    </div>
                  </div>
                </div>

                <div className="h-80">
                  {patrimoineTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={patrimoineTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={12} tickLine={false} />
                        <YAxis tickFormatter={(val) => `${val}€`} stroke="#94a3b8" fontSize={12} tickLine={false} />
                        <Tooltip 
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload || !payload.length) return null;
                            const dateStr = payload[0]?.payload?.date || label;
                            const orderedKeys = ['patrimoine', 'capital', 'solde'];
                            const sortedPayload = [...payload].sort((a, b) => {
                              const idxA = orderedKeys.indexOf(a.dataKey);
                              const idxB = orderedKeys.indexOf(b.dataKey);
                              return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
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
                          formatter={(val: number) => {
                            const totalCap = global.totalCurrentCapital || properties.reduce((acc, p) => acc + p.currentCapital, 0);
                            const pct = totalCap > 0 ? (val / totalCap) * 100 : 0;
                            return [`${formatEuro(val)} (${formatPercent(pct)} du capital total)`, "Capital investi"];
                          }}
                          labelFormatter={(label) => `Immeuble : ${label}`}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                          dataKey="currentCapital" 
                          radius={[6, 6, 0, 0]} 
                          className="cursor-pointer"
                          onClick={(data) => {
                            if (data && data.name) {
                              const found = findPropertyByName(data.name);
                              if (found) setSelectedProperty(found);
                            }
                          }}
                        >
                          {properties.map((entry, index) => (
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
                                if (found) setSelectedProperty(found);
                              }
                            }}
                          >
                            {topRevenuesChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(val: number) => {
                              const totalRev = global.totalNetRevenues || topRevenuesChartData.reduce((acc, item) => acc + item.netRevenues, 0);
                              const pct = totalRev > 0 ? (val / totalRev) * 100 : 0;
                              return [`${formatEuro(val)} (${formatPercent(pct)} des revenus)`, "Revenus nets"];
                            }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
                      type="text" 
                      placeholder="Rechercher un immeuble..."
                      value={searchInputValue}
                      onChange={(e) => setSearchInputValue(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    />
                    {searchInputValue && (
                      <button 
                        onClick={() => {
                          setSearchInputValue('');
                          setDebouncedSearchQuery('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all"
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
                              className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Effacer la recherche
                            </button>
                          </td>
                        </tr>
                      ) : (
                        sortedProperties.map((p) => (
                        <tr 
                          key={p.name} 
                          onClick={() => setSelectedProperty(p)}
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
                                  style={{ width: `${Math.min(p.yield * 10, 100)}%` }}
                                />
                              </div>
                              <span className="font-bold text-blue-600 text-sm">{formatPercent(p.yield)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-indigo-600 text-sm">
                            {formatPercent(p.annualYield)}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                            {formatPercent(global.totalCurrentCapital > 0 ? (p.currentCapital / global.totalCurrentCapital) * 100 : 0)}
                          </td>
                        </tr>
                      ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions History Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <History size={20} className="text-blue-600" />
                      Historique des Transactions (Période)
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {filteredPeriodTransactions.length} transaction(s) sur la période sélectionnée
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Category Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setTxCategoryFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          txCategoryFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Toutes
                      </button>
                      <button
                        onClick={() => setTxCategoryFilter('purchases')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          txCategoryFilter === 'purchases' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Achats
                      </button>
                      <button
                        onClick={() => setTxCategoryFilter('revenues')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          txCategoryFilter === 'revenues' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Revenus
                      </button>
                      <button
                        onClick={() => setTxCategoryFilter('sales')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          txCategoryFilter === 'sales' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Remboursements
                      </button>
                      <button
                        onClick={() => setTxCategoryFilter('wallet')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all",
                          txCategoryFilter === 'wallet' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        Solde / Virement
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full md:w-60">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text" 
                        placeholder="Filtrer transactions..."
                        value={txSearchQuery}
                        onChange={(e) => setTxSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                      {txSearchQuery && (
                        <button 
                          onClick={() => setTxSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Statut</th>
                        <th className="px-6 py-3">Immeuble / Projet</th>
                        <th className="px-6 py-3 text-right">Montant</th>
                        <th className="px-6 py-3 text-right">Solde Actuel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                            Aucune transaction trouvée pour cette sélection.
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((tx: any, idx: number) => {
                          const rawVal = typeof tx["montant (€)"] === "number" ? tx["montant (€)"] : parseFloat(String(tx["montant (€)"] || "0").replace(",", "."));
                          const amtVal = Math.abs(rawVal);
                          const normType = (tx.type || '').toLowerCase();
                          const statut = tx.statut || "Validée";
                          const normStatut = statut.toLowerCase();
                          const isValidated = normStatut === "validée" || normStatut === "validee";
                          const isCancelledOrRefused = normStatut.includes("refus") || normStatut.includes("annul");

                          const isSoldeBooste = normType.includes("solde boosté");
                          const isCommercialAdj = normType.includes("ajustement commercial") || normType.includes("ajustement");
                          const isRevenue = normType.includes("revenus") || normType.includes("parrainage");
                          const isPurchase = normType.includes("achat") && !normType.includes("frais");
                          const isSale = normType.includes("vente") || normType.includes("remboursement") || normType.includes("revente");
                          const isTax = normType.includes("prélèvement") || normType.includes("prelevement") || normType.includes("frais");
                          const propName = getTxPropertyName(tx);

                          return (
                            <tr key={tx.id || idx} className={cn("hover:bg-slate-50/80 transition-colors", !isValidated && "bg-slate-50/40")}>
                              <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                                {tx.date}
                              </td>
                              <td className="px-6 py-3 text-xs font-semibold">
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
                                      if (targetProp) setSelectedProperty(targetProp);
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
                                    <span className="p-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0" title="Solde en baisse (-)">
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

                {/* Pagination */}
                {totalTxPages > 1 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Page {txPage} sur {totalTxPages} ({filteredPeriodTransactions.length} résultats)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={txPage <= 1}
                        onClick={() => setTxPage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                        title="Page précédente"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        disabled={txPage >= totalTxPages}
                        onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                        className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                        title="Page suivante"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <PropertyDetail 
              property={selectedProperty} 
              onBack={() => setSelectedProperty(null)} 
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PropertyDetail({ 
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
}: { 
  property: PropertyStats, 
  onBack: () => void,
  formatEuro: (v: number) => string,
  formatPercent: (v: number) => string,
  filterMode: FilterMode,
  setFilterMode: (m: FilterMode) => void,
  rollingMonths: number,
  setRollingMonths: (m: number) => void,
  selectedYear: number,
  setSelectedYear: (y: number) => void,
  selectedMonth: number | 'all',
  setSelectedMonth: (m: number | 'all') => void,
  selectedQuarter: number | 'all',
  setSelectedQuarter: (q: number | 'all') => void,
  availableYears: number[]
}) {
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
  const contractType = meta?.investorContractType || sortedTxs.find(t => t["type de contrat"])?.["type de contrat"];
  const isObligation = contractType ? contractType.toLowerCase().includes("obligation") : false;
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium self-start"
      >
        <ArrowLeft size={20} />
        Retour au tableau de bord
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
                {meta.address.fr}
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
          title="Capital (Début)" 
          value={formatEuro(property.startCapital)} 
          icon={<Clock className="text-slate-600" />}
          description="Début de période"
        />
        {isRefundedOrSold && isRoyalty && (
          <StatCard 
            title="Plus / Moins-value" 
            value={`${plusMoinsValue >= 0 ? '+' : ''}${formatEuro(plusMoinsValue)}`} 
            icon={<Coins className={plusMoinsValue >= 0 ? "text-emerald-600" : "text-rose-600"} />}
            description={`Ventes (${formatEuro(salesForGain)}) - Inves. (${formatEuro(property.totalInvested)})`}
            trend={plusMoinsValue >= 0 ? "positive" : "negative"}
            badge="Revente / Remboursé"
          />
        )}
        {isRefundedOrSold ? (
          <StatCard 
            title="Durée du prêt" 
            value={property.investmentDurationText || '-'} 
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
            title="Capital (Fin)" 
            value={formatEuro(property.currentCapital)} 
            icon={<Wallet className="text-blue-600" />}
            description="Fin de période"
          />
        )}
        {isRoyalty && (
          <StatCard 
            title="Gain Capital" 
            value={`${property.capitalGain >= 0 ? '+' : ''}${formatEuro(property.capitalGain)}`} 
            icon={<TrendingUp className={property.capitalGain >= 0 ? "text-emerald-600" : "text-rose-600"} />}
            description="Variation période"
            trend={property.capitalGain >= 0 ? "positive" : "negative"}
          />
        )}
        <StatCard 
          title="Inves. Total" 
          value={formatEuro(property.totalInvested)} 
          icon={<Building2 className="text-emerald-600" />}
          description="Achats cumulés"
        />
        <StatCard 
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
        <StatCard 
          title="Revenus Nets" 
          value={formatEuro(property.netRevenues)} 
          icon={<ArrowUpRight className="text-amber-600" />}
          description="Loyers & Intérêts"
          trend={property.netRevenues > 0 ? "positive" : "negative"}
        />
        {property.daysBeforeFirstRevenue !== undefined ? (
          <StatCard 
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
            title="Délai 1er Revenu" 
            value="En attente" 
            icon={<Clock className="text-slate-400" />}
            description="Aucun revenu perçu à ce jour"
          />
        )}
        <StatCard 
          title="Ventes" 
          value={formatEuro(property.periodSales)} 
          icon={<Building2 className="text-indigo-600" />}
          description="Ventes / Capital"
        />
        <StatCard 
          title="Rendement Total" 
          value={formatPercent(property.yield)} 
          icon={<Percent className="text-purple-600" />}
          description="Sur total investi"
        />
        <StatCard 
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
            {meta?.investmentHorizonInMonths && (
              <DetailItem label="Horizon initial prévu" value={`${meta.investmentHorizonInMonths} mois`} />
            )}
            <DetailItem label="Rendement Total" value={formatPercent(property.yield)} />
            <DetailItem label="Rendement Annuel" value={`${formatPercent(property.annualYield)} / an`} />
            {property.commercialAdjustments !== undefined && property.commercialAdjustments > 0 && (
              <DetailItem label="Ajustement commercial" value={`+${formatEuro(property.commercialAdjustments)}`} />
            )}
            {isRefundedOrSold && isRoyalty && (
              <DetailItem label="Plus / Moins-value (Revente)" value={`${plusMoinsValue >= 0 ? '+' : ''}${formatEuro(plusMoinsValue)}`} />
            )}
            {meta && (
              <>
                <DetailItem label="Type de contrat" value={meta.investorContractType} />
                <DetailItem label="Statut financier" value={meta.financialStatus} />
                <DetailItem label="Horizon" value={`${meta.investmentHorizonInMonths} mois`} />
                <DetailItem label="Cible annuelle" value={formatPercent(meta.yearlyTotalRentabilityPercentage)} />
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
                onClick={() => setDetailTxCategory('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Toutes
              </button>
              <button
                onClick={() => setDetailTxCategory('purchases')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'purchases' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Achats
              </button>
              <button
                onClick={() => setDetailTxCategory('revenues')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'revenues' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Revenus
              </button>
              <button
                onClick={() => setDetailTxCategory('sales')}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  detailTxCategory === 'sales' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Remboursements ou Ventes
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Filtrer..."
                value={detailTxSearch}
                onChange={(e) => setDetailTxSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
              {detailTxSearch && (
                <button 
                  onClick={() => setDetailTxSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all"
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
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-slate-700 capitalize">{value}</span>
    </div>
  );
}

function FilterTab({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
        active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

function StatCard({ title, value, icon, description, trend, badge }: { 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  description?: React.ReactNode,
  trend?: 'positive' | 'negative',
  badge?: string
}) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-slate-50 rounded-lg">
            {icon}
          </div>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {badge}
            </span>
          )}
          {trend && !badge && (
            <div className={cn(
              "text-xs font-bold px-2 py-1 rounded-full",
              trend === 'positive' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {trend === 'positive' ? '↑' : '↓'}
            </div>
          )}
        </div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 mb-1 tracking-tight">{value}</div>
        <div className="text-xs font-semibold text-slate-500 mb-1">{title}</div>
      </div>
      {description && <div className="text-[11px] text-slate-400 mt-1">{description}</div>}
    </div>
  );
}
