# Donation Module

This module implements the monastery donation and offering workflow based on the official C# specification and the Prisma `DonorList` (`Donor_List` table) model.

All donation endpoints are mounted at `/api/v1/donations`.

---

## 1. Domain Enums

### DonationStatus
| Status Name | Numeric Value | Description |
| :--- | :--- | :--- |
| `PendingReview` | `1` | Initial state for donor requests waiting for monastery review |
| `Accepted` | `2` | Reviewed and approved by monastery manager |
| `Rejected` | `3` | Rejected by monastery manager |
| `Scheduled` | `4` | Pickup or dropoff time scheduled |
| `Completed` | `5` | Donation delivered/received and fulfilled (ledger sealed) |
| `Cancelled` | `6` | Cancelled by donor or monastery manager |

### DonationType
| Type Name | Numeric Value | Description |
| :--- | :--- | :--- |
| `Money` | `0` | Cash or electronic fund transfer |
| `Food` | `1` | Groceries, meals, morning gruel, dry rations |
| `Medicine` | `2` | Medical supplies and medicines |
| `Robe` | `3` | Monastic robes and garments (Kathina, etc.) |
| `Supplies` | `4` | Utilities, construction materials, and monastery supplies |
| `Other` | `5` | Custom offering category (requires `customDonationType`) |

---

## 2. API Endpoints

All endpoints except the public catalog require JWT Bearer authentication.

| # | Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- | :--- |
| **40a** | `GET` | `/api/v1/donations/statuses` | Public / None | Comprehensive donation status enum catalog |
| **28** | `POST` | `/api/v1/donations/request` | `Donation.Create` | Submit a self-service donation request (`PendingReview: 1`) |
| **29** | `POST` | `/api/v1/donations/manual` | `Donation.Create` | Record an offline or walk-in direct donation (`Accepted: 2` / `Scheduled: 4`) |
| **30** | `POST` | `/api/v1/donations/batch` | `Donation.Create` | Record up to 50 manual donation records in a single atomic transaction |
| **31** | `POST` | `/api/v1/donations/recurring/request` | `Donation.Create` | Request a repeating monthly series of donation offerings (tagged `[Series: <id>]`) |
| **32** | `POST` | `/api/v1/donations/recurring/manual` | `Donation.Create` | Record a repeating monthly series of manual donations for registered or walk-in donors |
| **33** | `GET` | `/api/v1/donations` | `Donation.View` | Paginated donation history with offset pagination (own history or space history) |
| **33b**| `GET` | `/api/v1/donations/feed` | `Donation.View` | Mobile cursor-based keyset feed for infinite scrolling |
| **34** | `GET` | `/api/v1/donations/:donationId` | `Donation.View` | Detailed donation record by ID |
| **35** | `GET` | `/api/v1/donations/calendar` | `Donation.View` | Aggregated monthly calendar summary by year & month |
| **36** | `POST` | `/api/v1/donations/:donationId/review` | `Donation.Review` | Evaluate pending request: Accept (`2`) or Reject (`3`) with optional note |
| **37** | `PUT` | `/api/v1/donations/:donationId/schedule` | `Donation.Schedule` | Update logistics (`pickupTime`/`dropoffTime`) and transition status to `Scheduled: 4` |
| **38** | `POST` | `/api/v1/donations/:donationId/complete` | `Donation.Schedule` | Mark donation fulfilled (`Status = Completed: 5`, `completedAt = UtcNow`) |
| **39** | `POST` | `/api/v1/donations/:donationId/cancel` | Donor / `Donation.Cancel` | Cancel an active donation record (`Cancelled: 6`) |
| **40** | `DELETE`| `/api/v1/donations/:donationId` | `Donation.Delete` | Permanently delete mistaken entry (completed donations strictly protected) |
| **40b**| `PUT` | `/api/v1/donations/:donationId/status` | `Donation.Review` | Direct status transition / manager override |
| — | `POST` | `/api/v1/donations/series/:seriesId/review` | `Donation.Review` | Bulk review/approve all donations in a recurring series |
| — | `POST` | `/api/v1/donations/series/:seriesId/cancel` | Donor / `Donation.Cancel` | Bulk cancel all remaining active donations in a recurring series |

---

## 3. Workflow State Transitions

```
[Donor Request] ──> PendingReview (1) ──(Review)──> Accepted (2) ──(Schedule)──> Scheduled (4) ──(Complete)──> Completed (5)
                           │                               │                            │
                           ├──(Review)──> Rejected (3)     └──(Schedule)────────────────┘
                           │
                           └──(Cancel)──> Cancelled (6)
```

### Business Rules & Constraints
1. **Ledger Integrity**: Completed donations (`statusValue = 5`) are permanently sealed. They cannot be cancelled, modified, or deleted by any user or manager.
2. **Review Restrictions**: Only donations in `PendingReview` (`1`) can be reviewed via `POST /:donationId/review`.
3. **Manager Override**: `PUT /:donationId/status` allows space managers to directly update active donations with an audit note, while still preserving completed donation protections.
4. **Phone Normalization**: Manual and recurring donation endpoints accept `donorPhoneNumber` supporting Myanmar formats (`09...`, `+959...`, `959...` with spaces or hyphens stripped), automatically resolving registered user accounts or recording walk-in donors.
5. **Timezone Accuracy**: Calendar aggregation and reminders calculate boundaries using UTC with Myanmar daily offering rollover (17:30 UTC boundary).
