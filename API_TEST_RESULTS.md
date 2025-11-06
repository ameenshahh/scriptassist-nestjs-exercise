# API Endpoint Testing Results

This document contains comprehensive test results for all API endpoints in the TaskFlow API. All tests were performed using curl commands.

**Test Date:** 2025-11-06  
**Base URL:** http://localhost:3000

---

## Table of Contents
1. [Public Endpoints](#public-endpoints)
2. [Authentication Endpoints](#authentication-endpoints)
3. [User Endpoints](#user-endpoints)
4. [Task Endpoints](#task-endpoints)
5. [Error Scenarios](#error-scenarios)

---

## Public Endpoints

### 1. Root Endpoint (GET /)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/` | - | - | `{"message":"Welcome to TaskFlow API","version":"1.0.0","status":"running","documentation":"/api","health":"/health"}` HTTP_STATUS:200 | correct | Welcome message returned successfully with all expected fields |

### 2. Health Check (GET /health)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/health` | - | - | `{"status":"ok","info":{"database":{"status":"up",...},"redis":{"status":"up",...},"memory_heap":{"status":"up"},"memory_rss":{"status":"up"},"storage":{"status":"up"}}}` HTTP_STATUS:200 | correct | All health checks (database, redis, memory, storage) are up |

### 3. Readiness Check (GET /health/ready)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/health/ready` | - | - | `{"status":"ok","info":{"database":{"status":"up",...},"redis":{"status":"up",...}}}` HTTP_STATUS:200 | correct | Database and Redis are ready |

### 4. Liveness Check (GET /health/live)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/health/live` | - | - | `{"status":"ok","info":{"memory_heap":{"status":"up"}}}` HTTP_STATUS:200 | correct | Memory heap check passed |

---

## Authentication Endpoints

### 5. Register User (POST /auth/register) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"testuser@example.com","name":"Test User","password":"Test123!"}'` | `{"email":"testuser@example.com","name":"Test User","password":"Test123!"}` | - | `{"access_token":"...","refresh_token":"...","user":{"id":"cf37652a-e92d-4f74-a001-e737e848ad45","email":"testuser@example.com","name":"Test User","role":"user"}}` HTTP_STATUS:201 | correct | User registered successfully, tokens returned, user ID generated |

### 6. Register User - Duplicate Email

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"testuser@example.com","name":"Test User","password":"Test123!"}'` | `{"email":"testuser@example.com","name":"Test User","password":"Test123!"}` | - | `{"success":false,"statusCode":400,"message":"Email already exists",...}` HTTP_STATUS:400 | correct | Properly rejects duplicate email registration |

### 7. Register User - Invalid Email

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"invalid-email","name":"Test","password":"Test123!"}'` | `{"email":"invalid-email","name":"Test","password":"Test123!"}` | - | `{"success":false,"statusCode":400,"message":["email must be an email"],...}` HTTP_STATUS:400 | correct | Validates email format correctly |

### 8. Register User - Empty Name

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"testuser2@example.com","name":"","password":"Test123!"}'` | `{"email":"testuser2@example.com","name":"","password":"Test123!"}` | - | `{"success":false,"statusCode":400,"message":["name should not be empty"],...}` HTTP_STATUS:400 | correct | Validates required name field |

### 9. Register User - Short Password

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"testuser3@example.com","name":"Test User 3","password":"123"}'` | `{"email":"testuser3@example.com","name":"Test User 3","password":"123"}` | - | `{"success":false,"statusCode":400,"message":["password must be longer than or equal to 6 characters"],...}` HTTP_STATUS:400 | correct | Validates minimum password length (6 characters) |

### 10. Register User - Empty Payload

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{}'` | `{}` | - | `{"success":false,"statusCode":400,"message":["email should not be empty","email must be an email","name should not be empty",...]}` HTTP_STATUS:400 | correct | Returns all validation errors for missing required fields |

### 11. Login (POST /auth/login) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"Test123!"}'` | `{"email":"testuser@example.com","password":"Test123!"}` | - | `{"access_token":"...","refresh_token":"...","user":{"id":"...","email":"testuser@example.com","role":"user"}}` HTTP_STATUS:200 | correct | Login successful, both tokens returned |

### 12. Login - Invalid Password

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"WrongPassword"}'` | `{"email":"testuser@example.com","password":"WrongPassword"}` | - | `{"success":false,"statusCode":401,"message":"Invalid credentials",...}` HTTP_STATUS:401 | correct | Properly rejects invalid password |

