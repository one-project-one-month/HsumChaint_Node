# Hsum Chaint Node API Endpoints Specification

This document provides a comprehensive technical catalog of all active HTTP endpoints implemented in the **Hsum Chaint Node.js** backend (`Express`, `Bun`, `Prisma`, `MySQL`).

---

## 1. System Roles & Authorization Taxonomy

Access control in Hsum Chaint Node is governed by two complementary layers:

1. **System Roles (Global System Level)**:
   - **`Monk` (Role ID 1)**: Religious administrators who can create and manage Monastery Spaces, manage member invitations, configure donation schedules, and review offerings.
   - **`Donor` (Role ID 2)**: Devotees and donors who browse monastery spaces, submit donation requests, and track their personal donation history.
   - **`Admin` (Role ID 3)**: Super-administrators with full oversight across user accounts, system roles, and global permissions.
   - **`Custom Roles`**: Dynamically created by system administrators via the RBAC module.

2. **Space Roles (Monastery Space Level)**:
   - **`Space Admin` (Space Role ID 1)**: Full administrative authority within the space. Automatically assigned to the space **Owner** (`isOwner = true`). Can manage members, invite members, review donations, and schedule offerings. (Only the Owner can delete the space).
   - **`Space Moderator` (Space Role ID 2)**: Moderates space activities, manages member interactions, and reviews incoming donation requests.
   - **`Space Editor` (Space Role ID 3)**: Records manual/walk-in donations, sets pickup/dropoff schedules, and completes fulfilled donations.
   - **`Space Member` (Space Role ID 4)**: General member or devotee with read access to space details and donations.

---

## 2. Global Request & Response Conventions

- **Base URL**: `http://localhost:3000` (Production: `https://hsum-chaint-node-api.invisigate.asia`)
- **Authentication**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Response Format**: All standard responses use the standard `ApiResponse<T>` envelope with `isSuccess`, `message`, and `isFailure`:

```json
// Standard Success Response Envelope
{
  "isSuccess": true,
  "message": "Specific operation success message (e.g. 'User registered successfully.')",
  "isFailure": false,
  "data": { ... }
}

// Standard Error Response Envelope
{
  "isSuccess": false,
  "message": "Detailed error explanation.",
  "isFailure": true,
  "error": { ... } // Detailed stack trace provided in development mode only
}
```

### Standard Response Envelopes

All API responses strictly utilize standardized envelopes matching the .NET specification:

```json
// 1. Single Object Response (Result<T>)
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": { ... }
}

// 2. Standard Void Response (Result)
{
  "isSuccess": true,
  "message": "Operation completed successfully.",
  "isFailure": false
}

// 3. Web Offset Pagination Response Envelope (PagedResult<T>)
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [ ... ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 42,
    "totalPages": 5,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}

// 4. Mobile Cursor Keyset Pagination Response Envelope (CursorPagedResult<T>)
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [ ... ],
  "pagination": {
    "nextCursor": 15,
    "hasNextPage": true,
    "pageSize": 15
  }
}
```

---

## 3. Quick Reference Matrix

