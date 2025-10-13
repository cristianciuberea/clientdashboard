## 🔄 Auto Sync Setup Guide

Sincronizarea automată verifică toate integrările active la fiecare 5 minute și le sincronizează dacă este necesar.

---

## 📋 **Ce ai nevoie:**

- ✅ Cont GitHub (unde ai repository-ul)
- ✅ Supabase URL
- ✅ Supabase Service Role Key

---

## 🚀 **Setup cu GitHub Actions (Recomandat - Gratuit!)**

### **Pas 1: Adaugă Secrets în GitHub**

1. Mergi la repository-ul tău pe GitHub
2. Click pe **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Adaugă două secrets:

**Secret 1: SUPABASE_URL**
- Name: `SUPABASE_URL`
- Value: `https://your-project.supabase.co` (înlocuiește cu URL-ul tău)

**Secret 2: SUPABASE_SERVICE_ROLE_KEY**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: (găsești în Supabase Dashboard → Settings → API → service_role key - secret!)

### **Pas 2: Verifică că funcționează**

1. Mergi la **Actions** tab în GitHub
2. Ar trebui să vezi workflow-ul "Auto Sync Integrations"
3. Click pe el și vezi run-urile
4. Poți face **"Run workflow"** manual pentru test

### **Pas 3: Monitorizare**

- Workflow-ul rulează automat **la fiecare 5 minute**
- Verifică **Actions** tab pentru a vedea istoricul
- Dacă sunt erori, vei vedea în logs

---

## 🛠️ **Setup cu Supabase Cron (Alternative - Mai Avansat)**

Dacă preferi să folosești pg_cron direct în Supabase:

### **Cerințe:**
- Supabase Pro plan (sau self-hosted)
- pg_cron extension enabled
- pg_net extension enabled

### **Pași:**

1. **Rulează migration-ul SQL:**
   ```sql
   -- În Supabase SQL Editor, rulează:
   -- Conținutul din: supabase/migrations/20251013_setup_auto_sync_cron.sql
   ```

2. **Configurează environment variables:**
   ```sql
   -- În Supabase SQL Editor:
   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
   ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
   ```

3. **Verifică job-ul:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'auto-sync-integrations';
   ```

---

## 🎯 **Cum funcționează?**

### **Flow-ul automatic:**

```
GitHub Actions (la fiecare 5 min)
    ↓
Apelează sync-scheduler Edge Function
    ↓
Verifică toate integrările active
    ↓
Pentru fiecare integrare:
  - Verifică ultima sincronizare (last_sync_at)
  - Dacă au trecut >= sync_frequency minute
  - Apelează platforma specifică (WooCommerce, Facebook Ads, etc.)
  - Actualizează last_sync_at
```

### **Configurarea frecvenței:**

Fiecare integrare are un câmp `sync_frequency` (în minute):
- Default: **5 minute**
- Minim: **1 minut**
- Maxim: **1440 minute** (24 ore)

Poți schimba frecvența în **Settings** pentru fiecare integrare.

---

## 🔍 **Verificare și Debugging**

### **Verifică dacă sincronizarea merge:**

1. **În aplicație:**
   - Mergi la **Settings** → **Integrations**
   - Vezi când a fost ultima sincronizare (Last Sync)
   - Ar trebui să se actualizeze automat la fiecare 5 minute

2. **În GitHub Actions:**
   - Mergi la **Actions** tab
   - Vezi run-urile recente
   - Verifică logs pentru erori

3. **În Supabase:**
   - Mergi la **Database** → **integrations** table
   - Verifică coloana `last_sync_at` - ar trebui să se actualizeze

### **Teste manuale:**

```bash
# Testează sync-scheduler direct:
curl -X POST "https://your-project.supabase.co/functions/v1/sync-scheduler" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## ⚠️ **Probleme frecvente:**

### **"No active integrations found"**
- ✅ Verifică că ai cel puțin o integrare cu status `active`
- ✅ Mergi la Settings → Integrations și adaugă/activează o integrare

### **"Sync failed" sau erori**
- ✅ Verifică credentials pentru integrare (API keys, tokens)
- ✅ Verifică că platforma (WooCommerce, Facebook) răspunde
- ✅ Vezi logs în GitHub Actions pentru detalii

### **Workflow-ul nu rulează**
- ✅ Verifică că ai adăugat secrets în GitHub
- ✅ Verifică că workflow-ul e activat (Settings → Actions → General)
- ✅ Primul run poate întârzia până la 5 minute

---

## 📊 **Monitorizare:**

### **Ce să monitorizezi:**

1. **GitHub Actions Runs:**
   - Success rate
   - Timpul de execuție
   - Erori frecvente

2. **Last Sync Times:**
   - În Settings → Integrations
   - Ar trebui actualizate regulat

3. **Integration Status:**
   - Active = totul OK ✅
   - Error = ceva nu merge ❌

---

## 💰 **Costuri:**

### **GitHub Actions:**
- ✅ **GRATUIT** pentru repository-uri publice
- ✅ **2000 minute/lună gratuite** pentru private repos
- ✅ Un run = ~5-10 secunde
- ✅ La fiecare 5 min = ~288 runs/zi = ~8640 runs/lună = ~1440 minute/lună
- ⚠️ Dacă repository-ul e privat, s-ar putea să depășești limita gratuită

### **Supabase:**
- ✅ Edge Functions: 500K invocations/lună (FREE tier)
- ✅ Sync-scheduler: ~12 calls/oră = ~288 calls/zi = ~8640 calls/lună
- ✅ Platforma sync functions: depinde de număr integrări
- ✅ Foarte probabil sub limita FREE

---

## 🎉 **Gata!**

După configurare, sincronizarea automată va rula la fiecare 5 minute și va menține datele tale up-to-date!

Pentru întrebări sau probleme, verifică logs în GitHub Actions sau contactează support.

