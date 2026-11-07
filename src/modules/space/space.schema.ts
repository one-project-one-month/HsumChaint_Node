import { z } from 'zod';
import { PaginationQuerySchema } from '@/helper/paginationSchema';

export const createSpaceSchema = z.object({
  body: z.object({
    monasteryName: z
      .string('Monastery name is required.')
      .trim()
      .min(1, 'Monastery name is required.')
      .max(255),
    description: z.string().trim().max(1000).optional(),
    address: z.string().trim().max(500).optional(),
  }),
});

export const updateSpaceSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Invalid space ID'),
  }),
  body: z.object({
    monasteryName: z.string().trim().max(255).optional(),
    description: z.string().trim().max(1000).optional(),
    address: z.string().trim().max(500).optional(),
  }),
});

export const spaceIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Invalid space ID'),
  }),
});

export const catalogPaginationSchema = z.object({
  query: z.object({
    pageNumber: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
  }),
});

export const cursorFeedSchema = z.object({
  query: z.object({
    lastId: z.coerce.number().int().nonnegative().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(15),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const searchMonasteriesSchema = z.object({
  query: z.object({
    keyword: z.string().trim().optional().default(''),
    pageNumber: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const searchFeedSchema = z.object({
  query: z.object({
    keyword: z.string().trim().optional().default(''),
    lastId: z.coerce.number().int().nonnegative().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(15),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const membersPaginationSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Invalid space ID'),
  }),
  query: z.object({
    pageNumber: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const spacePaginationSchema = z.object({
  query: PaginationQuerySchema.extend({
    search: z.string().trim().optional(),
    pageNumber: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const inviteMemberSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Invalid space ID'),
  }),
  body: z
    .object({
      spaceRoleId: z.coerce.number().int().positive().optional(),
      roleId: z.coerce.number().int().positive().optional(),
      userId: z.coerce.number().int().positive().optional(),
      phone: z.string().trim().optional(),
      phoneNumber: z.string().trim().optional(),
    })
    .refine((data) => data.spaceRoleId !== undefined || data.roleId !== undefined, {
      message: 'Valid spaceRoleId or roleId is required',
      path: ['roleId'],
    })
    .refine((data) => data.userId !== undefined || !!data.phone || !!data.phoneNumber, {
      message: 'Either userId, phone, or phoneNumber must be provided',
      path: ['phone'],
    }),
});

export const respondInvitationSchema = z.object({
  params: z.object({
    invitationId: z.coerce.number().int().positive('Invalid invitation ID'),
  }),
  body: z.object({
    status: z
      .union([z.boolean(), z.number(), z.enum(['accept', 'reject', 'Accept', 'Reject'])])
      .transform((val): 2 | 3 => {
        // 2 / 1 / true / 'accept' -> 2 (Accept)
        if (val === 2 || val === 1 || val === true || val === 'accept' || val === 'Accept') {
          return 2;
        }
        // 3 / 0 / false / 'reject' -> 3 (Reject)
        return 3;
      }),
  }),
});

export const updateMemberRoleSchema = z.object({
  params: z
    .object({
      id: z.coerce.number().int().positive('Invalid space ID'),
      userId: z.coerce.number().int().positive('Invalid user ID').optional(),
      memberUserId: z.coerce.number().int().positive('Invalid member user ID').optional(),
    })
    .refine((data) => data.userId !== undefined || data.memberUserId !== undefined, {
      message: 'userId or memberUserId is required',
      path: ['userId'],
    }),
  body: z
    .object({
      spaceRoleId: z.coerce.number().int().positive().optional(),
      roleId: z.coerce.number().int().positive().optional(),
    })
    .refine((data) => data.spaceRoleId !== undefined || data.roleId !== undefined, {
      message: 'Valid spaceRoleId or roleId is required',
      path: ['roleId'],
    }),
});

export const removeMemberSchema = z.object({
  params: z
    .object({
      id: z.coerce.number().int().positive('Invalid space ID'),
      userId: z.coerce.number().int().positive('Invalid user ID').optional(),
      memberUserId: z.coerce.number().int().positive('Invalid member user ID').optional(),
    })
    .refine((data) => data.userId !== undefined || data.memberUserId !== undefined, {
      message: 'userId or memberUserId is required',
      path: ['userId'],
    }),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>['body'];
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>['body'];
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>['body'];
export type RespondInvitationInput = z.infer<typeof respondInvitationSchema>['body'];
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>['body'];
