import { PropertyStats } from '../types';

/**
 * Extracts project identifier (slug, name, or id) from current URL.
 * Supports:
 * - Search query: ?projet=Nom%20du%20projet or ?project=...
 * - Pathname: /projet/Nom-du-projet or /project/...
 * - Hash: #/projet/Nom-du-projet or #projet=...
 */
export function getProjectIdentifierFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Search params
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('projet') || searchParams.get('project');
    if (fromSearch && fromSearch.trim()) {
      return decodeURIComponent(fromSearch.trim());
    }

    // 2. Pathname (/projet/:slug or /project/:slug)
    const pathname = window.location.pathname;
    const pathMatch = pathname.match(/^\/(?:projet|project)\/([^/?#]+)/i);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1].trim());
    }

    // 3. Hash (#/projet/:slug or #projet=...)
    const hash = window.location.hash;
    if (hash) {
      const hashPathMatch = hash.match(/^#\/?(?:projet|project)\/([^/?#&]+)/i);
      if (hashPathMatch && hashPathMatch[1]) {
        return decodeURIComponent(hashPathMatch[1].trim());
      }
      const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));
      const fromHash = hashParams.get('projet') || hashParams.get('project');
      if (fromHash && fromHash.trim()) {
        return decodeURIComponent(fromHash.trim());
      }
    }
  } catch (e) {
    console.error('Error parsing project from URL:', e);
  }

  return null;
}

/**
 * Normalizes text for comparison (removes accents, whitespace, case).
 */
function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Converts text to a clean URL slug.
 */
export function toSlug(str: string): string {
  return normalizeString(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves a PropertyStats item from an identifier (ID, exact name, or slug).
 */
export function findPropertyByIdOrSlug(
  identifier: string,
  properties: PropertyStats[]
): PropertyStats | undefined {
  if (!identifier || !properties || properties.length === 0) return undefined;
  
  const rawClean = identifier.trim();
  const lowerClean = rawClean.toLowerCase();
  const normalizedClean = normalizeString(rawClean);
  const slugClean = toSlug(rawClean);

  // 1. Match by metadata ID
  const byId = properties.find(p => p.metadata?.id && p.metadata.id.toLowerCase() === lowerClean);
  if (byId) return byId;

  // 2. Match by exact name
  const byExactName = properties.find(p => p.name.trim().toLowerCase() === lowerClean);
  if (byExactName) return byExactName;

  // 3. Match by normalized name (ignoring accents)
  const byNormName = properties.find(p => normalizeString(p.name) === normalizedClean);
  if (byNormName) return byNormName;

  // 4. Match by slug
  const bySlug = properties.find(p => toSlug(p.name) === slugClean);
  if (bySlug) return bySlug;

  // 5. Match by metadata name or address if available
  const byMeta = properties.find(p => {
    if (p.metadata?.name?.fr && toSlug(p.metadata.name.fr) === slugClean) return true;
    if (p.metadata?.name?.en && toSlug(p.metadata.name.en) === slugClean) return true;
    if (p.metadata?.address?.fr && toSlug(p.metadata.address.fr).includes(slugClean)) return true;
    return false;
  });
  if (byMeta) return byMeta;

  // 6. Substring match for fuzzy search
  if (slugClean.length >= 3) {
    const bySubstring = properties.find(p => {
      const pSlug = toSlug(p.name);
      return pSlug.includes(slugClean) || slugClean.includes(pSlug);
    });
    if (bySubstring) return bySubstring;
  }

  return undefined;
}

/**
 * Updates browser history URL for the selected project or clears it for dashboard.
 */
export function updateProjectUrl(propertyName: string | null, replace: boolean = false): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);

    if (propertyName) {
      url.searchParams.set('projet', propertyName);
      // Clean up path / hash if necessary
      if (url.pathname.startsWith('/projet/') || url.pathname.startsWith('/project/')) {
        url.pathname = '/';
      }
      if (url.hash.startsWith('#/projet/') || url.hash.startsWith('#/project/')) {
        url.hash = '';
      }
      if (replace) {
        window.history.replaceState({ projet: propertyName }, '', url.toString());
      } else {
        window.history.pushState({ projet: propertyName }, '', url.toString());
      }
    } else {
      url.searchParams.delete('projet');
      url.searchParams.delete('project');
      if (url.pathname.startsWith('/projet/') || url.pathname.startsWith('/project/')) {
        url.pathname = '/';
      }
      if (url.hash.startsWith('#/projet/') || url.hash.startsWith('#/project/')) {
        url.hash = '';
      }
      if (replace) {
        window.history.replaceState({}, '', url.toString());
      } else {
        window.history.pushState({}, '', url.toString());
      }
    }
  } catch (e) {
    console.error('Error updating project URL:', e);
  }
}