| HTTP Method | Route | Feature Module | Required Permission / Role | Target Roles |
|:---|:---|:---|:---|:---|
| `POST` | `/api/v1/auth/register` | Auth | None (Public) | All (`Monk`, `Donor`) |
| `POST` | `/api/v1/auth/login` | Auth | None (Public) | All (`Admin`, `Monk`, `Donor`) |
| `POST` | `/api/v1/auth/refresh-token` | Auth | None (Public) | All (`Admin`, `Monk`, `Donor`) |
| `POST` | `/api/v1/auth/logout` | Auth | None (Public) | Authenticated |
| `POST` | `/api/v1/auth/forgot-password` | Auth | None (Public) | All |
| `POST` | `/api/v1/auth/reset-password` | Auth | None (Public) | All |
| `GET` | `/api/user` (alias: `/api/v1/users`) | Users | `Users.View` | System Admin |
| `GET` | `/api/user/:id` (alias: `/api/v1/users/:id`, `/api/v1/users/me`) | Users | Self or `Users.View` | All (Self), Admin |
| `PUT` | `/api/user` (alias: `/api/v1/users`, `/api/v1/users/:id`) | Users | Self or `Users.Update` | All (Self), Admin |
| `DELETE` | `/api/user/:id` (alias: `/api/v1/users/:id`) | Users | `Users.Manage` | System Admin |
| `GET` | `/api/user/:id/invitations` | Users | Self or `Invitation.View` | All (Self), Admin |
| `GET` | `/api/user/:id/invitations/feed` | Users | Self or `Invitation.View` | All (Self), Admin |
| `GET` | `/api/user/:id/invited-by-list` | Users | Self or `Invitation.View` | All (Self), Admin |
| `GET` | `/api/user/:id/invited-by-list/feed` | Users | Self or `Invitation.View` | All (Self), Admin |
| `GET` | `/api/user/:id/notification` | Users | Self or `Notification.View` | All (Self), Admin |
| `GET` | `/api/user/:id/notification/feed` | Users | Self or `Notification.View` | All (Self), Admin |
| `DELETE` | `/api/user/:id/notification` | Users | Self or `Notification.Manage` | All (Self), Admin |
| `GET` | `/api/user/:id/monk-profile` | Users | Self (Monk) or `Users.View` | Monk, Admin |
| `PATCH` | `/api/user/:id/monk-profile` (alias: `PUT`) | Users | Self (Monk) or `Users.Update` | Monk, Admin |
| `DELETE` | `/api/user/:id/monk-profile` | Users | Self (Monk) or `Users.Manage` | Monk, Admin |
| `GET` | `/api/user/:id/settings` (alias: `/api/v1/user-settings/me`) | Users | Self or `Users.View` | All (Self), Admin |
| `PUT` | `/api/user/:id/settings` (alias: `/api/v1/user-settings/me`) | Users | Self or `Users.Update` | All (Self), Admin |
| `GET` | `/api/v1/spaces` | Spaces | Authenticated | All Space Members, Admin |
| `POST` | `/api/v1/spaces` | Spaces | `Monastery.Create` | Monk, Admin |
| `GET` | `/api/v1/spaces/:id` | Spaces | Authenticated | Space Members & Admin |
| `PUT` | `/api/v1/spaces/:id` | Spaces | `Space.Update` | Space Owner, Space Admin |
| `DELETE` | `/api/v1/spaces/:id` | Spaces | `Space.Delete` | Space Owner only |
| `GET` | `/api/v1/spaces/roles` | Spaces | Authenticated | All Space Members |
| `GET` | `/api/v1/spaces/roles/:id` | Spaces | Authenticated | All Space Members |
| `GET` | `/api/v1/spaces/:id/members` | Spaces | `Space.View` | Space Members & Admin |
| `POST` | `/api/v1/spaces/:id/invitations` | Spaces | `Space.Member.Invite` | Space Owner, Space Admin |
| `POST` | `/api/v1/spaces/invitations/:invitationId/respond` | Spaces | Authenticated | Invitee (`Monk`, `Donor`) |
| `PUT` | `/api/v1/spaces/:id/members/:userId` | Spaces | `Space.Role.Manage` | Space Owner, Space Admin |
| `DELETE` | `/api/v1/spaces/:id/members/:userId` | Spaces | `Space.Member.Remove` | Space Owner, Space Admin |
| `POST` | `/api/v1/donors/create` | Donors | Public / Optional | All |
| `GET` | `/api/v1/donors` | Donors | Public / Optional | All |
| `GET` | `/api/v1/donors/:id` | Donors | Public / Optional | All |
| `PUT` | `/api/v1/donors/:id` | Donors | Public / Optional | All |
| `DELETE` | `/api/v1/donors/:id` | Donors | Public / Optional | All |
| `POST` | `/api/v1/donations/request` | Donations | Authenticated Donor | Donor / User |
| `POST` | `/api/v1/donations/manual` | Donations | `Donation.Review` / Space Admin | Space Owner, Admin, Editor |
| `POST` | `/api/v1/donations/batch` | Donations | `Donation.Review` / Space Admin | Space Owner, Admin, Editor |
| `POST` | `/api/v1/donations/recurring/request` | Donations | Authenticated Donor | Donor / User |
| `POST` | `/api/v1/donations/recurring/manual` | Donations | `Donation.Review` / Space Admin | Space Owner, Admin, Editor |
| `POST` | `/api/v1/spaces/:spaceId/donations` | Donations | Authenticated | Space Donors / Members |
| `GET` | `/api/v1/donations` | Donations | `Donation.View` | Space Members & Donors |
| `GET` | `/api/v1/donations/:donationId` | Donations | `Donation.View` | Donor (Owner), Space Members |
| `GET` | `/api/v1/donations/calendar` | Donations | Space Membership | Space Members & Donors |
| `PATCH` | `/api/v1/donations/:donationId/review` | Donations | `Donation.Review` / Space Admin | Space Owner, Space Admin |
| `PATCH` | `/api/v1/donations/:donationId/schedule` | Donations | `Donation.Schedule` / Space Admin | Space Owner, Admin, Editor |
| `PATCH` | `/api/v1/donations/:donationId/complete` | Donations | `Donation.Schedule` / Space Admin | Space Owner, Admin, Editor |
| `PATCH` | `/api/v1/donations/:donationId/cancel` | Donations | Donor / `Donation.Cancel` | Donor (Owner), Space Managers |
| `DELETE` | `/api/v1/donations/:donationId` | Donations | `Donation.Delete` | Space Managers |
| `PATCH` | `/api/v1/donations/series/:seriesId/review` | Donations | `Donation.Review` / Space Admin | Space Owner, Space Admin |
| `PATCH` | `/api/v1/donations/series/:seriesId/cancel` | Donations | `Donation.Cancel` / Space Admin | Space Owner, Space Admin |
| `GET` | `/api/v1/roles` | RBAC | `Role.View` | System Admin |
| `GET` | `/api/v1/roles/:id` | RBAC | `Role.View` | System Admin |
| `POST` | `/api/v1/roles` | RBAC | `Role.Create` | System Admin |
| `PUT` | `/api/v1/roles/:id` | RBAC | `Role.Update` | System Admin |
| `DELETE` | `/api/v1/roles/:id` | RBAC | `Role.Delete` | System Admin |
| `GET` | `/api/v1/roles/permissions` | RBAC | `Role.View` | System Admin |
| `POST` | `/api/v1/roles/assign` | RBAC | `Role.Update` | System Admin |
| `GET` | `/api/v1/roles/me/permissions` | RBAC | Authenticated | Authenticated Users |
| `GET` | `/api/v1/roles/users/:userId/permissions` | RBAC | `Role.View` | System Admin |
| `GET` | `/api/v1/roles/space-roles` | RBAC | Authenticated | All Authenticated Users |
| `GET` | `/api/v1/roles/space-roles/:id` | RBAC | Authenticated | All Authenticated Users |
| `GET` | `/health` | Observability | Public | All |
| `GET` | `/api-docs` | Observability | Public | All |
| `GET` | `/stats` | Observability | Public | All |

---

## 4. Endpoint Specifications by Module

### 4.1. Authentication & Token Management (`/api/v1/auth`)

#### 1. Register User
- **Method**: `POST`
- **Route**: `/api/v1/auth/register`
- **Target User Role**: Public / Unauthenticated
- **Description**: Registers a new user account. Supports both `Monk` (`roleId: 1`) and `Donor` (`roleId: 2`). When registering as a Monk, `monasteryName` and `monasteryAddress` are mandatory. Accepts both `phoneNumber` and `phone`, and both `contactPhoneNumber` and `contactPhone`.
- **Request Body**:
```json
{
  "name": "Ashin Pannita",
  "phoneNumber": "09123456789",
  "password": "Password123!",
  "roleId": 1,
  "monasteryName": "Mahagandhayon Monastery",
  "monasteryAddress": "Amarapura, Mandalay",
  "email": "pannita@monastery.org",
  "contactPhoneNumber": "09123456789"
}
```
- **Responses**:
  - `201 Created`:
