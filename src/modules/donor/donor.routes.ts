import { Router } from 'express';
import {
  createDonor,
  getAllDonors,
  getDonorById,
  updateDonor,
  deleteDonor,
} from './donor.controller';
import {
  validateCreateDonor,
  validateGetAllDonors,
  validateGetDonorById,
  validateUpdateDonor,
  validateDeleteDonor,
} from './donor.middleware';

const router = Router();

router.get('/', validateGetAllDonors, getAllDonors);

router.get('/:id', validateGetDonorById, getDonorById);

router.post('/create', validateCreateDonor, createDonor);

router.put('/:id', validateUpdateDonor, updateDonor);

router.delete('/:id', validateDeleteDonor, deleteDonor);

export { router as donorRouter };
