# AI Planner API - Endpoints Documentation

## Base URL
- **Development**: `http://localhost:5000/api/v1`
- **Production**: `https://api.aiplanner.com/api/v1`

## Authentication
Most endpoints require authentication via JWT token in the Authorization header: Authorization: Bearer <your-jwt-token>


## Rate Limiting
- **General endpoints**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Premium users**: 500 requests per 15 minutes per user

## Endpoints Overview

### Authentication Endpoints

#### Register User
```http
POST /auth/register

Request Body:
JSON
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe",
  "acceptTerms": true
}
Response (201):
JSON
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "abc123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
Login
http
Copy
POST /auth/login
Request Body:
JSON
Copy
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
Response (200):
JSON
Copy
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "abc123",
      "email": "user@example.com",
      "displayName": "John Doe"
    }
  }
}
Refresh Token
http
Copy
POST /auth/refresh
Request Body:
JSON
Copy
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
Response (200):
JSON
Copy
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
User Management Endpoints
Get User Profile
http
Copy
GET /users/me
Headers:
Authorization: Bearer <access-token>
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "userId": "abc123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoURL": "https://example.com/photo.jpg",
    "emailVerified": true,
    "preferences": {
      "theme": "light",
      "notifications": true,
      "language": "en"
    },
    "subscription": {
      "plan": "premium",
      "status": "active",
      "expiresAt": "2024-12-31T23:59:59Z"
    }
  }
}
Update User Profile
http
Copy
PATCH /users/me
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "displayName": "John Updated",
  "preferences": {
    "theme": "dark",
    "notifications": false
  }
}
Response (200):
JSON
Copy
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "userId": "abc123",
    "displayName": "John Updated",
    "preferences": {
      "theme": "dark",
      "notifications": false
    }
  }
}
Planner Endpoints
Get All Planners
http
Copy
GET /planners
Headers:
Authorization: Bearer <access-token>
Query Parameters:
page (optional): Page number (default: 1)
limit (optional): Items per page (default: 10, max: 50)
sort (optional): Sort field (createdAt, updatedAt, title)
order (optional): Sort order (asc, desc)
search (optional): Search in title and description
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "planners": [
      {
        "id": "planner123",
        "title": "My Work Planner",
        "description": "Daily work tasks and goals",
        "color": "#3B82F6",
        "icon": "briefcase",
        "sectionsCount": 3,
        "activitiesCount": 15,
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-20T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
Create Planner
http
Copy
POST /planners
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "title": "Project Alpha",
  "description": "Q1 2024 project planning",
  "color": "#10B981",
  "icon": "rocket",
  "settings": {
    "isPublic": false,
    "allowCollaboration": true,
    "autoArchive": false,
    "reminderEnabled": true
  }
}
Response (201):
JSON
Copy
{
  "success": true,
  "message": "Planner created successfully",
  "data": {
    "id": "planner456",
    "title": "Project Alpha",
    "description": "Q1 2024 project planning",
    "color": "#10B981",
    "icon": "rocket",
    "sections": [],
    "settings": {
      "isPublic": false,
      "allowCollaboration": true,
      "autoArchive": false,
      "reminderEnabled": true
    },
    "createdAt": "2024-01-25T10:00:00Z",
    "updatedAt": "2024-01-25T10:00:00Z"
  }
}
Get Planner by ID
http
Copy
GET /planners/:id
Headers:
Authorization: Bearer <access-token>
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "id": "planner456",
    "title": "Project Alpha",
    "description": "Q1 2024 project planning",
    "color": "#10B981",
    "icon": "rocket",
    "sections": [
      {
        "id": "section789",
        "title": "Planning",
        "type": "tasks",
        "order": 1,
        "activities": []
      }
    ],
    "collaborators": [],
    "settings": {
      "isPublic": false,
      "allowCollaboration": true,
      "autoArchive": false,
      "reminderEnabled": true
    },
    "createdAt": "2024-01-25T10:00:00Z",
    "updatedAt": "2024-01-25T10:00:00Z"
  }
}
Section Endpoints
Get Sections
http
Copy
GET /planners/:plannerId/sections
Headers:
Authorization: Bearer <access-token>
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": "section789",
        "title": "Planning",
        "description": "Initial planning phase",
        "type": "tasks",
        "order": 1,
        "activitiesCount": 5,
        "settings": {
          "collapsed": false,
          "color": "#F59E0B",
          "icon": "light-bulb"
        },
        "createdAt": "2024-01-25T10:30:00Z",
        "updatedAt": "2024-01-25T10:30:00Z"
      }
    ]
  }
}
Activity Endpoints
Create Activity
http
Copy
POST /sections/:sectionId/activities
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "title": "Design Database Schema",
  "description": "Create ERD and define relationships",
  "type": "task",
  "priority": "high",
  "dueDate": "2024-02-01T17:00:00Z",
  "tags": ["backend", "database"],
  "metadata": {
    "estimatedDuration": 180,
    "difficulty": 4
  }
}
Response (201):
JSON
Copy
{
  "success": true,
  "message": "Activity created successfully",
  "data": {
    "id": "activity123",
    "title": "Design Database Schema",
    "description": "Create ERD and define relationships",
    "type": "task",
    "status": "pending",
    "priority": "high",
    "dueDate": "2024-02-01T17:00:00Z",
    "tags": ["backend", "database"],
    "metadata": {
      "estimatedDuration": 180,
      "difficulty": 4
    },
    "createdAt": "2024-01-25T11:00:00Z",
    "updatedAt": "2024-01-25T11:00:00Z"
  }
}
AI Endpoints
Get AI Task Suggestions
http
Copy
POST /ai/suggest-tasks
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "context": {
    "currentTasks": ["Design UI", "Write tests"],
    "goals": ["Launch MVP by Q2"],
    "constraints": ["Limited to 3 team members"],
    "preferences": {
      "difficulty": "medium",
      "timeAvailable": 40
    }
  }
}
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "title": "Set up CI/CD pipeline",
        "description": "Automate testing and deployment",
        "priority": "high",
        "estimatedDuration": 240,
        "confidence": 0.85,
        "reasoning": "Critical for maintaining code quality and deployment speed"
      }
    ],
    "insights": "Based on your current progress and constraints, focus on automation and infrastructure setup.",
    "confidence": 0.82
  }
}
Export Endpoints
Export Planner as PDF
http
Copy
POST /export/pdf
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "plannerId": "planner456",
  "format": "pdf",
  "options": {
    "includeCompleted": true,
    "includeNotes": true,
    "theme": "professional",
    "layout": "landscape"
  }
}
Response (200):
JSON
Copy
{
  "success": true,
  "data": {
    "downloadUrl": "https://storage.aiplanner.com/exports/planner456_20240125_120000.pdf",
    "expiresAt": "2024-01-26T12:00:00Z",
    "fileSize": 245760,
    "pages": 3
  }
}
Calendar Integration Endpoints
Sync with Google Calendar
http
Copy
POST /calendar/sync/google
Headers:
Authorization: Bearer <access-token>
Request Body:
JSON
Copy
{
  "accessToken": "ya29.a0AfH6SMBx...",
  "syncDirection": "bidirectional",
  "calendarId": "primary",
  "syncOptions": {
    "syncPastDays": 30,
    "syncFutureDays": 90,
    "includeCompleted": false
  }
}
Response (200):
JSON
Copy
{
  "success": true,
  "message": "Calendar sync initiated",
  "data": {
    "syncId": "sync789",
    "status": "in_progress",
    "eventsProcessed": 0,
    "totalEvents": 45,
    "estimatedCompletion": "2024-01-25T12:30:00Z"
  }
}
Error Responses
All endpoints return consistent error responses:
JSON
Copy
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
Common Error Codes
UNAUTHORIZED (401): Invalid or expired token
FORBIDDEN (403): Insufficient permissions
NOT_FOUND (404): Resource not found
VALIDATION_ERROR (422): Request validation failed
RATE_LIMIT_EXCEEDED (429): Too many requests
INTERNAL_ERROR (500): Server error
Pagination
List endpoints support pagination:
JSON
Copy
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
WebSocket Events
Real-time updates are available via WebSocket connection to /ws:
JavaScript
Copy
// Connect to WebSocket
const ws = new WebSocket('wss://api.aiplanner.com/ws');

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));

// Listen for updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update received:', data);
};
Available Events
planner:updated - Planner data updated
activity:created - New activity created
activity:updated - Activity updated
collaborator:joined - User joined collaboration
notification:new - New notification
Copy

## 2. Authentication Documentation

**File: `docs/api/authentication.md`**

```markdown
# Authentication & Authorization

