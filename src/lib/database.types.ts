export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          email: string
          full_name: string
          role: 'super_admin' | 'manager' | 'specialist' | 'client' | 'freelancer'
          avatar_url: string | null
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          email: string
          full_name: string
          role?: 'super_admin' | 'manager' | 'specialist' | 'client' | 'freelancer'
          avatar_url?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          email?: string
          full_name?: string
          role?: 'super_admin' | 'manager' | 'specialist' | 'client' | 'freelancer'
          avatar_url?: string | null
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          logo_url: string | null
          website: string | null
          industry: string | null
          status: 'active' | 'inactive' | 'paused'
          settings: Json
          monthly_expenses: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          logo_url?: string | null
          website?: string | null
          industry?: string | null
          status?: 'active' | 'inactive' | 'paused'
          settings?: Json
          monthly_expenses?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          website?: string | null
          industry?: string | null
          status?: 'active' | 'inactive' | 'paused'
          settings?: Json
          monthly_expenses?: number
          created_at?: string
          updated_at?: string
        }
      }
      client_users: {
        Row: {
          id: string
          client_id: string
          user_id: string
          role: 'manager' | 'specialist' | 'client'
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          user_id: string
          role?: 'manager' | 'specialist' | 'client'
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          user_id?: string
          role?: 'manager' | 'specialist' | 'client'
          created_at?: string
        }
      }
      client_expenses: {
        Row: {
          id: string
          client_id: string
          category: string
          amount: number
          description: string | null
          is_recurring: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          category: string
          amount: number
          description?: string | null
          is_recurring?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          category?: string
          amount?: number
          description?: string | null
          is_recurring?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      agency_client_income: {
        Row: {
          id: string
          client_id: string
          amount: number
          currency: string
          category: string
          description: string | null
          invoice_number: string | null
          payment_date: string
          payment_method: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          amount: number
          currency?: string
          category: string
          description?: string | null
          invoice_number?: string | null
          payment_date: string
          payment_method?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          amount?: number
          currency?: string
          category?: string
          description?: string | null
          invoice_number?: string | null
          payment_date?: string
          payment_method?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      agency_client_expenses: {
        Row: {
          id: string
          client_id: string
          amount: number
          currency: string
          category: string
          description: string | null
          expense_date: string
          is_recurring: boolean
          recurring_period: string | null
          assigned_to_user_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          amount: number
          currency?: string
          category: string
          description?: string | null
          expense_date: string
          is_recurring?: boolean
          recurring_period?: string | null
          assigned_to_user_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          amount?: number
          currency?: string
          category?: string
          description?: string | null
          expense_date?: string
          is_recurring?: boolean
          recurring_period?: string | null
          assigned_to_user_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      integrations: {
        Row: {
          id: string
          client_id: string
          platform: 'facebook_ads' | 'google_analytics' | 'woocommerce' | 'mailerlite' | 'wordpress'
          status: 'active' | 'inactive' | 'error'
          credentials: Json
          config: Json
          last_sync_at: string | null
          sync_frequency: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          platform: 'facebook_ads' | 'google_analytics' | 'woocommerce' | 'mailerlite' | 'wordpress'
          status?: 'active' | 'inactive' | 'error'
          credentials?: Json
          config?: Json
          last_sync_at?: string | null
          sync_frequency?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          platform?: 'facebook_ads' | 'google_analytics' | 'woocommerce' | 'mailerlite' | 'wordpress'
          status?: 'active' | 'inactive' | 'error'
          credentials?: Json
          config?: Json
          last_sync_at?: string | null
          sync_frequency?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      metrics_snapshots: {
        Row: {
          id: string
          client_id: string
          integration_id: string
          platform: string
          metric_type: string
          date: string
          metrics: Json
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          integration_id: string
          platform: string
          metric_type: string
          date: string
          metrics: Json
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          integration_id?: string
          platform?: string
          metric_type?: string
          date?: string
          metrics?: Json
          created_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          client_id: string
          user_id: string | null
          type: 'budget' | 'performance' | 'integration_error' | 'goal_reached' | 'info'
          severity: 'info' | 'warning' | 'critical'
          title: string
          message: string
          is_read: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          user_id?: string | null
          type: 'budget' | 'performance' | 'integration_error' | 'goal_reached' | 'info'
          severity?: 'info' | 'warning' | 'critical'
          title: string
          message: string
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          user_id?: string | null
          type?: 'budget' | 'performance' | 'integration_error' | 'goal_reached' | 'info'
          severity?: 'info' | 'warning' | 'critical'
          title?: string
          message?: string
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          client_id: string
          created_by: string
          name: string
          type: 'custom' | 'template' | 'scheduled'
          config: Json
          schedule: Json | null
          last_generated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          created_by: string
          name: string
          type?: 'custom' | 'template' | 'scheduled'
          config: Json
          schedule?: Json | null
          last_generated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          created_by?: string
          name?: string
          type?: 'custom' | 'template' | 'scheduled'
          config?: Json
          schedule?: Json | null
          last_generated_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      report_shares: {
        Row: {
          id: string
          client_id: string
          token: string
          expires_at: string | null
          created_at: string
          last_accessed_at: string | null
          access_count: number
        }
        Insert: {
          id?: string
          client_id: string
          token: string
          expires_at?: string | null
          created_at?: string
          last_accessed_at?: string | null
          access_count?: number
        }
        Update: {
          id?: string
          client_id?: string
          token?: string
          expires_at?: string | null
          created_at?: string
          last_accessed_at?: string | null
          access_count?: number
        }
      }
      goals: {
        Row: {
          id: string
          client_id: string
          metric_type: 'revenue' | 'orders' | 'products' | 'conversions' | 'roas' | 'custom'
          target_value: number
          period: 'daily' | 'weekly' | 'monthly' | 'yearly'
          start_date: string
          end_date: string
          label: string | null
          description: string | null
          status: 'active' | 'completed' | 'failed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          metric_type: 'revenue' | 'orders' | 'products' | 'conversions' | 'roas' | 'custom'
          target_value: number
          period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
          start_date: string
          end_date: string
          label?: string | null
          description?: string | null
          status?: 'active' | 'completed' | 'failed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          metric_type?: 'revenue' | 'orders' | 'products' | 'conversions' | 'roas' | 'custom'
          target_value?: number
          period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
          start_date?: string
          end_date?: string
          label?: string | null
          description?: string | null
          status?: 'active' | 'completed' | 'failed' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