```json
{
  "isSuccess": true,
  "message": "User registered successfully.",
  "isFailure": false,
  "data": {
    "userId": 1,
    "name": "Ashin Pannita",
    "phoneNumber": "09123456789",
    "roleId": 1,
    "roleName": "Monk",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "7c9e4b...",
    "permissions": [
      "Monastery.Create",
      "Donation.Create",
      "Donation.View",
      "Donation.Review"
    ]
  }
}
```
  - `400 Bad Request`: Validation failure or phone number already in use.

---

#### 2. Login
- **Method**: `POST`
- **Route**: `/api/v1/auth/login`
- **Target User Role**: Public / Unauthenticated
- **Description**: Authenticates user credentials via phone number and password. Returns signed JWT access token, refresh token, role details, and assigned permission keys. Accepts `phoneNumber` and `phone`.
- **Request Body**:
```json
{
  "phoneNumber": "09123456789",
  "password": "Password123!"
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Login successful.",
  "isFailure": false,
  "data": {
    "userId": 1,
    "name": "Ashin Pannita",
    "phoneNumber": "09123456789",
    "roleId": 1,
    "roleName": "Monk",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "7c9e4b...",
    "permissions": [
      "Monastery.Create",
      "Donation.Create",
      "Donation.View",
      "Donation.Review"
    ]
  }
}
```

---

#### 3. Refresh Access Token
- **Method**: `POST`
- **Route**: `/api/v1/auth/refresh-token`
- **Target User Role**: Public / Any Client with Valid Refresh Token
- **Description**: Validates refresh token from request body or cookies, verifies expiration, revocation status, and optional `userId`, and returns a new access token and rotated refresh token.
- **Request Body**:
```json
{
  "userId": 1,
  "refreshToken": "7c9e4b..."
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Token refreshed successfully.",
  "isFailure": false,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "new_rotated_refresh_token"
  }
}
```

---

#### 4. Logout User Session
- **Method**: `POST`
- **Route**: `/api/v1/auth/logout`
- **Target User Role**: Authenticated
- **Description**: Revokes the active refresh token and clears session cookies and cached user profiles.
- **Request Body**:
```json
{
  "refreshToken": "7c9e4b..."
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Logged out successfully.",
  "isFailure": false,
  "data": null
}
```

---

#### 5. Forgot Password
- **Method**: `POST`
- **Route**: `/api/v1/auth/forgot-password`
- **Target User Role**: Public / Unauthenticated
- **Description**: Verifies phone number existence and generates a secure password reset token. Accepts `phoneNumber` and `phone`.
- **Request Body**:
```json
{
  "phoneNumber": "09123456789"
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Password reset token generated successfully.",
  "isFailure": false,
  "data": {
    "resetToken": "a8f9c1e2d3..."
  }
}
```

---

#### 6. Reset Password
- **Method**: `POST`
- **Route**: `/api/v1/auth/reset-password`
- **Target User Role**: Public / Unauthenticated
- **Description**: Verifies the reset token, updates the user's password with a secure hash, and invalidates the token.
- **Request Body**:
```json
{
  "resetToken": "a8f9c1e2d3...",
  "password": "NewStrongPassword123!"
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Password reset successfully.",
  "isFailure": false,
  "data": null
}
```

---

### 4.2. Users & Profile Management (`/api/user`, `/api/v1/users`)

#### 7. Get All Users
- **Method**: `GET`
- **Route**: `/api/user` (alias: `/api/v1/users`)
- **Target User Role**: `System Admin`
- **Required Permission**: `Users.View`
- **Description**: Retrieves a paginated list of all active registered users.
- **Query Parameters (Offset Pagination)**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
  - `search` / `name` (string, optional)
  - `phoneNumber` / `phone` (string, optional)
  - `email` (string, optional)
  - `roleId` (int, optional)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (PagedResult<UserDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [
    {
      "id": 2,
      "name": "U Thuzana",
      "phoneNumber": "09100000002",
      "roleId": 1,
      "roleName": "Monk",
      "email": "thuzana@monastery.org",
      "contactPhoneNumber": "09100000002"
    }
  ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

#### 8. Get User Profile by ID
- **Method**: `GET`
- **Route**: `/api/user/:id` (alias: `/api/v1/users/:id`, `/api/v1/users/me`)
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: Self (`UserId == id`) or `Users.View`
- **Path Parameters**:
  - `id` (int, required): Target user ID.
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
- **Response `200 OK` (Result<UserDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": {
    "id": 2,
    "name": "U Thuzana",
    "phoneNumber": "09100000002",
    "roleId": 1,
    "roleName": "Monk",
    "email": "thuzana@monastery.org",
    "contactPhoneNumber": "09100000002"
  }
}
```

---

#### 9. Update User Profile
- **Method**: `PUT`
- **Route**: `/api/user` (alias: `/api/v1/users`, `/api/v1/users/:id`)
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Users.Update`
- **Description**: Updates profile attributes. Non-admin users cannot alter their own `roleId`; only admins can modify role assignments. Supports multipart/form-data for avatar uploads.
- **Request Body**:
```json
{
  "id": 2,
  "name": "U Thuzana Updated",
  "phoneNumber": "09100000002",
  "roleId": 1,
  "email": "updated@monastery.org",
  "contactPhoneNumber": "09100000002"
}
```
- **Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Result<UserDto>)**:
```json
{
  "isSuccess": true,
  "message": "User updated successfully.",
  "isFailure": false,
  "data": {
    "id": 2,
    "name": "U Thuzana Updated",
    "phoneNumber": "09100000002",
    "roleId": 1,
    "roleName": "Monk",
    "email": "updated@monastery.org",
    "contactPhoneNumber": "09100000002"
  }
}
```

---

#### 10. Soft Delete User Account
- **Method**: `DELETE`
- **Route**: `/api/user/:id` (alias: `/api/v1/users/:id`)
- **Target User Role**: `System Admin`
- **Required Permission**: `Users.Manage`
- **Path Parameters**:
  - `id` (int, required): Target user ID.
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
- **Response `200 OK` (Standard Void Result)**:
```json
{
  "isSuccess": true,
  "message": "User deleted successfully.",
  "isFailure": false
}
```

---

