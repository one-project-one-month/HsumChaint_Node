import { z } from 'zod';
import {
  DONATION_PERMISSIONS,
  DONATION_STATUS,
  DONATION_TYPE,
  type DonationPermission,
  type DonationStatus,
} from './donation.types';

// ============================================================================
// Primitives & Helpers
// ============================================================================

export const idSchema = z.coerce.number().int().positive().max(2147483647);

function enumCode<T extends Record<string, number>>(values: T) {
  const names = Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];
  return z.union([
    z
      .number()
      .int()
      .min(0)
      .max(names.length - 1),
    z.enum(names).transform((name) => values[name]),
  ]);
}

export const statusCodeSchema = enumCode(DONATION_STATUS);
export const typeCodeSchema = enumCode(DONATION_TYPE);

export const queryStatusSchema = z.preprocess(
  (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
  statusCodeSchema
);

const dateTimeSchema = z.iso.datetime({ offset: true });

const decimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/, 'Use a non-negative Decimal(18,2) value');

export const decimalSchema = z.union([
  decimalStringSchema,
  z
    .number()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER / 100)
    .transform(String)
    .pipe(decimalStringSchema),
]);

const timeOfDaySchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Use HH:mm or HH:mm:ss');

const validateCustomType = (data: { donationType: number; customDonationType?: string | null }) =>
  data.donationType !== DONATION_TYPE.Other || Boolean(data.customDonationType?.trim());

function checkSpaceMatch(
  params?: { spaceId?: number },
  bodyOrQuery?: { monasterySpaceId?: number }
) {
  const spaceId = params?.spaceId;
  const monasterySpaceId = bodyOrQuery?.monasterySpaceId;
  if (spaceId !== undefined && monasterySpaceId !== undefined && spaceId !== monasterySpaceId) {
    return false;
  }
  return true;
}

// ============================================================================
// Shared Fields
// ============================================================================

const baseDonationFields = {
  donationType: typeCodeSchema,
  customDonationType: z.string().trim().min(1).max(255).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  amount: decimalSchema.nullable().optional(),
  quantity: decimalSchema.nullable().optional(),
  pickupTime: dateTimeSchema.nullable().optional(),
  dropoffTime: dateTimeSchema.nullable().optional(),
};

const manualDonorFields = {
  donorId: idSchema.nullable().optional(),
  donorName: z.string().trim().min(1).max(255).nullable().optional(),
};

// ============================================================================
// Pure Body / Query Inputs
// ============================================================================

export const donationInputSchema = z
  .object(baseDonationFields)
  .strict()
  .refine(validateCustomType, 'Custom donation type is required for Other');

export const manualDonationInputSchema = z
  .object({
    ...baseDonationFields,
    ...manualDonorFields,
  })
  .strict()
  .refine(validateCustomType, 'Custom donation type is required for Other')
  .refine(
    (data) => data.donorId != null || Boolean(data.donorName?.trim()),
    'Donor name is required without a donor account'
  );

export const batchDonationInputSchema = z
  .object({
    monasterySpaceId: idSchema.optional(),
    title: z.string().trim().max(255).optional(),
    donations: z.array(manualDonationInputSchema).min(1).max(50),
  })
  .strict();

export const recurringInputSchema = z
  .object({
    ...baseDonationFields,
    note: z.string().max(900).nullable().optional(),
    startDate: z.union([z.iso.date(), dateTimeSchema]),
    dayOfMonth: z.number().int().min(1).max(31),
    monthsCount: z.number().int().min(1).max(24),
    pickupTimeOfDay: timeOfDaySchema.nullable().optional(),
    dropoffTimeOfDay: timeOfDaySchema.nullable().optional(),
  })
  .strict()
  .refine(validateCustomType, 'Custom donation type is required for Other');

export const manualRecurringInputSchema = z
  .object({
    ...baseDonationFields,
    ...manualDonorFields,
    note: z.string().max(900).nullable().optional(),
    startDate: z.union([z.iso.date(), dateTimeSchema]),
    dayOfMonth: z.number().int().min(1).max(31),
    monthsCount: z.number().int().min(1).max(24),
    pickupTimeOfDay: timeOfDaySchema.nullable().optional(),
    dropoffTimeOfDay: timeOfDaySchema.nullable().optional(),
  })
  .strict()
  .refine(validateCustomType, 'Custom donation type is required for Other')
  .refine(
    (data) => data.donorId != null || Boolean(data.donorName?.trim()),
    'Donor name is required without a donor account'
  );

