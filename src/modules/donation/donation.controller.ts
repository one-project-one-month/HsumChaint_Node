import type { NextFunction, Request, Response } from 'express';
import {
  sendCursorPaginatedResponse,
  sendPaginatedResponse,
  sendSuccessResponse,
} from '@/utils/response';
import type {
  BatchDonationInput,
  CancelDonationInput,
  DonationFeedQueryInput,
  DonationQueryInput,
  ManualDonationInput,
  ManualRecurringInput,
  MonthlyQueryInput,
  RequestDonationInput,
  RequestRecurringInput,
  ReviewDonationInput,
  ScheduleDonationInput,
  UpdateDonationStatusInput,
} from './donation.schema';
import {
  cancelDonationSeriesService,
  cancelDonationService,
  completeDonationService,
  createBatchDonationsService,
  createManualDonationService,
  createManualRecurringDonationService,
  deleteDonationService,
  getDonationByIdService,
  getDonationStatusesService,
  getDonationsFeedService,
  getDonationsService,
  getMonthlyDonationSummaryService,
  requestDonationService,
  requestRecurringDonationService,
  reviewDonationSeriesService,
  reviewDonationService,
  scheduleDonationService,
  updateDonationStatusDirectlyService,
} from './donation.service';

// ============================================================================
// Public Catalog Handlers
// ============================================================================

export const getDonationStatuses = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = getDonationStatusesService();
    return sendSuccessResponse(res, result, 'Donation statuses retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// Creation & Request Handlers
// ============================================================================

export const requestDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as RequestDonationInput;
    const result = await requestDonationService(req.user.userId, body);
    return sendSuccessResponse(res, result, 'Donation request submitted successfully.', 201);
  } catch (err) {
    next(err);
  }
};

export const createManualDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as ManualDonationInput & { monasterySpaceId: number };
    const result = await createManualDonationService(req.user.userId, body);
    return sendSuccessResponse(res, result, 'Manual donation recorded successfully.', 201);
  } catch (err) {
    next(err);
  }
};

export const createBatchDonations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as BatchDonationInput & { monasterySpaceId?: number };
    const result = await createBatchDonationsService(req.user.userId, body);
    return sendSuccessResponse(res, result, 'Batch donations created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

export const requestRecurringDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as RequestRecurringInput & { monasterySpaceId: number };
    const result = await requestRecurringDonationService(req.user.userId, body);
    return sendSuccessResponse(
      res,
      result,
      'Recurring donation series requested successfully.',
      201
    );
  } catch (err) {
    next(err);
  }
};

export const createManualRecurringDonation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body as ManualRecurringInput & { monasterySpaceId: number };
    const result = await createManualRecurringDonationService(req.user.userId, body);
    return sendSuccessResponse(res, result, 'Recurring donation series created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// List, Feed & Detail Handlers
// ============================================================================

export const getDonations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as DonationQueryInput;
    const result = await getDonationsService(req.user.userId, query);
    return sendPaginatedResponse(
      res,
      result.items,
      result.pagination,
      'Donations retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

export const getDonationsFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as DonationFeedQueryInput;
    const result = await getDonationsFeedService(req.user.userId, query);
    return sendCursorPaginatedResponse(
      res,
      result.items,
      result.pagination,
      'Donations feed retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

export const getDonationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    const result = await getDonationByIdService(req.user.userId, donationId);
    return sendSuccessResponse(res, result, 'Donation retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

export const getMonthlySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as MonthlyQueryInput;
    query.year = Number(query.year);
    query.month = Number(query.month);
    const result = await getMonthlyDonationSummaryService(req.user.userId, query);
    return sendSuccessResponse(res, result, 'Monthly calendar summary retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// Single Donation Lifecycle Handlers
// ============================================================================

export const reviewDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    const body = req.body as ReviewDonationInput;
    const result = await reviewDonationService(req.user.userId, donationId, body);
    return sendSuccessResponse(res, result, 'Donation review successful.');
  } catch (err) {
    next(err);
  }
};

export const scheduleDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    const body = req.body as ScheduleDonationInput;
    const result = await scheduleDonationService(req.user.userId, donationId, body);
    return sendSuccessResponse(res, result, 'Donation schedule successful.');
  } catch (err) {
    next(err);
  }
};

export const completeDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    const result = await completeDonationService(req.user.userId, donationId);
    return sendSuccessResponse(res, result, 'Donation marked complete.');
  } catch (err) {
    next(err);
  }
};

export const cancelDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    const body = req.body as CancelDonationInput;
    const result = await cancelDonationService(req.user.userId, donationId, body);
    return sendSuccessResponse(res, result, 'Donation cancelled successfully.');
  } catch (err) {
    next(err);
  }
};

export const deleteDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const donationId = Number(req.params.donationId);
    await deleteDonationService(req.user.userId, donationId);
    return sendSuccessResponse(res, null, 'Donation deleted successfully.');
  } catch (err) {
    next(err);
  }
};

export const updateDonationStatusDirectly = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const donationId = Number(req.params.donationId);
    const body = req.body as UpdateDonationStatusInput;
    const result = await updateDonationStatusDirectlyService(req.user.userId, donationId, body);
    return sendSuccessResponse(res, result, 'Donation status updated successfully.');
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// Recurring Donation Series Handlers
// ============================================================================

export const reviewDonationSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = String(req.params.seriesId);
    const body = req.body as ReviewDonationInput;
    const result = await reviewDonationSeriesService(req.user.userId, seriesId, body);
    return sendSuccessResponse(res, result, 'Recurring donation series reviewed successfully.');
  } catch (err) {
    next(err);
  }
};

export const cancelDonationSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seriesId = String(req.params.seriesId);
    const body = req.body as CancelDonationInput;
    const result = await cancelDonationSeriesService(req.user.userId, seriesId, body);
    return sendSuccessResponse(res, result, 'Recurring donation series cancelled successfully.');
  } catch (err) {
    next(err);
  }
};
