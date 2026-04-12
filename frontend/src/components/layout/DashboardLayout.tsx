import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { motion } from 'framer-motion';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className={isMobile ? '' : 'ml-[280px] transition-all duration-300'}>
        {(title || actions) && (
          <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border ${
            isMobile ? 'px-4 py-4' : 'px-8 py-6'
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
        
        <div className={isMobile ? 'p-4' : 'p-8'}>
          <motion.div
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
