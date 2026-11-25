# Hsum Chaint Node API Endpoints Specification

This document provides a comprehensive technical catalog of all active HTTP endpoints implemented in the **Hsum Chaint Node.js** backend (`Express`, `Bun`, `Prisma`, `MySQL`).

---

## 1. System Roles & Authorization Taxonomy

Access control in Hsum Chaint Node is governed by two complementary layers:

1. **System Roles (Global System Level)**:
   - **`Admin` (Role ID 1)**: Super-administrators with full oversight across user accounts, system roles, and global permissions.
   - **`Monk` (Role ID 2)**: Religious administrators who can create and manage Monastery Spaces, manage member invitations, configure donation schedules, and review offerings.
   - **`Donor` (Role ID 3)**: Devotees and donors who browse monastery spaces, submit donation requests, and track their personal donation history.
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
| `GET` | `/api/user/:id/settings` | Users | Self or `Users.View` | All (Self), Admin |
| `PUT` | `/api/user/:id/settings` | Users | Self or `Users.Update` | All (Self), Admin |
| `GET` | `/api/v1/monasteries` | Monasteries | None (`[AllowAnonymous]`) | Public, All Users |
| `GET` | `/api/v1/monasteries/feed` | Monasteries | None (`[AllowAnonymous]`) | Public, Mobile Users |
| `GET` | `/api/v1/monasteries/search` | Monasteries | None (`[AllowAnonymous]`) | Public, All Users |
| `GET` | `/api/v1/monasteries/search/feed` | Monasteries | None (`[AllowAnonymous]`) | Public, Mobile Users |
| `POST` | `/api/v1/monasteries` | Monasteries | `Monastery.Create` | Monk, Admin |
| `GET` | `/api/v1/monasteries/mine` | Monasteries | Authenticated | Space Members & Admin |
| `GET` | `/api/v1/monasteries/mine/feed` | Monasteries | Authenticated | Space Members & Admin |
| `GET` | `/api/v1/monasteries/:id` | Monasteries | `Space.View` | Space Members & Admin |
| `PATCH` | `/api/v1/monasteries/:id` | Monasteries | `Space.Update` | Space Owner, Space Admin |
| `DELETE` | `/api/v1/monasteries/:id` | Monasteries | `Space.Delete` | Space Owner only |
| `POST` | `/api/v1/monasteries/:id/invitations` | Monasteries | `Space.InviteMember` | Space Owner, Space Admin |
| `POST` | `/api/v1/monasteries/invitations/:invitationId/respond` | Monasteries | `Invitation.Respond` | Invitee (`Monk`, `Donor`) |
| `GET` | `/api/v1/monasteries/:id/members` | Monasteries | `Space.ViewMembers` | Space Members & Admin |
| `PUT` | `/api/v1/monasteries/:id/members/:memberUserId/role` | Monasteries | `Space.UpdateMemberRole` | Space Owner, Space Admin |
| `DELETE` | `/api/v1/monasteries/:id/members/:memberUserId` | Monasteries | `Space.RemoveMember` | Space Owner, Space Admin |
| `GET` | `/api/v1/monasteries/:id/permissions` | Monasteries | Authenticated | Space Members & Admin |
| `GET` | `/api/v1/monasteries/:id/roles` | Monasteries | Authenticated | Space Members & Admin |
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
- **Description**: Registers a new user account. Supports both `Monk` (`roleId: 2`) and regular User / `Donor` (`roleId: 3`). When registering as a Monk, `monasteryName` and `monasteryAddress` are mandatory. Accepts canonical `phoneNumber` and `contactPhoneNumber`.
- **Request Body**:
```json
{
  "name": "Ashin Pannita",
  "phoneNumber": "09123456789",
  "password": "Password123!",
  "roleId": 2,
  "monasteryName": "Mahagandhayon Monastery",
  "monasteryAddress": "Amarapura, Mandalay",
  "email": "pannita@monastery.org",
  "contactPhoneNumber": "09123456789"
}
```
- **Responses**:
  - `200 OK`:
