import type { NextFunction, Request, Response } from "express";
import type {
    CreateDonorType,
    GetAllDonorsQueryType,
    UpdateDonorType,
} from "./donor.schema";
import type { PaginationQueryType } from "../../helper/paginationSchema";

type IdParam = { id: string };
import {
    createDonorService,
    getAllDonorsService,
    getDonorByIdService,
    updateDonorService,
    deleteDonorService,
} from "./donor.service";
import { successResponse } from "../../utils/response";

const createDonor = async (
    req: Request<unknown, unknown, CreateDonorType["body"]>,
    res: Response,
    next: NextFunction,
) => {
    try {
        if (req.body == null || typeof req.body !== "object") {
            return next(new Error("Request body is required"));
        }
        const donor = await createDonorService({ body: req.body });
        return successResponse(res, donor, "Donor created successfully", 201);
    } catch (error) {
        next(error);
    }
};

const getAllDonors = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { name, email, phoneNo, page, limit } = req.query as unknown as
            GetAllDonorsQueryType["query"] & PaginationQueryType;
        const result = await getAllDonorsService(
            req,
            { name, email, phoneNo },
            { page: Number(page) || 1, limit: Number(limit) || 10 },
        );
        return successResponse(res, result, "Donors retrieved successfully");
    } catch (error) {
        next(error);
    }
};

const getDonorById = async (
    req: Request<IdParam>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const id = Number(req.params.id);
        const donor = await getDonorByIdService(id);
        return successResponse(res, donor, "Donor retrieved successfully");
    } catch (error) {
        next(error);
    }
};

const updateDonor = async (
    req: Request<IdParam, unknown, UpdateDonorType["body"]>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const id = Number(req.params.id);
        const donor = await updateDonorService(id, { body: req.body });
        return successResponse(res, donor, "Donor updated successfully");
    } catch (error) {
        next(error);
    }
};

const deleteDonor = async (
    req: Request<IdParam>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const id = Number(req.params.id);
        const donor = await deleteDonorService(id);
        return successResponse(res, donor, "Donor deleted successfully");
    } catch (error) {
        next(error);
    }
};

export { createDonor, getAllDonors, getDonorById, updateDonor, deleteDonor };