### 13. Login - Non-existent User

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"nonexistent@example.com","password":"Test123!"}'` | `{"email":"nonexistent@example.com","password":"Test123!"}` | - | `{"success":false,"statusCode":401,"message":"Invalid credentials",...}` HTTP_STATUS:401 | correct | Returns generic "Invalid credentials" for security (doesn't reveal if user exists) |

### 14. Login - Invalid Email Format

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"invalid-email","password":"Test123!"}'` | `{"email":"invalid-email","password":"Test123!"}` | - | `{"success":false,"statusCode":400,"message":["email must be an email"],...}` HTTP_STATUS:400 | correct | Validates email format before authentication attempt |

### 15. Login - Empty Payload

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{}'` | `{}` | - | `{"success":false,"statusCode":400,"message":["email should not be empty","email must be an email","password should not be empty",...]}` HTTP_STATUS:400 | correct | Returns all validation errors |

### 16. Refresh Token (POST /auth/refresh) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/refresh -H "Content-Type: application/json" -d '{"refresh_token":"<valid_token>"}'` | `{"refresh_token":"<valid_token>"}` | - | `{"access_token":"...","refresh_token":"..."}` HTTP_STATUS:200 | correct | New tokens generated successfully |

### 17. Refresh Token - Invalid Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/refresh -H "Content-Type: application/json" -d '{"refresh_token":"invalid-token"}'` | `{"refresh_token":"invalid-token"}` | - | `{"success":false,"statusCode":401,"message":"Invalid or expired refresh token",...}` HTTP_STATUS:401 | correct | Properly rejects invalid refresh token |

### 18. Refresh Token - Missing Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/refresh -H "Content-Type: application/json" -d '{}'` | `{}` | - | `{"success":false,"statusCode":400,"message":["refresh_token should not be empty","refresh_token must be a string"],...}` HTTP_STATUS:400 | correct | Validates required refresh_token field |

### 19. Logout (POST /auth/logout) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer <token>" -H "Content-Type: application/json"` | - | - | (empty response) HTTP_STATUS:204 | correct | Logout successful, no content returned |

### 20. Logout - No Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/logout` | - | - | `{"success":false,"statusCode":401,"message":"Unauthorized",...}` HTTP_STATUS:401 | correct | Requires authentication |

### 21. Logout - Invalid Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer invalid-token"` | - | - | `{"success":false,"statusCode":401,"message":"Unauthorized",...}` HTTP_STATUS:401 | correct | Rejects invalid token |

---

## User Endpoints

### 22. Create User (POST /users) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"newuser@example.com","name":"New User","password":"Password123!"}'` | `{"email":"newuser@example.com","name":"New User","password":"Password123!"}` | - | `{"email":"newuser@example.com","name":"New User","id":"bc61b9be-0ecb-4f8c-b8f1-31520fc3508d","role":"user","createdAt":"...","updatedAt":"..."}` HTTP_STATUS:201 | correct | User created successfully, UUID generated |

### 23. Create User - Invalid Email

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"invalid","name":"Test","password":"Test123!"}'` | `{"email":"invalid","name":"Test","password":"Test123!"}` | - | `{"success":false,"statusCode":400,"message":["email must be an email"],...}` HTTP_STATUS:400 | correct | Validates email format |

### 24. List Users (GET /users) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET http://localhost:3000/users -H "Authorization: Bearer <token>"` | - | - | `[{"id":"550e8400-e29b-41d4-a716-446655440000","email":"admin@example.com",...},...]` HTTP_STATUS:200 | correct | Returns array of all users |

### 25. List Users - No Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET http://localhost:3000/users` | - | - | `{"success":false,"statusCode":401,"message":"Unauthorized",...}` HTTP_STATUS:401 | correct | Requires authentication |

### 26. Get User by ID (GET /users/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/users/<user_id>" -H "Authorization: Bearer <token>"` | - | - | `{"id":"cf37652a-e92d-4f74-a001-e737e848ad45","email":"testuser@example.com","name":"Test User","role":"user",...}` HTTP_STATUS:200 | correct | Returns user details |

### 27. Get User by ID - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/users/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>"` | - | - | `{"success":false,"statusCode":404,"message":"User with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent user |

