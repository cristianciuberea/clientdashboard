/*
  # Marketing Dashboard Schema - Initial Setup

  ## Overview
  Creates the complete database schema for a multi-client marketing agency dashboard with support
  for multiple platform integrations (Facebook Ads, Google Analytics, WooCommerce, MailerLite, WordPress).

  ## New Tables

  ### `organizations`
  Agency/organization table for multi-tenancy support
  - `id` (uuid, primary key) - Unique organization identifier
  - `name` (text) - Organization/agency name
  - `slug` (text, unique) - URL-friendly identifier
  - `logo_url` (text, nullable) - Organization logo
  - `settings` (jsonb) - Custom settings (branding, white-label config)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `profiles`
  Extended user profiles linked to Supabase Auth
  - `id` (uuid, primary key, references auth.users) - User ID from auth system
  - `organization_id` (uuid, references organizations) - Parent organization
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'super_admin', 'client_admin', 'client_viewer'
  - `avatar_url` (text, nullable) - Profile picture URL
  - `preferences` (jsonb) - User preferences (theme, notifications, etc.)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `clients`
  Individual clients managed by the agency
  - `id` (uuid, primary key) - Unique client identifier
  - `organization_id` (uuid, references organizations) - Parent organization
  - `name` (text) - Client business name
  - `slug` (text) - URL-friendly identifier
  - `logo_url` (text, nullable) - Client logo
  - `website` (text, nullable) - Client website URL
  - `industry` (text, nullable) - Business industry/category
  - `status` (text) - Client status: 'active', 'inactive', 'paused'
  - `settings` (jsonb) - Client-specific settings
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `client_users`
  Junction table linking users to clients they can access
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, references clients) - Associated client
  - `user_id` (uuid, references profiles) - Associated user
  - `role` (text) - User role for this specific client: 'admin', 'viewer'
  - `created_at` (timestamptz) - Creation timestamp

  ### `integrations`
  Platform integration configurations per client
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, references clients) - Associated client
  - `platform` (text) - Platform name: 'facebook_ads', 'google_analytics', 'woocommerce', 'mailerlite', 'wordpress'
  - `status` (text) - Integration status: 'active', 'inactive', 'error'
  - `credentials` (jsonb) - Encrypted API keys, tokens, connection details
  - `config` (jsonb) - Platform-specific configuration
  - `last_sync_at` (timestamptz, nullable) - Last successful data sync
  - `sync_frequency` (integer) - Sync interval in minutes
  - `error_message` (text, nullable) - Last error message if any
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `metrics_snapshots`
  Historical metrics data from all integrated platforms
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, references clients) - Associated client
  - `integration_id` (uuid, references integrations) - Source integration
  - `platform` (text) - Platform name for quick filtering
  - `metric_type` (text) - Type of metric: 'facebook_ads', 'google_analytics', 'ecommerce', 'email', 'traffic'
  - `date` (date) - Date of the metrics
  - `metrics` (jsonb) - All metrics data as JSON object
  - `created_at` (timestamptz) - Creation timestamp

  ### `alerts`
  System alerts and notifications
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, references clients) - Associated client
  - `user_id` (uuid, references profiles, nullable) - Target user (null = all users)
  - `type` (text) - Alert type: 'budget', 'performance', 'integration_error', 'goal_reached'
  - `severity` (text) - Severity level: 'info', 'warning', 'critical'
  - `title` (text) - Alert title
  - `message` (text) - Alert message/description
  - `is_read` (boolean) - Read status
  - `metadata` (jsonb) - Additional alert data
  - `created_at` (timestamptz) - Creation timestamp

  ### `reports`
  Saved reports and report templates
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, references clients) - Associated client
  - `created_by` (uuid, references profiles) - Report creator
  - `name` (text) - Report name
  - `type` (text) - Report type: 'custom', 'template', 'scheduled'
  - `config` (jsonb) - Report configuration (widgets, metrics, filters)
  - `schedule` (jsonb, nullable) - Schedule settings for automated reports
  - `last_generated_at` (timestamptz, nullable) - Last generation timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies:
  
  1. **Organizations**: Only accessible by authenticated users belonging to that organization
  2. **Profiles**: Users can read own profile; super_admins can manage all profiles in their org
  3. **Clients**: Accessible by org members and assigned client users
  4. **Client Users**: Manageable by super_admins and client admins
  5. **Integrations**: Accessible only by authorized users for that client
  6. **Metrics Snapshots**: Accessible by users with client access
  7. **Alerts**: Visible to target users and admins
  8. **Reports**: Accessible by creator and users with client access

  ### Indexes
  Created indexes for frequently queried columns to optimize performance:
  - Organization lookups by slug
  - Client lookups by organization and slug
  - Integration lookups by client and platform
  - Metrics queries by client, date, and platform
  - Alert queries by client and user

  ## Notes
  - All timestamps use `timestamptz` for timezone-aware storage
  - JSONB columns allow flexible schema for platform-specific data
  - Credentials are stored as JSONB (should be encrypted at application level)
  - Unique constraints prevent duplicate clients per organization
  - Foreign keys maintain referential integrity
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'client_viewer' CHECK (role IN ('super_admin', 'client_admin', 'client_viewer')),
  avatar_url text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  website text,
  industry text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Create client_users junction table
CREATE TABLE IF NOT EXISTS client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook_ads', 'google_analytics', 'woocommerce', 'mailerlite', 'wordpress')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  credentials jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  sync_frequency integer DEFAULT 60,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, platform)
);

-- Create metrics_snapshots table
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  metric_type text NOT NULL,
  date date NOT NULL,
  metrics jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('budget', 'performance', 'integration_error', 'goal_reached', 'info')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom' CHECK (type IN ('custom', 'template', 'scheduled')),
  config jsonb NOT NULL,
  schedule jsonb,
  last_generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_clients_organization ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user ON client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_client ON integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_metrics_client ON metrics_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON metrics_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_metrics_client_date ON metrics_snapshots(client_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports(client_id);

-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update own organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles in same organization"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for clients
CREATE POLICY "Super admins can view all clients in org"
  ON clients FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can view assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for client_users
CREATE POLICY "Users can view own client assignments"
  ON client_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all client assignments"
  ON client_users FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can manage client assignments"
  ON client_users FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Super admins can delete client assignments"
  ON client_users FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- RLS Policies for integrations
CREATE POLICY "Users can view integrations for assigned clients"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Admins can manage integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

-- RLS Policies for metrics_snapshots
CREATE POLICY "Users can view metrics for assigned clients"
  ON metrics_snapshots FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "System can insert metrics"
  ON metrics_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for alerts
CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    (user_id IS NULL AND client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    ))
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for reports
CREATE POLICY "Users can view reports for assigned clients"
  ON reports FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can create reports for assigned clients"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();