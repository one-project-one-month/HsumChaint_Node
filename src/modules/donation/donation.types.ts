// HsumChaint.Shared/CommonEnum/{DonationStatus,DonationType}.cs
export const DONATION_STATUS = {
  Draft: 0,
  Submitted: 1,
  PendingReview: 2,
  Accepted: 3,
  Scheduled: 4,
  Completed: 5,
  Rejected: 6,
  Cancelled: 7,
} as const;

export type DonationStatusName = keyof typeof DONATION_STATUS;
export type DonationStatusCode = (typeof DONATION_STATUS)[DonationStatusName];
export type DonationStatus = DonationStatusName;

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
  amount: string | null;
  quantity: string | null;
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