#### 11. Get User's Received Invitations (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/invitations` (alias: `/api/v1/users/:id/invitations`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Invitation.View`
- **Query Parameters**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (PagedResult<InvitationDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [
    {
      "id": 5,
      "monasterySpaceId": 1,
      "monasterySpaceName": "Mahagandhayon Monastery",
      "invitedUserId": 3,
      "invitedUserName": "Daw Mya",
      "invitedById": 2,
      "invitedByName": "U Thuzana",
      "spaceRoleId": 3,
      "spaceRoleName": "Editor",
      "status": 0,
      "createdAt": "2026-11-01T08:00:00Z"
    }
  ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

#### 12. Get User's Received Invitations Feed (Mobile Keyset Cursor Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/invitations/feed` (alias: `/api/v1/users/:id/invitations/feed`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Invitation.View`
- **Query Parameters**:
  - `lastId` (int, optional): ID of the last item in previous batch.
  - `pageSize` (int, default: 15)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (CursorPagedResult<InvitationDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [
    {
      "id": 5,
      "monasterySpaceId": 1,
      "monasterySpaceName": "Mahagandhayon Monastery",
      "invitedUserId": 3,
      "invitedUserName": "Daw Mya",
      "invitedById": 2,
      "invitedByName": "U Thuzana",
      "spaceRoleId": 3,
      "spaceRoleName": "Editor",
      "status": 0,
      "createdAt": "2026-11-01T08:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": 5,
    "hasNextPage": false,
    "pageSize": 15
  }
}
```

---

#### 13. Get User's Sent Invitations (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/invited-by-list` (alias: `/api/v1/users/:id/invited-by-list`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Invitation.View`
- **Query Parameters**: `pageNumber` (int, default: 1), `pageSize` (int, default: 10)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK`**: `PagedResult<InvitationDto>`

---

#### 13b. Get User's Sent Invitations Feed (Mobile Cursor Keyset Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/invited-by-list/feed` (alias: `/api/v1/users/:id/invited-by-list/feed`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Invitation.View`
- **Query Parameters**: `lastId` (int, optional), `pageSize` (int, default: 15)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK`**: `CursorPagedResult<InvitationDto>`

---

#### 14. Get User Notifications (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/notification` (alias: `/api/v1/users/:id/notification`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Notification.View`
- **Query Parameters**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (PagedResult<NotificationDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [
    {
      "id": 10,
      "userId": 2,
      "type": 1,
      "message": "Your donation request has been accepted.",
      "isRead": false,
      "createdAt": "2026-11-05T06:00:00Z"
    }
  ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

#### 15. Get User Notifications Feed (Mobile Cursor Keyset Pagination)
- **Method**: `GET`
- **Route**: `/api/user/:id/notification/feed` (alias: `/api/v1/users/:id/notification/feed`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Notification.View`
- **Query Parameters**:
  - `lastId` (int, optional): Last notification ID from previous page.
  - `pageSize` (int, default: 15)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (CursorPagedResult<NotificationDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": [
    {
      "id": 10,
      "userId": 2,
      "type": 1,
      "message": "Your donation request has been accepted.",
      "isRead": false,
      "createdAt": "2026-11-05T06:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": 10,
    "hasNextPage": false,
    "pageSize": 15
  }
}
```

---

#### 16. Clear All User Notifications
- **Method**: `DELETE`
- **Route**: `/api/user/:id/notification` (alias: `/api/v1/users/:id/notification`)
- **Target User Role**: Self or `System Admin`
- **Required Permission**: Self or `Notification.Manage`
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Standard Void Result)**:
```json
{
  "isSuccess": true,
  "message": "Notifications cleared successfully.",
  "isFailure": false
}
```

---

#### 17. Get Monk Profile
- **Method**: `GET`
- **Route**: `/api/user/:id/monk-profile` (alias: `/api/v1/users/:id/monk-profile`)
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: Self or `Users.View`
- **Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Result<MonkProfileDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": {
    "id": 1,
    "userId": 2,
    "monasteryName": "Mahagandhayon Monastery",
    "monasteryAddress": "Amarapura, Mandalay"
  }
}
```

---

#### 18. Update Monk Profile
- **Method**: `PATCH` (alias: `PUT`)
- **Route**: `/api/user/:id/monk-profile` (alias: `/api/v1/users/:id/monk-profile`)
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: Self or `Users.Update`
- **Request Body**:
```json
{
  "monasteryName": "Mahagandhayon (Main Campus)",
  "monasteryAddress": "Amarapura, Mandalay Division"
}
```
- **Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Result<MonkProfileDto>)**:
```json
{
  "isSuccess": true,
  "message": "Monk profile updated successfully.",
  "isFailure": false,
  "data": {
    "id": 1,
    "userId": 2,
    "monasteryName": "Mahagandhayon (Main Campus)",
    "monasteryAddress": "Amarapura, Mandalay Division"
  }
}
```

---

#### 19. Delete Monk Profile
- **Method**: `DELETE`
- **Route**: `/api/user/:id/monk-profile` (alias: `/api/v1/users/:id/monk-profile`)
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: Self or `Users.Manage`
- **Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Standard Void Result)**:
```json
{
  "isSuccess": true,
  "message": "Monk profile deleted successfully.",
  "isFailure": false
}
```

---

#### 20. Get User Reminder & Notification Settings
- **Method**: `GET`
- **Route**: `/api/user/:id/settings` (alias: `/api/v1/users/:id/settings`, `/api/v1/user-settings/me`)
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: Self or `Users.View`
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Result<UserSettingDto>)**:
```json
{
  "isSuccess": true,
  "message": "Success",
  "isFailure": false,
  "data": {
    "userId": 2,
    "pickupNotificationTime": "2026-11-01T15:30:00Z",
    "dropoffNotificationTime": "2026-11-01T22:00:00Z",
    "pickupTime": null,
    "dropoffTime": null
  }
}
```

---

#### 21. Update User Reminder & Notification Settings
- **Method**: `PUT`
- **Route**: `/api/user/:id/settings` (alias: `/api/v1/users/:id/settings`, `/api/v1/user-settings/me`)
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: Self or `Users.Update`
- **Request Body**:
```json
{
  "pickupNotificationTime": "2026-11-01T14:00:00Z",
  "dropoffNotificationTime": "2026-11-01T21:00:00Z",
  "pickupTime": null,
  "dropoffTime": null
}
```
- **Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK` (Result<UserSettingDto>)**:
```json
{
  "isSuccess": true,
  "message": "Settings updated successfully.",
  "isFailure": false,
  "data": {
    "userId": 2,
    "pickupNotificationTime": "2026-11-01T14:00:00Z",
    "dropoffNotificationTime": "2026-11-01T21:00:00Z",
    "pickupTime": null,
    "dropoffTime": null
  }
}
```

---

### 4.3. User Settings & Reminders (`/api/v1/user-settings`)

#### 12. Get User Settings
- **Method**: `GET`
- **Route**: `/api/v1/user-settings/me`
- **Target User Role**: All Authenticated Users
- **Description**: Returns notification time preferences in Myanmar time (`HH:mm`). Auto-provisions a default record if one does not exist yet.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "User settings",
  "data": {
    "pickupTime": "06:00",
    "dropoffTime": "17:00",
    "pickupNotificationTime": "15:30",
    "dropoffNotificationTime": "22:00"
  }
}
```

---

#### 13. Update User Settings
- **Method**: `PUT`
- **Route**: `/api/v1/user-settings/me`
- **Target User Role**: All Authenticated Users
- **Description**: Updates adjustable reminder and routine hours (`HH:mm` format).
- **Request Body**:
```json
{
  "pickupNotificationTime": "14:00",
  "dropoffNotificationTime": "21:00",
  "pickupTime": "06:30",
  "dropoffTime": "16:30"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Settings updated",
  "data": {
    "pickupTime": "06:30",
    "dropoffTime": "16:30",
    "pickupNotificationTime": "14:00",
    "dropoffNotificationTime": "21:00"
  }
}
```

---

### 4.4. Spaces / Monasteries Management (`/api/v1/spaces` & `/api/v1/monasteries`)

*(Note: `/api/v1/monasteries` is an exact alias mounted to the same router)*

#### 14. List Monasteries / Spaces
- **Method**: `GET`
- **Route**: `/api/v1/spaces`
- **Target User Role**: Authenticated Space Members, System Admin
- **Description**: Returns paginated list of spaces that the calling user belongs to, or all spaces if called by a System Admin.
- **Query Parameters (Offset Pagination)**:
  - `page` (int, default: 1)
  - `limit` (int, default: 10)
  - `search` (string, optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "My monasteries retrieved successfully.",
  "data": {
    "monasteries": [
      {
        "id": 1,
        "monasteryName": "Mahagandhayon Monastery",
        "description": "Monastic education center",
        "address": "Amarapura, Mandalay",
        "createdById": 1,
        "currentUserRoleId": 1,
        "currentUserRoleName": "Space Admin",
        "isOwner": true
      }
    ],
    "pagination": {
      "meta": {
        "total": 1,
        "currentPage": 1,
        "lastPage": 1,
        "perPage": 10
      },
      "links": {
        "next": null,
        "prev": null
      }
    }
  }
}
```

---

#### 15. Create Monastery Space
- **Method**: `POST`
- **Route**: `/api/v1/spaces`
- **Target User Role**: `Monk` or System Admin
- **Required Permission**: `Monastery.Create`
- **Description**: Creates a new monastery space and atomically assigns the creator as **Owner** (`isOwner: true`, `spaceRoleId: 1` / `Space Admin`) with full permissions.
- **Request Body**:
```json
{
  "monasteryName": "Mahagandhayon Monastery",
  "description": "Historic monastery in Amarapura",
  "address": "Amarapura, Mandalay"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Monastery created successfully.",
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery",
    "description": "Historic monastery in Amarapura",
    "address": "Amarapura, Mandalay",
    "createdById": 1,
    "currentUserRoleId": 1,
    "currentUserRoleName": "Space Admin",
    "isOwner": true,
    "permissions": [
      "Space.View",
      "Space.Update",
      "Space.Delete",
      "Space.Member.Invite",
      "Space.Member.Manage",
      "Space.Member.Remove",
      "Space.Role.Manage",
      "Space.Post.Create",
      "Space.Donation.Create",
      "Space.Donation.Review"
    ]
  }
}
```

---

#### 16. Get Monastery Space Details
- **Method**: `GET`
- **Route**: `/api/v1/spaces/:id`
- **Target User Role**: Space Members, System Admin
- **Description**: Returns space metadata, current user role in space, and ownership status.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Monastery retrieved successfully.",
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery",
    "description": "Historic monastery in Amarapura",
    "address": "Amarapura, Mandalay",
    "isOwner": true,
    "currentUserRoleId": 1,
    "currentUserRoleName": "Space Admin"
  }
}
```

---

#### 17. Update Monastery Space
- **Method**: `PUT`
- **Route**: `/api/v1/spaces/:id`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Space.Update`
- **Description**: Updates monastery name, description, and address.
- **Request Body**:
```json
{
  "monasteryName": "Mahagandhayon Monastery (Main Campus)",
  "description": "Expanded monastic campus",
  "address": "Amarapura, Mandalay"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Monastery updated successfully.",
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery (Main Campus)",
    "address": "Amarapura, Mandalay"
  }
}
```

---

#### 18. Delete Monastery Space
- **Method**: `DELETE`
- **Route**: `/api/v1/spaces/:id`
- **Target User Role**: Space Owner only
- **Required Permission**: `Space.Delete`
- **Description**: Soft-deletes the space (`isDeleted = true`). Restricted strictly to the Space Owner.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Monastery deleted successfully."
}
```

