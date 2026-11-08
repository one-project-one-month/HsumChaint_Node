import { beforeEach, describe, expect, it, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { globalErrorHandler } from '@/middlewares/errorHandler';
import { donorRouter } from '../donor.routes';
import * as donorService from '../donor.service';

const FAKE_DONOR = {
  id: 1,
  name: 'U Ba',
  email: 'uba@monastery.org',
  phoneNo: '+95912345678',
  createdAt: new Date('2026-11-01T08:00:00Z'),
  updatedAt: new Date('2026-11-01T08:00:00Z'),
};

const app = express();
app.use(express.json());
app.use('/api/v1/donors', donorRouter);
app.use(globalErrorHandler);

describe('Donor Module Endpoints (.NET Spec Alignment)', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('POST /api/v1/donors and /api/v1/donors/create', () => {
    it('creates a donor via POST / with standard 200 response envelope', async () => {
      mock.module('../donor.service', () => ({
        ...donorService,
        createDonorService: mock(() => Promise.resolve(FAKE_DONOR)),
      }));

      const res = await request(app).post('/api/v1/donors').send({
        name: 'U Ba',
        email: 'uba@monastery.org',
        phoneNo: '+95912345678',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        isSuccess: true,
        message: 'Donor created successfully.',
        isFailure: false,
        data: {
          id: 1,
          name: 'U Ba',
          email: 'uba@monastery.org',
          phoneNo: '+95912345678',
          createdAt: FAKE_DONOR.createdAt.toISOString(),
          updatedAt: FAKE_DONOR.updatedAt.toISOString(),
        },
      });
    });

    it('creates a donor via POST /create with standard 200 response envelope', async () => {
      mock.module('../donor.service', () => ({
        ...donorService,
        createDonorService: mock(() => Promise.resolve(FAKE_DONOR)),
      }));

      const res = await request(app).post('/api/v1/donors/create').send({
        name: 'U Ba',
        email: 'uba@monastery.org',
        phoneNo: '+95912345678',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isSuccess: true,
        message: 'Donor created successfully.',
        isFailure: false,
        data: {
          id: 1,
          name: 'U Ba',
        },
      });
    });
  });

  describe('GET /api/v1/donors', () => {
    it('returns paginated response with standard PagedResult envelope', async () => {
      mock.module('../donor.service', () => ({
        ...donorService,
        getAllDonorsService: mock(() =>
          Promise.resolve({
            donors: [FAKE_DONOR],
            pagination: {
              meta: {
                total: 1,
                currentPage: 1,
                lastPage: 1,
                perPage: 10,
              },
              links: {
                next: null,
                prev: null,
              },
            },
          })
        ),
      }));

      const res = await request(app).get('/api/v1/donors?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        isSuccess: true,
        message: 'Donors retrieved successfully.',
        isFailure: false,
        data: [
          {
            id: 1,
            name: 'U Ba',
            email: 'uba@monastery.org',
            phoneNo: '+95912345678',
            createdAt: FAKE_DONOR.createdAt.toISOString(),
            updatedAt: FAKE_DONOR.updatedAt.toISOString(),
          },
        ],
        pagination: {
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      });
    });
  });

  describe('GET /api/v1/donors/:id', () => {
    it('returns single donor with standard Result<T> envelope', async () => {
      mock.module('../donor.service', () => ({
        ...donorService,
        getDonorByIdService: mock(() => Promise.resolve(FAKE_DONOR)),
      }));

      const res = await request(app).get('/api/v1/donors/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isSuccess: true,
        message: 'Donor retrieved successfully.',
        isFailure: false,
        data: {
          id: 1,
          name: 'U Ba',
          email: 'uba@monastery.org',
        },
      });
    });
  });

  describe('PUT and PATCH /api/v1/donors/:id', () => {
    it('updates donor via PUT with standard Result<T> envelope', async () => {
      const updated = { ...FAKE_DONOR, name: 'U Ba Updated' };
      mock.module('../donor.service', () => ({
        ...donorService,
        updateDonorService: mock(() => Promise.resolve(updated)),
      }));

      const res = await request(app).put('/api/v1/donors/1').send({
        name: 'U Ba Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isSuccess: true,
        message: 'Donor updated successfully.',
        isFailure: false,
        data: {
          id: 1,
          name: 'U Ba Updated',
        },
      });
    });

    it('updates donor via PATCH with standard Result<T> envelope', async () => {
      const updated = { ...FAKE_DONOR, phoneNo: '+95987654321' };
      mock.module('../donor.service', () => ({
        ...donorService,
        updateDonorService: mock(() => Promise.resolve(updated)),
      }));

      const res = await request(app).patch('/api/v1/donors/1').send({
        phoneNo: '+95987654321',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isSuccess: true,
        message: 'Donor updated successfully.',
        isFailure: false,
        data: {
          id: 1,
          phoneNo: '+95987654321',
        },
      });
    });
  });

  describe('DELETE /api/v1/donors/:id', () => {
    it('deletes donor with standard void Result envelope', async () => {
      mock.module('../donor.service', () => ({
        ...donorService,
        deleteDonorService: mock(() => Promise.resolve(FAKE_DONOR)),
      }));

      const res = await request(app).delete('/api/v1/donors/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        isSuccess: true,
        message: 'Donor deleted successfully.',
        isFailure: false,
      });
    });
  });
});