## Overview
AI Planner API uses JWT (JSON Web Tokens) for authentication with refresh token support. The system implements role-based access control (RBAC) and supports multi-factor authentication (MFA).

## Authentication Flow

### 1. User Registration
```mermaid
sequenceDiagram
    Client->>API: POST /auth/register
    API->>AuthService: Validate input
    AuthService->>Firebase: Create user
    Firebase-->>AuthService: User created
    AuthService->>AuthService: Send verification email
    AuthService-->>API: Registration successful
    API-->>Client: 201 Created



sequenceDiagram
    Client->>API: POST /auth/login
    API->>AuthService: Validate credentials
    AuthService->>Firebase: Verify user
    Firebase-->>AuthService: User data
    AuthService->>AuthService: Check account status
    AuthService->>AuthService: Generate tokens
    AuthService-->>API: Tokens + user data
    API-->>Client: 200 OK

Token Management
Access Token
Lifetime: 15 minutes
Purpose: Access protected resources
Usage: Include in Authorization header
Refresh Token
Lifetime: 7 days
Purpose: Obtain new access tokens
Storage: Secure HTTP-only cookie
Token Format
JSON
Copy
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user123",
    "email": "user@example.com",
    "role": "user",
    "permissions": ["read:planners", "write:planners"],
    "iat": 1640995200,
    "exp": 1640996100
  }
}
Implementation Details
Password Security
Hashing Algorithm: bcrypt with cost factor 12
Password Requirements:
Minimum 8 characters
At least one uppercase letter
At least one lowercase letter
At least one number
At least one special character
Account Security Features
Account Lockout
Trigger: 5 failed login attempts
Duration: 15 minutes
Notification: Email sent to user
Email Verification
Required: Yes, for new accounts
Token Expiry: 24 hours
Resend: Available after 5 minutes
Password Reset
Token Expiry: 1 hour
One-time Use: Yes
Rate Limit: 3 requests per hour
Multi-Factor Authentication (MFA)
Setup MFA
http
Copy
POST /auth/mfa/setup
Request:
JSON
Copy
{
  "password": "currentPassword123!"
}
Response:
JSON
Copy
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "backupCodes": [
      "12345678",
      "87654321",
      "11223344"
    ]
  }
}
Verify MFA Setup
http
Copy
POST /auth/mfa/verify-setup
Request:
JSON
Copy
{
  "code": "123456",
  "secret": "JBSWY3DPEHPK3PXP"
}
Disable MFA
http
Copy
DELETE /auth/mfa
Request:
JSON
Copy
{
  "password": "currentPassword123!",
  "code": "123456"
}
Role-Based Access Control (RBAC)
User Roles
1. Free User
JavaScript
Copy
permissions: [
  'read:own-planners',
  'write:own-planners',
  'read:own-profile',
  'write:own-profile'
]
2. Premium User
JavaScript
Copy
permissions: [
  ...freeUserPermissions,
  'create:unlimited-planners',
  'share:planners',
  'export:planners',
  'use:ai-features'
]
3. Enterprise User
JavaScript
Copy
permissions: [
  ...premiumUserPermissions,
  'create:team-planners',
  'manage:team-members',
  'access:advanced-analytics',
  'integrate:external-services'
]
4. Admin
JavaScript
Copy
permissions: [
  '*:*' // All permissions
]
Permission Checking
JavaScript
Copy
// Middleware example
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions;
    const hasPermission = userPermissions.includes(requiredPermission);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
    
    next();
  };
};
API Key Authentication
Generate API Key
http
Copy
POST /auth/api-keys
Headers:
Authorization: Bearer <access-token>
Request:
JSON
Copy
{
  "name": "Production Integration",
  "permissions": ["read:planners", "write:activities"],
  "expiresAt": "2024-12-31T23:59:59Z"
}
Response:
JSON
Copy
{
  "success": true,
  "data": {
    "key": "ak_live_1234567890abcdef",
    "name": "Production Integration",
    "permissions": ["read:planners", "write:activities"],
    "createdAt": "2024-01-25T10:00:00Z",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
Use API Key
Include the API key in the X-API-Key header:
X-API-Key: ak_live_1234567890abcdef
OAuth Integration
Supported Providers
Google
GitHub
Microsoft (Azure AD)
OAuth Flow
Redirect to Provider: User redirected to OAuth provider
Authorization: User authorizes the application
Callback: Provider redirects back with authorization code
Token Exchange: Server exchanges code for access token
User Creation/Login: User account created or logged in
Google OAuth Example
http
Copy
GET /auth/oauth/google
Query Parameters:
redirect_uri: Where to redirect after authorization
state: CSRF protection token
Response:
JSON
Copy
{
  "success": true,
  "data": {
    "authorizationUrl": "https://accounts.google.com/oauth2/auth?client_id=...&redirect_uri=...&state=..."
  }
}
Security Best Practices
1. Token Storage
Client-side: Store in memory or secure storage
Mobile apps: Use Keychain (iOS) or Keystore (Android)
Never: Store in localStorage or sessionStorage
2. Token Refresh
Automatic: Implement automatic token refresh
Background: Refresh tokens before expiration
Fallback: Handle refresh failures gracefully
3. HTTPS Only
Production: Always use HTTPS
Certificates: Use valid SSL certificates
HSTS: Implement HTTP Strict Transport Security
4. Input Validation
Sanitization: Validate and sanitize all inputs
Rate Limiting: Implement rate limiting
CSRF Protection: Use CSRF tokens for state-changing operations
5. Audit Logging
Authentication Events: Log all auth-related events
Failed Attempts: Track and monitor failed attempts
Suspicious Activity: Alert on suspicious patterns
Error Handling
Common Authentication Errors
Invalid Token
JSON
Copy
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
Insufficient Permissions
JSON
Copy
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this operation"
  }
}
Account Locked
JSON
Copy
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account is locked due to multiple failed login attempts. Please try again in 15 minutes."
  }
}
Testing Authentication
Using cURL
bash
Copy
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "displayName": "Test User"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Access protected route
curl -X GET http://localhost:5000/api/v1/users/me \
  -H "Authorization: Bearer <your-access-token>"
Using Postman
Import the collection from /docs/postman/AI-Planner-API.postman_collection.json
Set up environment variables
Use the pre-request script for automatic token refresh
Troubleshooting
Common Issues
1. Token Expired
Problem: Getting 401 Unauthorized
Solution: Use refresh token to get new access token
2. Invalid Signature
Problem: Token verification fails
Solution: Ensure JWT_SECRET is consistent across all instances
3. Rate Limit Exceeded
Problem: Getting 429 Too Many Requests
Solution: Implement exponential backoff and retry logic
4. CORS Issues
Problem: Preflight requests failing
Solution: Configure CORS properly in application settings
Debug Mode
Enable debug logging to troubleshoot authentication issues:
bash
Copy
DEBUG=auth:* npm run dev
Copy

## 3. API Examples

**File: `docs/api/examples.md`**

```markdown
# API Usage Examples

