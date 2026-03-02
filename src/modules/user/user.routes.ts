import { Router } from 'express';
import { userController } from './user.controller';

const router = Router();

router.get('/', userController.getAllUsers);

router.get('/:id', userController.getUserById);

router.post('/', userController.createUser);

router.delete('/:id', userController.deleteUser);

export { router as userRouter };