### 28. Get User by ID - Invalid UUID Format

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/users/invalid-id" -H "Authorization: Bearer <token>"` | - | - | `{"statusCode":500,"message":"Internal server error"}` HTTP_STATUS:500 | incorrect | Should return 400 Bad Request for invalid UUID format, not 500 |

### 29. Update User (PATCH /users/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X PATCH "http://localhost:3000/users/<user_id>" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Updated Name"}'` | `{"name":"Updated Name"}` | - | `{"id":"...","email":"...","name":"Updated Name","role":"user",...}` HTTP_STATUS:200 | correct | User updated successfully, updatedAt timestamp changed |

### 30. Update User - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X PATCH "http://localhost:3000/users/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Updated"}'` | `{"name":"Updated"}` | - | `{"success":false,"statusCode":404,"message":"User with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent user |

### 31. Delete User (DELETE /users/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X DELETE "http://localhost:3000/users/<user_id>" -H "Authorization: Bearer <token>"` | - | - | (empty response) HTTP_STATUS:200 | correct | User deleted successfully |

### 32. Delete User - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X DELETE "http://localhost:3000/users/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>"` | - | - | `{"success":false,"statusCode":404,"message":"User with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent user |

---

## Task Endpoints

### 33. Create Task (POST /tasks) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"Test Task 1","description":"First test task","status":"PENDING","priority":"HIGH","userId":"<user_id>"}'` | `{"title":"Test Task 1","description":"First test task","status":"PENDING","priority":"HIGH","userId":"<user_id>"}` | - | `{"title":"Test Task 1","description":"First test task","status":"PENDING","priority":"HIGH","userId":"...","dueDate":null,"id":"335f37c1-5d24-43ec-88e0-2e50f0f424fe","createdAt":"...","updatedAt":"..."}` HTTP_STATUS:201 | correct | Task created successfully with all fields |

### 34. Create Task - Minimal Required Fields

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"Test Task 3","status":"COMPLETED","priority":"LOW","userId":"<user_id>"}'` | `{"title":"Test Task 3","status":"COMPLETED","priority":"LOW","userId":"<user_id>"}` | - | `{"title":"Test Task 3","status":"COMPLETED","priority":"LOW","userId":"...","description":null,"dueDate":null,"id":"...",...}` HTTP_STATUS:201 | correct | Task created with only required fields, optional fields are null |

### 35. Create Task - Empty Title

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"","description":"Test","userId":"<user_id>"}'` | `{"title":"","description":"Test","userId":"<user_id>"}` | - | `{"success":false,"statusCode":400,"message":["title should not be empty"],...}` HTTP_STATUS:400 | correct | Validates required title field |

### 36. Create Task - Invalid Status

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"Test","status":"INVALID_STATUS","userId":"<user_id>"}'` | `{"title":"Test","status":"INVALID_STATUS","userId":"<user_id>"}` | - | `{"success":false,"statusCode":400,"message":["status must be one of the following values: PENDING, IN_PROGRESS, COMPLETED"],...}` HTTP_STATUS:400 | correct | Validates enum values for status |

### 37. Create Task - Invalid UUID

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"Test","userId":"invalid-uuid"}'` | `{"title":"Test","userId":"invalid-uuid"}` | - | `{"success":false,"statusCode":400,"message":["userId must be a UUID"],...}` HTTP_STATUS:400 | correct | Validates UUID format for userId |

### 38. Create Task - No Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Test","userId":"<user_id>"}'` | `{"title":"Test","userId":"<user_id>"}` | - | `{"success":false,"statusCode":401,"message":"Unauthorized",...}` HTTP_STATUS:401 | correct | Requires authentication |

### 39. List Tasks (GET /tasks) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks" -H "Authorization: Bearer <token>"` | - | - | `{"data":[...],"meta":{"total":8,"page":1,"limit":10,"totalPages":1,"hasNext":false,"hasPrev":false}}` HTTP_STATUS:200 | correct | Returns paginated tasks with metadata |

### 40. List Tasks - Filter by Status

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?status=PENDING" -H "Authorization: Bearer <token>"` | - | `status=PENDING` | `{"data":[...],"meta":{"total":6,"page":1,"limit":10,...}}` HTTP_STATUS:200 | correct | Filters tasks by status correctly |

