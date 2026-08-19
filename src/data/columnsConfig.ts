import React from 'react';
import { PropertyStats } from '../types';
import { Blocks, Building2, Calendar, Coins, TrendingUp, DollarSign, Clock, CheckCircle2, ShieldAlert, Sparkles, Layers, Percent } from 'lucide-react';

export type PropertyColumnKey = 
  | 'name'
  | 'contractType'
  | 'status'
  | 'share'
  | 'startCapital'
  | 'currentCapital'
  | 'totalInvested'
  | 'capitalGain'
  | 'periodSales'
  | 'ownedBricks'
  | 'currentBrickPrice'
  | 'averageBuyBrickPrice'
  | 'costForOwnedBricks'
  | 'netCostForOwnedBricks'
  | 'netBrickPrice'
  | 'currentTotalValue'
  | 'latentCapitalGain'
  | 'netRevenues'
  | 'totalRevenues'
  | 'commercialAdjustments'
  | 'marketplaceFees'
  | 'yield'
  | 'annualYield'
  | 'firstInvestmentDate'
  | 'investmentDuration'
  | 'firstRevenueDate'
  | 'lastRevenueDate'
  | 'daysBeforeFirstRevenue'
  | 'daysSinceLastRevenue'
  | 'expectedEndDate'
  | 'repaymentTiming'
  | 'capitalZeroDate';

export type ColumnCategory = 'general' | 'capital' | 'bricks' | 'revenues' | 'dates';

export interface ColumnDefinition {
  id: PropertyColumnKey;
  label: string;
  shortLabel?: string;
  category: ColumnCategory;
  categoryLabel: string;
  description: string;
  defaultVisible: boolean;
  align?: 'left' | 'right' | 'center';
}

export const PROPERTY_COLUMNS: ColumnDefinition[] = [
  // 1. Général & Identité
  {
    id: 'name',
    label: 'Immeuble',
    shortLabel: 'Immeuble',
    category: 'general',
    categoryLabel: 'Général & Type',
    description: 'Nom du projet, adresse et miniature',
    defaultVisible: true,
    align: 'left',
  },
  {
    id: 'contractType',
    label: 'Type de contrat',
    shortLabel: 'Contrat',
    category: 'general',
    categoryLabel: 'Général & Type',
    description: 'Royalty ou Obligation',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'status',
    label: 'Statut du projet',
    shortLabel: 'Statut',
    category: 'general',
    categoryLabel: 'Général & Type',
    description: 'En cours, remboursé ou retard de paiement',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'share',
    label: 'Part du portefeuille',
    shortLabel: 'Part',
    category: 'general',
    categoryLabel: 'Général & Type',
    description: 'Pourcentage du capital restant par rapport au total portefeuille',
    defaultVisible: true,
    align: 'right',
  },

  // 2. Capital & Investissements
  {
    id: 'firstInvestmentDate',
    label: 'Date 1er Achat',
    shortLabel: '1er Achat',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: "Date de la première souscription/achat de briques",
    defaultVisible: true,
    align: 'center',
  },
  {
    id: 'startCapital',
    label: 'Capital (Début)',
    shortLabel: 'Capital (Début)',
    category: 'capital',
    categoryLabel: 'Capital & Ventes',
    description: 'Capital investi au début de la période sélectionnée',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'currentCapital',
    label: 'Capital (Fin / En cours)',
    shortLabel: 'Capital (Fin)',
    category: 'capital',
    categoryLabel: 'Capital & Ventes',
    description: 'Capital actif restant à la fin de période',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'totalInvested',
    label: 'Total investi cumulé',
    shortLabel: 'Total Investi',
    category: 'capital',
    categoryLabel: 'Capital & Ventes',
    description: 'Montant total historique de tous les achats de briques',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'capitalGain',
    label: 'Gain / Variation Capital',
    shortLabel: 'Gain Capital',
    category: 'capital',
    categoryLabel: 'Capital & Ventes',
    description: 'Variation du capital sur la période (Fin - Début)',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'periodSales',
    label: 'Ventes & Remboursements',
    shortLabel: 'Ventes',
    category: 'capital',
    categoryLabel: 'Capital & Ventes',
    description: 'Montant du capital amorti ou revendu sur la période',
    defaultVisible: true,
    align: 'right',
  },

  // 3. Briques & Valorisation
  {
    id: 'ownedBricks',
    label: 'Briques détenues',
    shortLabel: 'Briques',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Nombre de parts/briques actuellement en portefeuille',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'currentBrickPrice',
    label: 'Prix de la brique',
    shortLabel: 'Prix Brique',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Valeur nominale unitaire actuelle',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'averageBuyBrickPrice',
    label: 'Prix moyen d’achat (PRU)',
    shortLabel: 'PRU Brique',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Prix de revient unitaire moyen des briques détenues',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'costForOwnedBricks',
    label: 'Coût d’achat des briques détenues',
    shortLabel: 'Coût Achat',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Somme brute dépensée pour acquérir les briques détenues',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'currentTotalValue',
    label: 'Valeur actuelle totale',
    shortLabel: 'Valeur Actuelle',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Briques détenues × Prix de la brique',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'latentCapitalGain',
    label: 'Plus-value latente (€ et %)',
    shortLabel: 'PV Latente',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Différence entre la valeur actuelle et le coût d’achat',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'netCostForOwnedBricks',
    label: 'Prix de revient net (après loyers)',
    shortLabel: 'Coût Net Total',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Coût d’achat moins loyers et intérêts perçus',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'netBrickPrice',
    label: 'PRU Net / Brique',
    shortLabel: 'PRU Net/br.',
    category: 'bricks',
    categoryLabel: 'Briques & Valorisation',
    description: 'Coût de revient unitaire net après loyers',
    defaultVisible: false,
    align: 'right',
  },

  // 4. Revenus & Rendements
  {
    id: 'netRevenues',
    label: 'Revenus Nets perçus',
    shortLabel: 'Revenus Nets',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Total des loyers ou intérêts nets perçus sur la période',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'totalRevenues',
    label: 'Revenus Bruts',
    shortLabel: 'Revenus Bruts',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Revenus avant déduction des prélèvements',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'commercialAdjustments',
    label: 'Ajustements commerciaux',
    shortLabel: 'Ajustements',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Primes et compensations reçues pour cet immeuble',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'marketplaceFees',
    label: 'Frais Marketplace',
    shortLabel: 'Frais MP',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Total des frais d’achat marketplace payés sur ce projet',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'yield',
    label: 'Rendement Total (%)',
    shortLabel: 'Rendement Total',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Rendement net cumulé pondéré sur le capital investi',
    defaultVisible: true,
    align: 'right',
  },
  {
    id: 'annualYield',
    label: 'Rendement / An (%)',
    shortLabel: 'Rendement / An',
    category: 'revenues',
    categoryLabel: 'Revenus & Rendements',
    description: 'Rendement moyen annualisé',
    defaultVisible: true,
    align: 'right',
  },

  // 5. Dates & Délais
  {
    id: 'firstRevenueDate',
    label: 'Date 1er Revenu',
    shortLabel: '1er Revenu',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Date du premier versement de loyer/intérêts',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'daysBeforeFirstRevenue',
    label: 'Délai 1er revenu (attente)',
    shortLabel: 'Délai 1er Loyer',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Nombre de jours d’attente entre l’achat et le 1er loyer versé',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'lastRevenueDate',
    label: 'Date Dernier Revenu',
    shortLabel: 'Dernier Revenu',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Date du versement de loyer ou coupon le plus récent',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'daysSinceLastRevenue',
    label: 'Jours depuis dernier revenu',
    shortLabel: 'Sans loyer depuis',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Nombre de jours écoulés depuis le dernier loyer versé (alerte si > 31 j)',
    defaultVisible: false,
    align: 'right',
  },
  {
    id: 'investmentDuration',
    label: 'Durée du prêt / détention',
    shortLabel: 'Durée Prêt',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Durée totale du prêt (du 1er achat au remboursement ou date actuelle)',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'expectedEndDate',
    label: 'Échéance prévue (Horizon)',
    shortLabel: 'Échéance',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Date de fin ou maturité théorique selon l’horizon initial du projet',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'repaymentTiming',
    label: 'Statut Remboursement (Anticipation / Retard)',
    shortLabel: 'Remboursement',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Statut temporel : remboursé en anticipation, à l’heure ou en retard',
    defaultVisible: false,
    align: 'center',
  },
  {
    id: 'capitalZeroDate',
    label: 'Date fin / Capital 0',
    shortLabel: 'Date Fin',
    category: 'dates',
    categoryLabel: 'Dates & Délais',
    description: 'Date effective à laquelle le capital restant est tombé à 0€',
    defaultVisible: false,
    align: 'center',
  }
];

