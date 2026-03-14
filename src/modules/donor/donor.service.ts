import { Request } from 'express';
import { BadRequestError } from '../../utils/BadRequestError';
import { NotFoundError } from '../../utils/NotFoundError';
import { generatePaginationData } from '../../helper/paginationHelper';
import { prisma } from '../../lib/prisma';
import { PaginationQueryType } from '../../helper/paginationSchema';
import { CreateDonorType, GetAllDonorsQueryType, UpdateDonorType } from './donor.schema';

const donorInclude = {
  user: {
    select: {
      id: true,
      userName: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
  donationList: {
    include: {
      monastery: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      donationType: {
        select: {
          id: true,
          donationType: true,
          duration: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          role: true,
          isOwner: true,
        },
      },
    },
  },
} as const;

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

  const where: Record<string, any> = {};

  if (name) {
    where.name = { contains: name };
  }
  if (email) {
    where.email = { contains: email };
  }
  if (phoneNo) {
    where.phoneNo = { contains: phoneNo };
  }

  const [donors, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      include: donorInclude,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.donor.count({ where }),
  ]);

  if (donors.length === 0) {
    throw new NotFoundError('No donors found');
  }

  const paginationData = generatePaginationData(req, total, page, limit);

  return { donors, pagination: paginationData };
}

export async function getDonorByIdService(id: number) {
  const donor = await prisma.donor.findUnique({
    where: { id },
    include: donorInclude,
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
    include: donorInclude,
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
