import { Transaction, ProjectMetadata } from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'bricks_saved_transactions',
  METADATA: 'bricks_saved_metadata',
  FILE_NAME: 'bricks_saved_file_name',
  LAST_UPDATE: 'bricks_saved_timestamp',
  VISIBLE_COLUMNS: 'bricks_visible_columns',
  CONTRACT_FILTER: 'bricks_contract_filter',
  REIMBURSEMENT_FILTER: 'bricks_reimbursement_filter',
};

/**
 * Safely retrieve visible columns selection
 */
export function getStoredVisibleColumns<T>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VISIBLE_COLUMNS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Safely save visible columns selection
 */
export function saveStoredVisibleColumns<T>(columns: T): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VISIBLE_COLUMNS, JSON.stringify(columns));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Safely retrieve stored transactions from localStorage
 */
export function getStoredTransactions(): Transaction[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('Unable to load transactions from localStorage:', e);
  }
  return null;
}

/**
 * Safely persist transactions into localStorage
 */
export function saveStoredTransactions(transactions: Transaction[]): boolean {
  try {
    if (!transactions || transactions.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      return true;
    }
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString());
    return true;
  } catch (e) {
    console.warn('Unable to save transactions to localStorage (quota exceeded?):', e);
    return false;
  }
}

/**
 * Safely retrieve stored project metadata from localStorage
 */
export function getStoredMetadata(): ProjectMetadata[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.METADATA);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('Unable to load metadata from localStorage:', e);
  }
  return null;
}

/**
 * Safely persist project metadata into localStorage
 */
export function saveStoredMetadata(metadata: ProjectMetadata[]): boolean {
  try {
    if (!metadata || metadata.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.METADATA);
      return true;
    }
    localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));
    return true;
  } catch (e) {
    console.warn('Unable to save metadata to localStorage:', e);
    return false;
  }
}

/**
 * Safely retrieve the last loaded file name
 */
export function getStoredFileName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.FILE_NAME);
  } catch {
    return null;
  }
}

/**
 * Safely persist the loaded file name
 */
export function saveStoredFileName(fileName: string | null): void {
  try {
    if (fileName) {
      localStorage.setItem(STORAGE_KEYS.FILE_NAME, fileName);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FILE_NAME);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all stored data (transactions, file name, metadata)
 */
export function clearAllStoredData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.METADATA);
    localStorage.removeItem(STORAGE_KEYS.FILE_NAME);
    localStorage.removeItem(STORAGE_KEYS.LAST_UPDATE);
  } catch (e) {
    console.warn('Unable to clear localStorage:', e);
  }
}
