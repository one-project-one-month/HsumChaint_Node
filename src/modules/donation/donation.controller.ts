import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { successResponse } from '@/utils/response';
import {
  type BatchDonationInput,
  type DonationInput,
  type DonationQueryInput,
  type ManualDonationInput,
  type ManualRecurringInput,
  type MonthlyQueryInput,
  queryStatusSchema,
  type RecurringInput,
  type ReviewDonationInput,
  type ScheduleDonationInput,
} from './donation.schema';
import {
  authorizeDonationEndpointService,
  cancelDonationSeriesService,
  cancelDonationService,
  completeDonationService,
  createBatchDonationsService,
  type createDonationService,
  createManualDonationService,
  createRecurringDonationService,
  deleteDonationService,
  getDonationByIdService,
  getDonationsService,
  getMonthlyDonationSummaryService,
  requestDonationService,
  reviewDonationSeriesService,
  reviewDonationService,
  scheduleDonationService,
} from './donation.service';

function getCustomService(req: Request) {
  return (req as unknown as { donationService?: ReturnType<typeof createDonationService> })
    .donationService;
}

function resolveSpaceId(req: Request): number | undefined {
  if (req.params.spaceId !== undefined) {
    return Number(req.params.spaceId);
  }
  if (req.body?.monasterySpaceId !== undefined) {
    return Number(req.body.monasterySpaceId);
  }
  if (req.query?.monasterySpaceId !== undefined) {
    return Number(req.query.monasterySpaceId);
  }
  return undefined;
}

function resolveDonationId(req: Request): number {
  return Number(req.params.donationId ?? req.params.id);
}

export const maybePassthroughCalendar: RequestHandler = (req, _res, next) => {
  if (
    req.params.spaceId === undefined &&
    req.query.year === undefined &&
    req.query.month === undefined
  ) {
    return next('router');
  }
  next();
};

export const requestDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = resolveSpaceId(req) ?? 0;
    const body = req.body as DonationInput;
    const customSvc = getCustomService(req);
    const result = customSvc
      ? await customSvc.request(req.user.userId, spaceId, body)
      : await requestDonationService(req.user.userId, spaceId, body);
    return successResponse(res, result, 'Donation request submitted successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const createManualDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = resolveSpaceId(req) ?? 0;
    const body = req.body as ManualDonationInput;
    const customSvc = getCustomService(req);
    const result = customSvc
      ? await customSvc.manual(req.user.userId, spaceId, body)
      : await createManualDonationService(req.user.userId, spaceId, body);
    return successResponse(res, result, 'Manual donation recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const createBatchDonations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = resolveSpaceId(req) ?? 0;
    const body = req.body as BatchDonationInput;
    const customSvc = getCustomService(req);
    const result = customSvc
      ? await customSvc.batch(req.user.userId, spaceId, body)
      : await createBatchDonationsService(req.user.userId, spaceId, body);
    return successResponse(res, result, 'Batch donations created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const requestRecurringDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = resolveSpaceId(req) ?? 0;
    const body = req.body as RecurringInput;
    const customSvc = getCustomService(req);
    const result = customSvc
      ? await customSvc.recurring(req.user.userId, spaceId, body, false)
      : await createRecurringDonationService(req.user.userId, spaceId, body, false);
    return successResponse(res, result, 'Recurring donation series requested successfully', 201);
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
    const spaceId = resolveSpaceId(req) ?? 0;
    const body = req.body as ManualRecurringInput;
    const customSvc = getCustomService(req);
    const result = customSvc
      ? await customSvc.recurring(req.user.userId, spaceId, body, true)
      : await createRecurringDonationService(req.user.userId, spaceId, body, true);
    return successResponse(res, result, 'Recurring donation series created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getDonations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.View', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.View', spaceId);
    }

    const queryMonasterySpaceId =
      spaceId !== undefined
        ? spaceId
        : req.query.monasterySpaceId !== undefined
          ? Number(req.query.monasterySpaceId)
          : undefined;

    const query: DonationQueryInput = {
      ...req.query,
      pageNumber: req.query.pageNumber !== undefined ? Number(req.query.pageNumber) : 1,
      pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : 10,
      ...(req.query.status !== undefined
        ? { status: queryStatusSchema.parse(req.query.status) }
        : {}),
      ...(queryMonasterySpaceId !== undefined ? { monasterySpaceId: queryMonasterySpaceId } : {}),
      ...(req.query.donorId !== undefined ? { donorId: Number(req.query.donorId) } : {}),
    };

    const result = customSvc
      ? await customSvc.list(req.user.userId, query)
      : await getDonationsService(req.user.userId, query);
    return res.json({
      success: true,
      message: 'Donations retrieved successfully',
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getDonationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.View', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.View', spaceId);
    }
    const donationId = resolveDonationId(req);
    const result = customSvc
      ? await customSvc.get(req.user.userId, donationId, spaceId)
      : await getDonationByIdService(req.user.userId, donationId, spaceId);
    return successResponse(res, result, 'Donation retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getMonthlySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (
      req.params.spaceId === undefined &&
      req.query.year === undefined &&
      req.query.month === undefined
    ) {
      return next('router');
    }
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.View', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.View', spaceId);
    }

    const queryMonasterySpaceId =
      spaceId !== undefined
        ? spaceId
        : req.query.monasterySpaceId !== undefined
          ? Number(req.query.monasterySpaceId)
          : undefined;

    const query: MonthlyQueryInput = {
      ...req.query,
      year: Number(req.query.year),
      month: Number(req.query.month),
      ...(queryMonasterySpaceId !== undefined ? { monasterySpaceId: queryMonasterySpaceId } : {}),
    };

    const result = customSvc
      ? await customSvc.monthly(req.user.userId, query)
      : await getMonthlyDonationSummaryService(req.user.userId, query);
    return successResponse(res, result, 'Monthly calendar summary retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const reviewDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Review', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Review', spaceId);
    }
    const donationId = resolveDonationId(req);
    const input = req.body as ReviewDonationInput;
    const result = customSvc
      ? await customSvc.change(req.user.userId, donationId, 'review', input, spaceId)
      : await reviewDonationService(req.user.userId, donationId, input, spaceId);
    return successResponse(res, result, 'Donation review successful');
  } catch (err) {
    next(err);
  }
};

