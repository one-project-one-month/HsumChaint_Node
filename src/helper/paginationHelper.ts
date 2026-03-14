import { Request } from 'express';

// Types for pagination metadata
export interface PaginationMeta {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

export interface PaginationLinks {
  next: string | null;
  prev: string | null;
}

export interface PaginationData {
  meta: PaginationMeta;
  links: PaginationLinks;
}

/**
 * Generates complete pagination data including metadata and navigation links
 * @function generatePaginationData
 * @param {Request} req - Express request object
 * @param {number} total - Total number of items
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} perPage - Number of items per page
 * @returns {PaginationData} Complete pagination data structure
 *
 * @example
 * // Returns full pagination data in one call
 * const pagination = generatePaginationData(req, 150, 2, 10);
 */
export function generatePaginationData(
  req: Request,
  total: number,
  currentPage: number,
  perPage: number
): PaginationData {
  if (total === 0) {
    return {
      meta: { total: 0, currentPage: 1, lastPage: 1, perPage },
      links: { next: null, prev: null },
    };
  }

  const lastPage = Math.ceil(total / perPage);

  // Generate metadata
  const meta: PaginationMeta = {
    total,
    currentPage,
    lastPage,
    perPage,
  };

  // Generate links
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const queryParams = new URLSearchParams();

  // Preserve existing query parameters
  Object.entries(req.query).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.set(key, String(value));
    }
  });

  queryParams.set('limit', perPage.toString());

  const links: PaginationLinks = {
    next: null,
    prev: null,
  };

  if (currentPage < lastPage) {
    queryParams.set('page', (currentPage + 1).toString());
    links.next = `${baseUrl}?${queryParams.toString()}`;
  }

  if (currentPage > 1) {
    queryParams.set('page', (currentPage - 1).toString());
    links.prev = `${baseUrl}?${queryParams.toString()}`;
  }

  return {
    meta,
    links,
  };
}
/*
Example response:
*/
// {
//     "meta": {
//       "total": 150,
//       "currentPage": 2,
//       "lastPage": 15,
//       "perPage": 10
//     },
//     "links": {
//       "next": "https://api.example.com/donors?search=john&limit=10&page=3",
//       "prev": "https://api.example.com/donors?search=john&limit=10&page=1"
//     }
//   }