```json
{
  "isSuccess": true,
  "message": "Register Successful",
  "isFailure": false,
  "data": {
    "id": 2,
    "roleId": 2,
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

### 4.2. User & Profile Management (`/api/v1/user`)

#### 4. Get All Users
- **Method**: `GET`
- **Route**: `/api/v1/user`
- **Target User Role**: `System Admin`
- **Required Permission**: `Users.View`
- **Description**: Retrieves a paginated list of all active registered users across the entire system.
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
      "id": 1,
      "name": "System Administrator",
      "phoneNumber": "09100000001",
      "roleId": 1,
      "roleName": "Admin",
      "email": "admin@monastery.org",
      "contactPhoneNumber": "09100000001"
    },
    {
      "id": 2,
      "name": "U Thuzana",
      "phoneNumber": "09100000002",
      "roleId": 2,
      "roleName": "Monk",
      "email": "thuzana@monastery.org",
      "contactPhoneNumber": "09100000002"
    }
  ],
  "pagination": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 2,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

#### 5. Get User Profile by ID
- **Method**: `GET`
- **Route**: `/api/v1/user/:id` (and `/api/v1/user/me`)
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
    "phone": "09100000002",
    "roleId": 2,
    "roleName": "Monk",
    "email": "thuzana@monastery.org",
    "contactPhoneNumber": "09100000002",
    "contactPhone": "09100000002",
    "avatar": null,
    "createdAt": "2026-11-01T08:00:00.000Z",
    "monkProfile": {
      "id": 1,
      "userId": 2,
      "monasteryName": "Mahagandhayon Monastery",
      "monasteryAddress": "Amarapura, Mandalay"
    },
    "permissions": [
      "Donor.View",
      "Monastery.View",
      "Monastery.Create",
      "Monastery.Update",
      "Monastery.Delete",
      "Monastery.ManageMembers",
      "Donation.View",
      "Donation.Create",
      "Donation.Review",
      "Donation.Schedule",
      "Donation.Cancel",
      "Donation.Delete"
    ]
  }
}
```

---

#### 6. Update User Profile
- **Method**: `PUT`
- **Route**: `/api/v1/user`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Users.Update`
- **Description**: Updates profile attributes (Name, Phone Number, Email, Contact Phone). Regular users cannot alter their own `roleId`; only Admins with `Users.Manage` and `Roles.Assign` can modify role assignments. Supports multipart/form-data for avatar uploads.
- **Request Body**:
```json
{
  "id": 2,
  "name": "U Thuzana Updated",
  "phoneNumber": "09100000002",
  "roleId": 2,
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
    "roleId": 2,
    "roleName": "Monk",
    "email": "updated@monastery.org",
    "contactPhoneNumber": "09100000002"
  }
}
```

---

#### 7. Soft Delete User Account
- **Method**: `DELETE`
- **Route**: `/api/v1/user/:id`
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

#### 8. Get User's Received Invitations (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/invitations`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Invitation.View`
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
      "status": "PENDING",
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

#### 8.1. Get User's Received Invitations Feed (Mobile Keyset Cursor Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/invitations/feed`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Invitation.View`
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
      "status": "PENDING",
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

#### 9. Get User's Sent Invitations (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/invited-by-list`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Invitation.View`
- **Query Parameters**: `pageNumber` (int, default: 1), `pageSize` (int, default: 10)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK`**: `PagedResult<InvitationDto>`

---

#### 9.1. Get User's Sent Invitations Feed (Mobile Cursor Keyset Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/invited-by-list/feed`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Invitation.View`
- **Query Parameters**: `lastId` (int, optional), `pageSize` (int, default: 15)
- **Status Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`
- **Response `200 OK`**: `CursorPagedResult<InvitationDto>`

---

#### 10. Get User Notifications (Web Offset Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/notification`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Notification.View`
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
      "type": "REMINDER",
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

#### 10.1. Get User Notifications Feed (Mobile Cursor Keyset Pagination)
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/notification/feed`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Notification.View`
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
      "type": "REMINDER",
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

#### 11. Clear All User Notifications
- **Method**: `DELETE`
- **Route**: `/api/v1/user/:id/notification`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Notification.Manage`
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

#### 12. Get Monk Profile
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/monk-profile`
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: `Users.View`
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

#### 13. Update Monk Profile
- **Method**: `PUT`
- **Route**: `/api/v1/user/:id/monk-profile`
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: `Users.Update`
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

#### 14. Delete Monk Profile
- **Method**: `DELETE`
- **Route**: `/api/v1/user/:id/monk-profile`
- **Target User Role**: `Monk` (Self) or `System Admin`
- **Required Permission**: `Users.Manage`
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

#### 15. Get User Reminder & Notification Settings
- **Method**: `GET`
- **Route**: `/api/v1/user/:id/settings`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Users.View`
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

