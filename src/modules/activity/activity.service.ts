// src/modules/activity/activity.service.ts
import { injectable, inject } from 'tsyringe';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { ActivityRepository } from './activity.repository';
import {
  Activity,
  ActivityFilterRequest,
  ActivityListResponse,
  TimeEntry,
} from './activity.types';
import { logger } from '../../shared/utils/logger';

@injectable()
export class ActivityService {
  constructor(@inject(ActivityRepository) private readonly repo: ActivityRepository) {}

  /* =========================================================
     CRUD
  ========================================================= */

  async createActivity(sectionId: string, userId: string, data: Partial<Activity>): Promise<Activity> {
    try {
      const activity: Activity = {
        ...data,
        id: data.id || `${Date.now()}-${Math.random()}`,
        sectionId,
        createdBy: userId,
        plannerId: data.plannerId || '',
        status: data.status || 'pending',
        order: data.order || 0,
      } as Activity;

      return await this.repo.createActivity(activity);
    } catch (err) {
      logger.error('ActivityService.createActivity error', { sectionId, userId, data, err });
      throw new AppError('Unable to create activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getActivity(activityId: string, userId: string): Promise<Activity | null> {
    try {
      return await this.repo.findById(activityId);
    } catch (err) {
      logger.error('ActivityService.getActivity error', { activityId, userId, err });
      throw new AppError('Unable to fetch activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async updateActivity(activityId: string, userId: string, updates: Partial<Activity>): Promise<Activity> {
    try {
      return await this.repo.updateActivity(activityId, updates);
    } catch (err) {
      logger.error('ActivityService.updateActivity error', { activityId, userId, updates, err });
      throw new AppError('Unable to update activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async deleteActivity(activityId: string, userId: string): Promise<void> {
    try {
      await this.repo.deleteActivity(activityId);
    } catch (err) {
      logger.error('ActivityService.deleteActivity error', { activityId, userId, err });
      throw new AppError('Unable to delete activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  /* =========================================================
     Listing & Filters
  ========================================================= */

  async listActivities(filters: ActivityFilterRequest, userId: string): Promise<ActivityListResponse> {
    try {
      return await this.repo.findWithFilters(filters);
    } catch (err) {
      logger.error('ActivityService.listActivities error', { filters, userId, err });
      throw new AppError('Unable to fetch activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  /* =========================================================
     Bulk Operations
  ========================================================= */

  async bulkUpdateActivities(activityIds: string[], updates: Partial<Activity>): Promise<void> {
    try {
      await this.repo.bulkUpdate(activityIds, updates);
    } catch (err) {
      logger.error('ActivityService.bulkUpdateActivities error', { activityIds, updates, err });
      throw new AppError('Unable to bulk update activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async bulkDeleteActivities(activityIds: string[]): Promise<void> {
    try {
      await this.repo.bulkDelete(activityIds);
    } catch (err) {
      logger.error('ActivityService.bulkDeleteActivities error', { activityIds, err });
      throw new AppError('Unable to bulk delete activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async reorderActivities(reorderData: Array<{ id: string; order: number }>): Promise<void> {
    try {
      await this.repo.reorderActivities(reorderData);
    } catch (err) {
      logger.error('ActivityService.reorderActivities error', { reorderData, err });
      throw new AppError('Unable to reorder activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async deleteActivitiesBySection(sectionId: string): Promise<void> {
    try {
      await this.repo.deleteBySectionId(sectionId);
    } catch (err) {
      logger.error('ActivityService.deleteActivitiesBySection error', { sectionId, err });
      throw new AppError('Unable to delete activities by section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  /* =========================================================
     Statistics
  ========================================================= */

  async getActivityStatistics(filters: ActivityFilterRequest) {
    try {
      return await this.repo.getActivityStatistics(filters);
    } catch (err) {
      logger.error('ActivityService.getActivityStatistics error', { filters, err });
      throw new AppError('Unable to compute activity statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getDueSoonActivities(userId: string, daysAhead = 7): Promise<Activity[]> {
    try {
      return await this.repo.getDueSoon(userId, daysAhead);
    } catch (err) {
      logger.error('ActivityService.getDueSoonActivities error', { userId, daysAhead, err });
      throw new AppError('Unable to fetch due soon activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getOverdueActivities(userId: string): Promise<Activity[]> {
    try {
      return await this.repo.getOverdue(userId);
    } catch (err) {
      logger.error('ActivityService.getOverdueActivities error', { userId, err });
      throw new AppError('Unable to fetch overdue activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async searchActivities(userId: string, q: string, limit = 20): Promise<Activity[]> {
    try {
      return await this.repo.searchActivities(userId, q, limit);
    } catch (err) {
      logger.error('ActivityService.searchActivities error', { userId, q, err });
      throw new AppError('Unable to search activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  /* =========================================================
     Time Tracking
  ========================================================= */

  async startTimeEntry(entry: TimeEntry): Promise<void> {
    try {
      await this.repo.saveTimeEntry(entry);
    } catch (err) {
      logger.error('ActivityService.startTimeEntry error', { entry, err });
      throw new AppError('Unable to start time entry', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getActiveTimeEntry(userId: string): Promise<TimeEntry | null> {
    try {
      return await this.repo.getActiveTimeEntry(userId);
    } catch (err) {
      logger.error('ActivityService.getActiveTimeEntry error', { userId, err });
      throw new AppError('Unable to fetch active time entry', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getTimeEntryById(timeEntryId: string): Promise<TimeEntry | null> {
    try {
      return await this.repo.getTimeEntry(timeEntryId);
    } catch (err) {
      logger.error('ActivityService.getTimeEntryById error', { timeEntryId, err });
      throw new AppError('Unable to fetch time entry', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async getUserTimeEntries(userId: string): Promise<TimeEntry[]> {
    try {
      return await this.repo.getUserTimeEntries(userId);
    } catch (err) {
      logger.error('ActivityService.getUserTimeEntries error', { userId, err });
      throw new AppError('Unable to fetch user time entries', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }
}