## Authentication Examples

### Complete Authentication Flow (Node.js)
```javascript
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';

class AIPlannerClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async registerUser(userData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        acceptTerms: true
      });
      
      console.log('Registration successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error.response.data);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });
      
      this.accessToken = response.data.data.accessToken;
      this.refreshToken = response.data.data.refreshToken;
      
      // Store tokens securely
      this.storeTokens();
      
      console.log('Login successful');
      return response.data;
    } catch (error) {
      console.error('Login failed:', error.response.data);
      throw error;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: this.refreshToken
      });
      
      this.accessToken = response.data.data.accessToken;
      this.storeTokens();
      
      return response.data;
    } catch (error) {
      console.error('Token refresh failed:', error.response.data);
      // Redirect to login
      throw error;
    }
  }

  storeTokens() {
    // In production, use secure storage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', this.accessToken);
      localStorage.setItem('refreshToken', this.refreshToken);
    }
  }

  async makeAuthenticatedRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      return await axios(config);
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired, try to refresh
        await this.refreshAccessToken();
        return this.makeAuthenticatedRequest(method, endpoint, data);
      }
      throw error;
    }
  }
}

// Usage
const client = new AIPlannerClient();

async function runExample() {
  try {
    // Register new user
    await client.registerUser({
      email: 'test@example.com',
      password: 'TestPassword123!',
      displayName: 'Test User'
    });

    // Login
    await client.login('test@example.com', 'TestPassword123!');

    // Make authenticated request
    const response = await client.makeAuthenticatedRequest('GET', '/users/me');
    console.log('User profile:', response.data);

  } catch (error) {
    console.error('Example failed:', error);
  }
}
OAuth Authentication (React)
jsx
Copy
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AuthComponent = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const response = await axios.get('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data.data);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('accessToken');
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/v1/auth/google';
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post('/api/v1/auth/login', {
        email,
        password
      });

      const { accessToken, refreshToken, user } = response.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);

    } catch (error) {
      console.error('Login failed:', error);
      alert(error.response?.data?.error?.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.displayName}!</h2>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <h2>Login</h2>
          <button onClick={handleGoogleLogin}>
            Login with Google
          </button>
          {/* Add regular login form here */}
        </div>
      )}
    </div>
  );
};

export default AuthComponent;
Planner Management Examples
Create a Complete Planner with Sections and Activities (Python)
Python
Copy
import requests
import json
from datetime import datetime, timedelta

class AIPlannerClient:
    def __init__(self, base_url, access_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    def create_planner(self, planner_data):
        """Create a new planner"""
        response = requests.post(
            f'{self.base_url}/planners',
            headers=self.headers,
            json=planner_data
        )
        response.raise_for_status()
        return response.json()
    
    def create_section(self, planner_id, section_data):
        """Create a section in a planner"""
        response = requests.post(
            f'{self.base_url}/planners/{planner_id}/sections',
            headers=self.headers,
            json=section_data
        )
        response.raise_for_status()
        return response.json()
    
    def create_activity(self, section_id, activity_data):
        """Create an activity in a section"""
        response = requests.post(
            f'{self.base_url}/sections/{section_id}/activities',
            headers=self.headers,
            json=activity_data
        )
        response.raise_for_status()
        return response.json()

# Usage example
def create_project_planner():
    client = AIPlannerClient('http://localhost:5000/api/v1', 'your-access-token')
    
    # Create planner
    planner_data = {
        'title': 'Website Redesign Project',
        'description': 'Complete redesign of company website for Q2 2024',
        'color': '#3B82F6',
        'icon': 'globe',
        'settings': {
            'allowCollaboration': True,
            'reminderEnabled': True
        }
    }
    
    planner_response = client.create_planner(planner_data)
    planner_id = planner_response['data']['id']
    print(f'Created planner: {planner_id}')
    
    # Create sections
    sections = [
        {
            'title': 'Planning & Research',
            'description': 'Initial planning and research phase',
            'type': 'tasks',
            'order': 1
        },
        {
            'title': 'Design & Prototyping',
            'description': 'UI/UX design and prototyping',
            'type': 'tasks',
            'order': 2
        },
        {
            'title': 'Development',
            'description': 'Frontend and backend development',
            'type': 'tasks',
            'order': 3
        },
        {
            'title': 'Testing & Launch',
            'description': 'Testing and deployment',
            'type': 'tasks',
            'order': 4
        }
    ]
    
    section_ids = []
    for section_data in sections:
        section_response = client.create_section(planner_id, section_data)
        section_ids.append(section_response['data']['id'])
        print(f'Created section: {section_response["data"]["id"]}')
    
    # Create activities for each section
    activities = {
        0: [  # Planning & Research
            {
                'title': 'Conduct user research',
                'description': 'Interview 20 users and analyze needs',
                'type': 'task',
                'priority': 'high',
                'dueDate': (datetime.now() + timedelta(days=7)).isoformat(),
                'estimatedDuration': 480,
                'tags': ['research', 'users']
            },
            {
                'title': 'Analyze competitor websites',
                'description': 'Review 10 competitor websites',
                'type': 'task',
                'priority': 'medium',
                'dueDate': (datetime.now() + timedelta(days=5)).isoformat(),
                'estimatedDuration': 240,
                'tags': ['research', 'competition']
            }
        ],
        1: [  # Design & Prototyping
            {
                'title': 'Create wireframes',
                'description': 'Design low-fidelity wireframes for all pages',
                'type': 'task',
                'priority': 'high',
                'dueDate': (datetime.now() + timedelta(days=14)).isoformat(),
                'estimatedDuration': 960,
                'tags': ['design', 'wireframes']
            },
            {
                'title': 'Design high-fidelity mockups',
                'description': 'Create pixel-perfect designs',
                'type': 'task',
                'priority': 'high',
                'dueDate': (datetime.now() + timedelta(days=21)).isoformat(),
                'estimatedDuration': 1200,
                'tags': ['design', 'mockups']
            }
        ]
    }
    
    # Create activities
    for section_index, section_activities in activities.items():
        section_id = section_ids[section_index]
        for activity_data in section_activities:
            activity_response = client.create_activity(section_id, activity_data)
            print(f'Created activity: {activity_response["data"]["id"]}')

# Run the example
if __name__ == '__main__':
    create_project_planner()
Real-time Collaboration Example (JavaScript with Socket.io)
JavaScript
Copy
const io = require('socket.io-client');

class CollaborationClient {
  constructor(apiUrl, accessToken) {
    this.apiUrl = apiUrl;
    this.accessToken = accessToken;
    this.socket = null;
    this.plannerId = null;
  }

  connect(plannerId) {
    this.plannerId = plannerId;
    
    this.socket = io(`${this.apiUrl}/ws`, {
      auth: {
        token: this.accessToken
      },
      query: {
        plannerId: plannerId
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to collaboration server');
      this.joinPlanner(this.plannerId);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from collaboration server');
    });

    this.socket.on('collaborator-joined', (data) => {
      console.log(`${data.user.displayName} joined the planner`);
      this.showNotification(`${data.user.displayName} joined`);
    });

    this.socket.on('collaborator-left', (data) => {
      console.log(`${data.user.displayName} left the planner`);
      this.showNotification(`${data.user.displayName} left`);
    });

    this.socket.on('activity-created', (data) => {
      console.log('New activity created:', data.activity);
      this.updateUI('activity-created', data.activity);
    });

    this.socket.on('activity-updated', (data) => {
      console.log('Activity updated:', data.activity);
      this.updateUI('activity-updated', data.activity);
    });

    this.socket.on('cursor-position', (data) => {
      this.updateCursorPosition(data.userId, data.position);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  joinPlanner(plannerId) {
    this.socket.emit('join-planner', { plannerId });
  }

  leavePlanner() {
    this.socket.emit('leave-planner');
  }

  broadcastActivityCreated(activity) {
    this.socket.emit('activity-created', { activity });
  }

  broadcastActivityUpdated(activity) {
    this.socket.emit('activity-updated', { activity });
  }

  broadcastCursorPosition(position) {
    this.socket.emit('cursor-position', { position });
  }

  showNotification(message) {
    // Implementation depends on your UI framework
    console.log('Notification:', message);
  }

  updateUI(eventType, data) {
    // Implementation depends on your UI framework
    console.log(`UI Update (${eventType}):`, data);
  }

  updateCursorPosition(userId, position) {
    // Show other user's cursor position
    console.log(`User ${userId} cursor at:`, position);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Usage
const collaboration = new CollaborationClient('http://localhost:5000', 'your-access-token');
collaboration.connect('planner123');

// Later, when creating an activity
document.getElementById('create-activity').addEventListener('submit', (e) => {
  e.preventDefault();
  const activityData = {
    title: e.target.title.value,
    description: e.target.description.value,
    type: 'task'
  };
  
  // Save to server first
  fetch('/api/v1/sections/section123/activities', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-access-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(activityData)
  })
  .then(response => response.json())
  .then(result => {
    // Broadcast to other collaborators
    collaboration.broadcastActivityCreated(result.data);
  });
});
AI Integration Examples
Get AI Task Suggestions (curl)
bash
Copy
curl -X POST http://localhost:5000/api/v1/ai/suggest-tasks \
  -H "Authorization: Bearer your-access-token" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "currentTasks": [
        {"title": "Design homepage", "status": "in-progress"},
        {"title": "Implement authentication", "status": "completed"}
      ],
      "goals": ["Launch MVP in 2 months"],
      "constraints": ["2 developers", "limited budget"],
      "preferences": {
        "difficulty": "medium",
        "timeAvailable": 40
      }
    }
  }'
AI Productivity Analysis (Python)
Python
Copy
import requests
import json
from datetime import datetime, timedelta

def get_ai_insights(access_token, user_id, date_range=30):
    """Get AI productivity insights"""
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=date_range)
    
    client = AIPlannerClient('http://localhost:5000/api/v1', access_token)
    
    # Get user's completed activities
    activities_response = client.get_activities(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        status='completed'
    )
    
    completed_activities = activities_response['data']['activities']
    
    # Prepare data for AI analysis
    analysis_data = {
        'userId': user_id,
        'dateRange': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat()
        },
        'activities': [
            {
                'id': activity['id'],
                'title': activity['title'],
                'completedAt': activity['completedAt'],
                'estimatedDuration': activity.get('metadata', {}).get('estimatedDuration', 0),
                'actualDuration': activity.get('metadata', {}).get('actualDuration', 0),
                'priority': activity['priority'],
                'tags': activity.get('tags', [])
            }
            for activity in completed_activities
        ],
        'metrics': {
            'totalCompleted': len(completed_activities),
            'totalTimeSpent': sum(activity.get('metadata', {}).get('actualDuration', 0) for activity in completed_activities),
            'averageCompletionTime': sum(activity.get('metadata', {}).get('actualDuration', 0) for activity in completed_activities) / len(completed_activities) if completed_activities else 0
        }
    }
    
    # Get AI insights
    response = requests.post(
        'http://localhost:5000/api/v1/ai/analyze-productivity',
        headers={'Authorization': f'Bearer {access_token}'},
        json=analysis_data
    )
    
    return response.json()

# Usage
insights = get_ai_insights('your-access-token', 'user123')
print(json.dumps(insights, indent=2))
Export Examples
Export Planner to Multiple Formats (Node.js)
JavaScript
Copy
const axios = require('axios');
const fs = require('fs').promises;

class ExportManager {
  constructor(apiUrl, accessToken) {
    this.apiUrl = apiUrl;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async exportToPDF(plannerId, options = {}) {
    const response = await axios.post(
      `${this.apiUrl}/export/pdf`,
      {
        plannerId,
        format: 'pdf',
        options: {
          includeCompleted: true,
          includeNotes: true,
          theme: 'professional',
          layout: 'landscape',
          ...options
        }
      },
      { headers: this.headers }
    );

    return response.data.data;
  }

  async exportToCalendar(plannerId, calendarType = 'ics') {
    const response = await axios.post(
      `${this.apiUrl}/export/calendar`,
      {
        plannerId,
        format: calendarType,
        options: {
          includeCompleted: false,
          dateRange: {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      },
      { headers: this.headers }
    );

    return response.data.data;
  }

  async exportToHandwriting(plannerId) {
    const response = await axios.post(
      `${this.apiUrl}/export/handwriting`,
      {
        plannerId,
        options: {
          style: 'cursive',
          paper: 'lined',
          color: 'blue'
        }
      },
      { headers: this.headers }
    );

    return response.data.data;
  }

  async downloadExport(downloadUrl, outputPath) {
    const response = await axios.get(downloadUrl, {
      responseType: 'stream'
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async exportAllFormats(plannerId, outputDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Export PDF
    console.log('Exporting to PDF...');
    const pdfExport = await this.exportToPDF(plannerId);
    await this.downloadExport(
      pdfExport.downloadUrl,
      `${outputDir}/planner-${timestamp}.pdf`
    );
    
    // Export Calendar
    console.log('Exporting to Calendar...');
    const calendarExport = await this.exportToCalendar(plannerId);
    await this.downloadExport(
      calendarExport.downloadUrl,
      `${outputDir}/planner-${timestamp}.ics`
    );
    
    // Export Handwriting
    console.log('Exporting to Handwriting...');
    const handwritingExport = await this.exportToHandwriting(plannerId);
    await this.downloadExport(
      handwritingExport.downloadUrl,
      `${outputDir}/planner-${timestamp}-handwriting.pdf`
    );
    
    console.log('All exports completed!');
  }
}

// Usage
async function runExportExample() {
  const exporter = new ExportManager(
    'http://localhost:5000/api/v1',
    'your-access-token'
  );
  
  await exporter.exportAllFormats('planner123', './exports');
}

runExportExample().catch(console.error);
Batch Operations Example
Bulk Create Activities (Python with asyncio)
Python

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

class BatchOperations:
    def __init__(self, base_url, access_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    async def bulk_create_activities(self, section_id, activities):
        """Bulk create activities using asyncio for performance"""
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            
            for activity in activities:
                task = self.create_activity_async(session, section_id, activity)
                tasks.append(task)
            
            # Execute all requests concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            successful = []
            failed = []
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed.append({
                        'activity': activities[i],
                        'error': str(result)
                    })
                else:
                    successful.append(result)
            
            return {
                'successful': successful,
                'failed': failed,
                'total': len(activities),
                'successful_count': len(successful),
                'failed_count': len(failed)
            }
    
    async def create_activity_async(self, session, section_id, activity_data):
        """Asynchronously create a single activity"""
        url = f'{self.base_url}/sections/{section_id}/activities'
        
        async with session.post(url, headers=self.headers, json=activity_data) as response:
            if response.status == 201:
                return await response.json()
            else:
                error_text = await response.text()
                raise Exception(f'Failed to create activity: {error_text}')

# Usage
async def run_batch_example():
    client = BatchOperations(
        'http://localhost:5000/api/v1',
        'your-access-token'
    )
    
    # Generate sample activities
    activities = []
    for i in range(20):
        activities.append({
            'title': f'Task {i+1}',
            'description': f'Description for task {i+1}',
            'type': 'task',
            'priority': 'medium' if i % 2 == 0 else 'high',
            'dueDate': (datetime.now() + timedelta(days=i+1)).isoformat(),
            'tags': ['batch', f'task-{i+1}']
        })
    
    # Bulk create
    results = await client.bulk_create_activities('section123', activities)
    
    print(f'Created {results["successful_count"]} activities successfully')
    if results["failed_count"] > 0:
        print(f'Failed to create {results["failed_count"]} activities')
        for failed in results["failed"]:
            print(f'Failed: {failed["activity"]["title"]} - {failed["error"]}')

# Run the example
asyncio.run(run_batch_example())
These examples cover the most common use cases for the AI Planner API. You can adapt them to your specific needs and integrate them into your applications.


## 4. Architecture Overview

**File: `docs/architecture/overview.md`**

```markdown
# Architecture Overview

