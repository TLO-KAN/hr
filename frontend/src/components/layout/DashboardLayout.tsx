import { ReactNode, useState } from 'react';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from './Sidebar';
import { motion } from 'framer-motion';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useIsCompactLayout, useIsMobile } from '@/hooks/use-mobile';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const isCompactLayout = useIsCompactLayout();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const desktopSidebarOffset = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      
      <main
        className="flex-1 min-w-0 transition-all duration-300"
        style={!isCompactLayout ? { marginLeft: desktopSidebarOffset } : { paddingTop: 64 }}
      >
        {(title || actions) && (
          <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border ${
            isMobile ? 'px-4 py-4' : isCompactLayout ? 'px-6 py-5' : 'px-8 py-6'
          } ${
            isCompactLayout ? 'top-16' : 'top-0'
          }`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="min-w-0"
              >
                {title && (
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-sm sm:text-base text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
                )}
              </motion.div>
              
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <NotificationBell />
                {actions && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex flex-wrap gap-2"
                  >
                    {actions}
                  </motion.div>
                )}
              </div>
            </div>
          </header>
        )}
        
        <div className={isMobile ? 'p-4 w-full' : isCompactLayout ? 'p-6 w-full' : 'p-8 w-full'}>
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
