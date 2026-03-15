import type { Prisma } from 'prisma-client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RegisterInput } from './auth.schema';
//register
export const registerUser = async (data: RegisterInput) => {
  const conditions: Prisma.UserWhereInput[] = [{ phone: data.phone }];
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
//login
export const loginUser = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { phone: data.phone, isDeleted: false },
  });
  if (!user) {
    throw new AppError('Invalid phone or password', 401);
  }
  const isPasswordMatch = await Bun.password.verify(data.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid phone or password', 401);
  }
  return {
    id: user.id,
    phone: user.phone,
    username: user.username,
    email: user.email,
    userType: user.userType,
  };
};