#### 16. Update User Reminder & Notification Settings
- **Method**: `PUT`
- **Route**: `/api/v1/user/:id/settings`
- **Target User Role**: Any Authenticated User (Self) or `System Admin`
- **Required Permission**: `Users.Update`
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

### 4.3. Monastery Spaces & Memberships (`/api/v1/monasteries`)

#### 16. Public Monastery Catalog Listing
- **Method**: `GET`
- **Route**: `/api/v1/monasteries`
- **Target User Role**: Public (Devotees, Donors, Monks, Unauthenticated Users)
- **Required Permission**: None (`[AllowAnonymous]`)
- **Description**: Public catalog listing of active monasteries for donor discovery. Returns paginated results ordered ascending by name and ID by default.
- **Query Parameters**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "data": [
    {
      "id": 1,
      "monasteryName": "Kyauk Gu Monastery",
      "description": "Historical cave monastery",
      "address": "Bagan, Mandalay Region",
      "createdByName": "Ashin Pannita",
      "membersCount": 6
    },
    {
      "id": 2,
      "monasteryName": "Mahagandhayon Monastery",
      "description": "Center for Buddhist monastic education",
      "address": "Amarapura, Mandalay",
      "createdByName": "U Thuzana",
      "membersCount": 12
    }
  ],
  "pagination": { "pageNumber": 1, "pageSize": 10, "totalCount": 2, "totalPages": 1, "hasPreviousPage": false, "hasNextPage": false }
}
```

---

#### 16b. Public Monastery Catalog Feed (Mobile Cursor)
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/feed`
- **Target User Role**: Public (Devotees, Donors, Monks, Mobile App Users)
- **Required Permission**: None (`[AllowAnonymous]`)
- **Description**: Dedicated cursor-based feed endpoint for mobile infinite scrolling of active monasteries.
- **Query Parameters**:
  - `lastId` (int, optional): ID of the last monastery from the previous page. Omit for the first page.
  - `pageSize` (int, optional, default: 15): Number of items per batch.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Monasteries feed retrieved successfully.",
  "data": [
    {
      "id": 1,
      "monasteryName": "Mahagandhayon Monastery",
      "description": "Center for monastic studies",
      "address": "Amarapura, Mandalay",
      "createdById": 2
    }
  ],
  "pagination": {
    "nextCursor": 1,
    "hasNextPage": true,
    "pageSize": 15
  }
}
```

---

#### 17. Search Public Monasteries
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/search`
- **Target User Role**: Public (Devotees, Donors, Monks, Unauthenticated Users)
- **Required Permission**: None (`[AllowAnonymous]`)
- **Description**: Dedicated keyword search across monastery names and physical addresses. Returns paginated matching results ordered ascending by name and ID.
- **Query Parameters**:
  - `keyword` (string, required query string)
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "data": [
    {
      "id": 2,
      "monasteryName": "Mahagandhayon Monastery",
      "description": "Center for Buddhist monastic education",
      "address": "Amarapura, Mandalay",
      "createdByName": "U Thuzana",
      "membersCount": 12
    }
  ],
  "pagination": { "pageNumber": 1, "pageSize": 10, "totalCount": 1, "totalPages": 1, "hasPreviousPage": false, "hasNextPage": false }
}
```

---

#### 17b. Search Public Monasteries Feed (Mobile Cursor)
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/search/feed`
- **Target User Role**: Public (Devotees, Donors, Monks, Mobile App Users)
- **Required Permission**: None (`[AllowAnonymous]`)
- **Description**: Dedicated cursor-based keyword search feed endpoint for mobile infinite scrolling across monastery names and addresses.
- **Query Parameters**:
  - `keyword` (string, optional): Search keyword.
  - `lastId` (int, optional): ID of the last monastery from the previous page.
  - `pageSize` (int, optional, default: 15): Number of items per batch.
- **Response `200 OK`**: Returns `CursorPagedResult<MonasterySpaceDto>` with `nextCursor` and `hasNextPage`.

---