export const donationQueryInputSchema = z
  .object({
    monasterySpaceId: idSchema.optional(),
    donorId: idSchema.optional(),
    pageNumber: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    status: queryStatusSchema.optional(),
    fromDate: dateTimeSchema.optional(),
    toDate: dateTimeSchema.optional(),
  })
  .refine(
    (data) =>
      !data.fromDate || !data.toDate || Date.parse(data.fromDate) <= Date.parse(data.toDate),
    'Date range must be ordered'
  );

export const monthlyQueryInputSchema = z.object({
  monasterySpaceId: idSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  status: queryStatusSchema.optional(),
});

export const reviewDonationInputSchema = z
  .object({
    status: statusCodeSchema.refine(
      (val) => val === DONATION_STATUS.Accepted || val === DONATION_STATUS.Rejected,
      'Review status must be Accepted (3) or Rejected (6)'
    ),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const scheduleDonationInputSchema = z
  .object({
    pickupTime: dateTimeSchema.nullable().optional(),
    dropoffTime: dateTimeSchema.nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => data.pickupTime != null || data.dropoffTime != null,
    'Pickup time or dropoff time is required'
  );

export const cancelDonationInputSchema = z
  .object({
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

// ============================================================================
// Route Validation Schemas (matching validator middleware)
// ============================================================================

export const requestDonationSchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    body: donationInputSchema
      .extend({
        monasterySpaceId: idSchema.optional(),
      })
      .strict(),
  })
  .refine(
    (data) => {
      if (!checkSpaceMatch(data.params, data.body)) return false;
      return data.params?.spaceId !== undefined || data.body.monasterySpaceId !== undefined;
    },
    {
      message: 'monasterySpaceId is required and must match spaceId if both provided',
      path: ['body', 'monasterySpaceId'],
    }
  );

export const manualDonationSchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    body: manualDonationInputSchema
      .extend({
        monasterySpaceId: idSchema.optional(),
      })
      .strict(),
  })
  .refine(
    (data) => {
      if (!checkSpaceMatch(data.params, data.body)) return false;
      return data.params?.spaceId !== undefined || data.body.monasterySpaceId !== undefined;
    },
    {
      message: 'monasterySpaceId is required and must match spaceId if both provided',
      path: ['body', 'monasterySpaceId'],
    }
  );

export const batchDonationSchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    body: batchDonationInputSchema,
  })
  .refine(
    (data) => {
      if (!checkSpaceMatch(data.params, data.body)) return false;
      return data.params?.spaceId !== undefined || data.body.monasterySpaceId !== undefined;
    },
    {
      message: 'monasterySpaceId is required and must match spaceId if both provided',
      path: ['body', 'monasterySpaceId'],
    }
  );

export const requestRecurringSchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    body: recurringInputSchema
      .extend({
        monasterySpaceId: idSchema.optional(),
      })
      .strict(),
  })
  .refine(
    (data) => {
      if (!checkSpaceMatch(data.params, data.body)) return false;
      return data.params?.spaceId !== undefined || data.body.monasterySpaceId !== undefined;
    },
    {
      message: 'monasterySpaceId is required and must match spaceId if both provided',
      path: ['body', 'monasterySpaceId'],
    }
  );

export const manualRecurringSchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    body: manualRecurringInputSchema
      .extend({
        monasterySpaceId: idSchema.optional(),
      })
      .strict(),
  })
  .refine(
    (data) => {
      if (!checkSpaceMatch(data.params, data.body)) return false;
      return data.params?.spaceId !== undefined || data.body.monasterySpaceId !== undefined;
    },
    {
      message: 'monasterySpaceId is required and must match spaceId if both provided',
      path: ['body', 'monasterySpaceId'],
    }
  );

export const donationIdParamSchema = z.object({
  params: z
    .object({
      id: idSchema.optional(),
      donationId: idSchema.optional(),
      spaceId: idSchema.optional(),
    })
    .refine((data) => data.id !== undefined || data.donationId !== undefined, {
      message: 'Donation ID is required',
      path: ['donationId'],
    }),
});

