import type { Request } from 'express';
import type { Prisma } from 'prisma-client';
import { generatePaginationData } from '@/helper/paginationHelper';
import type { PaginationQueryType } from '../../helper/paginationSchema';
import { prisma } from '../../lib/prisma';
import { BadRequestError } from '../../utils/BadRequestError';
import { NotFoundError } from '../../utils/NotFoundError';
import type { CreateDonorType, GetAllDonorsQueryType, UpdateDonorType } from './donor.schema';

export async function createDonorService(data: CreateDonorType) {
  const { name, email, phoneNo } = data.body;

  const existingDonor = await prisma.donor.findFirst({
    where: {
      OR: [{ email }, ...(phoneNo ? [{ phoneNo }] : [])],
    },
  });

  if (existingDonor) {
    throw new BadRequestError('A donor with this email or phone number already exists');
  }

  return prisma.donor.create({
    data: {
      name,
      email,
      phoneNo: phoneNo ?? '',
    },
  });
}

export async function getAllDonorsService(
  req: Request,
  query: GetAllDonorsQueryType['query'],
  pagination: PaginationQueryType
) {
  const { name, email, phoneNo } = query;
  const { page, limit } = pagination;

  const where: Prisma.DonorWhereInput = {};

  // search by each field
  if (name && name.trim() !== '') {
    where.name = { contains: name.trim() };
  }

  if (email && email.trim() !== '') {
    where.email = { contains: email.trim() };
  }

  if (phoneNo && phoneNo.trim() !== '') {
    where.phoneNo = { contains: phoneNo.trim() };
  }

  const [donors, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.donor.count({ where }),
  ]);

  const paginationData = generatePaginationData(req, total, page, limit);

  return { donors, pagination: paginationData };
}

export async function getDonorByIdService(id: number) {
  const donor = await prisma.donor.findUnique({
    where: { id },
  });

  if (!donor) {
    throw new NotFoundError('Donor not found');
  }

  return donor;
}

export async function updateDonorService(id: number, data: UpdateDonorType) {
  const { name, email, phoneNo } = data.body;

  const donor = await prisma.donor.findUnique({ where: { id } });

  if (!donor) {
    throw new NotFoundError('Donor not found');
  }

  if (email && email !== donor.email) {
    const emailTaken = await prisma.donor.findFirst({
      where: { email, NOT: { id } },
    });
    if (emailTaken) {
      throw new BadRequestError('A donor with this email already exists');
    }
  }

  return prisma.donor.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phoneNo && { phoneNo }),
    },
  });
}

export async function deleteDonorService(id: number) {
  const donor = await prisma.donor.findUnique({ where: { id } });

  if (!donor) {
    throw new NotFoundError('Donor not found');
  }

  await prisma.donor.delete({ where: { id } });

  return donor;
}
