import { prisma } from '../../lib/prisma';
import { RegisterInput } from './auth.schema';
import { AppError } from '../../utils/AppError';
export const registerUser = async (data: RegisterInput) => {
  const email = data.email || undefined;
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone: data.phone }, { email }],
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
      email,
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
