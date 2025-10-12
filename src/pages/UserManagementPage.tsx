import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, Edit2, Trash2, Shield, UserCheck, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type ClientUser = Database['public']['Tables']['client_users']['Row'];

interface UserWithClients extends Profile {
  assigned_clients: Array<{
    client_id: string;
    client_name: string;
    role: 'manager' | 'specialist' | 'client';
  }>;
}

const roleLabels: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  specialist: 'Specialist',
  client: 'Client',
};

const roleDescriptions: Record<Profile['role'], string> = {
  super_admin: 'Acces complet la toate setările și clienții',
  manager: 'Acces la clienții alocați cu drepturi de management',
  specialist: 'Acces la clienții alocați pentru vizualizare și lucru',
  client: 'Acces doar la dashboard-ul propriu',
};

const roleColors: Record<Profile['role'], string> = {
  super_admin: 'bg-red-100 text-red-700 border-red-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  specialist: 'bg-green-100 text-green-700 border-green-200',
  client: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserWithClients[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithClients | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'specialist' as Profile['role'],
    password: '',
  });

  // Client assignment state
  const [assignedClients, setAssignedClients] = useState<{
    [clientId: string]: 'manager' | 'specialist' | 'client' | null;
  }>({});

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch client assignments
      const { data: clientUsers, error: clientUsersError } = await supabase
        .from('client_users')
        .select(`
          user_id,
          client_id,
          role,
          clients (
            id,
            name
          )
        `);

      if (clientUsersError) throw clientUsersError;

      // Combine data
      const usersWithClients: UserWithClients[] = (profiles || []).map(profile => ({
        ...profile,
        assigned_clients: (clientUsers || [])
          .filter((cu: any) => cu.user_id === profile.id)
          .map((cu: any) => ({
            client_id: cu.client_id,
            client_name: cu.clients?.name || 'Unknown',
            role: cu.role,
          })),
      }));

      setUsers(usersWithClients);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      alert(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleAddUser = async () => {
    try {
      if (!formData.email || !formData.full_name || !formData.password) {
        alert('Please fill in all required fields');
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          preferences: {},
        });

      if (profileError) throw profileError;

      alert('User created successfully!');
      setShowAddModal(false);
      setFormData({ email: '', full_name: '', role: 'specialist', password: '' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      alert('User updated successfully!');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(`Failed to update user: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete client assignments first
      const { error: clientUsersError } = await supabase
        .from('client_users')
        .delete()
        .eq('user_id', userId);

      if (clientUsersError) throw clientUsersError;

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Note: Auth user deletion requires admin API call
      // For now, we just soft-delete the profile

      alert('User deleted successfully!');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error.message}`);
    }
  };

  const handleOpenAssignModal = (user: UserWithClients) => {
    setSelectedUser(user);
    
    // Build assigned clients map
    const assigned: { [clientId: string]: 'manager' | 'specialist' | 'client' | null } = {};
    user.assigned_clients.forEach(ac => {
      assigned[ac.client_id] = ac.role;
    });
    
    setAssignedClients(assigned);
    setShowAssignModal(true);
  };

  const handleSaveClientAssignments = async () => {
    if (!selectedUser) return;

    try {
      // Get current assignments
      const currentAssignments = selectedUser.assigned_clients.map(ac => ac.client_id);

      // Determine what to add and remove
      const toAdd: Array<{ client_id: string; role: 'manager' | 'specialist' | 'client' }> = [];
      const toUpdate: Array<{ client_id: string; role: 'manager' | 'specialist' | 'client' }> = [];
      const toRemove: string[] = [];

      // Check each client
      Object.entries(assignedClients).forEach(([clientId, role]) => {
        const wasAssigned = currentAssignments.includes(clientId);
        
        if (role) {
          if (wasAssigned) {
            // Check if role changed
            const currentRole = selectedUser.assigned_clients.find(ac => ac.client_id === clientId)?.role;
            if (currentRole !== role) {
              toUpdate.push({ client_id: clientId, role });
            }
          } else {
            toAdd.push({ client_id: clientId, role });
          }
        } else if (wasAssigned) {
          toRemove.push(clientId);
        }
      });

      // Check for removed assignments
      currentAssignments.forEach(clientId => {
        if (!assignedClients[clientId]) {
          toRemove.push(clientId);
        }
      });

      // Execute changes
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('client_users')
          .delete()
          .eq('user_id', selectedUser.id)
          .in('client_id', toRemove);

        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('client_users')
          .insert(
            toAdd.map(({ client_id, role }) => ({
              user_id: selectedUser.id,
              client_id,
              role,
            }))
          );

        if (error) throw error;
      }

      if (toUpdate.length > 0) {
        // Update one by one (Supabase doesn't support batch update with different values)
        for (const { client_id, role } of toUpdate) {
          const { error } = await supabase
            .from('client_users')
            .update({ role })
            .eq('user_id', selectedUser.id)
            .eq('client_id', client_id);

          if (error) throw error;
        }
      }

      alert('Client assignments updated successfully!');
      setShowAssignModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating client assignments:', error);
      alert(`Failed to update assignments: ${error.message}`);
    }
  };

  const handleEditUser = (user: UserWithClients) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">User Management</h1>
            <p className="text-sm text-slate-600">Manage users, roles, and client access</p>
          </div>

          <button
            onClick={() => {
              setFormData({ email: '', full_name: '', role: 'specialist', password: '' });
              setShowAddModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Assigned Clients
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-slate-800">{user.full_name}</div>
                      <div className="text-sm text-slate-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${roleColors[user.role]}`}>
                      <Shield className="w-3 h-3" />
                      <span>{roleLabels[user.role]}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'super_admin' ? (
                      <span className="text-sm text-slate-500 italic">All clients</span>
                    ) : user.assigned_clients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.assigned_clients.slice(0, 2).map((ac) => (
                          <span
                            key={ac.client_id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            {ac.client_name}
                          </span>
                        ))}
                        {user.assigned_clients.length > 2 && (
                          <span className="text-xs text-slate-500">
                            +{user.assigned_clients.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">No clients assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {user.role !== 'super_admin' && (
                        <button
                          onClick={() => handleOpenAssignModal(user)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                          title="Assign Clients"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium">No users found</p>
              <p className="text-sm text-slate-400 mt-1">Create your first user to get started</p>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Add New User</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role *
                  </label>
                  <div className="space-y-2">
                    {(['super_admin', 'manager', 'specialist', 'client'] as const).map((role) => (
                      <label
                        key={role}
                        className={`flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                          formData.role === role
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={formData.role === role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as Profile['role'] })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{roleLabels[role]}</div>
                          <div className="text-xs text-slate-500">{roleDescriptions[role]}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role *
                  </label>
                  <div className="space-y-2">
                    {(['super_admin', 'manager', 'specialist', 'client'] as const).map((role) => (
                      <label
                        key={role}
                        className={`flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                          formData.role === role
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={formData.role === role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as Profile['role'] })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{roleLabels[role]}</div>
                          <div className="text-xs text-slate-500">{roleDescriptions[role]}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Clients Modal */}
        {showAssignModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Assign Clients</h2>
                  <p className="text-sm text-slate-600">{selectedUser.full_name}</p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {clients.map((client) => {
                  const currentRole = assignedClients[client.id];
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{client.name}</div>
                        <div className="text-xs text-slate-500">{client.slug}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <select
                          value={currentRole || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAssignedClients({
                              ...assignedClients,
                              [client.id]: value ? (value as 'manager' | 'specialist' | 'client') : null,
                            });
                          }}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Not assigned</option>
                          <option value="manager">Manager</option>
                          <option value="specialist">Specialist</option>
                          <option value="client">Client</option>
                        </select>
                      </div>
                    </div>
                  );
                })}

                {clients.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No clients available
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClientAssignments}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Save Assignments
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

