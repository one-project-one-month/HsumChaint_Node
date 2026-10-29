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
  getDonations,
  getMonthlySummary,
  maybePassthroughCalendar,
  requestDonation,
  requestRecurringDonation,
  reviewDonation,
  reviewDonationSeries,
  scheduleDonation,
} from './donation.controller';
import {
  batchDonationSchema,
  cancelDonationSchema,
  cancelSeriesSchema,
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
} from './donation.schema';

const donationAuth: RequestHandler = (req, res, next) => {
  if (req.user) return next();
  return authMiddleware(req, res, next);
};

const router = Router({ mergeParams: true });
router.use(donationAuth);

// ============================================================================
// Creation & Request Endpoints
// ============================================================================

router.post('/request', validator(requestDonationSchema), requestDonation);
router.post('/manual', validator(manualDonationSchema), createManualDonation);
router.post('/batch', validator(batchDonationSchema), createBatchDonations);
router.post('/recurring/request', validator(requestRecurringSchema), requestRecurringDonation);
router.post('/recurring/manual', validator(manualRecurringSchema), createManualRecurringDonation);

// ============================================================================
// List & Calendar Endpoints
// ============================================================================

router.get('/', validator(donationQuerySchema), getDonations);
router.get('/calendar', maybePassthroughCalendar, validator(monthlyQuerySchema), getMonthlySummary);

// ============================================================================
// Recurring Series Endpoints
// ============================================================================

router.patch('/series/:seriesId/review', validator(reviewSeriesSchema), reviewDonationSeries);
router.patch('/series/:seriesId/cancel', validator(cancelSeriesSchema), cancelDonationSeries);

// ============================================================================
// Single Donation Lifecycle Actions (PATCH for updates, DELETE for removal)
// ============================================================================

router.patch('/:donationId/review', validator(reviewDonationSchema), reviewDonation);
router.patch('/:donationId/schedule', validator(scheduleDonationSchema), scheduleDonation);
router.patch('/:donationId/complete', validator(donationIdParamSchema), completeDonation);
router.patch('/:donationId/cancel', validator(cancelDonationSchema), cancelDonation);
router.delete('/:donationId', validator(donationIdParamSchema), deleteDonation);

// ============================================================================
// Donation Detail (Placed after specific sub-routes)
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
