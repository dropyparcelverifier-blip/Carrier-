# Dropy Scan

Warehouse parcel receiving tool for Dropy Abhi.  
Cargo team scans parcels on phone → Admin sees receiving dashboard.

## Tech Stack
- **SvelteKit** on **Vercel**
- **Supabase** (Postgres + Auth + Storage)
- **html5-qrcode** for barcode scanning

## Setup

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. SQL Editor → paste all of `supabase/schema.sql` → Run
3. Settings → API → copy the Project URL and the **service role** key

`schema.sql` is the whole database in one file. Re-running it rebuilds the
parcel tables and keeps your logins, packer names and settings.

### 2. Local Dev
```bash
cd dropy-scan
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### 3. Deploy to Vercel
1. Push to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
4. Deploy

### Accounts

PINs are hashed (bcrypt) and verified inside Postgres. Manage them with SQL:

```sql
SELECT add_user('ravi', '4821', 'packer', 'Ravi K');
SELECT set_user_pin('cargo', '7391');
UPDATE app_users SET active = false WHERE username = 'olduser';
```

Starter accounts — **change these before sharing the link**:
`admin/1234`, `cargo/0000`, `packer/1111`

### Security

The browser holds no database credentials. Every query runs in a SvelteKit
endpoint using the service role key, which stays in the server environment.
Anonymous access to Postgres is revoked, so the API is the only way in.
Sessions are HMAC-signed httpOnly cookies — scripts cannot read them and a
role cannot be edited without invalidating the signature.

## Screens

| Screen | Role | Purpose |
|--------|------|---------|
| PIN Entry | All | Gate access |
| Scan | Cargo + Admin | Camera/manual barcode scan → mark received |
| Dashboard | Admin | Stats, today's scans, missing alerts |
| Parcels | Admin | Searchable parcel list with filters |
| Upload | Admin | Upload Amazon CSVs |

## Data Flow
```
Amazon Business CSV → Upload to Dropy Scan → Auto-filters Dropy address
→ Cargo team scans on phone → Mark received → Dashboard shows status
```
