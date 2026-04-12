import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AppRole, Employee, Profile } from '@/types/hr';
import { buildApiUrl } from '@/config/api';

// Helper: decode JWT and extract roles
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1]));
    console.log('[AuthContext] JWT decoded:', decoded);
    return decoded;
  } catch (error) {
    console.error('[AuthContext] Failed to decode JWT:', error);
    return null;
  }
}

interface AuthUser {
  id: string;
  email: string;
  roles: AppRole[];
  employee: Employee | null;
  profile: Profile | null;
}

interface PermissionMap {
  isAdminLike: boolean;
  canViewDashboard: boolean;
  canRequestLeave: boolean;
  canViewProfile: boolean;
  canViewEmployees: boolean;
  canManageUsers: boolean;
  canManageOrgStructure: boolean;
  canManageLeavePolicies: boolean;
  canViewLeaveBalance: boolean;
  canViewHolidays: boolean;
  canManageHolidays: boolean;
  canApproveLeave: boolean;
  canViewReports: boolean;
  canManageSystemSettings: boolean;
  canCreateNotificationsForOthers: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  profile: Profile | null;
  employee: Employee | null;
  roles: AppRole[];
  permissions: PermissionMap;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: () => Promise<void>;
  signInWithOffice365: (email: string) => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: keyof PermissionMap) => boolean;
  isHROrAdmin: boolean;
  isManager: boolean;
  refreshProfile: () => Promise<void>;
  updateAvatarLocally: (avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultPermissions: PermissionMap = {
  isAdminLike: false,
  canViewDashboard: false,
  canRequestLeave: false,
  canViewProfile: false,
  canViewEmployees: false,
  canManageUsers: false,
  canManageOrgStructure: false,
  canManageLeavePolicies: false,
  canViewLeaveBalance: false,
  canViewHolidays: false,
  canManageHolidays: false,
  canApproveLeave: false,
  canViewReports: false,
  canManageSystemSettings: false,
  canCreateNotificationsForOthers: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionMap>(defaultPermissions);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const buildFallbackPermissions = (roleList: AppRole[]): PermissionMap => {
    const isAdminLike = roleList.includes('admin') || roleList.includes('ceo');
    const isHrLike = isAdminLike || roleList.includes('hr');
    const isApprover = isHrLike || roleList.includes('manager') || roleList.includes('supervisor');

    return {
      isAdminLike,
      canViewDashboard: true,
      canRequestLeave: true,
      canViewProfile: true,
      canViewEmployees: isApprover,
      canManageUsers: isHrLike,
      canManageOrgStructure: isHrLike,
      canManageLeavePolicies: isHrLike,
      canViewLeaveBalance: isHrLike,
      canViewHolidays: true,
      canManageHolidays: isHrLike,
      canApproveLeave: isApprover,
      canViewReports: isApprover,
      canManageSystemSettings: isAdminLike,
      canCreateNotificationsForOthers: isAdminLike || roleList.includes('hr') || roleList.includes('manager'),
    };
  };

  const fetchPermissions = async (authToken: string, roleList: AppRole[]) => {
    try {
      const response = await fetch(buildApiUrl('/auth/permissions'), {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setPermissions(buildFallbackPermissions(roleList));
        return;
      }

      const payload = await response.json();
      setPermissions({ ...defaultPermissions, ...(payload?.data?.permissions || {}) });
    } catch {
      setPermissions(buildFallbackPermissions(roleList));
    }
  };

  const setAuthData = (data: any, tokenToUse?: string) => {
    console.log('[AuthContext] setAuthData called with data:', data);
    
    if (!data || !data.user) {
      console.error('[AuthContext] Invalid data passed to setAuthData:', data);
      return;
    }

    const userData = data.user;
    const employeeData = userData.employee || null;
    
    // Build profile from different sources
    const profileData = userData.profile || (employeeData
      ? {
          id: employeeData.user_id || userData.id,
          email: userData.email || employeeData.email || '',
          first_name: employeeData.first_name || '',
          last_name: employeeData.last_name || '',
          avatar_url: employeeData.avatar_url || null,
        }
      : {
          id: userData.id,
          email: userData.email || '',
          first_name: '',
          last_name: '',
          avatar_url: null,
        });

    // Set user with all needed data
    const authUser: AuthUser = {
      id: userData.id,
      email: userData.email,
      roles: userData.roles || (userData.role ? [userData.role] : []),
      employee: employeeData,
      profile: profileData,
    };
    
    console.log('[AuthContext] Setting user:', authUser);
    setUser(authUser);
    
    // Extract roles
    let roles = userData.roles || (userData.role ? [userData.role] : []);
    
    if (roles.length === 0) {
      const effectiveToken = tokenToUse || token;
      if (effectiveToken) {
        const decoded = decodeJWT(effectiveToken);
        if (decoded?.roles && Array.isArray(decoded.roles)) {
          roles = decoded.roles;
          console.log('[AuthContext] Recovered roles from JWT:', roles);
        }
      }
    }
    
    const normalizedRoles = roles as AppRole[];
    setRoles(normalizedRoles);
    setEmployee(employeeData);
    setProfile(profileData);
    
    // Set permissions synchronously first so ProtectedRoute doesn't redirect
    // before the async fetchPermissions call completes (race condition on refresh)
    setPermissions(buildFallbackPermissions(normalizedRoles));

    const effectiveToken = tokenToUse || token;
    if (effectiveToken) {
      void fetchPermissions(effectiveToken, normalizedRoles);
    }
    
    console.log('[AuthContext] Auth data set successfully');
  };

  const refreshProfile = async () => {
    if (!token) {
      console.log('[AuthContext] No token, skipping refreshProfile');
      return;
    }
    try {
      console.log('[AuthContext] Refreshing profile from /auth/me');
      const res = await fetch(buildApiUrl('/auth/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        console.error('[AuthContext] /auth/me returned status:', res.status);
        if (res.status === 401) {
          console.log('[AuthContext] Token invalid (401), clearing auth');
          await signOut();
        }
        return;
      }

      const data = await res.json();
      console.log('[AuthContext] /api/v1/auth/me response:', data);
      setAuthData(data);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const syncOAuthUser = async (supabaseUserId: string) => {
    try {
      const res = await fetch(buildApiUrl(`/employees/user/${supabaseUserId}`));
      if (!res.ok) return;

      const employee = await res.json();
      const roleRes = await fetch(buildApiUrl(`/user_roles/user/${supabaseUserId}`));
      const roles = roleRes.ok ? await roleRes.json() : [];

      const oauthUser: AuthUser = {
        id: supabaseUserId,
        email: employee.email || '',
        roles,
        employee,
        profile: {
          id: employee.user_id || supabaseUserId,
          employee_id: employee.id || null,
          email: employee.email || null,
          first_name: employee.first_name || null,
          last_name: employee.last_name || null,
          avatar_url: employee.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      setUser(oauthUser);
      setRoles(roles);
      setPermissions(buildFallbackPermissions(roles as AppRole[]));
      setEmployee(employee);
      setProfile(oauthUser.profile);
    } catch (error) {
      console.error('Error syncing OAuth user:', error);
    }
  };

  useEffect(() => {
    // Initialize auth from localStorage on app mount
    const initializeAuth = async () => {
      try {
        const savedToken = localStorage.getItem('token');
        console.log('[AuthContext] Initializing auth, savedToken exists:', !!savedToken);
        
        if (!savedToken) {
          console.log('[AuthContext] No saved token, auth not initialized');
          setLoading(false);
          return;
        }

        // Fetch user profile with saved token
        console.log('[AuthContext] Fetching profile from /auth/me...');
        const res = await fetch(buildApiUrl('/auth/me'), {
          headers: {
            Authorization: `Bearer ${savedToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            console.log('[AuthContext] Token invalid (401), clearing auth');
            localStorage.removeItem('token');
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        console.log('[AuthContext] /api/v1/auth/me response:', data);
        
        // Verify user data exists
        if (!data.user || !data.user.id) {
          console.error('[AuthContext] Invalid response: no user data');
          setLoading(false);
          return;
        }

        // Update token state and auth data
        setToken(savedToken);
        setAuthData(data, savedToken);
        console.log('[AuthContext] Auth initialized successfully');
      } catch (error) {
        console.error('[AuthContext] Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Run only on mount

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] Signing in:', email);
    setLoading(true);
    
    try {
      const res = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log('[AuthContext] Login response:', data);
      
      if (!res.ok) {
        throw new Error(data?.error || 'Login failed');
      }

      // Extract token and user data from response
      const token = data.token ?? data.data?.token;
      
      // Store token immediately
      localStorage.setItem('token', token);
      console.log('[AuthContext] Token saved to localStorage');
      setToken(token);
      
      // Set auth data from login response, pass token directly
      const normalizedData = { token, user: data.user ?? data.data?.user };
      setAuthData(normalizedData, token);
      
      console.log('[AuthContext] Login successful');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const res = await fetch(buildApiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Signup failed');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setAuthData(data, data.token);
  };

  const signInWithOAuth = async () => {
    try {
      console.log('[AuthContext] Starting Azure AD OAuth...');

      // Mark OAuth start for diagnostics before redirecting to backend OAuth route.
      sessionStorage.setItem('azure-oauth-start', new Date().toISOString());
      const oauthStartUrl = buildApiUrl('/auth/microsoft');
      window.location.href = oauthStartUrl;
    } catch (error) {
      console.error('[AuthContext] signInWithOAuth error:', error);
      throw error;
    }
  };

  const signInWithOffice365 = async (email: string) => {
    const res = await fetch(buildApiUrl('/auth/office365-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Office365 login failed');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setAuthData(data, data.token);
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setRoles([]);
    setPermissions(defaultPermissions);
    setEmployee(null);
    setProfile(null);
  };

  const updateAvatarLocally = (avatarUrl: string | null) => {
    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
    setEmployee((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profile: prev.profile ? { ...prev.profile, avatar_url: avatarUrl } : prev.profile,
        employee: prev.employee ? { ...prev.employee, avatar_url: avatarUrl } : prev.employee,
      };
    });
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasPermission = (permission: keyof PermissionMap) => {
    // Business requirement: employee/hr/supervisor must always access leave request menu + page
    if (
      permission === 'canRequestLeave' &&
      (hasRole('employee') || hasRole('hr') || hasRole('supervisor'))
    ) {
      return true;
    }

    return Boolean(permissions[permission]);
  };
  const isHROrAdmin = permissions.canManageUsers || hasRole('hr');
  const isManager = permissions.canApproveLeave;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      profile,
      employee,
      roles,
      permissions,
      loading,
      signIn,
      signUp,
      signInWithOAuth,
      signInWithOffice365,
      signOut,
      hasRole,
      hasPermission,
      isHROrAdmin,
      isManager,
      refreshProfile,
      updateAvatarLocally,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