---

#### 19. List Space Roles Catalog
- **Method**: `GET`
- **Route**: `/api/v1/spaces/roles`
- **Target User Role**: All Authenticated Users
- **Description**: Returns all four standard space role definitions.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Space roles retrieved successfully.",
  "data": {
    "roles": [
      { "id": 1, "name": "Space Admin", "description": "Full control and administration" },
      { "id": 2, "name": "Space Moderator", "description": "Moderate space activities and review donations" },
      { "id": 3, "name": "Space Editor", "description": "Create posts and initiate donations" },
      { "id": 4, "name": "Space Member", "description": "General space member" }
    ]
  }
}
```

---

#### 20. Get Space Role by ID
- **Method**: `GET`
- **Route**: `/api/v1/spaces/roles/:id`
- **Target User Role**: All Authenticated Users
- **Description**: Returns single space role details and its mapped permissions.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Space role retrieved successfully.",
  "data": {
    "id": 1,
    "name": "Space Admin",
    "description": "Full control and administration",
    "permissions": ["Space.View", "Space.Update", "Space.Member.Invite", "Space.Role.Manage"]
  }
}
```

---

### 4.5. Space Members & Invitations (`/api/v1/spaces`)

#### 21. List Space Members
- **Method**: `GET`
- **Route**: `/api/v1/spaces/:id/members`
- **Target User Role**: Space Members, System Admin
- **Required Permission**: `Space.View`
- **Description**: Retrieves all enrolled users in the monastery space, their space roles, and ownership flags.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Monastery members retrieved successfully.",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "name": "Ashin Pannita",
      "phone": "09123456789",
      "spaceRoleId": 1,
      "spaceRoleName": "Space Admin",
      "isOwner": true
    }
  ]
}
```

---

#### 22. Invite Member to Space
- **Method**: `POST`
- **Route**: `/api/v1/spaces/:id/invitations`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Space.Member.Invite`
- **Description**: Invites an existing registered user by `userId` or `phone` to join the space.
- **Request Body**:
```json
{
  "phone": "09987654321",
  "spaceRoleId": 3
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Member invited successfully.",
  "data": {
    "invitationId": 1,
    "monasterySpaceId": 1,
    "invitedUserId": 2,
    "spaceRoleId": 3,
    "status": 0
  }
}
```

