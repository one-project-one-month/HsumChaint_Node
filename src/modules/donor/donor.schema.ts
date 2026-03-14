import { z } from 'zod';
import { PaginationQuerySchema } from '../../helper/paginationSchema';

// GET /monasteries/:id/donors/:donorId
const idParamSchema = z.object({
    params: z.object({
        id: z
         .string()
         .regex(/^\d+$/, 'ID must be a number')
         .transform(Number)
         .refine((val) => !Number.isNaN(val), 'ID must be a valid number')
    }),
});

const CreateDonorSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Donor name is required'),
        email: z.email('Invalid email address'),
        phoneNo: z
            .string()
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
            .transform(val => val.replace(/[^\d+]/g, ''))
            .refine((val) => val.length >= 6 && val.length <= 15, 'Phone number must be between 6 and 15 digits')
            .optional(),
    }).strict(),
});

const UpdateDonorSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Donor name is required').optional(),
        email: z.email('Invalid email address').optional(),
        phoneNo: z
            .string()
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
            .transform(val => val.replace(/[^\d+]/g, ''))
            .refine((val) => val.length >= 6 && val.length <= 15, 'Phone number must be between 6 and 15 digits')
            .optional(),
    })
    .refine((data) => data.name || data.email || data.phoneNo, 'At least one field is required'),

});

const GetAllDonorsQuerySchema = z.object({
    query: z.object({
        name: z.string().min(1, 'Donor name is required').optional(),
        email: z.email('Invalid email address').optional(),
        phoneNo: z
            .string()
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
            .transform(val => val.replace(/[^\d+]/g, ''))
            .refine((val) => val.length >= 6 && val.length <= 15, 'Phone number must be between 6 and 15 digits')
            .optional(),
    }),

});

type IdParamType = z.infer<typeof idParamSchema>;
type CreateDonorType = z.infer<typeof CreateDonorSchema>;
type UpdateDonorType = z.infer<typeof UpdateDonorSchema>;
type GetAllDonorsQueryType = z.infer<typeof GetAllDonorsQuerySchema>;

export { idParamSchema, CreateDonorSchema, UpdateDonorSchema, GetAllDonorsQuerySchema };
export type { IdParamType, CreateDonorType, UpdateDonorType, GetAllDonorsQueryType };