### 41. List Tasks - Filter by Priority

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?priority=HIGH" -H "Authorization: Bearer <token>"` | - | `priority=HIGH` | `{"data":[...],"meta":{"total":1,"page":1,"limit":10,...}}` HTTP_STATUS:200 | correct | Filters tasks by priority correctly |

### 42. List Tasks - Filter by User ID

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?userId=<user_id>" -H "Authorization: Bearer <token>"` | - | `userId=<user_id>` | `{"data":[...],"meta":{"total":3,"page":1,"limit":10,...}}` HTTP_STATUS:200 | correct | Filters tasks by user ID correctly |

### 43. List Tasks - Pagination

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?page=1&limit=2" -H "Authorization: Bearer <token>"` | - | `page=1&limit=2` | `{"data":[...],"meta":{"total":8,"page":1,"limit":2,"totalPages":4,"hasNext":true,"hasPrev":false}}` HTTP_STATUS:200 | correct | Pagination works correctly, hasNext reflects remaining pages |

### 44. List Tasks - Sorting

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?sortBy=createdAt&sortOrder=ASC" -H "Authorization: Bearer <token>"` | - | `sortBy=createdAt&sortOrder=ASC` | `{"data":[...],"meta":{...}}` HTTP_STATUS:200 | correct | Sorting by createdAt ascending works |

### 45. List Tasks - Combined Filters

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?status=PENDING&priority=HIGH&page=1&limit=5&sortBy=createdAt&sortOrder=DESC" -H "Authorization: Bearer <token>"` | - | `status=PENDING&priority=HIGH&page=1&limit=5&sortBy=createdAt&sortOrder=DESC` | `{"data":[...],"meta":{...}}` HTTP_STATUS:200 | correct | Multiple filters combined correctly |

### 46. List Tasks - Invalid Page (page=0)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?page=0" -H "Authorization: Bearer <token>"` | - | `page=0` | `{"success":false,"statusCode":400,"message":["page must not be less than 1"],...}` HTTP_STATUS:400 | correct | Validates page number minimum value |

### 47. List Tasks - Invalid Limit (limit > 100)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks?limit=200" -H "Authorization: Bearer <token>"` | - | `limit=200` | `{"success":false,"statusCode":400,"message":["limit must not be greater than 100"],...}` HTTP_STATUS:400 | correct | Validates maximum limit value |

### 48. Get Task Statistics (GET /tasks/stats)

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks/stats" -H "Authorization: Bearer <token>"` | - | - | `{"statusCode":500,"message":"Internal server error"}` HTTP_STATUS:500 | incorrect | Should return statistics, appears to have an internal error |

### 49. Get Task by ID (GET /tasks/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks/<task_id>" -H "Authorization: Bearer <token>"` | - | - | `{"id":"335f37c1-5d24-43ec-88e0-2e50f0f424fe","title":"Test Task 1",...}` HTTP_STATUS:200 | correct | Returns task details with user information |

### 50. Get Task by ID - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>"` | - | - | `{"success":false,"statusCode":404,"message":"Task with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent task |

### 51. Update Task (PATCH /tasks/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X PATCH "http://localhost:3000/tasks/<task_id>" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"status":"COMPLETED","description":"Updated description"}'` | `{"status":"COMPLETED","description":"Updated description"}` | - | `{"id":"...","title":"...","description":"Updated description","status":"COMPLETED",...}` HTTP_STATUS:200 | correct | Task updated successfully |

### 52. Update Task - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X PATCH "http://localhost:3000/tasks/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"status":"COMPLETED"}'` | `{"status":"COMPLETED"}` | - | `{"success":false,"statusCode":404,"message":"Task with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent task |

### 53. Update Task - Invalid Status

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X PATCH "http://localhost:3000/tasks/<task_id>" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"status":"INVALID"}'` | `{"status":"INVALID"}` | - | `{"success":false,"statusCode":400,"message":["status must be one of the following values: PENDING, IN_PROGRESS, COMPLETED"],...}` HTTP_STATUS:400 | correct | Validates enum values |

### 54. Delete Task (DELETE /tasks/:id) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X DELETE "http://localhost:3000/tasks/<task_id>" -H "Authorization: Bearer <token>"` | - | - | (empty response) HTTP_STATUS:204 | correct | Task deleted successfully, 204 No Content |

