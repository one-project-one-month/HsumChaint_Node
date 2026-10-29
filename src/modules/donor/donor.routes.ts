import { Router } from 'express';
import {
  createDonor,
  deleteDonor,
  getAllDonors,
  getDonorById,
  updateDonor,
} from './donor.controller';
import {
  validateCreateDonor,
  validateDeleteDonor,
  validateGetDonorById,
  validateUpdateDonor,
} from './donor.middleware';

const router = Router();

router.get('/', getAllDonors);

router.post('/create', validateCreateDonor, createDonor);

router.get('/:id', validateGetDonorById, getDonorById);

router.put('/:id', validateUpdateDonor, updateDonor);
router.patch('/:id', validateUpdateDonor, updateDonor);

router.delete('/:id', validateDeleteDonor, deleteDonor);

export { router as donorRouter };