## System Architecture

The AI Planner API follows a **microservices-inspired monolithic architecture** with clean separation of concerns, designed for scalability and maintainability.

### High-Level Architecture
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  Web App • Mobile App • Third-party Integrations               │
└─────────────────────────────────┬───────────────────────────────┘
│ HTTPS/WebSocket
┌─────────────────────────────────┴───────────────────────────────┐
│                      API Gateway (Nginx)                        │
│  Load Balancing • SSL Termination • Rate Limiting              │
│  Caching • Request Routing • Static Files                      │
└─────────────────────────────────┬───────────────────────────────┘
│
┌─────────────────────────────────┴───────────────────────────────┐
│                      Application Layer                          │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Modules   │ │   Shared    │ │Middleware   │              │
│  │             │ │             │ │             │              │
│  │ • Auth      │ │ • Config    │ │ • Auth      │              │
│  │ • Planner   │ │ • Utils     │ │ • Rate Limit│              │
│  │ • AI        │ │ • Services  │ │ • Validation│              │
│  │ • Export    │ │ • Types     │ │ • Logging   │              │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘              │
│         │               │               │                      │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐              │
│  │Controllers  │ │Services     │ │Repositories │              │
│  │             │ │             │ │             │              │
│  │Handle HTTP  │ │Business     │ │Data Access  │              │
│  │Requests     │ │Logic        │ │Layer        │              │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘              │
│         │               │               │                      │
└─────────┴───────┬───────┴───────────────┴──────────────────────┘
│
┌───────────────┴─────────────────────────────────────────────────┐
│                    Infrastructure Layer                         │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │   Database   │ │    Cache     │ │    Queue     │           │
│  │              │ │              │ │              │           │
│  │ • Firebase   │ │ • Redis      │ │ • BullMQ     │           │
│  │ • Firestore  │ │ • Memory     │ │ • Redis      │           │
│  │ • (MongoDB)  │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  Monitoring  │ │  External    │ │   Security   │           │
│  │              │ │  Services    │ │              │           │
│  │ • Prometheus │ │ • AI APIs    │ │ • Encryption │           │
│  │ • Grafana    │ │ • Email      │ │ • Validation │           │
│  │ • Jaeger     │ │ • Calendar   │ │ • Rate Limit │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘


## Design Principles

### 1. Domain-Driven Design (DDD)
- **Bounded Contexts**: Clear separation between modules
- **Ubiquitous Language**: Consistent terminology throughout
- **Aggregate Roots**: Planner, User, Activity as aggregate roots
- **Domain Events**: Event-driven architecture for real-time features

### 2. Clean Architecture
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                           │
│  Controllers → Validation → DTOs → Response Formatting    │
├─────────────────────────────────────────────────────────────┤
│                      Business Logic                        │
│  Services → Business Rules → Domain Models               │
├─────────────────────────────────────────────────────────────┤
│                      Data Access                           │
│  Repositories → ORM/ODM → Database Queries               │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure                          │
│  External APIs → Caching → File Storage → Message Queues │
└─────────────────────────────────────────────────────────────┘


### 3. SOLID Principles
- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Extensible without modification
- **Liskov Substitution**: Subtypes are substitutable
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions

## Technology Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x+ | Runtime environment |
| TypeScript | 5.x+ | Type-safe development |
| Express.js | 4.x+ | Web framework |
| Firebase Admin | 12.x+ | Authentication & Database |
| Redis | 7.x+ | Caching & Session storage |

### Database Schema
```javascript
// Users Collection
{
  uid: string,
  email: string,
  displayName: string,
  role: 'free' | 'premium' | 'enterprise' | 'admin',
  permissions: string[],
  subscription: {
    plan: string,
    status: 'active' | 'inactive',
    expiresAt: Timestamp
  },
  security: {
    mfaEnabled: boolean,
    lastPasswordChange: Timestamp,
    loginAttempts: number
  },
  preferences: object,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Planners Collection
{
  id: string,
  userId: string,
  title: string,
  description: string,
  sections: Section[],
  collaborators: [{
    userId: string,
    role: 'viewer' | 'editor' | 'admin',
    addedAt: Timestamp
  }],
  settings: object,
  metadata: object,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
Microservices Considerations
While currently a monolith, the architecture supports future microservice extraction:
Potential Microservices
Auth Service: Authentication & authorization
Planner Service: Core planning functionality
AI Service: AI-powered features
Notification Service: Real-time notifications
Export Service: File generation and exports
Analytics Service: Usage analytics and reporting
Service Communication
Synchronous: REST APIs with circuit breakers
Asynchronous: Message queues (BullMQ/Redis)
Event Streaming: For real-time features
Scalability Design
Horizontal Scaling
Stateless Services: No server-side session storage
Load Balancing: Nginx with health checks
Database Sharding: User-based sharding strategy
CDN Integration: Static asset caching
Vertical Scaling
Process Management: PM2 cluster mode
Memory Management: Efficient garbage collection
CPU Optimization: Non-blocking I/O operations
Auto-scaling Triggers
CPU Usage: > 70%
Memory Usage: > 80%
Request Latency: > 500ms (p95)
Queue Backlog: > 1000 jobs
Performance Optimization
Caching Strategy

┌─────────────────────────────────────────┐
│           CDN (CloudFlare)              │
│  • Static assets (24h)                  │
├─────────────────────────────────────────┤
│         Redis Cache Layer               │
│  • User sessions (15m)                  │
│  • API responses (configurable)         │
│  • Database queries (5m)                │
├─────────────────────────────────────────┤
│      Application Memory Cache           │
│  • Compiled templates                   │
│  • Frequently accessed data             │
└─────────────────────────────────────────┘
Database Optimization
Indexing: Compound indexes on frequently queried fields
Query Projection: Only fetch required fields
Pagination: Cursor-based for large datasets
Batch Operations: Bulk read/write operations
API Optimization
Response Compression: Gzip for JSON responses
HTTP/2: Multiplexing support
ETags: Conditional requests
Field Selection: Allow clients to specify fields
Security Architecture
Security Layers

┌─────────────────────────────────────────┐
│         Network Security                │
│  • HTTPS/TLS 1.3                        │
│  • WAF (CloudFlare)                     │
│  • DDoS Protection                      │
├─────────────────────────────────────────┤
│        Application Security             │
│  • Input Validation                     │
│  • SQL Injection Prevention             │
│  • XSS Protection                       │
│  • Rate Limiting                        │
├─────────────────────────────────────────┤
│         Data Security                   │
│  • Encryption at Rest                   │
│  • Encryption in Transit                │
│  • Field-level Encryption               │
│  • Secure Key Management                │
├─────────────────────────────────────────┤
│         Access Control                  │
│  • JWT Authentication                   │
│  • RBAC Authorization                   │
│  • API Key Management                   │
│  • Session Management                   │
└─────────────────────────────────────────┘
Security Headers
JavaScript

// Implemented via Helmet.js
{
  "Content-Security-Policy": "default-src 'self'",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
Monitoring & Observability
Metrics Collection
Application Metrics: Custom business metrics
System Metrics: CPU, memory, disk usage
Infrastructure Metrics: Database, cache, queue metrics
Business Metrics: User engagement, feature usage
Logging Strategy
┌─────────────────────────────────────────┐
│         Structured Logging              │
│  • JSON Format                          │
│  • Correlation IDs                      │
│  • Log Levels                           │
├─────────────────────────────────────────┤
│         Distributed Tracing              │
│  • OpenTelemetry                        │
│  • Jaeger Integration                   │
│  • Request Flow Tracking                │
├─────────────────────────────────────────┤
│          Error Tracking                 │
│  • Centralized Error Collection         │
│  • Error Aggregation                    │
│  • Alert Integration                    │
└─────────────────────────────────────────┘
Alerting Rules
Error Rate: > 5% for 5 minutes
Response Time: p95 > 1 second for 5 minutes
Availability: < 99.9% for any period
Resource Usage: CPU > 80%, Memory > 85%
Deployment Architecture
Environment Strategy

┌─────────────────────────────────────────┐
│         Production (prod)               │
│  • Blue-Green Deployment                │
│  • Auto-scaling Enabled                 │
│  • Zero-downtime Updates                │
├─────────────────────────────────────────┤
│         Staging (staging)               │
│  • Production-like Environment          │
│  • Final Testing Before Prod            │
├─────────────────────────────────────────┤
│         Development (dev)               │
│  • Developer Sandboxes                  │
│  • Feature Branch Deployments           │
├─────────────────────────────────────────┤
│         Local Development               │
│  • Docker Compose                       │
│  • Hot Reload Enabled                   │
└─────────────────────────────────────────┘
CI/CD Pipeline

graph LR
    A[Code Commit] --> B[Build]
    B --> C[Test]
    C --> D[Security Scan]
    D --> E[Deploy Staging]
    E --> F[Integration Tests]
    F --> G[Deploy Production]
    G --> H[Smoke Tests]
    H --> I[Monitoring]

    Disaster Recovery
Backup Strategy
Database: Daily automated backups with 30-day retention
Configuration: Version-controlled in Git
User Data: Encrypted backups with point-in-time recovery
Application State: Stateless design minimizes recovery needs
Recovery Procedures
Service Failure: Auto-restart via PM2/Docker
Data Center Failure: Multi-region deployment
Database Corruption: Restore from backup + replay logs
Security Breach: Immediate token revocation + incident response
RTO/RPO Targets
Recovery Time Objective (RTO): 1 hour
Recovery Point Objective (RPO): 15 minutes
This architecture provides a solid foundation for building, scaling, and maintaining the AI Planner API while ensuring high availability, security, and performance.
Copy

## 5. Database Schema Documentation

**File: `docs/architecture/database-schema.md`**

```markdown
# Database Schema Documentation