export const scheduleDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Schedule', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Schedule', spaceId);
    }
    const donationId = resolveDonationId(req);
    const input = req.body as ScheduleDonationInput;
    const result = customSvc
      ? await customSvc.change(req.user.userId, donationId, 'schedule', input, spaceId)
      : await scheduleDonationService(req.user.userId, donationId, input, spaceId);
    return successResponse(res, result, 'Donation schedule successful');
  } catch (err) {
    next(err);
  }
};

export const completeDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Schedule', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Schedule', spaceId);
    }
    const donationId = resolveDonationId(req);
    const result = customSvc
      ? await customSvc.change(req.user.userId, donationId, 'complete', {}, spaceId)
      : await completeDonationService(req.user.userId, donationId, spaceId);
    return successResponse(res, result, 'Donation marked complete');
  } catch (err) {
    next(err);
  }
};

export const cancelDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const donationId = resolveDonationId(req);
    const note = req.body?.note as string | undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Cancel', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Cancel', spaceId);
    }
    const result = customSvc
      ? await customSvc.change(req.user.userId, donationId, 'cancel', { note }, spaceId)
      : await cancelDonationService(req.user.userId, donationId, note, spaceId);
    return successResponse(res, result, 'Donation cancelled successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteDonation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Delete', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Delete', spaceId);
    }
    const donationId = resolveDonationId(req);
    if (customSvc) {
      await customSvc.change(req.user.userId, donationId, 'delete', {}, spaceId);
    } else {
      await deleteDonationService(req.user.userId, donationId, spaceId);
    }
    return successResponse(res, null, 'Donation deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const reviewDonationSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Review', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Review', spaceId);
    }
    const seriesId = String(req.params.seriesId);
    const input = req.body as ReviewDonationInput;
    const result = customSvc
      ? await customSvc.reviewSeries(req.user.userId, seriesId, input, spaceId)
      : await reviewDonationSeriesService(req.user.userId, seriesId, input, spaceId);
    return successResponse(res, result, 'Recurring donation series reviewed successfully');
  } catch (err) {
    next(err);
  }
};

export const cancelDonationSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.spaceId !== undefined ? Number(req.params.spaceId) : undefined;
    const customSvc = getCustomService(req);
    if (customSvc) {
      await customSvc.authorizeEndpoint(req.user.userId, 'Donation.Cancel', spaceId);
    } else {
      await authorizeDonationEndpointService(req.user.userId, 'Donation.Cancel', spaceId);
    }
    const seriesId = String(req.params.seriesId);
    const note = req.body?.note as string | undefined;
    const result = customSvc
      ? await customSvc.cancelSeries(req.user.userId, seriesId, note, spaceId)
      : await cancelDonationSeriesService(req.user.userId, seriesId, note, spaceId);
    return successResponse(res, result, 'Recurring donation series cancelled successfully');
  } catch (err) {
    next(err);
  }
};
