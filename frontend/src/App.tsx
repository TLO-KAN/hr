import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import LeaveRequest from "./pages/LeaveRequest";
import LeaveApproval from "./pages/LeaveApproval";
import LeaveSettings from "./pages/LeaveSettings";
import LeaveBalanceDashboard from "./pages/LeaveBalanceDashboard";
import Holidays from "./pages/Holidays";
import Reports from "./pages/Reports";
import Departments from "./pages/Departments";
import Positions from "./pages/Positions";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import PermissionsDebug from "./pages/PermissionsDebug";
import NotFound from "./pages/NotFound";

type PermissionKey =
  | 'canViewDashboard'
  | 'canViewEmployees'
  | 'canRequestLeave'
  | 'canApproveLeave'
  | 'canManageLeavePolicies'
  | 'canViewLeaveBalance'
  | 'canManageHolidays'
  | 'canViewHolidays'
  | 'canViewReports'
  | 'canManageOrgStructure'
  | 'canManageSystemSettings'
  | 'canViewProfile';

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: PermissionKey }) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const authSearch = new URLSearchParams(location.search);
  const requestedRedirect = authSearch.get('redirect');
  const safeRedirect = requestedRedirect && requestedRedirect.startsWith('/') ? requestedRedirect : '/dashboard';
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to={safeRedirect} replace /> : <Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute requiredPermission="canViewDashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute requiredPermission="canViewEmployees"><Employees /></ProtectedRoute>} />
      <Route path="/leave/request" element={<ProtectedRoute requiredPermission="canRequestLeave"><LeaveRequest /></ProtectedRoute>} />
      <Route path="/leave/approval" element={<ProtectedRoute requiredPermission="canApproveLeave"><LeaveApproval /></ProtectedRoute>} />
      <Route path="/leave/settings" element={<ProtectedRoute requiredPermission="canManageLeavePolicies"><LeaveSettings /></ProtectedRoute>} />
      <Route path="/leave/balance" element={<ProtectedRoute requiredPermission="canViewLeaveBalance"><LeaveBalanceDashboard /></ProtectedRoute>} />
      <Route path="/holidays" element={<ProtectedRoute requiredPermission="canViewHolidays"><Holidays /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute requiredPermission="canViewReports"><Reports /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute requiredPermission="canManageOrgStructure"><Departments /></ProtectedRoute>} />
      <Route path="/positions" element={<ProtectedRoute requiredPermission="canManageOrgStructure"><Positions /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requiredPermission="canManageSystemSettings"><Settings /></ProtectedRoute>} />
      <Route path="/debug/permissions" element={<ProtectedRoute requiredPermission="canManageSystemSettings"><PermissionsDebug /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute requiredPermission="canViewProfile"><Profile /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