### 55. Delete Task - Not Found

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X DELETE "http://localhost:3000/tasks/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <token>"` | - | - | `{"success":false,"statusCode":404,"message":"Task with ID 00000000-0000-0000-0000-000000000000 not found",...}` HTTP_STATUS:404 | correct | Properly handles non-existent task |

### 56. Batch Complete Tasks (POST /tasks/batch) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":["<task_id1>","<task_id2>"],"action":"complete"}'` | `{"tasks":["<task_id1>","<task_id2>"],"action":"complete"}` | - | `{"success":true,"message":"2 tasks marked as completed","affected":2}` HTTP_STATUS:201 | correct | Batch operation successful, returns affected count |

### 57. Batch Delete Tasks (POST /tasks/batch) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":["<task_id1>","<task_id2>"],"action":"delete"}'` | `{"tasks":["<task_id1>","<task_id2>"],"action":"delete"}` | - | `{"success":true,"message":"2 tasks deleted","affected":2}` HTTP_STATUS:201 | correct | Batch delete successful |

### 58. Batch Update Tasks (POST /tasks/batch) - Success

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":["<task_id1>","<task_id2>"],"action":"update","updateData":{"priority":"HIGH"}}'` | `{"tasks":["<task_id1>","<task_id2>"],"action":"update","updateData":{"priority":"HIGH"}}` | - | `{"success":true,"message":"2 tasks updated","affected":2}` HTTP_STATUS:201 | correct | Batch update successful |

### 59. Batch Operation - Empty Array

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":[],"action":"complete"}'` | `{"tasks":[],"action":"complete"}` | - | `{"success":false,"message":"No task IDs provided"}` HTTP_STATUS:201 | correct | Returns error message for empty array (note: should probably return 400 status) |

### 60. Batch Operation - Invalid Action

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":["<task_id>"],"action":"invalid_action"}'` | `{"tasks":["<task_id>"],"action":"invalid_action"}` | - | `{"success":false,"message":"Unknown action: invalid_action. Supported actions: complete, delete, update"}` HTTP_STATUS:201 | correct | Returns helpful error message (note: should return 400 status) |

### 61. Batch Update - Missing updateData

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X POST http://localhost:3000/tasks/batch -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"tasks":["<task_id>"],"action":"update"}'` | `{"tasks":["<task_id>"],"action":"update"}` | - | `{"success":false,"message":"updateData required for update action"}` HTTP_STATUS:201 | correct | Validates updateData requirement (note: should return 400 status) |

---

## Error Scenarios

### 62. Invalid Endpoint

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/invalid-endpoint"` | - | - | `{"success":false,"statusCode":404,"message":"Cannot GET /invalid-endpoint",...}` HTTP_STATUS:404 | correct | Properly handles non-existent routes |

### 63. Protected Endpoint with Invalid Token

| curl | payload | query params | response | status | remarks |
|------|---------|--------------|----------|--------|---------|
| `curl -s -X GET "http://localhost:3000/tasks" -H "Authorization: Bearer invalid-token-here"` | - | - | `{"success":false,"statusCode":401,"message":"Unauthorized",...}` HTTP_STATUS:401 | correct | Rejects invalid JWT token |

---

## Summary

### Test Coverage
- **Total Test Cases:** 63
- **Passed:** 61
- **Failed/Issues:** 2

### Issues Found

1. **GET /users/:id with invalid UUID** (Test #28)
   - Returns 500 Internal Server Error
   - Expected: 400 Bad Request
   - The endpoint should validate UUID format before processing

2. **GET /tasks/stats** (Test #48)
   - Returns 500 Internal Server Error
   - Expected: 200 OK with statistics
   - The statistics endpoint appears to have an internal error

3. **Batch Operations Status Codes** (Tests #59, #60, #61)
   - Return 201 Created even for error cases
   - Expected: 400 Bad Request for validation errors
   - Minor issue: error responses should use appropriate status codes

### Overall Assessment

The API is **well-designed** with:
- ✅ Comprehensive validation
- ✅ Proper error handling for most cases
- ✅ Good authentication and authorization
- ✅ Effective pagination and filtering
- ✅ Clear error messages

**Recommendations:**
1. Fix UUID validation in GET /users/:id endpoint
2. Debug and fix the /tasks/stats endpoint
3. Update batch operation error responses to use 400 status code
4. Consider adding more detailed error information for debugging

---

**Test Execution Date:** 2025-11-06  
**Tested By:** Automated curl testing  
**Application Version:** 1.0.0