---

#### 23. Respond to Space Invitation
- **Method**: `POST`
- **Route**: `/api/v1/spaces/invitations/:invitationId/respond`
- **Target User Role**: The Invited User
- **Description**: Accepts (`status: 1` / `"accept"`) or rejects (`status: 0` / `"reject"`) an invitation. On acceptance, immediately enrolls the user as a `MonasteryMember`.
- **Request Body**:
```json
{
  "status": 1
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Invitation accepted successfully."
}
```

---

#### 24. Update Member Role in Space
- **Method**: `PUT`
- **Route**: `/api/v1/spaces/:id/members/:userId`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Space.Role.Manage`
- **Description**: Modifies the space role of an existing member. Space Admins cannot alter the space Owner's role.
- **Request Body**:
```json
{
  "spaceRoleId": 2
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Member role updated successfully.",
  "data": {
    "userId": 2,
    "spaceRoleId": 2,
    "spaceRoleName": "Space Moderator"
  }
}
```

---

#### 25. Remove Member from Space
- **Method**: `DELETE`
- **Route**: `/api/v1/spaces/:id/members/:userId`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Space.Member.Remove`
- **Description**: Removes a member from the space. The space owner cannot be removed.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Member removed successfully."
}
```

---

### 4.6. Donors Directory (`/api/v1/donors`)

#### 26. Create Donor Contact
- **Method**: `POST`
- **Route**: `/api/v1/donors/create`
- **Target User Role**: Public / Optional
- **Description**: Records a donor contact entry in the donor address book.
- **Request Body**:
```json
{
  "name": "Daw Khin Myint",
  "email": "khinmyint@gmail.com",
  "phoneNo": "09450001122"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Donor created successfully",
  "data": {
    "id": 1,
    "name": "Daw Khin Myint",
    "email": "khinmyint@gmail.com",
    "phoneNo": "09450001122"
  }
}
```

---

#### 27. List All Donors
- **Method**: `GET`
- **Route**: `/api/v1/donors`
- **Target User Role**: Public / Optional
- **Description**: Paginated query of donor directory with keyword and contact filters.
- **Query Parameters (Offset Pagination)**:
  - `page` (int, default: 1)
  - `limit` (int, default: 10)
  - `name` (string, optional)
  - `email` (string, optional)
  - `phoneNo` (string, optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donors retrieved successfully",
  "data": {
    "donors": [
      {
        "id": 1,
        "name": "Daw Khin Myint",
        "email": "khinmyint@gmail.com",
        "phoneNo": "09450001122"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

#### 28. Get Donor by ID
- **Method**: `GET`
- **Route**: `/api/v1/donors/:id`
- **Target User Role**: Public / Optional
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donor retrieved successfully",
  "data": {
    "id": 1,
    "name": "Daw Khin Myint",
    "email": "khinmyint@gmail.com",
    "phoneNo": "09450001122"
  }
}
```

---

#### 29. Update Donor Contact
- **Method**: `PUT` *(also supports `PATCH`)*
- **Route**: `/api/v1/donors/:id`
- **Target User Role**: Public / Optional
- **Request Body**:
```json
{
  "name": "Daw Khin Myint Updated",
  "email": "khinmyint.updated@gmail.com"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donor updated successfully",
  "data": {
    "id": 1,
    "name": "Daw Khin Myint Updated"
  }
}
```

---

