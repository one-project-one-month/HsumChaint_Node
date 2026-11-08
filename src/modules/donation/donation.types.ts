// HsumChaint.Shared/CommonEnum/{DonationStatus,DonationType}.cs
export const DONATION_STATUS = {
  PendingReview: 0,
  Accepted: 1,
  Scheduled: 2,
  Completed: 3,
  Rejected: 4,
  Cancelled: 5,
} as const;

export type DonationStatusName = keyof typeof DONATION_STATUS;
export type DonationStatusCode = (typeof DONATION_STATUS)[DonationStatusName];
export type DonationStatus = DonationStatusName;

export const DONATION_STATUS_METADATA = [
  { id: 0, name: 'PendingReview', label: 'Pending Review' },
  { id: 1, name: 'Accepted', label: 'Accepted' },
  { id: 2, name: 'Scheduled', label: 'Scheduled' },
  { id: 3, name: 'Completed', label: 'Completed' },
  { id: 4, name: 'Rejected', label: 'Rejected' },
  { id: 5, name: 'Cancelled', label: 'Cancelled' },
] as const;

export const DONATION_TYPE = {
  Money: 0,
  Food: 1,
  Medicine: 2,
  Robe: 3,
  Supplies: 4,
  Other: 5,
} as const;

export type DonationTypeName = keyof typeof DONATION_TYPE;
export type DonationTypeCode = (typeof DONATION_TYPE)[DonationTypeName];
export type DonationType = DonationTypeName;

export const DONATION_PERMISSIONS = [
  'Donation.View',
  'Donation.Create',
  'Donation.Review',
  'Donation.Schedule',
  'Donation.Cancel',
  'Donation.Delete',
] as const;

export type DonationPermission = (typeof DONATION_PERMISSIONS)[number];

export const DONATION_NOTIFICATION_TYPE = 5;

export interface DonationDto {
  id: number;
  monasterySpaceId: number;
  donorId: number | null;
  donorName: string | null;
  donationType: number;
  customDonationType: string | null;
  note: string | null;
  amount: number | string | null;
  quantity: number | string | null;
  status: number;
  reviewerId: number | null;
  createdAt: Date;
  reviewedAt: Date | null;
  pickupTime: Date | null;
  dropoffTime: Date | null;
  completedAt: Date | null;
  seriesId?: string | null;
  seriesIndex?: number | null;
  seriesTotal?: number | null;
}

export interface MonthlyDonationDayDto {
  day: number;
  date: string;
  donationsCount: number;
  donations: DonationDto[];
}

export interface MonthlyDonationSummaryDto {
  year: number;
  month: number;
  totalDonationsCount: number;
  totalAmount: string;
  days: MonthlyDonationDayDto[];
}

export interface PaginatedDonationsDto {
  items: DonationDto[];
  pagination: {
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
  };
}

export interface CursorPaginatedDonationsDto {
  items: DonationDto[];
  pagination: {
    nextCursor: number | null;
    hasNextPage: boolean;
    pageSize: number;
  };
}
