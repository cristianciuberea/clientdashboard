import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, X, Receipt, FileText, Users as UsersIcon } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Income = Database['public']['Tables']['agency_client_income']['Row'];
type Expense = Database['public']['Tables']['agency_client_expenses']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type Period = 'this_month' | 'this_year' | 'lifetime' | 'custom';
type ViewMode = 'by_client' | 'by_team_member';

interface FinancialMetrics {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

interface TeamMemberStats {
  user: Profile;
  totalEarned: number;
  projectsCount: number;
  clients: string[];
}

export default function AgencyFinancePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState<Profile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('by_client');
  const [period, setPeriod] = useState<Period>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
  });
  
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (viewMode === 'by_client' && selectedClient) {
      fetchFinancialData();
    } else if (viewMode === 'by_team_member' && selectedTeamMember) {
      fetchTeamMemberData();
    }
  }, [selectedClient, selectedTeamMember, viewMode, period, customStartDate, customEndDate]);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'super_admin') {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .order('name');
        setClients(data || []);
        if (data && data.length > 0) setSelectedClient(data[0]);
      } else {
        const { data } = await supabase
          .from('client_users')
          .select('clients(*)')
          .eq('user_id', user.id)
          .eq('role', 'manager');
        
        const clientsList = data?.map((cu: any) => cu.clients).filter(Boolean) || [];
        setClients(clientsList);
        if (clientsList.length > 0) setSelectedClient(clientsList[0]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['manager', 'specialist', 'freelancer'])
        .order('full_name');
      
      setTeamMembers(data || []);
      if (data && data.length > 0 && !selectedTeamMember) {
        setSelectedTeamMember(data[0]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const getDateRange = (): { startDate: string; endDate: string } => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (period) {
      case 'this_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'this_year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'lifetime':
        startDate = new Date(2000, 0, 1);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return { startDate: '', endDate: '' };
        }
        return { startDate: customStartDate, endDate: customEndDate };
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const fetchFinancialData = async () => {
    if (!selectedClient) return;

    try {
      const { startDate, endDate } = getDateRange();
      if (!startDate || !endDate) return;

      const { data: incomeData } = await supabase
        .from('agency_client_income')
        .select('*')
        .eq('client_id', selectedClient.id)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      const { data: expensesData } = await supabase
        .from('agency_client_expenses')
        .select('*, profiles(full_name, email)')
        .eq('client_id', selectedClient.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      setIncome(incomeData || []);
      setExpenses(expensesData || []);

      const totalIncome = incomeData?.reduce((sum, i) => 
        i.status === 'received' ? sum + i.amount : sum, 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const netProfit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

      setMetrics({
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin,
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  };

  const fetchTeamMemberData = async () => {
    if (!selectedTeamMember) return;

    try {
      const { startDate, endDate } = getDateRange();
      if (!startDate || !endDate) return;

      // Fetch expenses where this team member was paid
      const { data: expensesData } = await supabase
        .from('agency_client_expenses')
        .select('*, clients(name)')
        .eq('assigned_to_user_id', selectedTeamMember.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      setExpenses(expensesData || []);
      setIncome([]);

      const totalEarned = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;

      setMetrics({
        totalIncome: 0,
        totalExpenses: totalEarned,
        netProfit: 0,
        profitMargin: 0,
      });
    } catch (error) {
      console.error('Error fetching team member data:', error);
    }
  };

  const handleAddIncome = async (formData: any) => {
    if (!selectedClient) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('agency_client_income')
        .insert({
          client_id: selectedClient.id,
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description || null,
          invoice_number: formData.invoice_number || null,
          payment_date: formData.payment_date,
          payment_method: formData.payment_method || null,
          status: formData.status,
          created_by: user?.id,
        });

      if (error) throw error;

      setShowAddIncome(false);
      await fetchFinancialData();
    } catch (error) {
      console.error('Error adding income:', error);
      alert('Eroare la adăugarea încasării');
    }
  };

  const handleAddExpense = async (formData: any) => {
    if (!selectedClient) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('agency_client_expenses')
        .insert({
          client_id: selectedClient.id,
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description || null,
          expense_date: formData.expense_date,
          is_recurring: formData.is_recurring,
          recurring_period: formData.is_recurring ? formData.recurring_period : null,
          assigned_to_user_id: formData.assigned_to_user_id || null,
          created_by: user?.id,
        });

      if (error) throw error;

      setShowAddExpense(false);
      await fetchFinancialData();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Eroare la adăugarea cheltuielii');
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('Sigur vrei să ștergi această încasare?')) return;

    try {
      const { error } = await supabase
        .from('agency_client_income')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchFinancialData();
    } catch (error) {
      console.error('Error deleting income:', error);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Sigur vrei să ștergi această cheltuială?')) return;

    try {
      const { error} = await supabase
        .from('agency_client_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchFinancialData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'this_month': return 'Luna Aceasta';
      case 'this_year': return 'Anul Acesta';
      case 'lifetime': return 'Lifetime';
      case 'custom': return 'Perioadă Custom';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-blue-600" />
              Agency Finance
            </h1>
            <p className="text-slate-600 mt-1">Urmărește încasările și cheltuielile pe client sau per membru al echipei</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('by_client')}
                className={`px-3 py-2 rounded-md transition text-sm font-medium ${
                  viewMode === 'by_client'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-4 h-4 inline mr-1" />
                Pe Client
              </button>
              <button
                onClick={() => setViewMode('by_team_member')}
                className={`px-3 py-2 rounded-md transition text-sm font-medium ${
                  viewMode === 'by_team_member'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <UsersIcon className="w-4 h-4 inline mr-1" />
                Per Membru
              </button>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('this_month')}
                className={`px-4 py-2 rounded-lg transition ${
                  period === 'this_month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Luna Aceasta
              </button>
              <button
                onClick={() => setPeriod('this_year')}
                className={`px-4 py-2 rounded-lg transition ${
                  period === 'this_year'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Anul Acesta
              </button>
              <button
                onClick={() => setPeriod('lifetime')}
                className={`px-4 py-2 rounded-lg transition ${
                  period === 'lifetime'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Lifetime
              </button>
            </div>

            {/* Selector (Client or Team Member) */}
            {viewMode === 'by_client' ? (
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setSelectedClient(client || null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedTeamMember?.id || ''}
                onChange={(e) => {
                  const member = teamMembers.find(m => m.id === e.target.value);
                  setSelectedTeamMember(member || null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} ({member.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {viewMode === 'by_client' && selectedClient && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Vizualizezi date pentru: <strong>{selectedClient.name}</strong> • {getPeriodLabel()}
            </p>
          </div>
        )}

        {viewMode === 'by_team_member' && selectedTeamMember && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-800">
              Vizualizezi câștiguri pentru: <strong>{selectedTeamMember.full_name}</strong> ({selectedTeamMember.role}) • {getPeriodLabel()}
            </p>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      {viewMode === 'by_client' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-700">Total Încasări</p>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-800">{metrics.totalIncome.toFixed(2)} RON</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-red-700">Total Cheltuieli</p>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-800">{metrics.totalExpenses.toFixed(2)} RON</p>
          </div>

          <div className={`bg-gradient-to-br border rounded-xl p-6 ${
            metrics.netProfit >= 0
              ? 'from-blue-50 to-blue-100 border-blue-200'
              : 'from-red-50 to-red-100 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-medium ${metrics.netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                Profit Net
              </p>
              <DollarSign className={`w-5 h-5 ${metrics.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
            </div>
            <p className={`text-3xl font-bold ${metrics.netProfit >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
              {metrics.netProfit.toFixed(2)} RON
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-purple-700">Marjă Profit</p>
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-800">{metrics.profitMargin.toFixed(1)}%</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-700">Total Câștigat</p>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-800">{metrics.totalExpenses.toFixed(2)} RON</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-purple-700">Nr. Proiecte</p>
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-800">{expenses.length}</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-700">Clienți Unici</p>
              <UsersIcon className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-800">
              {[...new Set(expenses.map(e => (e as any).clients?.name).filter(Boolean))].length}
            </p>
          </div>
        </div>
      )}

      {/* Income & Expenses Tables or Team Member Details */}
      {viewMode === 'by_client' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Încasări
                </h2>
                <button
                  onClick={() => setShowAddIncome(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Adaugă Încasare
                </button>
              </div>
            </div>

            <div className="p-6">
              {income.length > 0 ? (
                <div className="space-y-3">
                  {income.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-800">{item.category}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            item.status === 'received' 
                              ? 'bg-green-100 text-green-700'
                              : item.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-slate-600">{item.description}</p>
                        )}
                        {item.invoice_number && (
                          <p className="text-xs text-slate-500 mt-1">Factură: {item.invoice_number}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(item.payment_date).toLocaleDateString('ro-RO')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <p className="text-lg font-bold text-green-700 min-w-[100px] text-right">
                          {item.amount.toFixed(2)} RON
                        </p>
                        <button
                          onClick={() => handleDeleteIncome(item.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nu există încasări în această perioadă</p>
                </div>
              )}
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Cheltuieli
                </h2>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Adaugă Cheltuială
                </button>
              </div>
            </div>

            <div className="p-6">
              {expenses.length > 0 ? (
                <div className="space-y-3">
                  {expenses.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-800">{item.category}</p>
                          {item.is_recurring && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {item.recurring_period}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-slate-600">{item.description}</p>
                        )}
                        {item.profiles && (
                          <p className="text-xs text-blue-600 mt-1">
                            👤 {item.profiles.full_name}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(item.expense_date).toLocaleDateString('ro-RO')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <p className="text-lg font-bold text-red-700 min-w-[100px] text-right">
                          {item.amount.toFixed(2)} RON
                        </p>
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nu există cheltuieli în această perioadă</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Team Member View
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Plăți Primite
            </h2>
          </div>

          <div className="p-6">
            {expenses.length > 0 ? (
              <div className="space-y-3">
                {expenses.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-800">{item.category}</p>
                        {item.clients && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            {item.clients.name}
                          </span>
                        )}
                        {item.is_recurring && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {item.recurring_period}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600">{item.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(item.expense_date).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <p className="text-lg font-bold text-blue-700 min-w-[100px] text-right">
                        {item.amount.toFixed(2)} RON
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nu există plăți în această perioadă</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddIncome && (
        <AddIncomeModal
          onClose={() => setShowAddIncome(false)}
          onAdd={handleAddIncome}
        />
      )}

      {showAddExpense && selectedClient && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onAdd={handleAddExpense}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}

// Add Income Modal Component
function AddIncomeModal({ 
  onClose, 
  onAdd 
}: { 
  onClose: () => void; 
  onAdd: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    amount: '',
    category: 'monthly_retainer',
    description: '',
    invoice_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    status: 'received',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) {
      alert('Completează suma și categoria!');
      return;
    }
    
    setSubmitting(true);
    try {
      await onAdd(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Adaugă Încasare</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" type="button">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sumă (RON) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Plății *</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categorie *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="monthly_retainer">Abonament Lunar</option>
              <option value="project_fee">Proiect / Campanie</option>
              <option value="commission">Comision</option>
              <option value="bonus">Bonus</option>
              <option value="other">Altele</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Număr Factură</label>
            <input
              type="text"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: INV-2025-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Metodă Plată</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bank_transfer">Transfer Bancar</option>
                <option value="cash">Cash</option>
                <option value="paypal">PayPal</option>
                <option value="other">Altele</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="received">Încasat</option>
                <option value="pending">În Așteptare</option>
                <option value="cancelled">Anulat</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descriere</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Detalii suplimentare..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              disabled={submitting}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium disabled:bg-slate-300"
            >
              {submitting ? 'Se adaugă...' : 'Adaugă Încasare'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Expense Modal Component
function AddExpenseModal({ 
  onClose, 
  onAdd,
  teamMembers
}: { 
  onClose: () => void; 
  onAdd: (data: any) => Promise<void>;
  teamMembers: Profile[];
}) {
  const [formData, setFormData] = useState({
    amount: '',
    category: 'salaries',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    recurring_period: 'monthly',
    assigned_to_user_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) {
      alert('Completează suma și categoria!');
      return;
    }
    
    setSubmitting(true);
    try {
      await onAdd(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Adaugă Cheltuială</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" type="button">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sumă (RON) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categorie *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="salaries">Salarii Echipă</option>
              <option value="software">Software & Tools</option>
              <option value="ads_management">Management Ads</option>
              <option value="meetings">Întâlniri & Training</option>
              <option value="travel">Deplasări</option>
              <option value="other">Altele</option>
            </select>
          </div>

          {/* Assign to Team Member (for salaries or payments) */}
          {(formData.category === 'salaries' || formData.category === 'ads_management') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Atribuie la Membru (opțional)
              </label>
              <select
                value={formData.assigned_to_user_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Fără atribuire --</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} ({member.role})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Selectează membrul echipei care primește această plată pentru tracking individual
              </p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              Cheltuială Recurentă
            </label>
            {formData.is_recurring && (
              <select
                value={formData.recurring_period}
                onChange={(e) => setFormData({ ...formData, recurring_period: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="monthly">Lunar</option>
                <option value="quarterly">Trimestrial</option>
                <option value="yearly">Anual</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descriere</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Detalii suplimentare..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              disabled={submitting}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:bg-slate-300"
            >
              {submitting ? 'Se adaugă...' : 'Adaugă Cheltuială'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
