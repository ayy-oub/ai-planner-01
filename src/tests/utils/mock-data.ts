import { UserRole } from '../../src/shared/types/auth.types';
import { PlannerVisibility, SectionType, ActivityType, ActivityStatus, Priority } from '../../src/shared/types/common.types';

/**
 * Mock user data for testing
 */
export const mockUsers = {
    admin: {
        uid: 'admin-uid',
        email: 'admin@example.com',
        displayName: 'Admin User',
        photoURL: 'https://example.com/admin.jpg',
        emailVerified: true,
        preferences: {
            theme: 'dark' as const,
            accentColor: '#FF5733',
            defaultView: 'grid',
            notifications: true,
            language: 'en'
        },
        subscription: {
            plan: 'enterprise' as const,
            status: 'active' as const,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        statistics: {
            totalPlanners: 10,
            totalTasks: 150,
            completedTasks: 120,
            streakDays: 30
        },
        security: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            twoFactorEnabled: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date()
    },

    premium: {
        uid: 'premium-uid',
        email: 'premium@example.com',
        displayName: 'Premium User',
        photoURL: 'https://example.com/premium.jpg',
        emailVerified: true,
        preferences: {
            theme: 'light' as const,
            accentColor: '#4285F4',
            defaultView: 'list',
            notifications: true,
            language: 'en'
        },
        subscription: {
            plan: 'premium' as const,
            status: 'active' as const,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        statistics: {
            totalPlanners: 5,
            totalTasks: 75,
            completedTasks: 60,
            streakDays: 15
        },
        security: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date()
    },

    free: {
        uid: 'free-uid',
        email: 'free@example.com',
        displayName: 'Free User',
        photoURL: 'https://example.com/free.jpg',
        emailVerified: true,
        preferences: {
            theme: 'system' as const,
            accentColor: '#34A853',
            defaultView: 'calendar',
            notifications: false,
            language: 'en'
        },
        subscription: {
            plan: 'free' as const,
            status: 'active' as const,
            expiresAt: null
        },
        statistics: {
            totalPlanners: 2,
            totalTasks: 25,
            completedTasks: 15,
            streakDays: 5
        },
        security: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date()
    }
};

/**
 * Mock planner data for testing
 */
export const mockPlanners = {
    personal: {
        id: 'personal-planner-id',
        userId: 'free-uid',
        title: 'Personal Planner',
        description: 'My personal tasks and goals',
        color: '#FF5733',
        icon: '📝',
        sections: [],
        settings: {
            isPublic: PlannerVisibility.PRIVATE,
            allowCollaboration: false,
            autoArchive: true,
            reminderEnabled: true
        },
        collaborators: [],
        tags: ['personal', 'daily'],
        metadata: {
            version: 1,
            schemaVersion: '1.0.0'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
    },

    work: {
        id: 'work-planner-id',
        userId: 'premium-uid',
        title: 'Work Projects',
        description: 'Work-related projects and tasks',
        color: '#4285F4',
        icon: '💼',
        sections: [],
        settings: {
            isPublic: PlannerVisibility.SHARED,
            allowCollaboration: true,
            autoArchive: false,
            reminderEnabled: true
        },
        collaborators: [
            {
                userId: 'admin-uid',
                role: UserRole.EDITOR,
                addedAt: new Date()
            }
        ],
        tags: ['work', 'projects'],
        metadata: {
            version: 2,
            schemaVersion: '1.0.0'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
    },

    team: {
        id: 'team-planner-id',
        userId: 'admin-uid',
        title: 'Team Sprint',
        description: 'Team sprint planning and tracking',
        color: '#34A853',
        icon: '👥',
        sections: [],
        settings: {
            isPublic: PlannerVisibility.PUBLIC,
            allowCollaboration: true,
            autoArchive: false,
            reminderEnabled: true
        },
        collaborators: [
            {
                userId: 'premium-uid',
                role: UserRole.EDITOR,
                addedAt: new Date()
            },
            {
                userId: 'free-uid',
                role: UserRole.VIEWER,
                addedAt: new Date()
            }
        ],
        tags: ['team', 'sprint'],
        metadata: {
            version: 1,
            schemaVersion: '1.0.0'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null
    }
};

/**
 * Mock section data for testing
 */
export const mockSections = {
    todo: {
        id: 'todo-section-id',
        plannerId: 'personal-planner-id',
        title: 'To Do',
        description: 'Tasks to be completed',
        order: 1,
        type: SectionType.TASKS,
        activities: [],
        settings: {
            collapsed: false,
            color: '#FF5733',
            icon: '✅'
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    inProgress: {
        id: 'inprogress-section-id',
        plannerId: 'work-planner-id',
        title: 'In Progress',
        description: 'Currently working on',
        order: 2,
        type: SectionType.TASKS,
        activities: [],
        settings: {
            collapsed: false,
            color: '#FBBC05',
            icon: '🔄'
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    notes: {
        id: 'notes-section-id',
        plannerId: 'team-planner-id',
        title: 'Notes',
        description: 'Meeting notes and ideas',
        order: 3,
        type: SectionType.NOTES,
        activities: [],
        settings: {
            collapsed: false,
            color: '#4285F4',
            icon: '📝'
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }
};

/**
 * Mock activity data for testing
 */
export const mockActivities = {
    task1: {
        id: 'task-1-id',
        sectionId: 'todo-section-id',
        plannerId: 'personal-planner-id',
        title: 'Complete project documentation',
        description: 'Write comprehensive documentation for the project',
        type: ActivityType.TASK,
        status: ActivityStatus.PENDING,
        priority: Priority.HIGH,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        completedAt: null,
        tags: ['documentation', 'urgent'],
        attachments: [],
        aiSuggestions: [],
        metadata: {
            estimatedDuration: 120,
            actualDuration: 0,
            difficulty: 4,
            energyLevel: 3
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    task2: {
        id: 'task-2-id',
        sectionId: 'inprogress-section-id',
        plannerId: 'work-planner-id',
        title: 'Review pull requests',
        description: 'Review and merge pending pull requests',
        type: ActivityType.TASK,
        status: ActivityStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        completedAt: null,
        tags: ['review', 'development'],
        attachments: [],
        aiSuggestions: [],
        metadata: {
            estimatedDuration: 60,
            actualDuration: 30,
            difficulty: 2,
            energyLevel: 2
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    event1: {
        id: 'event-1-id',
        sectionId: 'notes-section-id',
        plannerId: 'team-planner-id',
        title: 'Team Standup Meeting',
        description: 'Daily standup meeting with the team',
        type: ActivityType.EVENT,
        status: ActivityStatus.PENDING,
        priority: Priority.URGENT,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        completedAt: null,
        tags: ['meeting', 'team'],
        attachments: [],
        aiSuggestions: [],
        metadata: {
            estimatedDuration: 30,
            actualDuration: 0,
            difficulty: 1,
            energyLevel: 1
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }
};

/**
 * Mock AI suggestions for testing
 */
export const mockAiSuggestions = [
    {
        id: 'ai-suggestion-1',
        suggestion: 'Consider breaking this task into smaller subtasks',
        confidence: 0.85,
        accepted: false
    },
    {
        id: 'ai-suggestion-2',
        suggestion: 'Schedule this task for your peak productivity hours',
        confidence: 0.72,
        accepted: true
    },
    {
        id: 'ai-suggestion-3',
        suggestion: 'Add a reminder for this deadline',
        confidence: 0.91,
        accepted: false
    }
];

/**
 * Mock API responses for testing
 */
export const mockApiResponses = {
    success: {
        success: true,
        message: 'Operation completed successfully',
        data: null
    },

    error: {
        success: false,
        message: 'An error occurred',
        error: {
            code: 'TEST_ERROR',
            message: 'Test error message'
        }
    },

    validationError: {
        success: false,
        message: 'Validation failed',
        errors: [
            {
                field: 'email',
                message: 'Email is required'
            },
            {
                field: 'password',
                message: 'Password must be at least 8 characters'
            }
        ]
    }
};