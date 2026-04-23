import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  Building2,
  Briefcase,
  CalendarCog,
  Calendar,
  UserCircle,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsCompactLayout } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ThemeToggle';
import { resolveAssetUrl } from '@/config/api';

type PermissionKey =
  | 'canViewDashboard'
  | 'canViewEmployees'
  | 'canRequestLeave'
  | 'canApproveLeave'
  | 'canViewLeaveBalance'
  | 'canManageLeavePolicies'
  | 'canManageHolidays'
  | 'canViewHolidays'
  | 'canViewReports'
  | 'canManageOrgStructure'
  | 'canManageSystemSettings'
  | 'canViewProfile';

const menuItems = [
  { icon: LayoutDashboard, label: 'แดชบอร์ด', path: '/dashboard', permission: 'canViewDashboard' as PermissionKey },
  { icon: Users, label: 'ข้อมูลพนักงาน', path: '/employees', permission: 'canViewEmployees' as PermissionKey },
  { icon: CalendarDays, label: 'ขอลางาน', path: '/leave/request', permission: 'canRequestLeave' as PermissionKey },
  { icon: ClipboardCheck, label: 'อนุมัติการลา', path: '/leave/approval', permission: 'canApproveLeave' as PermissionKey },
  { icon: FileText, label: 'สรุปยอดวันลา', path: '/leave/balance', permission: 'canViewLeaveBalance' as PermissionKey },
  { icon: CalendarCog, label: 'ตั้งค่าสิทธิ์การลา', path: '/leave/settings', permission: 'canManageLeavePolicies' as PermissionKey },
  { icon: Calendar, label: 'วันหยุดประจำปี', path: '/holidays', permission: 'canViewHolidays' as PermissionKey },
  { icon: FileText, label: 'รายงาน', path: '/reports', permission: 'canViewReports' as PermissionKey },
  { icon: Building2, label: 'แผนก', path: '/departments', permission: 'canManageOrgStructure' as PermissionKey },
  { icon: Briefcase, label: 'ตำแหน่ง', path: '/positions', permission: 'canManageOrgStructure' as PermissionKey },
  { icon: UserCircle, label: 'โปรไฟล์ของฉัน', path: '/profile', permission: 'canViewProfile' as PermissionKey },
  { icon: Settings, label: 'ตั้งค่า', path: '/settings', permission: 'canManageSystemSettings' as PermissionKey },
  { icon: ShieldCheck, label: 'Debug สิทธิ์', path: '/debug/permissions', permission: 'canManageSystemSettings' as PermissionKey },
];

export const SIDEBAR_EXPANDED_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 80;

interface SidebarContentProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  onLinkClick?: () => void;
  isMobileView?: boolean;
}

function SidebarContent({ collapsed, setCollapsed, onLinkClick, isMobileView }: SidebarContentProps) {
  const location = useLocation();
  const { profile, roles, signOut, employee, hasPermission } = useAuth();

  console.log('[Sidebar] Current roles:', roles);
  console.log('[Sidebar] Current user:', profile);

  const filteredMenuItems = menuItems.filter(item => hasPermission(item.permission));

  console.log('[Sidebar] Filtered menu items:', filteredMenuItems.length, 'out of', menuItems.length);

  const displayName = employee 
    ? `${employee.first_name} ${employee.last_name}`
    : profile?.first_name 
      ? `${profile.first_name} ${profile.last_name || ''}`
      : profile?.email || 'ผู้ใช้';

  const employeeAvatarUrl = employee && 'avatar_url' in employee
    ? (employee as { avatar_url?: string | null }).avatar_url
    : null;
  const avatarUrl = resolveAssetUrl(employeeAvatarUrl || profile?.avatar_url) || undefined;

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <AnimatePresence mode="wait">
          {(!collapsed || isMobileView) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-sidebar-foreground">PMS</h1>
                <p className="text-xs text-sidebar-foreground/60">ระบบจัดการบุคลากร</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isMobileView && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.div>
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onLinkClick}
                  title={collapsed && !isMobileView ? item.label : undefined}
                  aria-label={collapsed && !isMobileView ? item.label : undefined}
                  className={cn(
                    'sidebar-item',
                    isActive && 'sidebar-item-active'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <AnimatePresence mode="wait">
                    {(!collapsed || isMobileView) && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Theme Toggle & User Profile */}
      <div className="p-3 border-t border-sidebar-border space-y-3">
        {/* Theme Toggle */}
        <div className={cn(
          'flex items-center gap-3 px-2',
          collapsed && !isMobileView ? 'justify-center' : 'justify-between'
        )}>
          {(!collapsed || isMobileView) && (
            <span className="text-sm text-sidebar-foreground/70">โหมดมืด</span>
          )}
          <ThemeToggle 
            variant="outline" 
            className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
          />
        </div>

        {/* User Profile */}
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50',
          collapsed && !isMobileView && 'justify-center'
        )}>
          <Avatar className="w-10 h-10 border-2 border-sidebar-primary/30">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <AnimatePresence mode="wait">
            {(!collapsed || isMobileView) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {roles[0] ? roles[0].toUpperCase() : 'Employee'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          
          {(!collapsed || isMobileView) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCompactLayout = useIsCompactLayout();
  const location = useLocation();

  const isControlled = typeof collapsed === 'boolean';
  const desktopCollapsed = isControlled ? collapsed : internalCollapsed;
  const setDesktopCollapsed = (value: boolean) => {
    if (!isControlled) {
      setInternalCollapsed(value);
    }
    onCollapsedChange?.(value);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Mobile Sidebar (Sheet)
  if (isCompactLayout) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border h-16 flex items-center px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-3">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SidebarContent
              collapsed={false}
              setCollapsed={() => {}}
              onLinkClick={() => setMobileOpen(false)}
              isMobileView
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Users className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground truncate">People Management System (PMS)</span>
        </div>
      </div>
    );
  }

  // Desktop Sidebar
  return (
    <motion.aside
      initial={false}
      animate={{ width: desktopCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen z-50"
    >
      <SidebarContent
        collapsed={desktopCollapsed}
        setCollapsed={setDesktopCollapsed}
      />
    </motion.aside>
  );
}

export function useSidebarWidth() {
  const isCompactLayout = useIsCompactLayout();
  const [collapsed] = useState(false);
  
  if (isCompactLayout) return 0;
  return collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
}
