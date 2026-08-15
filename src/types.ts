export enum TransactionType {
  ACHAT_BRICKS = "Achat de bricks",
  ACHAT_MARKETPLACE = "Achat marketplace",
  FRAIS_ACHAT_MARKETPLACE = "Frais d’achat marketplace",
  VENTE_MARKETPLACE = "Vente Marketplace",
  REVENUS_REVERSES = "Revenus reversés",
  REVENUS_REVENTE_LOT = "Revenus reversés - revente d'un lot",
  REVENUS_REVENTE_TOTALE = "Revenus reversés - revente totale",
  REMBOURSEMENT_CAPITAL = "Remboursement de capital",
  PRELEVEMENT_SOURCE = "Prélèvement à la source",
  AJUSTEMENT_COMMERCIAL = "Ajustement commercial",
  SOLDE_BOOSTE = "Solde boosté",
  CREDIT_CARTE = "Crédit par carte",
  CREDIT_VIREMENT = "Crédit par virement",
  RETRAIT = "Retrait",
  ACHAT_CARTE_CADEAU = "Achat de carte cadeau",
  UTILISATION_CARTE_CADEAU = "Utilisation de la carte cadeau",
  PARRAINAGE_PARRAIN = "Prime de parrainage en tant que parrain",
  PARRAINAGE_FILLEUL = "Prime de parrainage en tant que filleul",
  PARRAINAGE_GENERIQUE = "Prime de parrainage",
  INVESTISSEMENT_SOCIETE_BRICKS = "Investissement dans la société Bricks",
  REMBOURSEMENT_SOCIETE_BRICKS = "Remboursement partiel d'investissement dans la société Bricks",
}

export type TransactionTypeCategory = 
  | 'purchase' 
  | 'revenue' 
  | 'repayment' 
  | 'sale' 
  | 'fee' 
  | 'tax' 
  | 'cash_in' 
  | 'cash_out' 
  | 'other';

export const normalizeTransactionType = (rawType: string): TransactionType | string => {
  if (!rawType) return rawType;
  const clean = rawType.trim();
  // Normalize apostrophes (curly to straight)
  const normApostrophe = clean.replace(/['’]/g, "'");
  
  for (const enumVal of Object.values(TransactionType)) {
    if (enumVal.replace(/['’]/g, "'").toLowerCase() === normApostrophe.toLowerCase()) {
      return enumVal;
    }
  }
  return clean;
};

export const isPurchaseType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("achat") && !norm.includes("frais") && !norm.includes("carte cadeau");
};

export const isRevenueType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (norm.includes("revenus") || norm.includes("loyer") || norm.includes("royalt") || norm.includes("solde booste") || norm.includes("parrainage")) && !norm.includes("revente totale");
};

export const isRepaymentOrSaleType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("vente") || norm.includes("remboursement") || norm.includes("revente");
};

export const isTotalResaleType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("revente totale") || norm.includes("revente-totale");
};

export const isFeeType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("frais");
};