## Overview
AI Planner API uses **Firebase Firestore** as the primary database with **Redis** for caching and session management. This document outlines the complete database schema, relationships, and indexing strategies.

## Database Structure

### Firestore Collections

#### 1. Users Collection
**Path**: `users/{userId}`

```json
{
  "uid": "string",                    // Firebase Auth UID (primary key)
  "email": "string",                  // User email (unique)
  "displayName": "string",            // Display name
  "photoURL": "string",               // Profile photo URL
  "emailVerified": "boolean",         // Email verification status
  "phoneNumber": "string",            // Optional phone number
  "preferences": {
    "theme": "light | dark | auto",   // UI theme preference
    "accentColor": "string",          // Hex color code
    "defaultView": "string",          // Default planner view
    "notifications": {
      "email": "boolean",             // Email notifications
      "push": "boolean",              // Push notifications
      "reminder": "boolean"           // Task reminders
    },
    "language": "string",             // ISO 639-1 code
    "timezone": "string",             // IANA timezone
    "dateFormat": "string",           // Date format preference
    "timeFormat": "12h | 24h"        // Time format preference
  },
  "subscription": {
    "plan": "free | premium | enterprise",
    "status": "active | inactive | cancelled | expired",
    "startedAt": "timestamp",         // Subscription start date
    "expiresAt": "timestamp",         // Subscription expiry date
    "autoRenew": "boolean",           // Auto-renewal status
    "paymentMethod": "string",        // Payment method ID
    "stripeCustomerId": "string",     // Stripe customer ID
    "stripeSubscriptionId": "string"  // Stripe subscription ID
  },
  "statistics": {
    "totalPlanners": "number",        // Total planners created
    "totalTasks": "number",           // Total tasks created
    "completedTasks": "number",       // Completed tasks count
    "streakDays": "number",           // Current streak
    "longestStreak": "number",        // Longest streak
    "lastActivity": "timestamp"       // Last activity timestamp
  },
  "security": {
    "failedLoginAttempts": "number",  // Failed login count
    "lockedUntil": "timestamp",       // Account lock expiry
    "passwordChangedAt": "timestamp", // Last password change
    "twoFactorEnabled": "boolean",    // 2FA status
    "backupCodes": ["string"],        // 2FA backup codes
    "trustedDevices": [{              // Trusted devices
      "deviceId": "string",
      "deviceInfo": "string",
      "lastAccess": "timestamp"
    }],
    "loginHistory": [{                // Recent login attempts
      "timestamp": "timestamp",
      "ip": "string",
      "userAgent": "string",
      "success": "boolean"
    }]
  },
  "metadata": {
    "createdFrom": "web | mobile | api", // Creation source
    "lastLoginAt": "timestamp",         // Last login timestamp
    "lastSeenAt": "timestamp",          // Last seen timestamp
    "userAgent": "string",              // Last user agent
    "ip": "string"                      // Last IP address
  },
  "createdAt": "timestamp",             // Account creation
  "updatedAt": "timestamp",             // Last update
  "deletedAt": "timestamp"              // Soft delete timestamp
}
Indexes:
JavaScript
Copy
// Single-field indexes (automatic)
users_by_email = users.where('email', '==', value)
users_by_uid = users.where('uid', '==', value)

// Composite indexes
users_by_status_date = users
  .where('subscription.status', '==', 'active')
  .orderBy('createdAt', 'desc')

users_by_plan_status = users
  .where('subscription.plan', '==', 'premium')
  .where('subscription.status', '==', 'active')
2. Planners Collection
Path: planners/{plannerId}
JSON
Copy
{
  "id": "string",                       // Planner ID (primary key)
  "userId": "string",                   // Owner user ID (foreign key)
  "title": "string",                    // Planner title
  "description": "string",              // Planner description
  "color": "string",                    // Hex color code
  "icon": "string",                     // Icon identifier
  "coverImage": "string",               // Cover image URL
  "sections": [{                        // Embedded sections
    "id": "string",
    "title": "string",
    "description": "string",
    "type": "tasks | notes | goals",
    "order": "number",
    "activitiesCount": "number",
    "settings": {
      "collapsed": "boolean",
      "color": "string",
      "icon": "string"
    },
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }],
  "settings": {
    "isPublic": "boolean",              // Public visibility
    "allowCollaboration": "boolean",    // Collaboration enabled
    "autoArchive": "boolean",           // Auto-archive completed
    "reminderEnabled": "boolean",       // Enable reminders
    "defaultView": "string",            // Default view mode
    "colorScheme": "string",            // Color scheme
    "timezone": "string"                // Planner timezone
  },
  "collaborators": [{                   // Collaborators
    "userId": "string",                 // User ID
    "email": "string",                  // User email
    "displayName": "string",            // Display name
    "role": "viewer | editor | admin",  // Collaboration role
    "permissions": ["string"],          // Specific permissions
    "addedAt": "timestamp",             // Added timestamp
    "addedBy": "string",                // Who added them
    "status": "active | pending | removed"
  }],
  "tags": ["string"],                   // Planner tags
  "metadata": {
    "version": "number",                // Schema version
    "schemaVersion": "string",          // Data schema version
    "lastActivity": "timestamp",        // Last activity
    "activitiesCount": "number",        // Total activities
    "completedCount": "number",         // Completed activities
    "completionRate": "number"          // Completion percentage
  },
  "sharing": {
    "shareId": "string",                // Unique share ID
    "shareLink": "string",              // Public share link
    "password": "string",               // Share password (hashed)
    "expiresAt": "timestamp",           // Share expiry
    "accessCount": "number"             // Access count
  },
  "archived": "boolean",                // Archive status
  "archivedAt": "timestamp",            // Archive timestamp
  "createdAt": "timestamp",             // Creation timestamp
  "updatedAt": "timestamp",             // Last update
  "deletedAt": "timestamp"              // Soft delete timestamp
}
3. Activities Collection
Path: activities/{activityId}
JSON
Copy
{
  "id": "string",                       // Activity ID (primary key)
  "sectionId": "string",                // Parent section ID
  "plannerId": "string",                // Parent planner ID
  "userId": "string",                   // Creator user ID
  "title": "string",                    // Activity title
  "description": "string",              // Activity description
  "type": "task | event | note | goal", // Activity type
  "status": "pending | in-progress | completed | cancelled", // Status
  "priority": "low | medium | high | urgent", // Priority
  "dueDate": "timestamp",               // Due date
  "startDate": "timestamp",             // Start date (for events)
  "endDate": "timestamp",               // End date (for events)
  "completedAt": "timestamp",           // Completion timestamp
  "tags": ["string"],                   // Activity tags
  "assignees": [{                       // Assigned users
    "userId": "string",
    "email": "string",
    "displayName": "string"
  }],
  "attachments": [{                     // File attachments
    "id": "string",
    "name": "string",
    "url": "string",
    "type": "string",                   // MIME type
    "size": "number",                   // File size in bytes
    "uploadedAt": "timestamp",
    "uploadedBy": "string"
  }],
  "checklist": [{                       // Checklist items
    "id": "string",
    "text": "string",
    "completed": "boolean",
    "order": "number"
  }],
  "comments": [{                        // Comments
    "id": "string",
    "userId": "string",
    "text": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }],
  "aiSuggestions": [{                   // AI-generated suggestions
    "id": "string",
    "suggestion": "string",
    "confidence": "number",             // 0-1 confidence score
    "accepted": "boolean",              // Whether user accepted
    "createdAt": "timestamp"
  }],
  "reminders": [{                       // Reminders
    "id": "string",
    "type": "email | push | sms",
    "time": "timestamp",                // When to remind
    "sent": "boolean",                  // Whether sent
    "sentAt": "timestamp"
  }],
  "recurrence": {                       // Recurrence settings
    "pattern": "daily | weekly | monthly | yearly",
    "interval": "number",               // Every N periods
    "daysOfWeek": ["number"],           // For weekly recurrence
    "endDate": "timestamp",             // Recurrence end
    "occurrences": "number"             // Max occurrences
  },
  "metadata": {
    "estimatedDuration": "number",      // Estimated minutes
    "actualDuration": "number",         // Actual minutes
    "difficulty": "number",             // 1-5 difficulty
    "energyLevel": "number",            // 1-5 energy required
    "focusTime": "number",              // Deep work minutes
    "pomodoroSessions": "number",       // Pomodoro count
    "progress": "number"                // 0-100 progress
  },
  "location": {                         // Location (for events)
    "name": "string",
    "address": "string",
    "coordinates": {
      "latitude": "number",
      "longitude": "number"
    }
  },
  "createdAt": "timestamp",             // Creation timestamp
  "updatedAt": "timestamp",             // Last update
  "updatedBy": "string",                // Who last updated
  "deletedAt": "timestamp"              // Soft delete timestamp
}
4. Audit Logs Collection
Path: auditLogs/{logId}
{
  "id": "string",                       // Log ID
  "userId": "string",                   // User who performed action
}