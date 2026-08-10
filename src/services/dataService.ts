import { parse, format, isAfter, isBefore, subMonths, subYears, startOfDay, endOfDay, getYear, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { Transaction, PropertyStats, GlobalStats, ProjectMetadata } from "../types";

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

export const getSoldeImpact = (typeStr: string): number => {
  if (!typeStr) return 0;
  const norm = typeStr.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Inflows (+1)
  if (norm.includes("remboursement")) {
    // Remboursement de capital, Remboursement partiel d'investissement...
    return 1;
  }
  if (norm.includes("solde booste")) {
    return 1;
  }
  if (norm.includes("credit") || norm.includes("depot") || norm.includes("recharge") || norm.includes("alimentation")) {
    // Crédit par carte, Crédit par virement...
    return 1;
  }
  if (norm.includes("vente")) {
    // Vente Marketplace...
    return 1;
  }
  if (norm.includes("revenus")) {
    // Revenus reversés, Revenus reversés - revente d'un lot, Revenus reversés - revente totale...
    return 1;
  }
  if (norm.includes("ajustement commercial")) {
    return 1;
  }
  if (norm.includes("prime de parrainage") || norm.includes("parrainage")) {
    // Prime de parrainage, en tant que parrain, en tant que filleul...
    return 1;
  }
  if (norm.includes("carte cadeau")) {
    if (norm.includes("achat")) return -1; // Achat de carte cadeau
    return 1; // Utilisation de la carte cadeau
  }

  // 2. Outflows (-1)
  if (
    norm.includes("achat") || // Achat de bricks, Achat marketplace, Frais d'achat marketplace...
    norm.includes("prelevement") || // Prélèvement à la source
    norm.includes("retrait") || // Retrait
    norm.includes("frais") || // Frais d'achat marketplace
    norm.includes("investissement") // Investissement dans la société Bricks
  ) {
    return -1;
  }

  // Default fallback
  return 1;
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
    let periodSales = 0;

    // Find earliest investment date (first purchase by user)
    const sortedTxsAsc = [...txs].map((t, _origIdx) => ({ ...t, _origIdx })).sort((a, b) => {
      const diff = parseDate(a.date).getTime() - parseDate(b.date).getTime();
      if (diff !== 0) return diff;
      return b._origIdx - a._origIdx;
    });
    const purchaseTxs = sortedTxsAsc.filter(t => t.type.includes("Achat") && !t.type.toLowerCase().includes("frais"));
    const firstTx = purchaseTxs.length > 0 ? purchaseTxs[0] : sortedTxsAsc[0];
    const firstInvestmentDate = firstTx ? firstTx.date : undefined;
    const firstInvestmentDateObj = firstTx ? parseDate(firstTx.date) : null;

    let totalResaleOccurredBeforeEnd = false;
    let runningCapital = 0;
    let capitalZeroDateStr: string | undefined = undefined;

    sortedTxsAsc.forEach(t => {
      const amount = parseFloat(t["montant (€)"].replace(",", "."));
      const tDate = parseDate(t.date);
      const normTypeLower = t.type.toLowerCase();
      const isReventeTotale = normTypeLower.includes("revente totale") || normTypeLower.includes("revente-totale");
      const isRevente = normTypeLower.includes("revente");
      const isFrais = normTypeLower.includes("frais");
      const isRevenus = normTypeLower.includes("revenus");
      const isPureRevenus = isRevenus && !isRevente;

      const prevCap = runningCapital;
      // Track running capital chronologically
      if (t.type.includes("Achat") && !isFrais) {
        runningCapital += Math.abs(amount);
      } else if (!isRevenus && (t.type.includes("Vente") || t.type.includes("Remboursement")) && !isFrais) {
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
      if (t.type.includes("Achat") && !isFrais) {
        totalInvested += Math.abs(amount);
      }

      // Start capital (cumulative before startDate)
      if (isBeforeStart) {
        if (t.type.includes("Achat") && !isFrais) {
          startCapital += Math.abs(amount);
        } else if (!isRevenus && (t.type.includes("Vente") || t.type.includes("Remboursement")) && !isFrais) {
          startCapital -= Math.abs(amount);
        }
        if (isReventeTotale) {
          startCapital = 0;
        }
      }

      // End capital (cumulative up to endDate)
      if (isBeforeEnd) {
        if (t.type.includes("Achat") && !isFrais) {
          currentCapital += Math.abs(amount);
        } else if (!isRevenus && (t.type.includes("Vente") || t.type.includes("Remboursement")) && !isFrais) {
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
        if ((t.type.includes("Revenus reversés") && !isRevente) || t.type === "Solde boosté" || t.type === "Prime de parrainage") {
          totalRevenues += amount;
          netRevenues += amount;
        } else if (t.type === "Prélèvement à la source") {
          netRevenues += amount;
        } else if (t.type.includes("Vente") || t.type.includes("Remboursement") || isRevente) {
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

    ownedBricks = Math.round(ownedBricks * 1000) / 1000;
    costForOwnedBricks = Math.round(costForOwnedBricks * 100) / 100;
    const averageBuyBrickPrice = ownedBricks > 0 ? costForOwnedBricks / ownedBricks : 0;
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
      } else if (sortedTxsAsc.length > 0) {
        const lastTxDateObj = parseDate(sortedTxsAsc[sortedTxsAsc.length - 1].date);
        fullEnd = isBefore(lastTxDateObj, now) ? lastTxDateObj : now;
      }

      const days = Math.max(1, differenceInDays(periodEnd, periodStart));
      const yearsElapsed = Math.max(days / 365.25, 1 / 12); // minimum 1 month
      annualYield = yieldVal / yearsElapsed;

      // Always calculate the total loan/investment duration from first purchase date to final capital 0 date (or last active date)
      const fullStart = firstInvestmentDateObj;
      if (isAfter(fullEnd, fullStart)) {
        investmentDurationText = formatInvestmentDuration(fullStart, fullEnd);
      } else {
        investmentDurationText = formatInvestmentDuration(fullStart, now);
      }
    }

    // Project opening date from metadata
    let projectOpeningDate: string | undefined = undefined;
    if (propertyMetadata?.funding?.startedAt) {
      try {
        const startDateObj = new Date(propertyMetadata.funding.startedAt);
        if (!isNaN(startDateObj.getTime())) {
          projectOpeningDate = format(startDateObj, "dd/MM/yyyy");
        }
      } catch (e) {
        // fallback
      }
    }

    return {
      name,
      totalInvested,
      startCapital,
      currentCapital,
      capitalGain,
      totalRevenues,
      netRevenues,
      periodSales,
      yield: yieldVal,
      annualYield,
      firstInvestmentDate,
      capitalZeroDate,
      investmentDurationText,
      projectOpeningDate,
      transactions: txs,
      metadata: propertyMetadata,
      ownedBricks,
      currentBrickPrice,
      averageBuyBrickPrice,
      costForOwnedBricks,
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

    const normType = (t.type || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normProp = (t.propriété || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const propName = t.propriété || "Autre (Boost/Frais)";
    const isReventeTotale = normType.includes("revente totale") || normType.includes("revente-totale");

    const currentCap = globalPropCapTracker.get(propName) || 0;
    const capitalRestant = currentCap;

    if (propName !== "Autre (Boost/Frais)") {
      if (normType.includes("achat")) {
        globalPropCapTracker.set(propName, currentCap + amount);
      } else if (!normType.includes("revenus") && (normType.includes("vente") || normType.includes("remboursement"))) {
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

      const isBricksCompany = 
        normType.includes("investissement dans la societe bricks") ||
        normType.includes("societe bricks") ||
        normProp.includes("investissement dans la societe bricks") ||
        normProp.includes("societe bricks") ||
        (normType.includes("investissement") && (normType.includes("bricks") || normProp.includes("bricks")));

      if (isBricksCompany) {
        if (normType.includes("remboursement")) {
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
      const norm = normType;
      if (norm.includes("carte cadeau"))
      {
        if (norm.includes("achat"))
        {
          periodGiftCardsOut += amount;
          periodCashOut += amount;
        }
        else if (norm.includes("utilisation"))
        {
          periodGiftCardsIn += amount;
          periodCashIn += amount;
        }
      }
      else if (norm.includes("credit") || norm.includes("depot") || norm.includes("recharge") || norm.includes("alimentation")) {
        periodCashIn += amount;
      } else if (norm.includes("retrait")) {
        periodCashOut += amount;
        periodBankWithdrawals += amount;
      }
      if (norm.includes("frais")) {
        periodFees += amount;
      }
      if (norm.includes("prelevement") || norm.includes("impot") || norm.includes("tax")) {
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
                           norm.includes("obligation") || norm.includes("interet") || normProp.includes("obligation");

      if (!isReventeTotale) {
        if (norm.includes("parrainage")) {
          periodReferralBonuses += amount;
        } else if (norm.includes("solde booste") || norm.includes("boost")) {
          periodBoostedBalance += amount;
        } else if (norm.includes("revenus") || norm.includes("loyer") || norm.includes("royalt") || norm.includes("obligation") || norm.includes("interet") || norm.includes("coupon")) {
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
    .filter(t => t.type && t.type.toLowerCase().includes("achat"))
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  
  const earliestGlobalTx = allPurchaseTxs[0] || [...validTransactions].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0];
  const earliestGlobalDateObj = earliestGlobalTx ? parseDate(earliestGlobalTx.date) : null;
  
  let globalInvestmentDurationText: string | undefined = undefined;
  let globalFirstInvestmentDate: string | undefined = undefined;

  if (earliestGlobalDateObj) {
    globalFirstInvestmentDate = earliestGlobalTx ? earliestGlobalTx.date : undefined;
    const globalStart = startDate && isAfter(startDate, earliestGlobalDateObj) ? startDate : earliestGlobalDateObj;
    const globalEnd = endDate && isBefore(endDate, now) ? endDate : now;
    globalInvestmentDurationText = formatInvestmentDuration(globalStart, globalEnd);
  }

  return {
    properties: properties.sort((a, b) => b.currentCapital - a.currentCapital),
    global: {
      totalInvested,
      totalStartCapital,
      totalCurrentCapital,
      totalCapitalGain,
      totalNetRevenues,
      periodRoyaltyRevenues,
      periodObligationRevenues,
      periodBoostedBalance,
      periodReferralBonuses,
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
      investmentDurationText: globalInvestmentDurationText,
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

export interface PatrimoinePoint {
  date: string;
  formattedDate: string;
  dateObj: Date;
  solde: number;
  capital: number;
  patrimoine: number;
}

export const getPatrimoineTimeline = (
  allTransactions: Transaction[],
  startDate: Date | null,
  endDate: Date | null
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

  const fullHistory: { dateObj: Date; dateStr: string; solde: number; capital: number; patrimoine: number }[] = [];

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
      }
    }

    const runningCapital = Array.from(propertyCapitalMap.values()).reduce((sum, c) => sum + c, 0);

    fullHistory.push({
      dateObj: t.parsedDate,
      dateStr: t.date,
      solde: Math.round(runningSolde * 100) / 100,
      capital: Math.round(runningCapital * 100) / 100,
      patrimoine: Math.round((runningSolde + runningCapital) * 100) / 100
    });
  });

  const rangeStart = startDate ? startOfDay(startDate) : null;
  const rangeEnd = endDate ? endOfDay(endDate) : null;

  let baselineSolde = 0;
  let baselineCapital = 0;
  if (rangeStart) {
    for (const p of fullHistory) {
      if (isBefore(p.dateObj, rangeStart)) {
        baselineSolde = p.solde;
        baselineCapital = p.capital;
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

  const dateMap = new Map<string, { dateObj: Date; solde: number; capital: number; patrimoine: number }>();

  if (rangeStart) {
    const startStr = format(rangeStart, "dd/MM/yyyy");
    dateMap.set(startStr, {
      dateObj: rangeStart,
      solde: baselineSolde,
      capital: baselineCapital,
      patrimoine: Math.round((baselineSolde + baselineCapital) * 100) / 100
    });
  }

  pointsInRange.forEach(p => {
    dateMap.set(p.dateStr, {
      dateObj: p.dateObj,
      solde: p.solde,
      capital: p.capital,
      patrimoine: p.patrimoine
    });
  });

  if (rangeEnd) {
    const endStr = format(rangeEnd, "dd/MM/yyyy");
    if (!dateMap.has(endStr)) {
      const last = pointsInRange.length > 0 ? pointsInRange[pointsInRange.length - 1] : {
        solde: baselineSolde,
        capital: baselineCapital,
        patrimoine: Math.round((baselineSolde + baselineCapital) * 100) / 100
      };
      dateMap.set(endStr, {
        dateObj: rangeEnd,
        solde: last.solde,
        capital: last.capital,
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
    patrimoine: item.patrimoine
  })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
};
