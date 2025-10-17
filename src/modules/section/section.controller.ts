// src/modules/section/section.controller.ts
import { Response, NextFunction } from 'express';
import { SectionService } from './section.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../auth/auth.types';
import { logger } from '../../shared/utils/logger';

export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  /* =========================================================
    CRUD
  ========================================================= */
  createSection = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.sectionService.createSection(req.params.plannerId, req.user!.uid, req.body);
      res.status(201).json(new ApiResponse(req).success(result, 'Section created successfully'));
    } catch (err) {
      logger.error('Create section controller error:', err);
      next(err);
    }
  });

  getSection = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.sectionService.getSection(req.params.id, req.user!.uid);
      res.json(new ApiResponse(req).success(result, 'Section retrieved successfully'));
    } catch (err) {
      logger.error('Get section controller error:', err);
      next(err);
    }
  });

  listSections = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        type: req.query.type as string[],
        search: req.query.search as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      };
      const result = await this.sectionService.listSections(req.params.plannerId, req.user!.uid, filters);
      res.json(new ApiResponse(req).success(result, 'Sections retrieved successfully'));
    } catch (err) {
      logger.error('List sections controller error:', err);
      next(err);
    }
  });

  updateSection = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.sectionService.updateSection(req.params.id, req.user!.uid, req.body);
      res.json(new ApiResponse(req).success(result, 'Section updated successfully'));
    } catch (err) {
      logger.error('Update section controller error:', err);
      next(err);
    }
  });

  deleteSection = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.sectionService.deleteSection(req.params.id, req.user!.uid);
      res.json(new ApiResponse(req).success(null, 'Section deleted successfully'));
    } catch (err) {
      logger.error('Delete section controller error:', err);
      next(err);
    }
  });

  /* =========================================================
     ACTIONS
  ========================================================= */
  reorderSections = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.sectionService.reorderSections(req.params.plannerId, req.user!.uid, req.body);
      res.json(new ApiResponse(req).success(null, 'Sections reordered successfully'));
    } catch (err) {
      logger.error('Reorder sections controller error:', err);
      next(err);
    }
  });

  getSectionStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await this.sectionService.getSectionStatistics(req.params.id);
      res.json(new ApiResponse(req).success(stats, 'Section statistics retrieved successfully'));
    } catch (err) {
      logger.error('Get section statistics controller error:', err);
      next(err);
    }
  });
}