#### 30. Delete Donor Contact
- **Method**: `DELETE`
- **Route**: `/api/v1/donors/:id`
- **Target User Role**: Public / Optional
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donor deleted successfully"
}
```

---

### 4.7. Donations Management (`/api/v1/donations`)

*Domain Enums:*
* **`DonationStatus`**: `0 = Draft`, `1 = Submitted`, `2 = PendingReview`, `3 = Accepted`, `4 = Scheduled`, `5 = Completed`, `6 = Rejected`, `7 = Cancelled`
* **`DonationType`**: `0 = Money`, `1 = Food`, `2 = Medicine`, `3 = Robe`, `4 = Supplies`, `5 = Other`

#### 31. Self-Service Donation Request
- **Method**: `POST`
- **Route**: `/api/v1/donations/request`
- **Target User Role**: Authenticated Donor
- **Required Permission**: `Donation.Create`
- **Description**: Donor submits offering request. Initial status is `PendingReview` (`2`).
- **Request Body**:
```json
{
  "monasterySpaceId": 1,
  "donationType": 1,
  "amount": 50000,
  "quantity": 10,
  "note": "Morning meal offering for 10 monks",
  "pickupTime": "2026-11-15T06:00:00Z",
  "dropoffTime": "2026-11-15T07:30:00Z"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Donation request submitted successfully",
  "data": {
    "id": 101,
    "monasterySpaceId": 1,
    "donorId": 2,
    "donationType": 1,
    "status": 2,
    "statusName": "PendingReview",
    "amount": "50000.00"
  }
}
```

---

#### 32. Create Manual Donation
- **Method**: `POST`
- **Route**: `/api/v1/donations/manual`
- **Target User Role**: Space Owner, Space Admin, Space Editor
- **Required Permission**: `Donation.Review`
- **Description**: Records direct or offline walk-in donation. Initial status is `Scheduled` (`4`) if pickup/dropoff is provided, otherwise `Accepted` (`3`).
- **Request Body**:
```json
{
  "monasterySpaceId": 1,
  "donorName": "Daw Mya Mya (Walk-in)",
  "donationType": 0,
  "amount": 100000,
  "note": "Cash donation for monastery building fund"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Manual donation recorded successfully",
  "data": {
    "id": 102,
    "monasterySpaceId": 1,
    "donorName": "Daw Mya Mya (Walk-in)",
    "status": 3,
    "statusName": "Accepted",
    "amount": "100000.00"
  }
}
```

---

#### 33. Create Batch Manual Donations
- **Method**: `POST`
- **Route**: `/api/v1/donations/batch`
- **Target User Role**: Space Owner, Space Admin, Space Editor
- **Required Permission**: `Donation.Review`
- **Description**: Atomic insertion of up to 50 manual donation records in a single transaction.
- **Request Body**:
```json
{
  "monasterySpaceId": 1,
  "title": "Katina Festival Offering",
  "donations": [
    {
      "donorName": "U Ba",
      "donationType": 1,
      "amount": 50000,
      "note": "Morning gruel"
    },
    {
      "donorName": "Daw Hla",
      "donationType": 3,
      "amount": 80000,
      "note": "Kathina Robe"
    }
  ]
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Batch donations created successfully",
  "data": [
    { "id": 103, "donorName": "U Ba", "status": 3 },
    { "id": 104, "donorName": "Daw Hla", "status": 3 }
  ]
}
```

---

#### 34. Request Recurring Monthly Series
- **Method**: `POST`
- **Route**: `/api/v1/donations/recurring/request`
- **Target User Role**: Authenticated Donor
- **Required Permission**: `Donation.Create`
- **Description**: Creates recurring monthly donation requests (up to 24 months).
- **Request Body**:
```json
{
  "monasterySpaceId": 1,
  "donationType": 1,
  "amount": 60000,
  "startDate": "2026-12-01T00:00:00Z",
  "dayOfMonth": 15,
  "monthsCount": 6,
  "pickupTimeOfDay": "06:30",
  "note": "Monthly full-moon meal"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Recurring donation series created successfully",
  "data": [
    { "id": 105, "status": 2, "note": "Monthly full-moon meal [Series: a1b2c3d4...]" }
  ]
}
```

---

#### 35. List Donations
- **Method**: `GET`
- **Route**: `/api/v1/donations`
- **Target User Role**: Space Members & Donors
- **Required Permission**: `Donation.View`
- **Description**: Flexible query endpoint for donation history with offset pagination.
- **Query Parameters (Offset Pagination)**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
  - `monasterySpaceId` (int, optional)
  - `donorId` (int, optional)
  - `status` (int, optional: 2=PendingReview, 3=Accepted, 4=Scheduled, 5=Completed, etc.)
  - `fromDate` (ISO DateTime, optional)
  - `toDate` (ISO DateTime, optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donations retrieved successfully",
  "data": [
    {
      "id": 101,
      "monasterySpaceId": 1,
      "donorId": 2,
      "donorName": "Daw Khin",
      "donationType": 1,
      "amount": "50000.00",
      "status": 4,
      "pickupTime": "2026-11-15T06:00:00Z"
    }
  ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

#### 36. Get Donation by ID
- **Method**: `GET`
- **Route**: `/api/v1/donations/:donationId`
- **Target User Role**: Donor (Owner) or Space Members
- **Required Permission**: `Donation.View`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation retrieved successfully",
  "data": {
    "id": 101,
    "monasterySpaceId": 1,
    "donorId": 2,
    "donationType": 1,
    "amount": "50000.00",
    "status": 4,
    "statusName": "Scheduled"
  }
}
```

---

#### 37. Review Donation Request
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/:donationId/review`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Donation.Review`
- **Description**: Evaluates donation request to transition status to `Accepted` (`3`) or `Rejected` (`6`).
- **Request Body**:
```json
{
  "status": 3,
  "note": "Accepted with blessings."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation reviewed successfully",
  "data": {
    "id": 101,
    "status": 3,
    "statusName": "Accepted"
  }
}
```

---

#### 38. Schedule Donation Logistics
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/:donationId/schedule`
- **Target User Role**: Space Owner, Space Admin, Space Editor
- **Required Permission**: `Donation.Schedule`
- **Description**: Sets pickup and dropoff hours. Status updates to `Scheduled` (`4`).
- **Request Body**:
```json
{
  "pickupTime": "2026-11-15T05:30:00Z",
  "dropoffTime": "2026-11-15T07:00:00Z",
  "note": "Pickup scheduled at 5:30 AM"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation scheduled successfully",
  "data": {
    "id": 101,
    "status": 4,
    "statusName": "Scheduled"
  }
}
```

---

#### 39. Complete Donation
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/:donationId/complete`
- **Target User Role**: Space Owner, Space Admin, Space Editor
- **Required Permission**: `Donation.Schedule`
- **Description**: Marks donation fulfilled and completed (`status: 5`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation completed successfully",
  "data": {
    "id": 101,
    "status": 5,
    "statusName": "Completed"
  }
}
```

---

#### 40. Cancel Donation
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/:donationId/cancel`
- **Target User Role**: Owning Donor or Space Managers
- **Required Permission**: `Donation.Cancel`
- **Description**: Cancels active donation (`status: 7`). Completed donations cannot be cancelled.
- **Request Body**:
```json
{
  "note": "Donor requested cancellation."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation cancelled successfully",
  "data": {
    "id": 101,
    "status": 7,
    "statusName": "Cancelled"
  }
}
```

---

