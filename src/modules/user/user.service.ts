import { prisma } from '@/lib/prisma';
import type { CreateUser, User } from './user.schema';

export class UserService {
  async getAllUsers(): Promise<User[]> {
    return prisma.user.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
    }) as unknown as User[];
  }

  async getUserById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    }) as unknown as User | null;
  }

  async createUser(data: CreateUser): Promise<User> {
    return prisma.user.create({
      data,
    }) as unknown as User;
  }

  async deleteUser(id: number): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }
}

export const userService = new UserService();