#### 18. Create Monastery Space
- **Method**: `POST`
- **Route**: `/api/v1/monasteries`
- **Target User Role**: `Monk` or System Admin
- **Required Permission**: `Monastery.Create`
- **Description**: Provisions an isolated monastery space. The authenticated user is automatically enrolled as the space Owner (`SpaceRoleId = 1`, `IsOwner = true`).
- **Request Body**:
```json
{
  "monasteryName": "Mahagandhayon Monastery",
  "description": "Center for Buddhist monastic education",
  "address": "Amarapura, Mandalay Division"
}
```
- **Response `201 Created`**:
```json
{
  "isSuccess": true,
  "message": "Monastery created successfully.",
  "isFailure": false,
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery",
    "description": "Center for Buddhist monastic education",
    "address": "Amarapura, Mandalay Division",
    "createdById": 2,
    "currentUserRoleId": 1,
    "currentUserRoleName": "Space Admin",
    "isOwner": true
  }
}
```

---

#### 19. Get My Monasteries
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/mine`
- **Target User Role**: Any Space Member (`Monk`, `Admin`, `Editor`, `Viewer`)
- **Description**: Returns all monastery spaces where the current user is an enrolled member or owner, using Offset-based pagination.
- **Query Parameters**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
  - `search` (string, optional)
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "My monasteries retrieved successfully.",
  "isFailure": false,
  "data": [
    {
      "id": 1,
      "monasteryName": "Mahagandhayon Monastery",
      "description": "Center for Buddhist monastic education",
      "address": "Amarapura, Mandalay Division",
      "createdById": 2,
      "currentUserRoleId": 1,
      "currentUserRoleName": "Space Admin",
      "isOwner": true
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

#### 19b. Get My Monasteries Feed (Mobile Cursor)
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/mine/feed`
- **Target User Role**: Any Space Member (`Monk`, `Admin`, `Editor`, `Viewer`)
- **Description**: Cursor-based infinite scrolling feed of monasteries where the current user is an enrolled member or owner.
- **Query Parameters**:
  - `lastId` (int, optional): ID of the last monastery from the previous page.
  - `pageSize` (int, optional, default: 15): Number of items per batch.
- **Response `200 OK`**: Returns `CursorPagedResult<MonasterySpaceDto>` with `nextCursor` and `hasNextPage`.

---

#### 20. Get Monastery Space Details
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/{id}`
- **Target User Role**: Space Members (`Owner`, `Admin`, `Editor`, `Viewer`)
- **Required Space Permission**: `Space.View`
- **Description**: Fetches metadata for a single space along with the caller's contextual role and ownership flag.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Monastery retrieved successfully.",
  "isFailure": false,
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery",
    "description": "Center for Buddhist monastic education",
    "address": "Amarapura, Mandalay Division",
    "createdById": 2,
    "currentUserRoleId": 1,
    "currentUserRoleName": "Space Admin",
    "isOwner": true
  }
}
```

---

#### 21. Update Monastery Space
- **Method**: `PATCH`
- **Route**: `/api/v1/monasteries/{id}`
- **Target User Role**: Space Owner, Space Admin
- **Required Space Permission**: `Space.Update`
- **Description**: Updates the monastery space's name, description, and physical address.
- **Request Body**:
```json
{
  "monasteryName": "Mahagandhayon Monastery (Main)",
  "description": "Updated monastic campus description",
  "address": "Amarapura, Mandalay"
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Monastery updated successfully.",
  "isFailure": false,
  "data": {
    "id": 1,
    "monasteryName": "Mahagandhayon Monastery (Main)",
    "description": "Updated monastic campus description",
    "address": "Amarapura, Mandalay"
  }
}
```

---

