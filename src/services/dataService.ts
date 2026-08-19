import { parse, format, isAfter, isBefore, subMonths, subYears, startOfDay, endOfDay, getYear, startOfMonth, endOfMonth, differenceInDays, addMonths } from "date-fns";
import { 
  Transaction, 
  PropertyStats, 
  GlobalStats, 
  ContractTypeStats,
  ProjectMetadata, 
  PropertyTimelinePoint,
  YearlyYieldPoint,
  MonthlyYieldPoint,
  TransactionType,
  normalizeTransactionType,
  isPurchaseType,
  isRevenueType,
  isRepaymentOrSaleType,
  isTotalResaleType,
  isFeeType,
  isTaxType
} from "../types";

export const parseDate = (dateStr: string) => parse(dateStr, "dd/MM/yyyy", new Date());

export function formatInvestmentDuration(start: Date, end: Date): string {
  const days = Math.max(1, differenceInDays(end, start));
  
  if (days < 30) {
    return `${days} jour${days > 1 ? 's' : ''}`;
  }
  
  const totalMonths = Math.round(days / 30.4375);
  if (totalMonths < 12) {
    return `${totalMonths} mois`;
  }
  
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  
  if (remainingMonths === 0) {
    return `${years} an${years > 1 ? 's' : ''}`;
  }
  return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`;
}

/**
 * Calculates monthly and yearly rentabilities taking into account variable capital
 * (marketplace purchases, brick sales, marketplace fees) and 0 revenue for inactive months.
 */
export interface PropertyYieldTimelineResult {
  monthlyYieldHistory: MonthlyYieldPoint[];
  yearlyYieldHistory: YearlyYieldPoint[];
  timeWeightedTotalYield: number;
  timeWeightedAnnualYield: number;
  totalDurationInMonths: number;
  totalDurationInYears: number;
}

export function calculatePropertyYieldTimeline(
  sortedTxsAsc: (Transaction & { parsedDate: Date })[],
  firstInvestmentDateObj: Date | null,
  isProjectFinished: boolean,
  capitalZeroDateObj: Date | null
): PropertyYieldTimelineResult {
  if (!firstInvestmentDateObj || sortedTxsAsc.length === 0) {
    return {
      monthlyYieldHistory: [],
      yearlyYieldHistory: [],
      timeWeightedTotalYield: 0,
      timeWeightedAnnualYield: 0,
      totalDurationInMonths: 0,
      totalDurationInYears: 0
    };
  }

  const now = new Date();
  const startMonthDate = startOfMonth(firstInvestmentDateObj);
  let endMonthDate = startOfMonth(now);

  if (isProjectFinished && capitalZeroDateObj) {
    endMonthDate = startOfMonth(capitalZeroDateObj);
  } else if (isProjectFinished && sortedTxsAsc.length > 0) {
    const lastTx = [...sortedTxsAsc].reverse().find(t => {
      const norm = (t.type || "").toLowerCase();
      return norm.includes("vente") || norm.includes("remboursement") || norm.includes("revente");
    });
    if (lastTx) {
      endMonthDate = startOfMonth(lastTx.parsedDate);
    }
  }

  if (isBefore(endMonthDate, startMonthDate)) {
    endMonthDate = startMonthDate;
  }

  // Pre-group transactions by month (yyyy-MM)
  const txByMonth = new Map<string, (Transaction & { parsedDate: Date })[]>();
  sortedTxsAsc.forEach(t => {
    const key = format(t.parsedDate, "yyyy-MM");
    if (!txByMonth.has(key)) {
      txByMonth.set(key, []);
    }
    txByMonth.get(key)!.push(t);
  });

  let curr = startMonthDate;
  let monthIndex = 1;
  let runningCapital = 0;
  let cumulativeYield = 0;
  let cumulativeRevenue = 0;
  const monthlyYieldHistory: MonthlyYieldPoint[] = [];

  while (!isAfter(curr, endMonthDate)) {
    const monthKey = format(curr, "yyyy-MM");
    const mtxs = txByMonth.get(monthKey) || [];

    let monthRevenue = 0;
    let periodInvestment = 0;
    let periodRepayment = 0;
    let periodMarketplaceFees = 0;

    // Process transactions in this month
    mtxs.forEach(t => {
      const rawVal = parseFloat((t["montant (€)"] || "0").replace(",", "."));
      if (isNaN(rawVal)) return;
      const amount = Math.abs(rawVal);
      const normType = normalizeTransactionType(t.type);
      const rawType = (t.type || "").toLowerCase();

      const isAchat = isPurchaseType(t.type);
      const isFee = normType === TransactionType.FRAIS_ACHAT_MARKETPLACE || isFeeType(t.type) || rawType.includes("frais");
      const isRepayOrSale = isRepaymentOrSaleType(t.type);
      const isTotalResale = isTotalResaleType(t.type);
      const isRev = isRevenueType(t.type);
      const isCommercial = normType === TransactionType.AJUSTEMENT_COMMERCIAL;
      const isTax = normType === TransactionType.PRELEVEMENT_SOURCE || isTaxType(t.type);

      if (isAchat) {
        runningCapital += amount;
        periodInvestment += amount;
      } else if (isFee) {
        // Marketplace fees on purchase increase the invested capital cost for yield calculation
        runningCapital += amount;
        periodMarketplaceFees += amount;
      } else if (!isRev && isRepayOrSale) {
        runningCapital = Math.max(0, runningCapital - amount);
        periodRepayment += amount;
      }

      if (isTotalResale) {
        runningCapital = 0;
      }

      if (isRev || isCommercial) {
        monthRevenue += rawVal > 0 ? rawVal : amount;
      } else if (isTax) {
        monthRevenue += rawVal; // tax is negative
      }
    });

    monthRevenue = Math.round(monthRevenue * 100) / 100;
    const activeCapital = Math.max(0, Math.round(runningCapital * 100) / 100);

    // Monthly yield rentability: revenue / activeCapital * 100
    // If no revenue in this month, monthRevenue = 0 and monthlyYield = 0
    let monthlyYield = 0;
    if (activeCapital > 0 && monthRevenue !== 0) {
      monthlyYield = (monthRevenue / activeCapital) * 100;
    }
    monthlyYield = Math.round(monthlyYield * 10000) / 10000;

    cumulativeYield = Math.round((cumulativeYield + monthlyYield) * 10000) / 10000;
    cumulativeRevenue = Math.round((cumulativeRevenue + monthRevenue) * 100) / 100;

    const yearIndex = Math.floor((monthIndex - 1) / 12) + 1;

    monthlyYieldHistory.push({
      monthIndex,
      monthKey,
      dateStr: format(endOfMonth(curr), "dd/MM/yyyy"),
      formattedDate: format(curr, "MM/yy"),
      revenue: monthRevenue,
      activeCapital,
      monthlyYield: Math.round(monthlyYield * 100) / 100,
      cumulativeYield: Math.round(cumulativeYield * 100) / 100,
      hasRevenue: monthRevenue > 0,
      yearIndex,
      periodInvestment: Math.round(periodInvestment * 100) / 100,
      periodRepayment: Math.round(periodRepayment * 100) / 100,
      marketplaceFees: Math.round(periodMarketplaceFees * 100) / 100
    });

    curr = addMonths(curr, 1);
    monthIndex++;
  }

  // Build yearly breakdown
  const yearlyMap = new Map<number, MonthlyYieldPoint[]>();
  monthlyYieldHistory.forEach(m => {
    if (!yearlyMap.has(m.yearIndex)) {
      yearlyMap.set(m.yearIndex, []);
    }
    yearlyMap.get(m.yearIndex)!.push(m);
  });

  const yearlyYieldHistory: YearlyYieldPoint[] = Array.from(yearlyMap.entries()).map(([yearIndex, months]) => {
    const monthsCount = months.length;
    const isComplete = monthsCount === 12;
    const yearYield = Math.round(months.reduce((acc, m) => acc + m.monthlyYield, 0) * 100) / 100;
    const annualizedYield = monthsCount > 0 ? Math.round(((yearYield * 12) / monthsCount) * 100) / 100 : yearYield;
    const totalRevenue = Math.round(months.reduce((acc, m) => acc + m.revenue, 0) * 100) / 100;
    const avgCapital = monthsCount > 0 
      ? Math.round((months.reduce((acc, m) => acc + m.activeCapital, 0) / monthsCount) * 100) / 100 
      : 0;

    let yearLabel = `${yearIndex}ème année`;
    if (yearIndex === 1) {
      yearLabel = isComplete ? "1ère année écoulée" : `1ère année (${monthsCount} mois)`;
    } else {
      yearLabel = isComplete ? `${yearIndex}ème année écoulée` : `${yearIndex}ème année (${monthsCount} mois)`;
    }

    return {
      yearIndex,
      yearLabel,
      yield: yearYield,
      annualizedYield,
      totalRevenue,
      averageCapital: avgCapital,
      monthsCount,
      isComplete,
      startDate: months[0]?.dateStr,
      endDate: months[months.length - 1]?.dateStr
    };
  });

  const totalDurationInMonths = monthlyYieldHistory.length;
  const totalDurationInYears = Math.max(totalDurationInMonths / 12, 1 / 12);
  const timeWeightedTotalYield = Math.round(yearlyYieldHistory.reduce((acc, y) => acc + y.yield, 0) * 100) / 100;
  const timeWeightedAnnualYield = Math.round((timeWeightedTotalYield / totalDurationInYears) * 100) / 100;

  return {
    monthlyYieldHistory,
    yearlyYieldHistory,
    timeWeightedTotalYield,
    timeWeightedAnnualYield,
    totalDurationInMonths,
    totalDurationInYears
  };
}

export const getSoldeImpact = (typeStr: string): number => {
  if (!typeStr) return 0;
  const normType = normalizeTransactionType(typeStr);

  switch (normType) {
    // Entrées dans le solde (+1)
    case TransactionType.CREDIT_CARTE:
    case TransactionType.CREDIT_VIREMENT:
    case TransactionType.SOLDE_BOOSTE:
    case TransactionType.REVENUS_REVERSES:
    case TransactionType.REVENUS_REVENTE_LOT:
    case TransactionType.REVENUS_REVENTE_TOTALE:
    case TransactionType.REMBOURSEMENT_CAPITAL:
    case TransactionType.REMBOURSEMENT_SOCIETE_BRICKS:
    case TransactionType.AJUSTEMENT_COMMERCIAL:
    case TransactionType.PARRAINAGE_PARRAIN:
    case TransactionType.PARRAINAGE_FILLEUL:
    case TransactionType.PARRAINAGE_GENERIQUE:
    case TransactionType.UTILISATION_CARTE_CADEAU:
    case TransactionType.VENTE_MARKETPLACE:
      return 1;

    // Sorties du solde (-1)
    case TransactionType.ACHAT_BRICKS:
    case TransactionType.ACHAT_MARKETPLACE:
    case TransactionType.FRAIS_ACHAT_MARKETPLACE:
    case TransactionType.ACHAT_CARTE_CADEAU:
    case TransactionType.RETRAIT:
    case TransactionType.PRELEVEMENT_SOURCE:
    case TransactionType.INVESTISSEMENT_SOCIETE_BRICKS:
      return -1;

    default: {
      const norm = typeStr.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (
        norm.includes("remboursement") || 
        norm.includes("solde booste") || 
        norm.includes("credit") || 
        norm.includes("depot") || 
        norm.includes("vente") || 
        norm.includes("revenus") || 
        norm.includes("ajustement") || 
        norm.includes("parrainage")
      ) {
        return 1;
      }
      if (
        norm.includes("achat") || 
        norm.includes("prelevement") || 
        norm.includes("retrait") || 
        norm.includes("frais") || 
        norm.includes("investissement")
      ) {
        return -1;
      }
      return 1;
    }
  }
};

export const getAvailableYears = (transactions: Transaction[]) => {
  const years = new Set<number>();
  transactions.forEach(t => {
    years.add(getYear(parseDate(t.date)));
  });
  return Array.from(years).sort((a, b) => b - a);
};

const normalizeName = (name: string) => {
  return name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const calculateStats = (
  allTransactions: Transaction[], 
  startDate: Date | null, 
  endDate: Date | null,
  metadata: ProjectMetadata[] = []
): { properties: PropertyStats[], global: GlobalStats } => {
  const validTransactions = allTransactions.filter(t => t.statut === "Validée");
  const propertyMap = new Map<string, Transaction[]>();

  validTransactions.forEach(t => {
    const propName = t.propriété || "Autre (Boost/Frais)";
    if (!propertyMap.has(propName)) {
      propertyMap.set(propName, []);
    }
    propertyMap.get(propName)!.push(t);
  });

  const now = new Date();

  const properties: PropertyStats[] = Array.from(propertyMap.entries()).map(([name, txs]) => {
    let totalInvested = 0;
    let startCapital = 0;
    let currentCapital = 0;
    let totalRevenues = 0;
    let netRevenues = 0;
    let commercialAdjustments = 0;
    let periodSales = 0;

    // Find earliest investment date (first purchase by user)
    const sortedTxsAsc = [...txs].map((t, _origIdx) => ({ ...t, _origIdx })).sort((a, b) => {
      const diff = parseDate(a.date).getTime() - parseDate(b.date).getTime();
      if (diff !== 0) return diff;
      return b._origIdx - a._origIdx;
    });
    const purchaseTxs = sortedTxsAsc.filter(t => isPurchaseType(t.type));
    const firstTx = purchaseTxs.length > 0 ? purchaseTxs[0] : sortedTxsAsc[0];
    const firstInvestmentDate = firstTx ? firstTx.date : undefined;
    const firstInvestmentDateObj = firstTx ? parseDate(firstTx.date) : null;

    // Find earliest and latest revenue transactions for this property
    const revenueTxs = sortedTxsAsc.filter(t => isRevenueType(t.type));
    let firstRevenueDate: string | undefined = undefined;
    let lastRevenueDate: string | undefined = undefined;
    let daysBeforeFirstRevenue: number | undefined = undefined;
    let daysSinceLastRevenue: number | undefined = undefined;
    if (revenueTxs.length > 0) {
      const firstRevTx = revenueTxs[0];
      firstRevenueDate = firstRevTx.date;
      const firstRevDateObj = parseDate(firstRevTx.date);
      if (firstInvestmentDateObj && !isNaN(firstInvestmentDateObj.getTime()) && !isNaN(firstRevDateObj.getTime())) {
        daysBeforeFirstRevenue = Math.max(0, differenceInDays(firstRevDateObj, firstInvestmentDateObj));
      }

      const lastRevTx = revenueTxs[revenueTxs.length - 1];
      lastRevenueDate = lastRevTx.date;
      const lastRevDateObj = parseDate(lastRevTx.date);
      if (!isNaN(lastRevDateObj.getTime())) {
        daysSinceLastRevenue = Math.max(0, differenceInDays(now, lastRevDateObj));
      }
    } else if (firstInvestmentDateObj && !isNaN(firstInvestmentDateObj.getTime())) {
      daysSinceLastRevenue = Math.max(0, differenceInDays(now, firstInvestmentDateObj));
    }

    // Marketplace fees for this property
    let marketplaceFees = 0;
    sortedTxsAsc.forEach(t => {
      const normType = normalizeTransactionType(t.type);
      const rawType = (t.type || "").toLowerCase();
      if (normType === TransactionType.FRAIS_ACHAT_MARKETPLACE || isFeeType(t.type) || rawType.includes("frais")) {
        const rawVal = parseFloat((t["montant (€)"] || "0").replace(",", "."));
        if (!isNaN(rawVal)) {
          marketplaceFees += Math.abs(rawVal);
        }
      }
    });
    marketplaceFees = Math.round(marketplaceFees * 100) / 100;

    let totalResaleOccurredBeforeEnd = false;
    let runningCapital = 0;
    let capitalZeroDateStr: string | undefined = undefined;

    sortedTxsAsc.forEach(t => {
      const amount = parseFloat(t["montant (€)"].replace(",", "."));
      const tDate = parseDate(t.date);
      const isReventeTotale = isTotalResaleType(t.type);
      const isAchat = isPurchaseType(t.type);
      const isRepaymentOrSale = isRepaymentOrSaleType(t.type);
      const isRevenue = isRevenueType(t.type);

      const prevCap = runningCapital;
      // Track running capital chronologically
      if (isAchat) {
        runningCapital += Math.abs(amount);
      } else if (!isRevenue && isRepaymentOrSale) {
        runningCapital = Math.max(0, runningCapital - Math.abs(amount));
      }
      if (isReventeTotale) {
        runningCapital = 0;
      }

      if (prevCap > 0 && runningCapital === 0) {
        capitalZeroDateStr = t.date;
      }

      const isBeforeStart = startDate && isBefore(tDate, startOfDay(startDate));
      const isBeforeEnd = !endDate || isBefore(tDate, endOfDay(endDate)) || tDate.getTime() === endOfDay(endDate).getTime();

      // Total invested ever
      if (isAchat) {
        totalInvested += Math.abs(amount);
      }

      // Start capital (cumulative before startDate)
      if (isBeforeStart) {
        if (isAchat) {
          startCapital += Math.abs(amount);
        } else if (!isRevenue && isRepaymentOrSale) {
          startCapital -= Math.abs(amount);
        }
        if (isReventeTotale) {
          startCapital = 0;
        }
      }

      // End capital (cumulative up to endDate)
      if (isBeforeEnd) {
        if (isAchat) {
          currentCapital += Math.abs(amount);
        } else if (!isRevenue && isRepaymentOrSale) {
          currentCapital -= Math.abs(amount);
        }
        if (isReventeTotale) {
          totalResaleOccurredBeforeEnd = true;
          currentCapital = 0;
        }
      }
      
      // Transactions in range
      const isInRange = (!startDate || isAfter(tDate, startOfDay(startDate)) || tDate.getTime() === startOfDay(startDate).getTime()) &&
                        (!endDate || isBefore(tDate, endOfDay(endDate)) || tDate.getTime() === endOfDay(endDate).getTime());

      if (isInRange) {
        const normType = normalizeTransactionType(t.type);
        if (normType === TransactionType.AJUSTEMENT_COMMERCIAL) {
          commercialAdjustments += amount;
          totalRevenues += amount;
          netRevenues += amount;
        } else if (isRevenue) {
          totalRevenues += amount;
          netRevenues += amount;
        } else if (normType === TransactionType.PRELEVEMENT_SOURCE || isTaxType(t.type)) {
          netRevenues += amount;
        } else if (isRepaymentOrSale) {
          periodSales += Math.abs(amount);
        }
      }
    });

    if (totalResaleOccurredBeforeEnd) {
      currentCapital = 0;
    }
    startCapital = Math.max(0, Math.round(startCapital * 100) / 100);
    currentCapital = Math.max(0, Math.round(currentCapital * 100) / 100);
    let capitalGain = Math.round((currentCapital - startCapital) * 100) / 100;
    if (Math.abs(capitalGain) < 0.005) {
      capitalGain = 0;
    }
    totalInvested = Math.round(totalInvested * 100) / 100;
    totalRevenues = Math.round(totalRevenues * 100) / 100;
    netRevenues = Math.round(netRevenues * 100) / 100;
    commercialAdjustments = Math.round(commercialAdjustments * 100) / 100;
    periodSales = Math.round(periodSales * 100) / 100;

    // Yield logic: use totalInvested if > 0, otherwise fallback to current capital
    const denominator = totalInvested > 0 ? totalInvested : currentCapital;
    const yieldVal = denominator > 0 ? (netRevenues / denominator) * 100 : 0;

    // Link metadata
    const normalizedName = normalizeName(name);
    const propertyMetadata = metadata.find(m => 
      normalizeName(m.name.fr) === normalizedName || 
      normalizeName(m.name.en) === normalizedName
    );

    // Calculate brick metrics & latent valuation
    let currentBrickPrice = 10; // Default 10€
    if (propertyMetadata?.brickPrice && propertyMetadata.brickPrice > 0) {
      currentBrickPrice = propertyMetadata.brickPrice / 100;
    } else if (propertyMetadata?.funding?.brickPrice && propertyMetadata.funding.brickPrice > 0) {
      currentBrickPrice = propertyMetadata.funding.brickPrice / 100;
    } else {
      // Look for latest brick price in transactions if available
      const txWithPrice = sortedTxsAsc.slice().reverse().find(t => {
        const p = parseFloat((t["prix de la brick (€)"] || "").replace(",", "."));
        return !isNaN(p) && p > 0;
      });
      if (txWithPrice) {
        currentBrickPrice = parseFloat(txWithPrice["prix de la brick (€)"].replace(",", "."));
      }
    }

    let ownedBricks = 0;
    let costForOwnedBricks = 0;
    let runningCapForBricks = 0;

    sortedTxsAsc.forEach(t => {
      const rawVal = parseFloat((t["montant (€)"] || "0").replace(",", "."));
      if (isNaN(rawVal)) return;
      const absAmount = Math.abs(rawVal);
      
      let rawTxBrickPrice = parseFloat((t["prix de la brick (€)"] || "").replace(",", "."));
      if (isNaN(rawTxBrickPrice) || rawTxBrickPrice <= 0) {
        rawTxBrickPrice = currentBrickPrice;
      }

      const normType = (t.type || "").toLowerCase();
      const isReventeTotale = normType.includes("revente totale") || normType.includes("revente-totale");
      const isFrais = normType.includes("frais");
      const isRevenus = normType.includes("revenus");

      if (normType.includes("achat") && !isFrais) {
        const boughtBricks = absAmount / rawTxBrickPrice;
        ownedBricks += boughtBricks;
        costForOwnedBricks += absAmount;
        runningCapForBricks += absAmount;
      } else if (!isRevenus && normType.includes("vente") && !normType.includes("remboursement") && !isFrais) {
        const soldBricks = absAmount / rawTxBrickPrice;
        const avgCost = ownedBricks > 0 ? (costForOwnedBricks / ownedBricks) : rawTxBrickPrice;
        ownedBricks = Math.max(0, ownedBricks - soldBricks);
        costForOwnedBricks = Math.max(0, costForOwnedBricks - (soldBricks * avgCost));
        runningCapForBricks = Math.max(0, runningCapForBricks - absAmount);
      } else if (!isRevenus && normType.includes("remboursement") && !isFrais) {
        runningCapForBricks = Math.max(0, runningCapForBricks - absAmount);
        costForOwnedBricks = Math.max(0, costForOwnedBricks - absAmount);
      }

      if (runningCapForBricks <= 0.01 || isReventeTotale) {
        ownedBricks = 0;
        costForOwnedBricks = 0;
        runningCapForBricks = 0;
      }
    });

    // Enforce 0 owned bricks if currentCapital is 0 or less
    if (currentCapital <= 0.01) {
      ownedBricks = 0;
      costForOwnedBricks = 0;
    } else if (ownedBricks === 0 && currentCapital > 0) {
      if (propertyMetadata?.ownedBricks && propertyMetadata.ownedBricks > 0) {
        ownedBricks = propertyMetadata.ownedBricks;
      } else if (propertyMetadata?.investorBricks?.owned && propertyMetadata.investorBricks.owned > 0) {
        ownedBricks = propertyMetadata.investorBricks.owned;
      } else {
        ownedBricks = currentCapital / currentBrickPrice;
      }
      costForOwnedBricks = currentCapital;
    }

    // Calculate total historical bought bricks and purchase cost
    let totalBoughtBricks = 0;
    let totalPurchaseCost = 0;
    sortedTxsAsc.forEach(t => {
      const rawVal = parseFloat((t["montant (€)"] || "0").replace(",", "."));
      if (isNaN(rawVal)) return;
      const absAmount = Math.abs(rawVal);
      const normType = (t.type || "").toLowerCase();
      const isFrais = normType.includes("frais");
      if (normType.includes("achat") && !isFrais) {
        let rawTxBrickPrice = parseFloat((t["prix de la brick (€)"] || "").replace(",", "."));
        if (isNaN(rawTxBrickPrice) || rawTxBrickPrice <= 0) {
          rawTxBrickPrice = currentBrickPrice;
        }
        totalBoughtBricks += (absAmount / rawTxBrickPrice);
        totalPurchaseCost += absAmount;
      }
    });

    totalBoughtBricks = Math.round(totalBoughtBricks * 1000) / 1000;
    totalPurchaseCost = Math.round(totalPurchaseCost * 100) / 100;
    const historicalAverageBuyBrickPrice = totalBoughtBricks > 0 ? (totalPurchaseCost / totalBoughtBricks) : 10;

    ownedBricks = Math.round(ownedBricks * 1000) / 1000;
    costForOwnedBricks = Math.round(costForOwnedBricks * 100) / 100;
    const averageBuyBrickPrice = ownedBricks > 0 ? (costForOwnedBricks / ownedBricks) : historicalAverageBuyBrickPrice;
    const netCostForOwnedBricks = Math.max(0, Math.round((costForOwnedBricks - netRevenues) * 100) / 100);
    const netBrickPrice = ownedBricks > 0 ? Math.max(0, (costForOwnedBricks - netRevenues) / ownedBricks) : 0;
    const currentTotalValue = Math.round(ownedBricks * currentBrickPrice * 100) / 100;
    const latentCapitalGain = Math.round((currentTotalValue - costForOwnedBricks) * 100) / 100;
    const latentCapitalGainPercent = costForOwnedBricks > 0 ? (latentCapitalGain / costForOwnedBricks) * 100 : 0;

    // Calculate annual yield & investment duration
    let annualYield = yieldVal;
    let investmentDurationText: string | undefined = undefined;
    let capitalZeroDate: string | undefined = undefined;

    const isProjectFinished = currentCapital <= 0.01 || ownedBricks === 0 || totalResaleOccurredBeforeEnd;
    if (isProjectFinished) {
      if (capitalZeroDateStr) {
        capitalZeroDate = capitalZeroDateStr;
      } else if (sortedTxsAsc.length > 0) {
        const lastTx = [...sortedTxsAsc].reverse().find(t => {
          const norm = t.type.toLowerCase();
          return norm.includes("vente") || norm.includes("remboursement") || norm.includes("revente");
        });
        if (lastTx) {
          capitalZeroDate = lastTx.date;
        }
      }
    }

    if (firstInvestmentDateObj) {
      const periodStart = startDate && isAfter(startDate, firstInvestmentDateObj) ? startDate : firstInvestmentDateObj;
      let periodEnd = endDate && isBefore(endDate, now) ? endDate : now;

      let fullEnd = now;

      if (isProjectFinished) {
        if (capitalZeroDate) {
          const capZeroObj = parseDate(capitalZeroDate);
          fullEnd = capZeroObj;
          if (isAfter(capZeroObj, periodStart)) {
            periodEnd = capZeroObj;
          }
        } else if (sortedTxsAsc.length > 0) {
          const txsBeforeEnd = sortedTxsAsc.filter(t => {
            const d = parseDate(t.date);
            return isBefore(d, periodEnd) || d.getTime() === periodEnd.getTime();
          });
          if (txsBeforeEnd.length > 0) {
            const lastTxDateObj = parseDate(txsBeforeEnd[txsBeforeEnd.length - 1].date);
            fullEnd = lastTxDateObj;
            if (isAfter(lastTxDateObj, periodStart) && isBefore(lastTxDateObj, periodEnd)) {
              periodEnd = lastTxDateObj;
            }
          }
        }
      } else {
        fullEnd = now;
      }

      const days = Math.max(1, differenceInDays(periodEnd, periodStart));
      const yearsElapsed = Math.max(days / 365.25, 1 / 12); // minimum 1 month
      annualYield = yieldVal / yearsElapsed;

      // Always calculate the total loan/investment duration from first purchase date to final capital 0 date (or today for active projects)
      const fullStart = firstInvestmentDateObj;
      if (isProjectFinished && isAfter(fullEnd, fullStart)) {
        investmentDurationText = formatInvestmentDuration(fullStart, fullEnd);
      } else {
        investmentDurationText = formatInvestmentDuration(fullStart, now);
      }
    }

    // Calculate dynamic yield timeline taking into account monthly capital variations & 0 revenue months
    const yieldTimelineResult = calculatePropertyYieldTimeline(
      sortedTxsAsc.map(t => ({ ...t, parsedDate: parseDate(t.date) })),
      firstInvestmentDateObj,
      isProjectFinished,
      capitalZeroDate ? parseDate(capitalZeroDate) : (capitalZeroDateStr ? parseDate(capitalZeroDateStr) : null)
    );

    const {
      monthlyYieldHistory,
      yearlyYieldHistory,
      timeWeightedTotalYield,
      timeWeightedAnnualYield
    } = yieldTimelineResult;

    // If no custom period filter is active (full lifetime), use timeWeightedTotalYield and timeWeightedAnnualYield
    // If a custom filter (startDate or endDate) is active, calculate yield on that period using the monthly slices
    let effectiveYield = timeWeightedTotalYield;
    let effectiveAnnualYield = timeWeightedAnnualYield;

    if (startDate || endDate) {
      const filterStart = startDate ? startOfMonth(startDate) : null;
      const filterEnd = endDate ? endOfMonth(endDate) : null;

      const filteredMonths = monthlyYieldHistory.filter(m => {
        const mDate = parse(m.monthKey, "yyyy-MM", new Date());
        if (filterStart && isBefore(mDate, filterStart)) return false;
        if (filterEnd && isAfter(mDate, filterEnd)) return false;
        return true;
      });

      if (filteredMonths.length > 0) {
        effectiveYield = Math.round(filteredMonths.reduce((acc, m) => acc + m.monthlyYield, 0) * 100) / 100;
        const durYears = Math.max(filteredMonths.length / 12, 1 / 12);
        effectiveAnnualYield = Math.round((effectiveYield / durYears) * 100) / 100;
      } else {
        effectiveYield = 0;
        effectiveAnnualYield = 0;
      }
    }

    // Project opening date from metadata
    let projectOpeningDate: string | undefined = undefined;
    let projectStartDateObj: Date | null = null;
    if (propertyMetadata?.funding?.startedAt) {
      try {
        const startDateObj = new Date(propertyMetadata.funding.startedAt);
        if (!isNaN(startDateObj.getTime())) {
          projectOpeningDate = format(startDateObj, "dd/MM/yyyy");
          projectStartDateObj = startDateObj;
        }
      } catch (e) {
        // fallback
      }
    }

    if (!projectStartDateObj && firstInvestmentDateObj) {
      projectStartDateObj = firstInvestmentDateObj;
    }

    let finalRepaymentDate: string | undefined = capitalZeroDate;
    let repaymentTimingStatus: 'anticipation' | 'retard' | 'on_time' | undefined = undefined;
    let repaymentTimingLabel: string | undefined = undefined;
    let expectedEndDate: string | undefined = undefined;

    const horizonMonths = propertyMetadata?.investmentHorizonInMonths;
    if (projectStartDateObj && horizonMonths && horizonMonths > 0) {
      try {
        const expEnd = addMonths(projectStartDateObj, horizonMonths);
        expectedEndDate = format(expEnd, "dd/MM/yyyy");
      } catch (e) {
        // ignore
      }
    }

    if (isProjectFinished) {
      if (!finalRepaymentDate && sortedTxsAsc.length > 0) {
        const lastRefundTx = [...sortedTxsAsc].reverse().find(t => {
          const norm = t.type.toLowerCase();
          return norm.includes("vente") || norm.includes("remboursement") || norm.includes("revente");
        });
        if (lastRefundTx) {
          finalRepaymentDate = lastRefundTx.date;
        }
      }

      if (finalRepaymentDate) {
        const repaymentDateObj = parseDate(finalRepaymentDate);
        if (projectStartDateObj && horizonMonths && horizonMonths > 0 && !isNaN(repaymentDateObj.getTime())) {
          try {
            const expEnd = addMonths(projectStartDateObj, horizonMonths);
            const diffDays = differenceInDays(repaymentDateObj, expEnd);
            // If ended at least 25 days before expected horizon -> en anticipation
            // If ended at least 25 days after expected horizon -> en retard
            // Otherwise -> dans les délais (on_time)
            if (diffDays <= -25) {
              repaymentTimingStatus = 'anticipation';
              repaymentTimingLabel = `en anticipation le ${finalRepaymentDate}`;
            } else if (diffDays >= 25) {
              repaymentTimingStatus = 'retard';
              repaymentTimingLabel = `en retard le ${finalRepaymentDate}`;
            } else {
              repaymentTimingStatus = 'on_time';
              repaymentTimingLabel = `le ${finalRepaymentDate}`;
            }
          } catch (e) {
            repaymentTimingLabel = `le ${finalRepaymentDate}`;
          }
        } else {
          repaymentTimingLabel = `le ${finalRepaymentDate}`;
        }
      }
    }

    const normContract = (txs.find(t => t["type de contrat"])?.["type de contrat"] || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const metaContract = (propertyMetadata?.investorContractType || propertyMetadata?.contractType || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normName = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const isObligation = normContract.includes("obligation") || normContract.includes("loan") || normContract.includes("pret") ||
                         metaContract.includes("obligation") || metaContract.includes("loan") || metaContract.includes("pret") ||
                         normName.includes("obligation");
    const contractType = isObligation ? "Obligation" : "Royalty";

    return {
      name,
      totalInvested,
      startCapital,
      currentCapital,
      contractType,
      isObligation,
      capitalGain,
      totalRevenues,
      netRevenues,
      commercialAdjustments,
      periodSales,
      yield: effectiveYield,
      annualYield: effectiveAnnualYield,
      timeWeightedTotalYield,
      timeWeightedAnnualYield,
      yearlyYieldHistory,
      monthlyYieldHistory,
      firstInvestmentDate,
      firstRevenueDate,
      lastRevenueDate,
      daysBeforeFirstRevenue,
      daysSinceLastRevenue,
      isPaymentDelayed: !isProjectFinished && daysSinceLastRevenue !== undefined && daysSinceLastRevenue > 31,
      marketplaceFees,
      capitalZeroDate,
      finalRepaymentDate,
      repaymentTimingStatus,
      repaymentTimingLabel,
      expectedEndDate,
      investmentDurationText,
      projectOpeningDate,
      transactions: txs,
      metadata: propertyMetadata,
      ownedBricks,
      currentBrickPrice,
      averageBuyBrickPrice,
      costForOwnedBricks,
      totalBoughtBricks,
      totalPurchaseCost,
      historicalAverageBuyBrickPrice,
      netCostForOwnedBricks,
      netBrickPrice,
      currentTotalValue,
      latentCapitalGain,
      latentCapitalGainPercent
    };
  }).filter(p => {
    if (p.name === "Autre (Boost/Frais)") return false;

    // Filter out properties that arrived strictly after the selected period end date
    if (endDate) {
      const endCutoff = endOfDay(endDate);
      const hasTxBeforeOrOnEnd = p.transactions.some(t => {
        const d = parseDate(t.date);
        return isBefore(d, endCutoff) || d.getTime() === endCutoff.getTime();
      });

      if (!hasTxBeforeOrOnEnd) {
        return false;
      }

      // Check if first purchase/investment was strictly after endDate
      const firstTx = p.transactions
        .filter(t => t.type.toLowerCase().includes("achat"))
        .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0];
      if (firstTx) {
        const firstD = parseDate(firstTx.date);
        if (isAfter(firstD, endCutoff)) {
          return false;
        }
      }
    }

    return true;
  });

  // Handle "Autre" for global stats
  const otherTxs = propertyMap.get("Autre (Boost/Frais)") || [];
  let otherNetRevenues = 0;
  let otherPeriodSales = 0;
  otherTxs.forEach(t => {
    const amount = parseFloat(t["montant (€)"].replace(",", "."));
    const tDate = parseDate(t.date);
    const isInRange = (!startDate || isAfter(tDate, startOfDay(startDate)) || tDate.getTime() === startOfDay(startDate).getTime()) &&
                      (!endDate || isBefore(tDate, endOfDay(endDate)) || tDate.getTime() === endOfDay(endDate).getTime());

    if (isInRange) {
      if (t.type === "Solde boosté" || t.type === "Prime de parrainage" || t.type === "Prélèvement à la source") {
        otherNetRevenues += amount;
      } else if (t.type.includes("Vente") || t.type.includes("Remboursement")) {
        otherPeriodSales += Math.abs(amount);
      }
    }
  });

  const totalInvested = properties.reduce((acc, p) => acc + p.totalInvested, 0);
  const totalStartCapital = properties.reduce((acc, p) => acc + p.startCapital, 0);
  const totalCurrentCapital = properties.reduce((acc, p) => acc + p.currentCapital, 0);
  const totalOwnedBricks = properties.reduce((acc, p) => acc + (p.currentCapital > 0 ? p.ownedBricks : 0), 0);
  const totalCapitalGain = totalCurrentCapital - totalStartCapital;
  const totalNetRevenues = properties.reduce((acc, p) => acc + p.netRevenues, 0) + otherNetRevenues;
  const totalPeriodSales = properties.reduce((acc, p) => acc + p.periodSales, 0) + otherPeriodSales;

  // Breakdown Royalties vs Obligations
  let totalCurrentRoyaltyCapital = 0;
  let totalCurrentObligationCapital = 0;
  let totalStartRoyaltyCapital = 0;
  let totalStartObligationCapital = 0;
  let royaltyActiveProjectsCount = 0;
  let obligationActiveProjectsCount = 0;
  let royaltyOwnedBricks = 0;
  let obligationOwnedBricks = 0;

  properties.forEach(p => {
    if (p.isObligation) {
      totalCurrentObligationCapital += p.currentCapital;
      totalStartObligationCapital += p.startCapital;
      if (p.currentCapital > 0.01) {
        obligationActiveProjectsCount++;
        obligationOwnedBricks += p.ownedBricks;
      }
    } else {
      totalCurrentRoyaltyCapital += p.currentCapital;
      totalStartRoyaltyCapital += p.startCapital;
      if (p.currentCapital > 0.01) {
        royaltyActiveProjectsCount++;
        royaltyOwnedBricks += p.ownedBricks;
      }
    }
  });

  // Compute Project Counts
  let newProjectsCount = 0;
  let activeProjectsCount = 0;
  let periodRefundedProjectsCount = 0;
  let totalRefundedProjectsCount = 0;

  properties.forEach(p => {
    // 1st investment date parsed
    const firstTx = p.transactions
      .filter(t => t.type.includes("Achat"))
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0] || p.transactions[0];
    const firstInvDate = firstTx ? parseDate(firstTx.date) : null;

    // Check if participated for the first time during the period
    if (firstInvDate) {
      const isFirstInvInRange = (!startDate || isAfter(firstInvDate, startOfDay(startDate)) || firstInvDate.getTime() === startOfDay(startDate).getTime()) &&
                                (!endDate || isBefore(firstInvDate, endOfDay(endDate)) || firstInvDate.getTime() === endOfDay(endDate).getTime());
      if (isFirstInvInRange) {
        newProjectsCount++;
      }
    }

    // Active project (capital > 0)
    if (p.currentCapital > 0.01) {
      activeProjectsCount++;
    }

    // Total refunded overall (invested in past, now 0)
    if (p.totalInvested > 0.01 && p.currentCapital <= 0.01) {
      totalRefundedProjectsCount++;
    }

    // Refunded during period (had capital at start or bought during period, fell to 0 by end)
    const wasInvestedBeforeOrDuring = p.startCapital > 0.01 || (firstInvDate && (!startDate || firstInvDate >= startOfDay(startDate)));
    if (wasInvestedBeforeOrDuring && p.currentCapital <= 0.01 && p.totalInvested > 0.01) {
      periodRefundedProjectsCount++;
    }
  });

  // Calculate Wallet Cash Balance (Solde) & period cash in / cash out
  let startSolde = 0;
  let currentSolde = 0;
  let periodCashIn = 0;
  let periodCashOut = 0;
  let periodBankWithdrawals = 0;
  let periodGiftCardsIn = 0;
  let periodGiftCardsOut = 0;
  let periodFees = 0;
  let periodTaxes = 0;
  let periodRoyaltyRevenues = 0;
  let periodObligationRevenues = 0;
  let periodBoostedBalance = 0;
  let periodReferralBonuses = 0;
  let periodCommercialAdjustments = 0;
  let totalCommercialAdjustments = 0;
  let periodCommercialAdjustmentsCount = 0;
  let totalCommercialAdjustmentsCount = 0;

  // Bricks Company Investment Calculation
  let bricksCompanyInvested = 0;
  let bricksCompanyRefunded = 0;
  let hasBricksCompanyInvestment = false;

  const globalPropCapTracker = new Map<string, number>();

  const sortedGlobalTxs = [...validTransactions].map((t, _origIdx) => ({ ...t, _origIdx })).sort((a, b) => {
    const diff = parseDate(a.date).getTime() - parseDate(b.date).getTime();
    if (diff !== 0) return diff;
    return b._origIdx - a._origIdx;
  });

  sortedGlobalTxs.forEach(t => {
    const rawVal = typeof t["montant (€)"] === "number" 
      ? t["montant (€)"] 
      : parseFloat(String(t["montant (€)"] || "0").replace(",", "."));
    if (isNaN(rawVal)) return;

    const amount = Math.abs(rawVal);
    const impact = getSoldeImpact(t.type);
    const delta = amount * impact;

    const tDate = parseDate(t.date);

    const isBeforeStart = startDate && isBefore(tDate, startOfDay(startDate));
    const isBeforeEnd = !endDate || isBefore(tDate, endOfDay(endDate)) || tDate.getTime() === endOfDay(endDate).getTime();

    const normType = normalizeTransactionType(t.type);
    const normProp = (t.propriété || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const propName = t.propriété || "Autre (Boost/Frais)";
    const isReventeTotale = isTotalResaleType(t.type);

    const currentCap = globalPropCapTracker.get(propName) || 0;
    const capitalRestant = currentCap;

    if (propName !== "Autre (Boost/Frais)") {
      if (isPurchaseType(t.type)) {
        globalPropCapTracker.set(propName, currentCap + amount);
      } else if (!isRevenueType(t.type) && isRepaymentOrSaleType(t.type)) {
        globalPropCapTracker.set(propName, Math.max(0, currentCap - amount));
      }
      if (isReventeTotale) {
        globalPropCapTracker.set(propName, 0);
      }
    }

    if (isBeforeStart) {
      startSolde += delta;
    }
    if (isBeforeEnd) {
      currentSolde += delta;

      const isCommercialAdj = normType === TransactionType.AJUSTEMENT_COMMERCIAL || (typeof normType === 'string' && normType.toLowerCase().includes("ajustement"));
      if (isCommercialAdj) {
        totalCommercialAdjustments += amount;
        totalCommercialAdjustmentsCount++;
      }

      const isBricksCompany = 
        normType === TransactionType.INVESTISSEMENT_SOCIETE_BRICKS ||
        normType === TransactionType.REMBOURSEMENT_SOCIETE_BRICKS ||
        normProp.includes("societe bricks");

      if (isBricksCompany) {
        if (normType === TransactionType.REMBOURSEMENT_SOCIETE_BRICKS || (typeof normType === 'string' && normType.toLowerCase().includes("remboursement"))) {
          bricksCompanyRefunded += amount;
        } else {
          bricksCompanyInvested += amount;
          hasBricksCompanyInvestment = true;
        }
      }
    }

    const isInRange = (!startDate || isAfter(tDate, startOfDay(startDate)) || tDate.getTime() === startOfDay(startDate).getTime()) &&
                      (!endDate || isBefore(tDate, endOfDay(endDate)) || tDate.getTime() === endOfDay(endDate).getTime());

    if (isInRange) {
      if (normType === TransactionType.ACHAT_CARTE_CADEAU) {
        periodGiftCardsOut += amount;
        periodCashOut += amount;
      } else if (normType === TransactionType.UTILISATION_CARTE_CADEAU) {
        periodGiftCardsIn += amount;
        periodCashIn += amount;
      } else if (normType === TransactionType.CREDIT_CARTE || normType === TransactionType.CREDIT_VIREMENT) {
        periodCashIn += amount;
      } else if (normType === TransactionType.RETRAIT) {
        periodCashOut += amount;
        periodBankWithdrawals += amount;
      }

      if (isFeeType(t.type)) {
        periodFees += amount;
      }
      // Fiscalité
      if (isTaxType(t.type)) {
        periodTaxes += amount;
      }

      // Revenue classification
      const normContract = (t["type de contrat"] || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedPropName = normalizeName(t.propriété || "");
      const propMeta = metadata.find(m => 
        normalizeName(m.name?.fr || "") === normalizedPropName || 
        normalizeName(m.name?.en || "") === normalizedPropName
      );
      const metaContract = (propMeta?.investorContractType || propMeta?.contractType || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const isObligation = normContract.includes("obligation") || normContract.includes("loan") || normContract.includes("pret") ||
                           metaContract.includes("obligation") || metaContract.includes("loan") || metaContract.includes("pret") ||
                           (typeof normType === 'string' && normType.toLowerCase().includes("obligation")) || normProp.includes("obligation");

      if (!isReventeTotale) {
        if (normType === TransactionType.AJUSTEMENT_COMMERCIAL || (typeof normType === 'string' && normType.toLowerCase().includes("ajustement"))) {
          periodCommercialAdjustments += amount;
          periodCommercialAdjustmentsCount++;
        } else if (
          normType === TransactionType.PARRAINAGE_PARRAIN ||
          normType === TransactionType.PARRAINAGE_FILLEUL ||
          normType === TransactionType.PARRAINAGE_GENERIQUE
        ) {
          periodReferralBonuses += amount;
        } else if (normType === TransactionType.SOLDE_BOOSTE) {
          periodBoostedBalance += amount;
        } else if (isRevenueType(t.type)) {
          if (isObligation) {
            periodObligationRevenues += amount;
          } else {
            periodRoyaltyRevenues += amount;
          }
        }
      }
    }
  });

  const bricksCompanyNetInvested = Math.max(0, bricksCompanyInvested - bricksCompanyRefunded);
  if (bricksCompanyInvested > 0) {
    hasBricksCompanyInvestment = true;
  }

  startSolde = Math.max(0, startSolde);
  currentSolde = Math.max(0, currentSolde);

  const totalStartBalanceAndInvestments = totalStartCapital + startSolde;
  const totalCurrentBalanceAndInvestments = totalCurrentCapital + currentSolde;

  const globalDenominator = totalInvested > 0 ? totalInvested : totalCurrentCapital;
  const averageYield = globalDenominator > 0 ? (totalNetRevenues / globalDenominator) * 100 : 0;

  const totalWeightedAnnualYield = properties.reduce((acc, p) => {
    const weight = p.totalInvested > 0 ? p.totalInvested : p.currentCapital;
    return acc + (p.annualYield * weight);
  }, 0);
  const averageAnnualYield = globalDenominator > 0 ? totalWeightedAnnualYield / globalDenominator : (properties.length > 0 ? properties.reduce((acc, p) => acc + p.annualYield, 0) / properties.length : 0);

  // Global investment duration
  const allPurchaseTxs = validTransactions
    .filter(t => {
      const norm = (t.type || '').toLowerCase();
      return norm.includes("achat") || norm.includes("investissement");
    })
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  
  const earliestGlobalTx = allPurchaseTxs[0] || [...validTransactions].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0];
  const earliestGlobalDateObj = earliestGlobalTx ? parseDate(earliestGlobalTx.date) : null;
  
  let globalInvestmentDurationText: string | undefined = undefined;
  let globalFirstInvestmentDate: string | undefined = undefined;
  let globalAccountAgeText: string | undefined = undefined;

  if (earliestGlobalDateObj) {
    globalFirstInvestmentDate = earliestGlobalTx ? earliestGlobalTx.date : undefined;
    globalAccountAgeText = formatInvestmentDuration(earliestGlobalDateObj, now);
    const globalStart = startDate && isAfter(startDate, earliestGlobalDateObj) ? startDate : earliestGlobalDateObj;
    const globalEnd = endDate && isBefore(endDate, now) ? endDate : now;
    globalInvestmentDurationText = formatInvestmentDuration(globalStart, globalEnd);
  }

  // Calculate average days before 1st revenue across all projects with at least 1 revenue
  const realProperties = properties.filter(p => !p.name.toLowerCase().includes("autre") && p.totalInvested > 0);
  const projectsWithFirstRevenue = realProperties.filter(p => p.daysBeforeFirstRevenue !== undefined);
  let averageDaysBeforeFirstRevenue: number | undefined = undefined;
  const projectsWithRevenueCount = projectsWithFirstRevenue.length;

  if (projectsWithFirstRevenue.length > 0) {
    const totalDays = projectsWithFirstRevenue.reduce((acc, p) => acc + (p.daysBeforeFirstRevenue || 0), 0);
    averageDaysBeforeFirstRevenue = Math.round(totalDays / projectsWithFirstRevenue.length);
  }

  // 1. Global Bricks Valuation (Current valuation = sum of ownedBricks * currentBrickPrice)
  const activeRealProps = realProperties.filter(p => p.currentCapital > 0.01 || p.ownedBricks > 0);
  const totalCurrentBricksValue = Math.round(activeRealProps.reduce((acc, p) => acc + (p.currentTotalValue || 0), 0) * 100) / 100;
  const totalCostForOwnedBricks = Math.round(activeRealProps.reduce((acc, p) => acc + (p.costForOwnedBricks || 0), 0) * 100) / 100;
  const totalLatentCapitalGain = Math.round((totalCurrentBricksValue - totalCostForOwnedBricks) * 100) / 100;
  const totalLatentCapitalGainPercent = totalCostForOwnedBricks > 0 ? Math.round(((totalLatentCapitalGain / totalCostForOwnedBricks) * 100) * 100) / 100 : 0;
  const totalBoughtBricksCount = Math.round(realProperties.reduce((acc, p) => acc + (p.totalBoughtBricks || p.ownedBricks || 0), 0) * 100) / 100;

  // 2. Royalties stats (Revenus locatifs reversés & valorisation)
  const royaltyProps = realProperties.filter(p => !p.isObligation);
  const activeRoyaltyProps = royaltyProps.filter(p => p.currentCapital > 0.01 || p.ownedBricks > 0);
  const refundedRoyaltyProps = royaltyProps.filter(p => p.currentCapital <= 0.01 && p.totalInvested > 0.01);
  
  const royaltyTotalInvested = royaltyProps.reduce((acc, p) => acc + p.totalInvested, 0);
  const royaltyCurrentCapital = royaltyProps.reduce((acc, p) => acc + p.currentCapital, 0);
  const royaltyStartCapital = royaltyProps.reduce((acc, p) => acc + p.startCapital, 0);
  const royaltyCapitalGain = royaltyCurrentCapital - royaltyStartCapital;
  const royaltyOwnedBricksCount = Math.round(activeRoyaltyProps.reduce((acc, p) => acc + p.ownedBricks, 0) * 100) / 100;
  const royaltyTotalBoughtBricks = Math.round(royaltyProps.reduce((acc, p) => acc + (p.totalBoughtBricks || p.ownedBricks || 0), 0) * 100) / 100;
  const royaltyCurrentTotalValue = Math.round(activeRoyaltyProps.reduce((acc, p) => acc + p.currentTotalValue, 0) * 100) / 100;
  const royaltyCostForOwnedBricks = Math.round(activeRoyaltyProps.reduce((acc, p) => acc + p.costForOwnedBricks, 0) * 100) / 100;
  const royaltyLatentCapitalGain = Math.round((royaltyCurrentTotalValue - royaltyCostForOwnedBricks) * 100) / 100;
  const royaltyLatentCapitalGainPercent = royaltyCostForOwnedBricks > 0 ? Math.round(((royaltyLatentCapitalGain / royaltyCostForOwnedBricks) * 100) * 100) / 100 : 0;

  const royaltyPositiveGainProjectsCount = activeRoyaltyProps.filter(p => p.latentCapitalGain > 0.01).length;
  const royaltyNegativeGainProjectsCount = activeRoyaltyProps.filter(p => p.latentCapitalGain < -0.01).length;
  const royaltyNeutralGainProjectsCount = activeRoyaltyProps.filter(p => Math.abs(p.latentCapitalGain) <= 0.01).length;

  const royaltyNetRevenues = royaltyProps.reduce((acc, p) => acc + p.netRevenues, 0);
  const royaltyTotalPeriodSales = royaltyProps.reduce((acc, p) => acc + p.periodSales, 0);
  const royaltyDenominator = royaltyTotalInvested > 0 ? royaltyTotalInvested : royaltyCurrentCapital;
  const royaltyAverageYield = royaltyDenominator > 0 ? (royaltyNetRevenues / royaltyDenominator) * 100 : 0;
  
  const royaltyWeightedAnnualYield = royaltyProps.reduce((acc, p) => {
    const w = p.totalInvested > 0 ? p.totalInvested : p.currentCapital;
    return acc + (p.annualYield * w);
  }, 0);
  const royaltyAverageAnnualYield = royaltyDenominator > 0 ? royaltyWeightedAnnualYield / royaltyDenominator : (royaltyProps.length > 0 ? royaltyProps.reduce((acc, p) => acc + p.annualYield, 0) / royaltyProps.length : 0);

  const royaltyPropsWithFirstRevenue = royaltyProps.filter(p => p.daysBeforeFirstRevenue !== undefined);
  const royaltyAverageDaysBeforeFirstRevenue = royaltyPropsWithFirstRevenue.length > 0 
    ? Math.round(royaltyPropsWithFirstRevenue.reduce((acc, p) => acc + (p.daysBeforeFirstRevenue || 0), 0) / royaltyPropsWithFirstRevenue.length) 
    : undefined;

  const royaltiesStats: ContractTypeStats = {
    contractType: 'Royalty',
    totalProjectsCount: royaltyProps.length,
    activeProjectsCount: activeRoyaltyProps.length,
    refundedProjectsCount: refundedRoyaltyProps.length,
    totalInvested: royaltyTotalInvested,
    currentCapital: royaltyCurrentCapital,
    startCapital: royaltyStartCapital,
    capitalGain: royaltyCapitalGain,
    ownedBricks: royaltyOwnedBricksCount,
    totalBoughtBricks: royaltyTotalBoughtBricks,
    currentTotalValue: royaltyCurrentTotalValue,
    costForOwnedBricks: royaltyCostForOwnedBricks,
    latentCapitalGain: royaltyLatentCapitalGain,
    latentCapitalGainPercent: royaltyLatentCapitalGainPercent,
    positiveGainProjectsCount: royaltyPositiveGainProjectsCount,
    negativeGainProjectsCount: royaltyNegativeGainProjectsCount,
    neutralGainProjectsCount: royaltyNeutralGainProjectsCount,
    netRevenues: royaltyNetRevenues,
    totalHistoricalPeriodSales: royaltyTotalPeriodSales,
    averageYield: royaltyAverageYield,
    averageAnnualYield: royaltyAverageAnnualYield,
    averageDaysBeforeFirstRevenue: royaltyAverageDaysBeforeFirstRevenue,
    projectsWithRevenueCount: royaltyPropsWithFirstRevenue.length
  };

  // 3. Obligations stats (Prêts obligataires participatifs & remboursements)
  const obligationProps = realProperties.filter(p => p.isObligation);
  const activeObligationProps = obligationProps.filter(p => p.currentCapital > 0.01 || p.ownedBricks > 0);
  const refundedObligationProps = obligationProps.filter(p => p.currentCapital <= 0.01 && p.totalInvested > 0.01);
  
  const obligationTotalInvested = obligationProps.reduce((acc, p) => acc + p.totalInvested, 0);
  const obligationCurrentCapital = obligationProps.reduce((acc, p) => acc + p.currentCapital, 0);
  const obligationStartCapital = obligationProps.reduce((acc, p) => acc + p.startCapital, 0);
  const obligationCapitalGain = obligationCurrentCapital - obligationStartCapital;
  const obligationOwnedBricksCount = Math.round(activeObligationProps.reduce((acc, p) => acc + p.ownedBricks, 0) * 100) / 100;
  const obligationTotalBoughtBricks = Math.round(obligationProps.reduce((acc, p) => acc + (p.totalBoughtBricks || p.ownedBricks || 0), 0) * 100) / 100;
  const obligationCurrentTotalValue = Math.round(activeObligationProps.reduce((acc, p) => acc + p.currentTotalValue, 0) * 100) / 100;
  const obligationCostForOwnedBricks = Math.round(activeObligationProps.reduce((acc, p) => acc + p.costForOwnedBricks, 0) * 100) / 100;
  const obligationLatentCapitalGain = Math.round((obligationCurrentTotalValue - obligationCostForOwnedBricks) * 100) / 100;
  const obligationLatentCapitalGainPercent = obligationCostForOwnedBricks > 0 ? Math.round(((obligationLatentCapitalGain / obligationCostForOwnedBricks) * 100) * 100) / 100 : 0;

  const obligationPositiveGainProjectsCount = activeObligationProps.filter(p => p.latentCapitalGain > 0.01).length;
  const obligationNegativeGainProjectsCount = activeObligationProps.filter(p => p.latentCapitalGain < -0.01).length;
  const obligationNeutralGainProjectsCount = activeObligationProps.filter(p => Math.abs(p.latentCapitalGain) <= 0.01).length;

  const obligationNetRevenues = obligationProps.reduce((acc, p) => acc + p.netRevenues, 0);
  const obligationTotalPeriodSales = obligationProps.reduce((acc, p) => acc + p.periodSales, 0);
  const obligationDenominator = obligationTotalInvested > 0 ? obligationTotalInvested : obligationCurrentCapital;
  const obligationAverageYield = obligationDenominator > 0 ? (obligationNetRevenues / obligationDenominator) * 100 : 0;

  const obligationWeightedAnnualYield = obligationProps.reduce((acc, p) => {
    const w = p.totalInvested > 0 ? p.totalInvested : p.currentCapital;
    return acc + (p.annualYield * w);
  }, 0);
  const obligationAverageAnnualYield = obligationDenominator > 0 ? obligationWeightedAnnualYield / obligationDenominator : (obligationProps.length > 0 ? obligationProps.reduce((acc, p) => acc + p.annualYield, 0) / obligationProps.length : 0);

  const obligationPropsWithFirstRevenue = obligationProps.filter(p => p.daysBeforeFirstRevenue !== undefined);
  const obligationAverageDaysBeforeFirstRevenue = obligationPropsWithFirstRevenue.length > 0 
    ? Math.round(obligationPropsWithFirstRevenue.reduce((acc, p) => acc + (p.daysBeforeFirstRevenue || 0), 0) / obligationPropsWithFirstRevenue.length) 
    : undefined;

  const repaidInAdvanceCount = obligationProps.filter(p => p.currentCapital <= 0.01 && p.repaymentTimingStatus === 'anticipation').length;
  const repaidOnTimeCount = obligationProps.filter(p => p.currentCapital <= 0.01 && (p.repaymentTimingStatus === 'on_time' || !p.repaymentTimingStatus)).length;
  const repaidLateCount = obligationProps.filter(p => p.currentCapital <= 0.01 && p.repaymentTimingStatus === 'retard').length;
  const repaymentRate = obligationTotalInvested > 0 ? Math.round((Math.max(0, obligationTotalInvested - obligationCurrentCapital) / obligationTotalInvested) * 10000) / 100 : 0;

  const obligationsStats: ContractTypeStats = {
    contractType: 'Obligation',
    totalProjectsCount: obligationProps.length,
    activeProjectsCount: activeObligationProps.length,
    refundedProjectsCount: refundedObligationProps.length,
    totalInvested: obligationTotalInvested,
    currentCapital: obligationCurrentCapital,
    startCapital: obligationStartCapital,
    capitalGain: obligationCapitalGain,
    ownedBricks: obligationOwnedBricksCount,
    totalBoughtBricks: obligationTotalBoughtBricks,
    currentTotalValue: obligationCurrentTotalValue,
    costForOwnedBricks: obligationCostForOwnedBricks,
    latentCapitalGain: obligationLatentCapitalGain,
    latentCapitalGainPercent: obligationLatentCapitalGainPercent,
    positiveGainProjectsCount: obligationPositiveGainProjectsCount,
    negativeGainProjectsCount: obligationNegativeGainProjectsCount,
    neutralGainProjectsCount: obligationNeutralGainProjectsCount,
    netRevenues: obligationNetRevenues,
    totalHistoricalPeriodSales: obligationTotalPeriodSales,
    averageYield: obligationAverageYield,
    averageAnnualYield: obligationAverageAnnualYield,
    averageDaysBeforeFirstRevenue: obligationAverageDaysBeforeFirstRevenue,
    projectsWithRevenueCount: obligationPropsWithFirstRevenue.length,
    repaidInAdvanceCount,
    repaidOnTimeCount,
    repaidLateCount,
    repaymentRate
  };

  return {
    properties: properties.sort((a, b) => b.currentCapital - a.currentCapital),
    global: {
      totalInvested,
      totalStartCapital,
      totalCurrentCapital,
      totalCurrentRoyaltyCapital,
      totalCurrentObligationCapital,
      totalStartRoyaltyCapital,
      totalStartObligationCapital,
      royaltyActiveProjectsCount,
      obligationActiveProjectsCount,
      royaltyOwnedBricks: Math.round(royaltyOwnedBricks * 100) / 100,
      obligationOwnedBricks: Math.round(obligationOwnedBricks * 100) / 100,
      totalCurrentBricksValue,
      totalCostForOwnedBricks,
      totalLatentCapitalGain,
      totalLatentCapitalGainPercent,
      totalBoughtBricksCount,
      royaltiesStats,
      obligationsStats,
      totalCapitalGain,
      totalNetRevenues,
      periodRoyaltyRevenues,
      periodObligationRevenues,
      periodBoostedBalance,
      periodReferralBonuses,
      periodCommercialAdjustments: Math.round(periodCommercialAdjustments * 100) / 100,
      totalCommercialAdjustments: Math.round(totalCommercialAdjustments * 100) / 100,
      periodCommercialAdjustmentsCount,
      totalCommercialAdjustmentsCount,
      totalPeriodSales,
      periodCashIn,
      periodCashOut,
      periodBankWithdrawals,
      periodGiftCards: periodGiftCardsOut,
      periodGiftCardsIn,
      periodGiftCardsOut,
      periodFees,
      periodTaxes,
      periodFeesAndTaxes: periodFees + periodTaxes,
      bricksCompanyInvested,
      bricksCompanyRefunded,
      bricksCompanyNetInvested,
      hasBricksCompanyInvestment,
      averageYield,
      averageAnnualYield,
      firstInvestmentDate: globalFirstInvestmentDate,
      accountAgeText: globalAccountAgeText,
      investmentDurationText: globalInvestmentDurationText,
      averageDaysBeforeFirstRevenue,
      projectsWithRevenueCount,
      startSolde,
      currentSolde,
      totalStartBalanceAndInvestments,
      totalCurrentBalanceAndInvestments,
      newProjectsCount,
      activeProjectsCount,
      totalOwnedBricks: Math.round(totalOwnedBricks * 100) / 100,
      periodRefundedProjectsCount,
      totalRefundedProjectsCount
    }
  };
};

export type { PatrimoinePoint } from "../types";
import { PatrimoinePoint } from "../types";

export const getPatrimoineTimeline = (
  allTransactions: Transaction[],
  startDate: Date | null,
  endDate: Date | null,
  metadata: ProjectMetadata[] = []
): PatrimoinePoint[] => {
  const validTransactions = allTransactions.filter(t => t.statut === "Validée");
  if (validTransactions.length === 0) return [];

  const sortedAsc = [...validTransactions].map((t, originalIdx) => ({
    ...t,
    originalIdx,
    parsedDate: parseDate(t.date)
  })).sort((a, b) => {
    const diff = a.parsedDate.getTime() - b.parsedDate.getTime();
    if (diff !== 0) return diff;
    return b.originalIdx - a.originalIdx;
  });

  let runningSolde = 0;
  const propertyCapitalMap = new Map<string, number>();
  const propertyContractTypeMap = new Map<string, boolean>(); // true if obligation

  const fullHistory: { 
    dateObj: Date; 
    dateStr: string; 
    solde: number; 
    capital: number; 
    royaltyCapital: number;
    obligationCapital: number;
    patrimoine: number 
  }[] = [];

  sortedAsc.forEach(t => {
    const rawVal = typeof t["montant (€)"] === "number" 
      ? t["montant (€)"] 
      : parseFloat(String(t["montant (€)"] || "0").replace(",", "."));

    if (!isNaN(rawVal)) {
      const amount = Math.abs(rawVal);
      const impactSolde = getSoldeImpact(t.type);
      runningSolde += amount * impactSolde;
      if (runningSolde < 0) runningSolde = 0;

      const propName = t.propriété || "Autre (Boost/Frais)";
      if (propName !== "Autre (Boost/Frais)") {
        let propCap = propertyCapitalMap.get(propName) || 0;
        const normType = (t.type || '').toLowerCase();

        if (normType.includes("achat")) {
          propCap += amount;
        } else if (normType.includes("vente") || normType.includes("remboursement")) {
          propCap = Math.max(0, propCap - amount);
        }

        if (normType.includes("revente totale") || normType.includes("revente-totale")) {
          propCap = 0;
        }

        propertyCapitalMap.set(propName, propCap);

        // Detect obligation vs royalty
        if (!propertyContractTypeMap.has(propName)) {
          const normContract = (t["type de contrat"] || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const normalizedPropName = normalizeName(propName);
          const propMeta = metadata?.find(m => 
            normalizeName(m.name?.fr || "") === normalizedPropName || 
            normalizeName(m.name?.en || "") === normalizedPropName
          );
          const metaContract = (propMeta?.investorContractType || propMeta?.contractType || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isObligation = normContract.includes("obligation") || normContract.includes("loan") || normContract.includes("pret") ||
                               metaContract.includes("obligation") || metaContract.includes("loan") || metaContract.includes("pret") ||
                               normalizedPropName.includes("obligation");
          propertyContractTypeMap.set(propName, isObligation);
        }
      }
    }

    let runningRoyaltyCap = 0;
    let runningObligationCap = 0;

    propertyCapitalMap.forEach((cap, pName) => {
      const isOblig = propertyContractTypeMap.get(pName) || false;
      if (isOblig) {
        runningObligationCap += cap;
      } else {
        runningRoyaltyCap += cap;
      }
    });

    const runningCapital = runningRoyaltyCap + runningObligationCap;

    fullHistory.push({
      dateObj: t.parsedDate,
      dateStr: t.date,
      solde: Math.round(runningSolde * 100) / 100,
      capital: Math.round(runningCapital * 100) / 100,
      royaltyCapital: Math.round(runningRoyaltyCap * 100) / 100,
      obligationCapital: Math.round(runningObligationCap * 100) / 100,
      patrimoine: Math.round((runningSolde + runningCapital) * 100) / 100
    });
  });

  const rangeStart = startDate ? startOfDay(startDate) : null;
  const rangeEnd = endDate ? endOfDay(endDate) : null;

  let baselineSolde = 0;
  let baselineCapital = 0;
  let baselineRoyaltyCap = 0;
  let baselineObligationCap = 0;

  if (rangeStart) {
    for (const p of fullHistory) {
      if (isBefore(p.dateObj, rangeStart)) {
        baselineSolde = p.solde;
        baselineCapital = p.capital;
        baselineRoyaltyCap = p.royaltyCapital;
        baselineObligationCap = p.obligationCapital;
      } else {
        break;
      }
    }
  }

  const pointsInRange = fullHistory.filter(p => {
    if (rangeStart && isBefore(p.dateObj, rangeStart)) return false;
    if (rangeEnd && isAfter(p.dateObj, rangeEnd)) return false;
    return true;
  });

  const dateMap = new Map<string, { 
    dateObj: Date; 
    solde: number; 
    capital: number; 
    royaltyCapital: number;
    obligationCapital: number;
    patrimoine: number 
  }>();

  if (rangeStart) {
    const startStr = format(rangeStart, "dd/MM/yyyy");
    dateMap.set(startStr, {
      dateObj: rangeStart,
      solde: baselineSolde,
      capital: baselineCapital,
      royaltyCapital: baselineRoyaltyCap,
      obligationCapital: baselineObligationCap,
      patrimoine: Math.round((baselineSolde + baselineCapital) * 100) / 100
    });
  }

  pointsInRange.forEach(p => {
    dateMap.set(p.dateStr, {
      dateObj: p.dateObj,
      solde: p.solde,
      capital: p.capital,
      royaltyCapital: p.royaltyCapital,
      obligationCapital: p.obligationCapital,
      patrimoine: p.patrimoine
    });
  });

  if (rangeEnd) {
    const endStr = format(rangeEnd, "dd/MM/yyyy");
    if (!dateMap.has(endStr)) {
      const last = pointsInRange.length > 0 ? pointsInRange[pointsInRange.length - 1] : {
        solde: baselineSolde,
        capital: baselineCapital,
        royaltyCapital: baselineRoyaltyCap,
        obligationCapital: baselineObligationCap,
        patrimoine: Math.round((baselineSolde + baselineCapital) * 100) / 100
      };
      dateMap.set(endStr, {
        dateObj: rangeEnd,
        solde: last.solde,
        capital: last.capital,
        royaltyCapital: last.royaltyCapital,
        obligationCapital: last.obligationCapital,
        patrimoine: last.patrimoine
      });
    }
  }

  return Array.from(dateMap.entries()).map(([dStr, item]) => ({
    date: dStr,
    formattedDate: format(item.dateObj, "dd/MM/yy"),
    dateObj: item.dateObj,
    solde: item.solde,
    capital: item.capital,
    royaltyCapital: item.royaltyCapital,
    obligationCapital: item.obligationCapital,
    patrimoine: item.patrimoine
  })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
};

export const getPropertyTimeline = (
  propertyTransactions: Transaction[]
): PropertyTimelinePoint[] => {
  const validTransactions = propertyTransactions.filter(t => t.statut === "Validée");
  if (validTransactions.length === 0) return [];

  // Sort ascending by parsed date
  const sortedAsc = [...validTransactions].map((t, originalIdx) => ({
    ...t,
    originalIdx,
    parsedDate: parseDate(t.date)
  })).sort((a, b) => {
    const diff = a.parsedDate.getTime() - b.parsedDate.getTime();
    if (diff !== 0) return diff;
    return a.originalIdx - b.originalIdx;
  });

  let runningCapital = 0;
  let cumulativeRevenue = 0;

  // Group by month YYYY-MM
  const monthMap = new Map<string, {
    dateObj: Date;
    dateStr: string;
    monthlyRevenue: number;
    cumulativeRevenue: number;
    capital: number;
    periodInvestment: number;
    periodRepayment: number;
  }>();

  sortedAsc.forEach(t => {
    const rawVal = typeof t["montant (€)"] === "number"
      ? t["montant (€)"]
      : parseFloat(String(t["montant (€)"] || "0").replace(",", "."));
    
    if (isNaN(rawVal)) return;
    const amount = Math.abs(rawVal);
    const normalizedType = normalizeTransactionType(t.type);

    let monthlyRevDelta = 0;
    let invDelta = 0;
    let repDelta = 0;

    if (isPurchaseType(t.type)) {
      runningCapital += amount;
      invDelta += amount;
    } else if (isRepaymentOrSaleType(t.type)) {
      runningCapital = Math.max(0, runningCapital - amount);
      repDelta += amount;
    }

    if (isTotalResaleType(t.type)) {
      runningCapital = 0;
    }

    if (isRevenueType(t.type)) {
      monthlyRevDelta += amount;
      cumulativeRevenue += amount;
    }

    if (normalizedType === TransactionType.AJUSTEMENT_COMMERCIAL) {
      monthlyRevDelta += amount;
      cumulativeRevenue += amount;
    }

    const monthKey = format(t.parsedDate, "yyyy-MM");
    const existing = monthMap.get(monthKey);

    if (existing) {
      existing.monthlyRevenue += monthlyRevDelta;
      existing.cumulativeRevenue = cumulativeRevenue;
      existing.capital = runningCapital;
      existing.periodInvestment += invDelta;
      existing.periodRepayment += repDelta;
      if (isAfter(t.parsedDate, existing.dateObj)) {
        existing.dateObj = t.parsedDate;
        existing.dateStr = t.date;
      }
    } else {
      monthMap.set(monthKey, {
        dateObj: t.parsedDate,
        dateStr: t.date,
        monthlyRevenue: monthlyRevDelta,
        cumulativeRevenue,
        capital: runningCapital,
        periodInvestment: invDelta,
        periodRepayment: repDelta
      });
    }
  });

  const monthKeys = Array.from(monthMap.keys()).sort();
  if (monthKeys.length === 0) return [];

  const firstDate = monthMap.get(monthKeys[0])!.dateObj;
  const lastDate = monthMap.get(monthKeys[monthKeys.length - 1])!.dateObj;

  const result: PropertyTimelinePoint[] = [];
  let curr = startOfMonth(firstDate);
  const end = startOfMonth(lastDate);

  let prevCapital = 0;
  let prevCumulativeRevenue = 0;

  while (!isAfter(curr, end)) {
    const key = format(curr, "yyyy-MM");
    const monthData = monthMap.get(key);

    if (monthData) {
      prevCapital = monthData.capital;
      prevCumulativeRevenue = monthData.cumulativeRevenue;
      result.push({
        date: monthData.dateStr,
        formattedDate: format(curr, "MM/yy"),
        dateObj: monthData.dateObj,
        monthlyRevenue: Math.round(monthData.monthlyRevenue * 100) / 100,
        cumulativeRevenue: Math.round(monthData.cumulativeRevenue * 100) / 100,
        capital: Math.round(monthData.capital * 100) / 100,
        periodInvestment: Math.round(monthData.periodInvestment * 100) / 100,
        periodRepayment: Math.round(monthData.periodRepayment * 100) / 100
      });
    } else {
      result.push({
        date: format(endOfMonth(curr), "dd/MM/yyyy"),
        formattedDate: format(curr, "MM/yy"),
        dateObj: endOfMonth(curr),
        monthlyRevenue: 0,
        cumulativeRevenue: Math.round(prevCumulativeRevenue * 100) / 100,
        capital: Math.round(prevCapital * 100) / 100,
        periodInvestment: 0,
        periodRepayment: 0
      });
    }

    curr = addMonths(curr, 1);
  }

  return result;
};

