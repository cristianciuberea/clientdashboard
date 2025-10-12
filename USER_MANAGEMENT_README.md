# User Management System

## Sistem de Roluri

Aplicația suportă acum 4 tipuri de roluri:

### 1. **Super Admin** 
- ✅ Acces complet la toate setările și clienții
- ✅ Poate crea, edita și șterge useri
- ✅ Poate aloca useri la clienți
- ✅ Vede toate paginile (Dashboard, Clients, Reports, Alerts, User Management, Settings)

### 2. **Manager**
- ✅ Acces la clienții alocați cu drepturi de management
- ✅ Poate gestiona integrările și setările pentru clienții alocați
- ✅ Poate vizualiza și edita rapoarte

### 3. **Specialist**
- ✅ Acces la clienții alocați pentru vizualizare și lucru
- ✅ Poate vizualiza dashboards, reports, și alerts
- ⛔ Nu poate modifica setări sau integrări

### 4. **Client**
- ✅ Acces doar la dashboard-ul propriu
- ✅ Poate vizualiza propriile metrici și rapoarte
- ⛔ Nu poate accesa alte clienți sau setări

---

## Instalare și Configurare

### Pas 1: Rulează SQL Migration

Pentru a actualiza baza de date cu noile roluri, rulează fișierul `update-roles.sql` în Supabase SQL Editor:

1. Deschide [Supabase Dashboard](https://app.supabase.com)
2. Selectează proiectul tău
3. Mergi la **SQL Editor**
4. Copiază conținutul din `update-roles.sql`
5. Rulează query-ul

**Important:** Acest script va:
- Actualiza rolurile existente:
  - `client_admin` → `manager`
  - `client_viewer` → `client`
- Adăuga constrângeri noi pentru roluri
- Crea funcții helper pentru verificarea accesului
- Crea view-uri pentru user-client relationships

### Pas 2: Verifică că migration-ul a reușit

Rulează următorul query în SQL Editor pentru a verifica:

```sql
SELECT email, full_name, role 
FROM profiles 
ORDER BY role;
```

Ar trebui să vezi rolurile noi: `super_admin`, `manager`, `specialist`, `client`

### Pas 3: Testează aplicația

1. Login cu un cont de **Super Admin**
2. În sidebar, ar trebui să vezi opțiunea **"User Management"**
3. Deschide User Management și creează useri noi

---

## Cum să folosești User Management

### Creare User

1. Click pe **"Add User"**
2. Completează:
   - Email
   - Full Name
   - Password (minim 6 caractere)
   - Rol (Super Admin, Manager, Specialist, sau Client)
3. Click **"Create User"**

### Alocare Clienți

Pentru rolurile **Manager**, **Specialist**, și **Client**:

1. Click pe iconița **UserCheck** (⚡) de lângă user
2. Selectează clienții pe care vrei să-i aloci
3. Alege rolul specific pentru fiecare client:
   - **Manager**: poate gestiona integrările
   - **Specialist**: poate doar vizualiza
   - **Client**: acces limitat la dashboard
4. Click **"Save Assignments"**

**Notă:** Super Admins au automat acces la toți clienții!

### Editare User

1. Click pe iconița **Edit** (✏️)
2. Modifică numele sau rolul
3. Click **"Save Changes"**

**Notă:** Email-ul nu poate fi modificat

### Ștergere User

1. Click pe iconița **Delete** (🗑️)
2. Confirmă ștergerea
3. Toate asocierile cu clienții vor fi șterse automat

**Notă:** Super Admins nu pot fi șterși din UI

---

## Structura Bazei de Date

### Tables

#### `profiles`
- `id` (UUID) - User ID (FK to auth.users)
- `email` (TEXT)
- `full_name` (TEXT)
- `role` (ENUM) - 'super_admin', 'manager', 'specialist', 'client'
- `organization_id` (UUID)
- `avatar_url` (TEXT)
- `preferences` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)

#### `client_users`
- `id` (UUID)
- `client_id` (UUID) - FK to clients
- `user_id` (UUID) - FK to profiles
- `role` (ENUM) - 'manager', 'specialist', 'client'
- `created_at` (TIMESTAMP)

### Helper Functions

#### `user_has_client_access(user_id, client_id)`
Returnează `TRUE` dacă userul are acces la client (fie e super admin, fie e alocat).

**Exemplu:**
```sql
SELECT user_has_client_access('user-uuid', 'client-uuid');
```

### Views

#### `user_client_access`
View care combine profiles + client_users pentru a vedea rapid ce user are acces la ce client.

**Exemplu:**
```sql
SELECT * FROM user_client_access 
WHERE user_id = 'your-user-uuid';
```

---

## Permisiuni și Securitate

### Super Admin
- Poate accesa toate paginile
- Vede opțiunea "User Management" în sidebar
- Poate crea/edita/șterge useri
- Poate aloca useri la clienți

### Manager / Specialist / Client
- **NU** văd opțiunea "User Management"
- Pot accesa doar clienții alocați
- Filtrarea se face automat în queries

### Row Level Security (RLS)

Migration-ul creează automat funcții și view-uri care respectă RLS. Dacă vrei să activezi RLS complet, adaugă policies:

```sql
-- Example RLS policy for clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their assigned clients"
ON clients FOR SELECT
USING (
  user_has_client_access(auth.uid(), id)
);
```

---

## Troubleshooting

### Problema: Nu văd "User Management" în sidebar
**Soluție:** Asigură-te că ești logat cu un cont de Super Admin. Verifică:
```sql
SELECT role FROM profiles WHERE email = 'your-email@example.com';
```

### Problema: Eroare la creare user: "User creation failed"
**Soluție:** 
1. Verifică că email-ul nu este deja înregistrat
2. Parola trebuie să aibă minim 6 caractere
3. Verifică că migration-ul SQL a fost rulat corect

### Problema: Nu văd clienții alocați
**Soluție:**
1. Verifică că userul are alocări în `client_users`:
```sql
SELECT * FROM client_users WHERE user_id = 'user-uuid';
```
2. Verifică că clienții au status 'active'

### Problema: Eroare "profiles_role_check" violation
**Soluție:** Rolul specificat nu este valid. Trebuie să fie unul din:
- `super_admin`
- `manager`
- `specialist`
- `client`

---

## Best Practices

1. **Super Admin Account**: Creează doar câțiva Super Admins de încredere
2. **Manager vs Specialist**: Folosește Manager pentru persoane care gestionează campanii, Specialist pentru raportare
3. **Client Role**: Pentru clienți reali care vor doar să vadă propriile date
4. **Regular Backups**: Fă backup la tabelele `profiles` și `client_users` regulat
5. **Audit Trail**: Consider adding a trigger pentru logging modificările de role

---

## Support

Pentru probleme sau întrebări, contactează:
- Email: cristi@blogdesucces.com
- GitHub Issues: [Link la repository]

---

**Versiune:** 1.0.0  
**Data:** Octombrie 2025  
**Autor:** Cristian Ciuberea