#### 22. Delete Monastery Space
- **Method**: `DELETE`
- **Route**: `/api/v1/monasteries/{id}`
- **Target User Role**: Space Owner only
- **Required Space Permission**: `Space.Delete`
- **Description**: Soft-deletes the monastery space (`IsDeleted = true`). Space admins cannot delete spaces; this action is reserved exclusively for the space owner.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Monastery deleted successfully.",
  "isFailure": false
}
```

---

#### 23. Invite Member to Space
- **Method**: `POST`
- **Route**: `/api/v1/monasteries/{id}/invitations`
- **Target User Role**: Space Owner, Space Admin
- **Required Space Permission**: `Space.InviteMember`
- **Description**: Invites an existing registered user by `UserId` or `PhoneNumber` to join the space with a selected space role (`Admin`, `Editor`, or `Viewer`). Dispatches an in-app & FCM push notification to the invitee.
- **Request Body**:
```json
{
  "phoneNumber": "09100000003",
  "spaceRoleId": 3
}
```
- **Response `201 Created`**:
```json
{
  "isSuccess": true,
  "message": "Member invited successfully.",
  "isFailure": false,
  "data": {
    "invitationId": 1,
    "monasterySpaceId": 1,
    "invitedUserId": 3,
    "spaceRoleId": 3,
    "status": 1
  }
}
```

---

#### 24. Respond to Space Invitation
- **Method**: `POST`
- **Route**: `/api/v1/monasteries/invitations/{invitationId}/respond`
- **Target User Role**: The invited user
- **Required Permission**: `Invitation.Respond`
- **Description**: Accepts (`Status = 2` / Accepted) or rejects (`Status = 3` / Rejected) an invitation. Upon acceptance, the user is immediately enrolled as an active `MonasteryMember` with the specified role.
- **Request Body**:
```json
{
  "status": 2
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Invitation accepted successfully.",
  "isFailure": false
}
```

---

#### 25. List Space Members
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/{id}/members`
- **Target User Role**: All Space Members (`Owner`, `Admin`, `Editor`, `Viewer`)
- **Required Space Permission**: `Space.ViewMembers`
- **Description**: Retrieves a paginated list of all enrolled users in the monastery space.
- **Query Parameters**:
  - `pageNumber` (int, default: 1)
  - `pageSize` (int, default: 10)
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Members retrieved successfully.",
  "isFailure": false,
  "data": [
    {
      "id": 1,
      "userId": 2,
      "name": "Ashin Pannita",
      "phoneNumber": "09100000002",
      "phone": "09100000002",
      "email": "ashin.pannita@monastery.org",
      "spaceRoleId": 1,
      "spaceRoleName": "Space Admin",
      "isOwner": true
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

#### 26. Update Space Member Role
- **Method**: `PUT`
- **Route**: `/api/v1/monasteries/{id}/members/{memberUserId}/role`
- **Target User Role**: Space Owner, Space Admin
- **Required Space Permission**: `Space.UpdateMemberRole`
- **Description**: Modifies the role assigned to a member. Space Admins cannot alter the space Owner's role.
- **Request Body**:
```json
{
  "spaceRoleId": 2
}
```
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Member role updated successfully.",
  "isFailure": false,
  "data": {
    "userId": 3,
    "spaceRoleId": 2,
    "spaceRoleName": "Space Moderator"
  }
}
```

---

#### 27. Remove Member from Space
- **Method**: `DELETE`
- **Route**: `/api/v1/monasteries/{id}/members/{memberUserId}`
- **Target User Role**: Space Owner, Space Admin
- **Required Space Permission**: `Space.RemoveMember`
- **Description**: Disassociates a member from the monastery space. The space owner cannot be removed.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Member removed successfully.",
  "isFailure": false
}
```

---

#### 27a. Get Current User's Space Permissions
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/{id}/permissions`
- **Target User Role**: Space Members, System Admin
- **Required Permission**: Authenticated Space Member or System Admin
- **Description**: Retrieves the active space permissions granted to the calling user inside the specified monastery space. If the caller is the Space Owner or a System Admin, all active space permissions are returned.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Permissions retrieved successfully.",
  "isFailure": false,
  "data": [
    {
      "id": 1,
      "name": "Space.View",
      "description": "View monastery details"
    },
    {
      "id": 2,
      "name": "Donation.Create",
      "description": "Submit donation requests"
    }
  ]
}
```

---

#### 27b. Get Available Monastery Space Roles
- **Method**: `GET`
- **Route**: `/api/v1/monasteries/{id}/roles`
- **Target User Role**: Space Members, System Admin
- **Required Permission**: Authenticated Space Member or System Admin
- **Description**: Retrieves all assignable space roles along with their configured permissions for this monastery space.
- **Response `200 OK`**:
```json
{
  "isSuccess": true,
  "message": "Roles retrieved successfully.",
  "isFailure": false,
  "data": [
    {
      "id": 1,
      "name": "Owner",
      "description": "Space creator with full administrative authority",
      "permissions": []
    },
    {
      "id": 2,
      "name": "Admin",
      "description": "Monastery trustee/manager",
      "permissions": []
    }
  ]
}
```

---

### 4.4. Donors Directory (`/api/v1/donors`)

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

### 4.5. Donations Management (`/api/v1/donations`)

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

### 4.6. Donation Calendar Aggregation (`/api/v1/donations/calendar`)

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

### 4.7. Dynamic RBAC & System Permissions (`/api/v1/roles`)

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

### 4.8. Observability & System (`/health`, `/api-docs`, `/stats`)

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

