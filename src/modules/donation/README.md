# Donation Module

This module implements the multi-space donation workflow based on the C# `DonationService` specification and the Prisma `DonorList` (`Donor_List` table) model.

---

## 1. Domain Enums

### DonationStatus
| Status Name | Numeric Value | Description |
| :--- | :--- | :--- |
| `Draft` | `0` | Unsubmitted draft (reserved) |
| `Submitted` | `1` | Submitted (reserved) |
| `PendingReview` | `2` | Initial state for donor requests waiting for review |
| `Accepted` | `3` | Reviewed and approved by monastery manager |
| `Scheduled` | `4` | Pickup or dropoff time scheduled |
| `Completed` | `5` | Donation delivered/received and completed |
| `Rejected` | `6` | Rejected by monastery manager |
| `Cancelled` | `7` | Cancelled by donor or monastery manager |

### DonationType
| Type Name | Numeric Value | Description |
| :--- | :--- | :--- |
| `Money` | `0` | Cash or electronic transfer |
| `Food` | `1` | Groceries, meals, dry rations |
| `Medicine` | `2` | Medical supplies and medicines |
| `Robe` | `3` | Monastic robes and garments |
| `Supplies` | `4` | General utilities and monastery supplies |
| `Other` | `5` | Custom category (requires `customDonationType`) |

---

## 2. API Endpoints

All endpoints require JWT Bearer authentication.

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/donations/request` | Authenticated Donor | Submit a new donation request (`PendingReview`) |
| `POST` | `/api/v1/donations/manual` | `Donation.Review` / Owner | Record an offline or direct donation (`Accepted` / `Scheduled`) |
| `POST` | `/api/v1/donations/batch` | `Donation.Review` / Owner | Record a batch of manual donations (up to 50) |
| `POST` | `/api/v1/donations/recurring/request` | Authenticated Donor | Submit a series of monthly donation requests |
| `POST` | `/api/v1/donations/recurring/manual` | `Donation.Review` / Owner | Record a series of monthly manual donations |
| `GET` | `/api/v1/donations` | `Donation.View` | Paginated list (own history or space history) |
| `GET` | `/api/v1/donations/:donationId` | `Donation.View` | Detailed donation record |
| `GET` | `/api/v1/donations/calendar` | `Donation.View` | Monthly aggregated calendar summary |
| `PATCH` | `/api/v1/donations/:donationId/review` | `Donation.Review` / Owner | Accept (`3`) or Reject (`6`) with optional note |
| `PATCH` | `/api/v1/donations/:donationId/schedule` | `Donation.Schedule` / Owner | Set pickup/dropoff schedule (`4`) |
| `PATCH` | `/api/v1/donations/:donationId/complete` | `Donation.Schedule` / Owner | Mark donation complete (`5`) |
| `PATCH` | `/api/v1/donations/:donationId/cancel` | Donor / `Donation.Cancel` | Cancel donation (`7`) |
| `DELETE` | `/api/v1/donations/:donationId` | `Donation.Delete` | Soft/hard delete pending donation |

### Space-Scoped Aliases
The router also supports monastery-scoped requests at:
- `/api/v1/monasteries/:spaceId/donations`
- `/api/v1/monasteries/:spaceId/donations/:donationId`

---

## 3. Workflow State Transitions

```
[Donor Request] ──> PendingReview (2) ──(Review)──> Accepted (3) ──(Schedule)──> Scheduled (4) ──(Complete)──> Completed (5)
                           │                               │                            │
                           ├──(Review)──> Rejected (6)     └──(Schedule)────────────────┘
                           │
                           └──(Cancel)──> Cancelled (7)
```
