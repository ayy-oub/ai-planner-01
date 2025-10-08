# AI Planner API - Postman Collection

## Overview
This Postman collection provides comprehensive API testing for the AI Planner API with pre-configured requests, tests, and environment variables.

## Files Included
1. **AI-Planner-API.postman_collection.json** - Main collection with all API endpoints
2. **AI-Planner-API.postman_environment.json** - Development environment
3. **AI-Planner-API-Production.postman_environment.json** - Production environment

## Import Instructions

### Method 1: Direct Import
1. Open Postman
2. Click "Import" button
3. Drag and drop the JSON files into Postman
4. Select the appropriate environment

### Method 2: File Import
1. Open Postman
2. Click "Import" → "Upload Files"
3. Select the JSON files
4. Click "Import"

## Collection Structure

### 1. Health Check
- Basic health check
- Detailed health check
- Metrics endpoint

### 2. Authentication
- User registration
- Login with token management
- Get current user
- Refresh tokens
- Update profile
- Logout

### 3. User Management
- Get user profile
- Update user preferences

### 4. Planner Management
- Create planner
- List planners (with pagination)
- Get planner by ID
- Update planner
- Share planner

### 5. Section Management
- Create section
- List sections
- Update section

### 6. Activity Management
- Create activity
- List activities
- Update activity status
- Complete activity

### 7. AI Features
- AI task suggestions
- Schedule optimization
- Productivity analysis

### 8. Export Features
- Export as PDF
- Export to calendar
- Check export status

### 9. Calendar Integration
- Sync with Google Calendar
- Get calendar events

### 10. Collaboration
- Get collaborators
- Add collaborators

### 11. Admin Operations
- Get system stats
- List all users

## Features

### 🔐 Automatic Authentication
- Token management with automatic refresh
- Environment variables for tokens
- Pre-request script handles expired tokens

### 🧪 Comprehensive Testing
- Response validation for all endpoints
- Status code verification
- Response time monitoring
- JSON structure validation

### 📊 Dynamic Data
- Random dates for testing
- Auto-generated timestamps
- Dynamic test data

### 🔄 Environment Variables
- Base URL configuration
- Token storage
- Test user credentials
- Dynamic IDs (planner, section, activity)

## Usage Workflow

### 1. Setup Environment
1. Import the collection and environment
2. Update the `base_url` variable if needed
3. Modify test credentials in environment variables

### 2. Authentication Flow
1. Run "Register User" (first time only)
2. Run "Login" to get tokens
3. Tokens are automatically saved and used in subsequent requests

### 3. Test API Flow
1. Create a planner
2. Create sections within the planner
3. Create activities within sections
4. Test AI features
5. Export data
6. Test collaboration features

### 4. Token Management
- Access tokens expire after 15 minutes
- Refresh tokens are used automatically when needed
- Token expiry is tracked and handled by pre-request scripts

## Environment Variables

### Required Variables
- `base_url`: API base URL
- `test_email`: Test user email
- `test_password`: Test user password
- `test_user_name`: Test user display name

### Auto-populated Variables
- `access_token`: JWT access token (auto-set after login)
- `refresh_token`: JWT refresh token (auto-set after login)
- `user_id`: Current user ID (auto-set after login)
- `planner_id`: Created planner ID (auto-set after creation)
- `section_id`: Created section ID (auto-set after creation)
- `activity_id`: Created activity ID (auto-set after creation)
- `export_id`: Export job ID (auto-set after export request)
- `token_expiry`: Token expiration timestamp

## Customization

### Adding New Requests
1. Duplicate existing similar requests
2. Update the endpoint path
3. Modify the request body as needed
4. Add appropriate tests

### Modifying Tests
Tests are written in JavaScript and can be found in the "Tests" tab of each request:
```javascript
pm.test("Test name", function () {
    pm.response.to.have.status(200);
    const jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});



Environment Switching
Use development environment for local testing
Use production environment for production API testing
Variables are automatically updated when switching environments
Advanced Features
Pre-request Scripts
Automatic token refresh when expired
Dynamic timestamp generation
Request signing for API key authentication
Test Scripts
Response validation
Data extraction and storage
Environment variable updates
Error handling
Collection Variables
Global variables for the entire collection
Request-specific variables
Dynamic variable generation
Testing Best Practices
1. Sequential Testing
Run requests in order within each folder for proper data dependencies.
2. Data Cleanup
After testing, delete created resources to keep the database clean.
3. Error Testing
Test error scenarios by providing invalid data:
Missing required fields
Invalid email formats
Wrong passwords
Expired tokens
4. Performance Testing
Monitor response times and identify slow endpoints.
5. Load Testing
Use Postman's collection runner for basic load testing.
Troubleshooting
Authentication Issues
Check if tokens are properly set in environment
Verify token expiry and refresh mechanism
Ensure correct credentials in environment variables
Connection Issues
Verify the base_url environment variable
Check if the API server is running
Ensure proper network connectivity
Response Errors
Check the response body for error details
Verify request payload format
Check for missing required fields
Support
For issues or questions about the Postman collection, please:
Check the API documentation
Review the test scripts for examples
Examine the pre-request scripts for authentication flow
Contact the development team for specific API issues



This complete Postman collection provides:

1. **Comprehensive API Coverage** - All endpoints from your API documentation
2. **Automatic Authentication** - Token management with auto-refresh
3. **Dynamic Data Generation** - Random dates, timestamps, and test data
4. **Environment Variables** - Separate configs for dev and production
5. **Test Validation** - Response validation for all endpoints
6. **Sequential Flow** - Logical order for testing complete workflows
7. **Error Handling** - Proper test scripts for validation
8. **Documentation** - Clear instructions for usage

To use this collection:

1. **Import the files** into Postman
2. **Set your environment** (dev or production)
3. **Update credentials** in the environment variables
4. **Run the authentication flow** first (Register → Login)
5. **Test API endpoints** in sequence
6. **Monitor results** with the built-in test validation

The collection automatically handles token refresh, saves IDs for subsequent requests, and validates all responses according to your API specification.