export const isTaxType = (type: string): boolean => {
  const norm = (type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("prelevement") || norm.includes("tax") || norm.includes("impot");
};

export interface Transaction {
  id: string;
  date: string;
  type: string;
  statut: string;
  propriété: string;
  "type de contrat": string;
  "montant (€)": string;
  "prix de la brick (€)": string;
}

export interface PropertyStats {
  name: string;
  totalInvested: number; // Total money put in (purchases)
  startCapital: number; // Capital at start of period
  currentCapital: number; // Capital at end of period
  capitalGain: number; // Capital variation during period (currentCapital - startCapital)
  totalRevenues: number; // Sum of "Revenus reversés"
  netRevenues: number; // Revenues - Taxes (pure yield / rents)
  royaltyRevenues?: number;
  obligationRevenues?: number;
  commercialAdjustments?: number;
  periodSales: number; // Sales / capital returns on period
  yield: number; // Rendement Total
  annualYield: number; // Rendement par an / annuel
  firstInvestmentDate?: string; // Date du premier achat de l'investisseur (dd/MM/yyyy)
  firstRevenueDate?: string; // Date du premier versement de revenu (dd/MM/yyyy)
  daysBeforeFirstRevenue?: number; // Nombre de jours entre le 1er investissement et le 1er revenu
  capitalZeroDate?: string; // Date à laquelle le capital est passé à 0 (dd/MM/yyyy)
  finalRepaymentDate?: string; // Date du remboursement final ou de revente (dd/MM/yyyy)
  repaymentTimingStatus?: 'anticipation' | 'retard' | 'on_time'; // Statut par rapport à la durée initiale
  repaymentTimingLabel?: string; // Ex: "en anticipation le 15/03/2024", "en retard le 15/03/2024"
  expectedEndDate?: string; // Date de fin initialement prévue (dd/MM/yyyy)
  investmentDurationText?: string; // Durée d'investissement (ex: "2 ans et 4 mois", "6 mois")
  projectOpeningDate?: string; // Date d'ouverture/lancement du projet (dd/MM/yyyy)
  transactions: Transaction[];
  metadata?: ProjectMetadata;
  contractType?: string;
  isObligation?: boolean;
  // Bricks details
  ownedBricks: number; // Nombre de briques possédées
  currentBrickPrice: number; // Prix actuel par brique (€)
  averageBuyBrickPrice: number; // Prix moyen d'achat / PRU par brique (€)
  costForOwnedBricks: number; // Coût total de revient des briques actuellement détenues (€)
  totalBoughtBricks?: number; // Nombre total de briques achetées historiquement
  totalPurchaseCost?: number; // Coût total d'achat historique de toutes les briques (€)
  historicalAverageBuyBrickPrice?: number; // Prix moyen d'achat historique (€)
  netCostForOwnedBricks?: number; // Prix de revient net après loyers/intérêts perçus (€)
  netBrickPrice?: number; // Prix de revient net unitaire par brique (€)
  currentTotalValue: number; // Valeur actuelle totale des briques (€)
  latentCapitalGain: number; // Plus ou moins-value latente (€)
  latentCapitalGainPercent: number; // Plus ou moins-value latente (%)
}

export interface GlobalStats {
  totalInvested: number;
  totalStartCapital: number;
  totalCurrentCapital: number; // Encours d'investissement
  totalCurrentRoyaltyCapital: number; // Encours Royalties
  totalCurrentObligationCapital: number; // Encours Obligations
  totalStartRoyaltyCapital?: number;
  totalStartObligationCapital?: number;
  royaltyActiveProjectsCount?: number;
  obligationActiveProjectsCount?: number;
  royaltyOwnedBricks?: number;
  obligationOwnedBricks?: number;
  totalCapitalGain: number;
  totalNetRevenues: number;
  periodRoyaltyRevenues: number;
  periodObligationRevenues: number;
  periodBoostedBalance: number;
  periodReferralBonuses: number;
  periodCommercialAdjustments: number;
  totalCommercialAdjustments: number;
  periodCommercialAdjustmentsCount: number;
  totalCommercialAdjustmentsCount: number;
  totalPeriodSales: number;
  periodCashIn: number; // Dépôts & crédits sur la période (ajout d'argent)
  periodCashOut: number; // Retraits & cartes cadeaux sur la période (sortie d'argent)
  periodBankWithdrawals: number; // Retraits bancaires
  periodGiftCards: number; // Achats de carte cadeau
  periodGiftCardsIn?: number;
  periodGiftCardsOut?: number;
  averageYield: number;
  averageAnnualYield?: number;
  firstInvestmentDate?: string;
  accountAgeText?: string;
  investmentDurationText?: string;
  averageDaysBeforeFirstRevenue?: number;
  projectsWithRevenueCount?: number;

  // Wallet cash balance (Solde) & combined total capital
  startSolde: number;
  currentSolde: number;
  totalStartBalanceAndInvestments: number; // totalStartCapital + startSolde
  totalCurrentBalanceAndInvestments: number; // totalCurrentCapital + currentSolde

  // Frais & Fiscalité sur la période
  periodFees: number;
  periodTaxes: number;
  periodFeesAndTaxes: number;

  // Bricks company investment
  bricksCompanyInvested?: number;
  bricksCompanyRefunded?: number;
  bricksCompanyNetInvested?: number;
  hasBricksCompanyInvestment?: boolean;

  // Project count metrics
  newProjectsCount: number; // Participé pour la 1ère fois durant la période
  activeProjectsCount: number; // En cours (capital > 0)
  totalOwnedBricks: number; // Nombre total de briques possédées en cours
  periodRefundedProjectsCount: number; // Tombé à 0 durant la période
  totalRefundedProjectsCount: number; // Tombé à 0 au total (remboursé)
}

export interface ProjectMetadata {
  id: string;
  name: {
    en: string;
    fr: string;
  };
  address: {
    en: string;
    fr: string;
  };
  investorContractType?: string;
  contractType?: string;
  publishStatus: string;
  thumbnailUrl: string;
  imageGallery: string[];
  totalNumberOfBricks: number;
  brickPrice: number; // in cents
  investmentHorizonInMonths: number;
  yearlyTotalRentabilityPercentage: number;
  hasBricksAvailable: boolean;
  singleInvestorMaximumBrickPurchaseCapacity: number;
  documents: {
    type: string;
    url: string;
  }[];
  funding: {
    startedAt: string;
    maxEndDate: string;
    amountToFundCents: number;
    brickPrice?: number;
    investorCount: number;
    purchasedBrickCount: number;
    autoInvestPurchasedBrickCount: number;
    ended?: {
      type: string;
      at: string;
    };
  };
  financialStatus: string;
  ownedBricks: number;
  investorBricks: {
    owned: number;
    onSale: number;
  };
}

export interface ProjectGroup {
  yearMonthDate: string;
  total: number;
  projects: ProjectMetadata[];
}

export interface PropertyTimelinePoint {
  date: string;
  formattedDate: string;
  dateObj: Date;
  monthlyRevenue: number;
  cumulativeRevenue: number;
  capital: number;
  periodInvestment?: number;
  periodRepayment?: number;
}