export const donationQuerySchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    query: donationQueryInputSchema,
  })
  .refine((data) => checkSpaceMatch(data.params, data.query), {
    message: 'Query monasterySpaceId must match the URL',
    path: ['query', 'monasterySpaceId'],
  });

export const monthlyQuerySchema = z
  .object({
    params: z.object({ spaceId: idSchema.optional() }).optional(),
    query: monthlyQueryInputSchema,
  })
  .refine((data) => checkSpaceMatch(data.params, data.query), {
    message: 'Query monasterySpaceId must match the URL',
    path: ['query', 'monasterySpaceId'],
  });

export const reviewDonationSchema = z.object({
  params: z
    .object({
      id: idSchema.optional(),
      donationId: idSchema.optional(),
      spaceId: idSchema.optional(),
    })
    .refine((data) => data.id !== undefined || data.donationId !== undefined, {
      message: 'Donation ID is required',
      path: ['donationId'],
    }),
  body: reviewDonationInputSchema,
});

export const scheduleDonationSchema = z.object({
  params: z
    .object({
      id: idSchema.optional(),
      donationId: idSchema.optional(),
      spaceId: idSchema.optional(),
    })
    .refine((data) => data.id !== undefined || data.donationId !== undefined, {
      message: 'Donation ID is required',
      path: ['donationId'],
    }),
  body: scheduleDonationInputSchema,
});

export const cancelDonationSchema = z.object({
  params: z
    .object({
      id: idSchema.optional(),
      donationId: idSchema.optional(),
      spaceId: idSchema.optional(),
    })
    .refine((data) => data.id !== undefined || data.donationId !== undefined, {
      message: 'Donation ID is required',
      path: ['donationId'],
    }),
  body: cancelDonationInputSchema.optional(),
});

export const reviewSeriesSchema = z.object({
  params: z.object({
    seriesId: z.string().trim().min(1).max(64),
    spaceId: idSchema.optional(),
  }),
  body: reviewDonationInputSchema,
});

export const cancelSeriesSchema = z.object({
  params: z.object({
    seriesId: z.string().trim().min(1).max(64),
    spaceId: idSchema.optional(),
  }),
  body: cancelDonationInputSchema.optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type DonationInput = z.infer<typeof donationInputSchema>;
export type ManualDonationInput = z.infer<typeof manualDonationInputSchema>;
export type RequestDonationInput = DonationInput & { monasterySpaceId?: number };
export type BatchDonationInput = z.infer<typeof batchDonationInputSchema>;
export type RecurringInput = z.infer<typeof recurringInputSchema>;
export type ManualRecurringInput = z.infer<typeof manualRecurringInputSchema>;
export type RequestRecurringInput = RecurringInput & { monasterySpaceId?: number };
export type DonationQueryInput = z.infer<typeof donationQueryInputSchema>;
export type MonthlyQueryInput = z.infer<typeof monthlyQueryInputSchema>;
export type ReviewDonationInput = z.infer<typeof reviewDonationInputSchema>;
export type ScheduleDonationInput = z.infer<typeof scheduleDonationInputSchema>;
export type CancelDonationInput = z.infer<typeof cancelDonationInputSchema>;

export type { DonationPermission, DonationStatus };

// Compatibility aliases
export { DONATION_PERMISSIONS, DONATION_STATUS, DONATION_TYPE };
export const donationInput = donationInputSchema;
export const manualDonationInput = manualDonationInputSchema;
export const requestDonationInput = requestDonationSchema;
export const requestManualInput = manualDonationSchema;
export const batchInput = batchDonationInputSchema;
export const requestBatchInput = batchDonationSchema;
export const recurringInput = recurringInputSchema;
export const manualRecurringInput = manualRecurringInputSchema;
export const requestRecurringInput = requestRecurringSchema;
export const requestManualRecurringInput = manualRecurringSchema;
export const donationParams = donationIdParamSchema;
export const donationQuery = donationQueryInputSchema;
export const donationReview = reviewDonationInputSchema;
export const donationSchedule = scheduleDonationInputSchema;
export const monthlyQuery = monthlyQueryInputSchema;
export const statusCode = statusCodeSchema;