#### 41. Delete Donation Record
- **Method**: `DELETE`
- **Route**: `/api/v1/donations/:donationId`
- **Target User Role**: Space Owner, Space Admin, Space Editor
- **Required Permission**: `Donation.Delete`
- **Description**: Permanently removes a draft or accidental donation. Completed donations (`status: 5`) are strictly protected from deletion.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation deleted successfully"
}
```

---

#### 42. Review Recurring Donation Series
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/series/:seriesId/review`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Donation.Review`
- **Request Body**:
```json
{
  "status": 3,
  "note": "Series approved"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Recurring donation series reviewed successfully"
}
```

---

#### 43. Cancel Recurring Donation Series
- **Method**: `PATCH`
- **Route**: `/api/v1/donations/series/:seriesId/cancel`
- **Target User Role**: Space Owner, Space Admin
- **Required Permission**: `Donation.Cancel`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Recurring donation series cancelled successfully"
}
```

---

### 4.8. Donation Calendar Aggregation (`/api/v1/donations/calendar`)

#### 44. Get Donation Calendar
- **Method**: `GET`
- **Route**: `/api/v1/donations/calendar`
- **Target User Role**: Space Members, System Admin
- **Description**: Returns daily grouped offerings for a monastery space in Myanmar Time (UTC+06:30).
- **Query Parameters**:
  - `monasterySpaceId` (int, required)
  - `fromDate` (ISO date, e.g. `2026-11-01`)
  - `toDate` (ISO date, e.g. `2026-11-30`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Donation calendar",
  "data": [
    {
      "date": "2026-11-05",
      "donations": [
        {
          "id": 101,
          "donorName": "Daw Khin",
          "donationType": "Food",
          "status": "Scheduled",
          "pickupTime": "2026-11-05T06:00:00.000Z",
          "dropoffTime": "2026-11-05T07:30:00.000Z"
        }
      ]
    }
  ]
}
```

---

### 4.9. Dynamic RBAC & System Permissions (`/api/v1/roles`)

#### 45. Get System Roles
- **Method**: `GET`
- **Route**: `/api/v1/roles`
- **Target User Role**: System Admin
- **Required Permission**: `Role.View`
- **Query Parameters (Offset Pagination)**:
  - `page` (int, default: 1)
  - `limit` (int, default: 10)
  - `search` (string, optional)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "data": {
    "roles": [
      { "id": 1, "name": "Monk", "isDeleted": false },
      { "id": 2, "name": "Donor", "isDeleted": false },
      { "id": 3, "name": "Admin", "isDeleted": false }
    ],
    "pagination": {
      "meta": { "total": 3, "currentPage": 1, "lastPage": 1, "perPage": 10 },
      "links": { "next": null, "prev": null }
    }
  }
}
```

---

#### 46. Get System Role by ID
- **Method**: `GET`
- **Route**: `/api/v1/roles/:id`
- **Target User Role**: System Admin
- **Required Permission**: `Role.View`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Role retrieved successfully",
  "data": {
    "id": 1,
    "name": "Monk",
    "permissions": ["Monastery.Create", "Donation.Create", "Donation.View"]
  }
}
```

---

#### 47. Create Custom System Role
- **Method**: `POST`
- **Route**: `/api/v1/roles`
- **Target User Role**: System Admin
- **Required Permission**: `Role.Create`
- **Request Body**:
```json
{
  "name": "Auditor"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "id": 4,
    "name": "Auditor"
  }
}
```

---

#### 48. Update System Role
- **Method**: `PUT`
- **Route**: `/api/v1/roles/:id`
- **Target User Role**: System Admin
- **Required Permission**: `Role.Update`
- **Request Body**:
```json
{
  "name": "Senior Auditor"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": {
    "id": 4,
    "name": "Senior Auditor"
  }
}
```

---

#### 49. Soft Delete System Role
- **Method**: `DELETE`
- **Route**: `/api/v1/roles/:id`
- **Target User Role**: System Admin
- **Required Permission**: `Role.Delete`
- **Description**: Soft-deletes a custom role. System defaults (`Monk`, `Donor`, `Admin`) cannot be deleted.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

---

#### 50. Get Permissions Catalog
- **Method**: `GET`
- **Route**: `/api/v1/roles/permissions`
- **Target User Role**: System Admin
- **Required Permission**: `Role.View`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Permissions retrieved successfully",
  "data": [
    { "id": 1, "name": "User.View" },
    { "id": 2, "name": "Monastery.Create" },
    { "id": 3, "name": "Donation.Review" }
  ]
}
```

---

#### 51. Assign Permissions to Role
- **Method**: `POST`
- **Route**: `/api/v1/roles/assign`
- **Target User Role**: System Admin
- **Required Permission**: `Role.Update`
- **Request Body**:
```json
{
  "roleId": 4,
  "permissionIds": [1, 2, 3]
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Permissions assigned successfully"
}
```

---

#### 52. Get Own Permissions
- **Method**: `GET`
- **Route**: `/api/v1/roles/me/permissions`
- **Target User Role**: All Authenticated Users
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "User permissions retrieved successfully",
  "data": {
    "roleId": 1,
    "roleName": "Monk",
    "permissions": ["Monastery.Create", "Donation.View", "Donation.Create"]
  }
}
```

---

#### 53. Get Specific User Permissions
- **Method**: `GET`
- **Route**: `/api/v1/roles/users/:userId/permissions`
- **Target User Role**: System Admin
- **Required Permission**: `Role.View`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "User permissions retrieved successfully",
  "data": {
    "userId": 2,
    "permissions": ["Donation.View", "Donation.Create"]
  }
}
```

---

### 4.10. Observability & System (`/health`, `/api-docs`, `/stats`)

#### 54. Health Check
- **Method**: `GET`
- **Route**: `/health`
- **Target User Role**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Health check",
  "data": {
    "status": "ok",
    "timestamp": "2026-11-06T15:50:00.000Z"
  }
}
```

---

#### 55. Swagger Documentation
- **Method**: `GET`
- **Route**: `/api-docs`
- **Description**: Interactive OpenAPI / Swagger UI playground.

---

#### 56. Real-time Telemetry Dashboard
- **Method**: `GET`
- **Route**: `/stats`
- **Description**: Real-time HTTP metrics, throughput, error rates, and response latency dashboard (via `swagger-stats`).

