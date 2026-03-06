<![CDATA[# System Design — RuralPOS

## Overview

RuralPOS is designed as an **offline-first, multi-tenant SaaS** point of sale platform targeting food businesses (butcheries, restaurants, kitchens) in areas with unreliable connectivity.

The architecture prioritizes:
- **Zero-downtime operations** — the app must work fully offline
- **Data integrity** — no sales or inventory data should ever be lost
- **Multi-device sync** — multiple tablets per business must stay consistent
- **Tenant isolation** — one cloud backend serves many businesses securely

---

## High-Level Architecture

The system consists of three tiers:

### 1. Mobile POS Terminals (React Native / Expo)
- Primary user-facing application running on Android tablets
- Local SQLite database for all business data
- Zustand stores for reactive UI state
- Background sync service with offline queue
- Role-based navigation (Admin, Butchery, Kitchen, Chef, Inventory)

### 2. Cloud Backend (Supabase)
- PostgreSQL database with Row Level Security
- Realtime WebSocket channels for live cross-device sync
- RPC functions for secure license verification
- Multi-tenant data isolation via `tenant_id` column on every table

### 3. Web Management Layer
- **Web Dashboard** (Vite + React) — Browser-based POS and reporting
- **Admin Portal** (Next.js) — SaaS-level tenant and license management

---

## Data Model

Core entities with multi-tenant isolation:

| Table | Purpose |
|---|---|
| `licenses` | Subscription license keys per tenant |
| `users` | Staff accounts with roles and PIN auth |
| `products` | Menu items / product catalog |
| `orders` | Sales transactions |
| `order_items` | Line items within each order |
| `inventory` | Stock levels and thresholds |
| `carcass_records` | Butchery yield tracking |
| `freezer_items` | Cold storage management |
| `audit_logs` | Security and accountability trail |

Every table includes a `tenant_id` column for SaaS data isolation.

---

## Sync Architecture

### Upstream (Device → Cloud)
1. User performs an action (e.g., creates an order)
2. Data is written to local SQLite **immediately**
3. SyncService attempts to push to Supabase
4. If offline → action is queued in `sync_queue` table
5. On reconnection (or background fetch) → queue is flushed

### Downstream (Cloud → Device)
1. Supabase Realtime pushes changes via WebSocket channels
2. Channels are scoped by `tenant_id` for isolation
3. Incoming changes are upserted into local SQLite
4. Zustand stores trigger UI re-renders automatically

### Background Sync
- `expo-background-fetch` runs every 15 minutes
- Processes any pending items in the sync queue
- Configured with `stopOnTerminate: false` and `startOnBoot: true`

---

## Authentication & Licensing

### License Flow
1. First launch → user enters a license key
2. Key is verified via Supabase RPC function (`verify_license`)
3. On success → tenant_id, business name, and expiry are cached locally
4. App operates under a **7-day offline grace period**
5. After grace period expires without verification → app blocks access

### User Authentication
- Staff log in with a **4-digit PIN** (no passwords)
- PIN is validated against local SQLite users table
- Role determines which screens are accessible

---

## OTA Update Strategy

- Expo Updates checks for new bundles on app launch
- If an update is available, it's downloaded in the background
- User is prompted to restart to apply the update
- Skipped in development mode (`__DEV__` guard)

---

## Security Considerations

- Supabase Row Level Security (RLS) enabled on all tables
- License verification uses `SECURITY DEFINER` RPC (bypasses RLS)
- Tenant data is isolated via `tenant_id` in all queries and WebSocket filters
- Audit logs record all significant user actions
- Admin dashboard has password-protected access

---

## Scalability

The multi-tenant architecture allows horizontal scaling:
- Single Supabase instance serves multiple businesses
- Each business is isolated by `tenant_id`
- New tenants are onboarded by issuing a license key
- Admin portal manages tenants, licenses, and monitoring
]]>
