import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { requireDonationPermission } from '@/middlewares/permissionMiddleware';
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
  requestDonation,
  requestRecurringDonation,
  reviewDonation,
  reviewDonationSeries,
  scheduleDonation,
  updateDonationStatusDirectly,
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

const router = Router();

// ============================================================================
// Public Catalog
// ============================================================================

router.get('/statuses', getDonationStatuses);

// ============================================================================
// Protected Endpoints (Authentication Required)
// ============================================================================

router.use(authMiddleware);

// ============================================================================
// Donation Submission & Manual Recording
// ============================================================================

router.post(
  '/request',
  requireDonationPermission('Donation.Create'),
  validator(requestDonationSchema),
  requestDonation
);
router.post(
  '/manual',
  requireDonationPermission('Donation.Create'),
  validator(manualDonationSchema),
  createManualDonation
);
router.post(
  '/batch',
  requireDonationPermission('Donation.Create'),
  validator(batchDonationSchema),
  createBatchDonations
);
router.post(
  '/recurring/request',
  requireDonationPermission('Donation.Create'),
  validator(requestRecurringSchema),
  requestRecurringDonation
);
router.post(
  '/recurring/manual',
  requireDonationPermission('Donation.Create'),
  validator(manualRecurringSchema),
  createManualRecurringDonation
);

// ============================================================================
// Donation Catalog, Feed & Calendar
// ============================================================================

router.get(
  '/',
  requireDonationPermission('Donation.View'),
  validator(donationQuerySchema),
  getDonations
);
router.get(
  '/feed',
  requireDonationPermission('Donation.View'),
  validator(donationFeedQuerySchema),
  getDonationsFeed
);
router.get(
  '/calendar',
  requireDonationPermission('Donation.View'),
  validator(monthlyQuerySchema),
  getMonthlySummary
);

// ============================================================================
// Recurring Donation Series Actions
// ============================================================================

router.post(
  '/series/:seriesId/review',
  requireDonationPermission('Donation.Review'),
  validator(reviewSeriesSchema),
  reviewDonationSeries
);
router.post(
  '/series/:seriesId/cancel',
  requireDonationPermission('Donation.Cancel'),
  validator(cancelSeriesSchema),
  cancelDonationSeries
);

// ============================================================================
// Single Donation Lifecycle Actions
// ============================================================================

router.post(
  '/:donationId/review',
  requireDonationPermission('Donation.Review'),
  validator(reviewDonationSchema),
  reviewDonation
);
router.put(
  '/:donationId/schedule',
  requireDonationPermission('Donation.Schedule'),
  validator(scheduleDonationSchema),
  scheduleDonation
);
router.post(
  '/:donationId/complete',
  requireDonationPermission('Donation.Schedule'),
  validator(donationIdParamSchema),
  completeDonation
);
router.post(
  '/:donationId/cancel',
  requireDonationPermission('Donation.Cancel'),
  validator(cancelDonationSchema),
  cancelDonation
);
router.put(
  '/:donationId/status',
  requireDonationPermission('Donation.Review'),
  validator(updateDonationStatusSchema),
  updateDonationStatusDirectly
);
router.delete(
  '/:donationId',
  requireDonationPermission('Donation.Delete'),
  validator(donationIdParamSchema),
  deleteDonation
);

// ============================================================================
// Single Donation Details
// ============================================================================

router.get(
  '/:donationId',
  requireDonationPermission('Donation.View'),
  validator(donationIdParamSchema),
  getDonationById
);

export { router as donationRouter };
export default router;