export const DEFAULT_VISIBLE_COLUMNS: PropertyColumnKey[] = [
  'name',
  'firstInvestmentDate',
  'startCapital',
  'currentCapital',
  'ownedBricks',
  'capitalGain',
  'netRevenues',
  'periodSales',
  'yield',
  'annualYield',
  'share'
];

export interface ColumnPreset {
  id: string;
  name: string;
  description: string;
  columns: PropertyColumnKey[];
}

export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: 'default',
    name: 'Par défaut (11 colonnes)',
    description: 'La vue standard équilibrée avec la part de portefeuille',
    columns: [
      'name',
      'firstInvestmentDate',
      'startCapital',
      'currentCapital',
      'ownedBricks',
      'capitalGain',
      'netRevenues',
      'periodSales',
      'yield',
      'annualYield',
      'share'
    ]
  },
  {
    id: 'essential',
    name: 'Essentiel (7 colonnes)',
    description: 'Vue épurée et synthétique pour un coup d’œil rapide',
    columns: [
      'name',
      'currentCapital',
      'ownedBricks',
      'netRevenues',
      'yield',
      'annualYield',
      'share'
    ]
  },
  {
    id: 'performance',
    name: 'Rendements & Revenus (10 colonnes)',
    description: 'Idéal pour comparer la rentabilité et les flux de trésorerie',
    columns: [
      'name',
      'contractType',
      'currentCapital',
      'netRevenues',
      'totalRevenues',
      'yield',
      'annualYield',
      'firstRevenueDate',
      'daysBeforeFirstRevenue',
      'share'
    ]
  },
  {
    id: 'valuation',
    name: 'Briques & Valorisation (10 colonnes)',
    description: 'Focus sur les briques, prix de revient PRU et plus-values latentes',
    columns: [
      'name',
      'ownedBricks',
      'currentBrickPrice',
      'averageBuyBrickPrice',
      'costForOwnedBricks',
      'currentTotalValue',
      'latentCapitalGain',
      'netBrickPrice',
      'currentCapital',
      'share'
    ]
  },
  {
    id: 'timeline',
    name: 'Délais & Calendrier (9 colonnes)',
    description: 'Dates d’achat, durée de prêt et calendrier des remboursements',
    columns: [
      'name',
      'contractType',
      'status',
      'firstInvestmentDate',
      'investmentDuration',
      'lastRevenueDate',
      'periodSales',
      'repaymentTiming',
      'currentCapital'
    ]
  },
  {
    id: 'all',
    name: 'Tout afficher (Toutes colonnes)',
    description: 'Affiche toutes les 31 métriques calculées pour une comparaison complète',
    columns: PROPERTY_COLUMNS.map(c => c.id)
  }
];
