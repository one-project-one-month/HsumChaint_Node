import { type RequestHandler, Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import {
  cancelDonation,
  cancelDonationSeries,
  completeDonation,
  createBatchDonations,
  createManualDonation,
  createManualRecurringDonation,
  deleteDonation,
  getDonationById,
  getDonationStatuses,
  getDonations,
  getDonationsFeed,
  getMonthlySummary,
  maybePassthroughCalendar,
  requestDonation,
  requestRecurringDonation,
  reviewDonation,
  reviewDonationSeries,
  scheduleDonation,
  updateDonationStatus,
} from './donation.controller';
import {
  batchDonationSchema,
  cancelDonationSchema,
  cancelSeriesSchema,
  donationFeedQuerySchema,
  donationIdParamSchema,
  donationQuerySchema,
  manualDonationSchema,
  manualRecurringSchema,
  monthlyQuerySchema,
  requestDonationSchema,
  requestRecurringSchema,
  reviewDonationSchema,
  reviewSeriesSchema,
  scheduleDonationSchema,
  updateDonationStatusSchema,
} from './donation.schema';

const donationAuth: RequestHandler = (req, res, next) => {
  // Allow anonymous access to status metadata (C# spec: [AllowAnonymous])
  if (req.path === '/statuses' || req.path.endsWith('/statuses')) return next();
  if (req.user) return next();
  return authMiddleware(req, res, next);
};

const router = Router({ mergeParams: true });
router.use(donationAuth);

// ============================================================================
// Creation & Request Endpoints (#44 - #48)
// ============================================================================

router.post('/request', validator(requestDonationSchema), requestDonation);
router.post('/manual', validator(manualDonationSchema), createManualDonation);
router.post('/batch', validator(batchDonationSchema), createBatchDonations);
router.post('/recurring/request', validator(requestRecurringSchema), requestRecurringDonation);
router.post('/recurring/manual', validator(manualRecurringSchema), createManualRecurringDonation);

// ============================================================================
// List, Feed, Calendar & Statuses Metadata Endpoints (#49, #50, #52, #58)
// ============================================================================

router.get('/', validator(donationQuerySchema), getDonations);
router.get('/feed', validator(donationFeedQuerySchema), getDonationsFeed);
router.get('/statuses', getDonationStatuses);
router.get('/calendar', maybePassthroughCalendar, validator(monthlyQuerySchema), getMonthlySummary);

// ============================================================================
// Recurring Series Endpoints
// ============================================================================

router.post('/series/:seriesId/review', validator(reviewSeriesSchema), reviewDonationSeries);
router.patch('/series/:seriesId/review', validator(reviewSeriesSchema), reviewDonationSeries);
router.post('/series/:seriesId/cancel', validator(cancelSeriesSchema), cancelDonationSeries);
router.patch('/series/:seriesId/cancel', validator(cancelSeriesSchema), cancelDonationSeries);

// ============================================================================
// Single Donation Lifecycle Actions (#53 - #57, #59)
// Standard HTTP methods matching C# endpoints + PATCH for backwards compatibility
// ============================================================================

router.post('/:donationId/review', validator(reviewDonationSchema), reviewDonation);
router.patch('/:donationId/review', validator(reviewDonationSchema), reviewDonation);

router.put('/:donationId/schedule', validator(scheduleDonationSchema), scheduleDonation);
router.patch('/:donationId/schedule', validator(scheduleDonationSchema), scheduleDonation);

router.post('/:donationId/complete', validator(donationIdParamSchema), completeDonation);
router.patch('/:donationId/complete', validator(donationIdParamSchema), completeDonation);

router.post('/:donationId/cancel', validator(cancelDonationSchema), cancelDonation);
router.patch('/:donationId/cancel', validator(cancelDonationSchema), cancelDonation);

router.put('/:donationId/status', validator(updateDonationStatusSchema), updateDonationStatus);

router.delete('/:donationId', validator(donationIdParamSchema), deleteDonation);

// ============================================================================
// Donation Detail (#51) (Placed after specific sub-routes)
// ============================================================================

router.get('/:donationId', validator(donationIdParamSchema), getDonationById);

export { router as donationRouter };

// ============================================================================
// Space-Scoped Router: /api/v1/spaces/:spaceId/donations
// ============================================================================

const spaceRouter = Router({ mergeParams: true });
spaceRouter.use(donationAuth);
spaceRouter.post('/', validator(requestDonationSchema), requestDonation);
spaceRouter.use('/', router);

export { spaceRouter as spaceDonationRouter };

// Compatibility wrappers for existing routes and fixtures
export function createDonationRouter(customService?: unknown, scoped = false): Router {
  if (!customService) return scoped ? spaceRouter : router;
  const target = Router({ mergeParams: true });
  target.use((req, _res, next) => {
    (req as unknown as { donationService?: unknown }).donationService = customService;
    next();
  });
  target.use(scoped ? spaceRouter : router);
  return target;
}

export const createSpaceDonationRouter = (customService?: unknown) =>
  createDonationRouter(customService, true);

export default router;
