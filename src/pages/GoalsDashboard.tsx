import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Target, TrendingUp, TrendingDown, Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Goal = Database['public']['Tables']['goals']['Row'];

interface GoalWithProgress extends Goal {
  current_value: number;
  progress_percentage: number;
  is_on_track: boolean;
  days_remaining: number;
  daily_target: number;
  today_change: number;
  facebook_spend: number;
  roas: number;
  expected_progress: number;
  gross_profit: number;
  net_profit: number;
}

const metricLabels: Record<Goal['metric_type'], string> = {
  revenue: 'Revenue',
  orders: 'Orders',
  products: 'Products Sold',
  conversions: 'Conversions',
  roas: 'ROAS',
  custom: 'Custom Metric',
};

const metricIcons: Record<Goal['metric_type'], string> = {
  revenue: '💰',
  orders: '📦',
  products: '🛍️',
  conversions: '✅',
  roas: '📈',
  custom: '🎯',
};

const periodLabels: Record<Goal['period'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export default function GoalsDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
        .single();

      const isSuperAdmin = profile?.role === 'super_admin';

      let query = supabase
        .from('clients')
        .select('*')
        .eq('status', 'active');

      if (!isSuperAdmin) {
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('client_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');

        const clientIds = clientUsers?.map(cu => cu.client_id) || [];
        query = query.in('id', clientIds);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;

      setClients(data || []);
      if (data && data.length > 0 && !selectedClient) {
        setSelectedClient(data[0]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }, [selectedClient]);

  const fetchGoalsWithProgress = useCallback(async (clientId: string) => {
    try {
      setLoading(true);

      // Fetch client data for monthly expenses
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('monthly_expenses')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      const monthlyExpenses = clientData?.monthly_expenses || 0;

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      if (!goalsData || goalsData.length === 0) {
        setGoals([]);
        return;
      }

      // Fetch current metrics for the client
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const goalsWithProgress: GoalWithProgress[] = [];

      for (const goal of goalsData) {
        const startDate = new Date(goal.start_date);
        const endDate = new Date(goal.end_date);
        
        // Calculate current value based on metric type
        let currentValue = 0;
        let todayChange = 0;
        let facebookSpend = 0;
        let roas = 0;

        // Fetch snapshots for the goal period ONLY (avoids Supabase 1000-row limit)
        const { data: snapshots } = await supabase
          .from('metrics_snapshots')
          .select('*')
          .eq('client_id', clientId)
          .gte('date', goal.start_date)
          .lte('date', goal.end_date)
          .order('created_at', { ascending: false });

        if (snapshots && snapshots.length > 0) {
          // Group by date-platform to get latest snapshot per combination
          const latestByDatePlatform: Record<string, any> = {};
          snapshots.forEach(s => {
            const key = `${s.date}-${s.platform}`;
            if (!latestByDatePlatform[key] || new Date(s.created_at) > new Date(latestByDatePlatform[key].created_at)) {
              latestByDatePlatform[key] = s;
            }
          });

          const uniqueSnapshots = Object.values(latestByDatePlatform);

          // Check if we have aggregate snapshots for this period (for WooCommerce)
          const wooAggregateSnapshots = uniqueSnapshots.filter(
            s => s.platform === 'woocommerce' && (s as any).metric_type === 'ecommerce_aggregate'
          );
          
          // Daily WooCommerce/WordPress snapshots
          const wooDailySnapshots = uniqueSnapshots.filter(
            s => (s.platform === 'woocommerce' || s.platform === 'wordpress') && 
                 (s as any).metric_type !== 'ecommerce_aggregate'
          );

          // Facebook Ads snapshots
          const fbSnapshots = uniqueSnapshots.filter(s => s.platform === 'facebook_ads');

          // Calculate based on metric type
          switch (goal.metric_type) {
              case 'revenue': {
                // Try to use aggregate snapshot first for the period
                const aggregateSnapshot = wooAggregateSnapshots.find(s => s.date === goal.start_date);
                
                if (aggregateSnapshot && (aggregateSnapshot.metrics as any)?.totalRevenue) {
                  currentValue = (aggregateSnapshot.metrics as any).totalRevenue;
                } else {
                  // Fall back to summing daily snapshots
                  wooDailySnapshots.forEach(s => {
                    const revenue = (s.metrics as any)?.totalRevenue || 0;
                    currentValue += revenue;
                  });
                }

                // Today's change
                const todaySnapshots = wooDailySnapshots.filter(s => s.date === todayStr);
                todaySnapshots.forEach(s => {
                  todayChange += (s.metrics as any)?.totalRevenue || 0;
                });
                break;
              }
              
              case 'orders': {
                // Try aggregate first
                const aggregateSnapshot = wooAggregateSnapshots.find(s => s.date === goal.start_date);
                
                if (aggregateSnapshot && (aggregateSnapshot.metrics as any)?.totalOrders) {
                  currentValue = (aggregateSnapshot.metrics as any).totalOrders;
                } else {
                  // Sum daily
                  wooDailySnapshots.forEach(s => {
                    currentValue += (s.metrics as any)?.totalOrders || 0;
                  });
                }

                // Today's orders
                const todaySnapshots = wooDailySnapshots.filter(s => s.date === todayStr);
                todaySnapshots.forEach(s => {
                  todayChange += (s.metrics as any)?.totalOrders || 0;
                });
                break;
              }

              case 'products': {
                // Take max from any snapshot (unique products)
                wooDailySnapshots.forEach(s => {
                  const products = (s.metrics as any)?.totalProducts || 0;
                  if (products > currentValue) currentValue = products;
                });

                const todaySnapshots = wooDailySnapshots.filter(s => s.date === todayStr);
                todaySnapshots.forEach(s => {
                  const products = (s.metrics as any)?.totalProducts || 0;
                  if (products > todayChange) todayChange = products;
                });
                break;
              }

              case 'conversions': {
                // Sum Facebook conversions
                fbSnapshots.forEach(s => {
                  currentValue += (s.metrics as any)?.conversions || 0;
                });

                const todayFb = fbSnapshots.filter(s => s.date === todayStr);
                todayFb.forEach(s => {
                  todayChange += (s.metrics as any)?.conversions || 0;
                });
                break;
              }

              case 'roas': {
                // Calculate ROAS from all data
                let totalSpend = 0;
                let totalRevenue = 0;

                fbSnapshots.forEach(s => {
                  totalSpend += (s.metrics as any)?.spend || 0;
                });

                wooDailySnapshots.forEach(s => {
                  totalRevenue += (s.metrics as any)?.totalRevenue || 0;
                });

                currentValue = totalSpend > 0 ? totalRevenue / totalSpend : 0;
                break;
              }
            }

          // Calculate Facebook Spend (for all goals)
          fbSnapshots.forEach(s => {
            const metrics = (s.metrics as any);
            facebookSpend += metrics?.spend || 0;
          });

          // Calculate ROAS (Return on Ad Spend) - for all goals
          roas = facebookSpend > 0 ? currentValue / facebookSpend : 0;
        }

        // Calculate progress
        const progressPercentage = goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0;
        
        // Calculate days remaining
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Calculate daily target needed
        const remaining = Math.max(0, goal.target_value - currentValue);
        const dailyTarget = daysRemaining > 0 ? remaining / daysRemaining : 0;
        
        // Check if on track
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const expectedProgress = daysPassed > 0 ? (daysPassed / totalDays) * 100 : 0;
        const isOnTrack = progressPercentage >= expectedProgress * 0.9; // 90% tolerance

        // Calculate profit metrics
        const grossProfit = currentValue - facebookSpend; // Revenue - Ad Costs
        const netProfit = grossProfit - monthlyExpenses;  // Gross Profit - Fixed Expenses

        goalsWithProgress.push({
          ...goal,
          current_value: currentValue,
          progress_percentage: progressPercentage,
          is_on_track: isOnTrack,
          days_remaining: daysRemaining,
          daily_target: dailyTarget,
          today_change: todayChange,
          facebook_spend: facebookSpend,
          roas: roas,
          expected_progress: expectedProgress,
          gross_profit: grossProfit,
          net_profit: netProfit,
        });
      }

      setGoals(goalsWithProgress);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchGoalsWithProgress(selectedClient.id);
    }
  }, [selectedClient, fetchGoalsWithProgress]);

  const formatValue = (value: number, metricType: Goal['metric_type']) => {
    switch (metricType) {
      case 'revenue':
        return `${value.toFixed(2)} RON`;
      case 'orders':
      case 'products':
      case 'conversions':
        return Math.round(value).toString();
      case 'roas':
        return `${value.toFixed(2)}x`;
      default:
        return value.toFixed(2);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      if (selectedClient) {
        fetchGoalsWithProgress(selectedClient.id);
      }
    } catch (error: any) {
      console.error('Error deleting goal:', error);
      alert(`Failed to delete goal: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Goals Dashboard</h1>
            <p className="text-sm text-slate-600">Track your objectives and progress</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddGoal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add Goal</span>
            </button>

            {clients.length > 1 && (
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setSelectedClient(client || null);
                }}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedClient && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Viewing goals for:</span> {selectedClient.name}
            </p>
          </div>
        )}

        {goals.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Target className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No active goals</h3>
            <p className="text-sm text-slate-600 mb-4">Set your first goal to start tracking progress</p>
            <button
              onClick={() => setShowAddGoal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add Goal</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className={`bg-white rounded-xl border-2 p-6 transition ${
                  goal.progress_percentage >= 100
                    ? 'border-green-400 bg-green-50'
                    : goal.is_on_track
                    ? 'border-blue-300'
                    : 'border-orange-300 bg-orange-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-4xl">{metricIcons[goal.metric_type]}</div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">
                        {goal.label || metricLabels[goal.metric_type]} Goal
                      </h3>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {periodLabels[goal.period]}
                        </span>
                        <span className="text-xs text-slate-500">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {new Date(goal.start_date).toLocaleDateString()} - {new Date(goal.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                      title="Edit Goal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {goal.description && (
                  <p className="text-sm text-slate-600 mb-4">{goal.description}</p>
                )}

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-slate-800">
                        {formatValue(goal.current_value, goal.metric_type)}
                      </span>
                      <span className="text-lg text-slate-400">/</span>
                      <span className="text-lg font-semibold text-slate-600">
                        {formatValue(goal.target_value, goal.metric_type)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        goal.progress_percentage >= 100 ? 'text-green-600' :
                        goal.progress_percentage >= 50 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {goal.progress_percentage.toFixed(1)}%
                      </div>
                      <div className={`flex items-center text-xs font-medium ${
                        goal.progress_percentage >= 100 ? 'text-green-600' :
                        goal.progress_percentage >= 50 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {goal.progress_percentage >= 100 ? 'Completat' : 'Progres'}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Progress Bar with Milestones */}
                  <div className="w-full relative">
                    {/* Progress Bar Background */}
                    <div className="w-full bg-slate-200 rounded-full h-3 relative overflow-visible">
                      {/* Milestone markers at 25%, 50%, 75% */}
                      {[25, 50, 75].map((milestone) => (
                        <div
                          key={milestone}
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                          style={{ left: `${milestone}%` }}
                        >
                          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 font-medium">
                            {milestone}%
                          </div>
                        </div>
                      ))}

                      {/* Expected Progress Indicator (where you should be) */}
                      {goal.expected_progress > 0 && goal.expected_progress < 100 && (
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 z-10"
                          style={{ left: `${Math.min(goal.expected_progress, 100)}%` }}
                        >
                          <div className="relative">
                            <div className="w-1 h-6 bg-slate-600 rounded-full shadow-lg" />
                            <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                              <div className="bg-slate-700 text-white text-xs px-2 py-0.5 rounded shadow-lg">
                                Expected: {goal.expected_progress.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actual Progress Bar */}
                      <div
                        className={`h-3 rounded-full transition-all duration-500 relative ${
                          goal.progress_percentage >= 100
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : goal.progress_percentage >= goal.expected_progress
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                            : 'bg-gradient-to-r from-orange-500 to-orange-600'
                        }`}
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      />
                    </div>
                    
                    {/* Progress vs Expected Label */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="text-slate-600">
                        Actual: <span className="font-semibold">{goal.progress_percentage.toFixed(1)}%</span>
                      </div>
                      <div className={`font-semibold ${
                        goal.progress_percentage >= goal.expected_progress 
                          ? 'text-blue-600' 
                          : 'text-orange-600'
                      }`}>
                        {goal.progress_percentage >= goal.expected_progress ? '✓ Ahead' : '⚠ Behind'} by {Math.abs(goal.progress_percentage - goal.expected_progress).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Days Remaining</p>
                    <p className="text-lg font-bold text-slate-800">{goal.days_remaining}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Daily Target Needed</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatValue(goal.daily_target, goal.metric_type)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-slate-600 mb-1">Today's Progress</p>
                    <p className="text-lg font-bold text-blue-700">
                      {goal.today_change > 0 ? '+' : ''}{formatValue(goal.today_change, goal.metric_type)}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-1">Remaining</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatValue(Math.max(0, goal.target_value - goal.current_value), goal.metric_type)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs text-slate-600 mb-1">Facebook Spend</p>
                    <p className="text-lg font-bold text-purple-700">
                      {goal.facebook_spend.toFixed(2)} RON
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-slate-600 mb-1">ROAS</p>
                    <p className="text-lg font-bold text-green-700">
                      {goal.roas.toFixed(2)}x
                    </p>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-200">
                    <p className="text-xs text-slate-600 mb-1">Profit Brut</p>
                    <p className={`text-lg font-bold ${
                      goal.gross_profit >= 0 ? 'text-cyan-700' : 'text-red-600'
                    }`}>
                      {goal.gross_profit.toFixed(2)} RON
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <p className="text-xs text-slate-600 mb-1">Profit Net</p>
                    <p className={`text-lg font-bold ${
                      goal.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {goal.net_profit.toFixed(2)} RON
                    </p>
                  </div>
                </div>

                {/* Completion message */}
                {goal.progress_percentage >= 100 && (
                  <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                    <p className="text-sm font-semibold text-green-800">
                      🎉 Goal completed! You've reached {goal.progress_percentage.toFixed(1)}% of your target!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Goal Modal */}
      {(showAddGoal || editingGoal) && selectedClient && (
        <GoalModal
          client={selectedClient}
          goal={editingGoal}
          onClose={() => {
            setShowAddGoal(false);
            setEditingGoal(null);
          }}
          onSuccess={() => {
            setShowAddGoal(false);
            setEditingGoal(null);
            if (selectedClient) {
              fetchGoalsWithProgress(selectedClient.id);
            }
          }}
        />
      )}
    </div>
  );
}

// Goal Modal Component
function GoalModal({ 
  client, 
  goal, 
  onClose, 
  onSuccess 
}: { 
  client: Client; 
  goal: Goal | null; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    metric_type: (goal?.metric_type || 'revenue') as Goal['metric_type'],
    target_value: goal?.target_value || 0,
    period: (goal?.period || 'monthly') as Goal['period'],
    start_date: goal?.start_date || new Date().toISOString().split('T')[0],
    end_date: goal?.end_date || (() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date.toISOString().split('T')[0];
    })(),
    label: goal?.label || '',
    description: goal?.description || '',
  });

  const handleSubmit = async () => {
    try {
      if (!formData.target_value || formData.target_value <= 0) {
        alert('Please enter a valid target value');
        return;
      }

      if (new Date(formData.end_date) <= new Date(formData.start_date)) {
        alert('End date must be after start date');
        return;
      }

      const dataToSave = {
        client_id: client.id,
        metric_type: formData.metric_type,
        target_value: formData.target_value,
        period: formData.period,
        start_date: formData.start_date,
        end_date: formData.end_date,
        label: formData.label || null,
        description: formData.description || null,
        status: 'active' as const,
      };

      if (goal) {
        // Update existing goal
        const { error } = await supabase
          .from('goals')
          .update(dataToSave)
          .eq('id', goal.id);

        if (error) throw error;
        alert('Goal updated successfully!');
      } else {
        // Create new goal
        const { error } = await supabase
          .from('goals')
          .insert(dataToSave);

        if (error) throw error;
        alert('Goal created successfully!');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving goal:', error);
      alert(`Failed to save goal: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {goal ? 'Edit Goal' : 'Add New Goal'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Metric Type
            </label>
            <select
              value={formData.metric_type}
              onChange={(e) => setFormData({ ...formData, metric_type: e.target.value as Goal['metric_type'] })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="revenue">💰 Revenue</option>
              <option value="orders">📦 Orders</option>
              <option value="products">🛍️ Products Sold</option>
              <option value="conversions">✅ Conversions</option>
              <option value="roas">📈 ROAS</option>
              <option value="custom">🎯 Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Target Value
            </label>
            <input
              type="number"
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter target value"
              min="0"
              step={formData.metric_type === 'revenue' ? '0.01' : '1'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Period
            </label>
            <select
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value as Goal['period'] })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Label (Optional)
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Q4 Revenue Target"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe this goal..."
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
          >
            {goal ? 'Update Goal' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

