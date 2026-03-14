import { prisma } from '../../lib/prisma';
import { RegisterInput } from './auth.schema';
import { AppError } from '../../utils/AppError';
export const registerUser = async (data: RegisterInput) => {
  const conditions: any[] = [{ phone: data.phone }];
  if (data.email) {
    conditions.push({ email: data.email });
  }
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: conditions,
      isDeleted: false,
    },
  });
  if (existingUser) {
    throw new AppError('User already exists', 400);
  }
  const hashedPassword = await Bun.password.hash(data.password);
  const user = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
    select: {
      id: true,
      phone: true,
      username: true,
      email: true,
      userType: true,
      createdAt: true,
    },
  });
  return user;
};
