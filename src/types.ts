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
  periodSales: number; // Sales / capital returns on period
  yield: number; // Rendement Total
  annualYield: number; // Rendement par an / annuel
  firstInvestmentDate?: string; // Date du premier achat de l'investisseur (dd/MM/yyyy)
  capitalZeroDate?: string; // Date à laquelle le capital est passé à 0 (dd/MM/yyyy)
  investmentDurationText?: string; // Durée d'investissement (ex: "2 ans et 4 mois", "6 mois")
  projectOpeningDate?: string; // Date d'ouverture/lancement du projet (dd/MM/yyyy)
  transactions: Transaction[];
  metadata?: ProjectMetadata;
  // Bricks details
  ownedBricks: number; // Nombre de briques possédées
  currentBrickPrice: number; // Prix actuel par brique (€)
  averageBuyBrickPrice: number; // Prix moyen d'achat par brique (€)
  costForOwnedBricks: number; // Coût total d'achat des briques actuellement détenues (€)
  currentTotalValue: number; // Valeur actuelle totale des briques (€)
  latentCapitalGain: number; // Plus ou moins-value latente (€)
  latentCapitalGainPercent: number; // Plus ou moins-value latente (%)
}

export interface GlobalStats {
  totalInvested: number;
  totalStartCapital: number;
  totalCurrentCapital: number; // Encours d'investissement
  totalCapitalGain: number;
  totalNetRevenues: number;
  periodRoyaltyRevenues: number;
  periodObligationRevenues: number;
  periodBoostedBalance: number;
  periodReferralBonuses: number;
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
  investmentDurationText?: string;

  // Wallet cash balance (Solde) & combined total capital
  startSolde: number;
  currentSolde: number;
  totalStartBalanceAndInvestments: number; // totalStartCapital + startSolde
  totalCurrentBalanceAndInvestments: number; // totalCurrentCapital + currentSolde

  // Frais & Impôts sur la période
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
