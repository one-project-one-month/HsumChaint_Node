import { z } from 'zod';
import { validator } from '../../middlewares/validator';
import {
  idParamSchema,
  CreateDonorSchema,
  UpdateDonorSchema,
  GetAllDonorsQuerySchema,
} from './donor.schema';
import { PaginationQuerySchema } from '../../helper/paginationSchema';

const GetAllDonorsFullSchema = z.object({
  query: GetAllDonorsQuerySchema.shape.query.extend(PaginationQuerySchema.shape),
});

const UpdateDonorFullSchema = z.object({
  params: idParamSchema.shape.params,
  body: UpdateDonorSchema.shape.body,
});

export const validateCreateDonor = validator(CreateDonorSchema);
export const validateGetAllDonors = validator(GetAllDonorsFullSchema);
export const validateGetDonorById = validator(idParamSchema);
export const validateUpdateDonor = validator(UpdateDonorFullSchema);
export const validateDeleteDonor = validator(idParamSchema);
