import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/config/api';

interface CompanyHoliday {
  id: string | number;
  holiday_date?: string;
  date?: string;
  name: string;
  description: string | null;
}

interface HolidayNotificationProps {
  daysAhead?: number; // How many days ahead to show notifications
}

export function HolidayNotification({ daysAhead = 7 }: HolidayNotificationProps) {
  const [upcomingHolidays, setUpcomingHolidays] = useState<CompanyHoliday[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchUpcomingHolidays();
    // Load dismissed notifications from localStorage
    const dismissedFromStorage = localStorage.getItem('dismissedHolidayNotifications');
    if (dismissedFromStorage) {
      try {
        const parsed = JSON.parse(dismissedFromStorage);
        setDismissed(new Set(parsed));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const fetchUpcomingHolidays = async () => {
    const today = startOfDay(new Date());
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/holidays`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        throw new Error('Unable to fetch holidays');
      }

      const payload = await res.json();
      const allHolidays: CompanyHoliday[] = payload?.data || [];
      const startStr = format(today, 'yyyy-MM-dd');
      const endStr = format(futureDate, 'yyyy-MM-dd');

      const filtered = allHolidays
        .map((h) => ({ ...h, holiday_date: h.holiday_date || h.date }))
        .filter((h) => h.holiday_date && h.holiday_date >= startStr && h.holiday_date <= endStr)
        .sort((a, b) => (a.holiday_date || '').localeCompare(b.holiday_date || ''));

      setUpcomingHolidays(filtered);
    } catch (error) {
      console.error('Error fetching upcoming holidays:', error);
    }
  };

  const handleDismiss = (holidayId: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(holidayId);
    setDismissed(newDismissed);
    localStorage.setItem(
      'dismissedHolidayNotifications',
      JSON.stringify(Array.from(newDismissed))
    );
  };

  const handleDismissAll = () => {
    const allIds = upcomingHolidays.map(h => h.id);
    const newDismissed = new Set([...dismissed, ...allIds]);
    setDismissed(newDismissed);
    localStorage.setItem(
      'dismissedHolidayNotifications',
      JSON.stringify(Array.from(newDismissed))
    );
  };

  const visibleHolidays = upcomingHolidays.filter(h => !dismissed.has(String(h.id)));

  if (visibleHolidays.length === 0) {
    return null;
  }

  const getDaysUntil = (dateStr: string) => {
    const today = startOfDay(new Date());
    const holidayDate = parseISO(dateStr);
    return differenceInDays(holidayDate, today);
  };

  const getDaysLabel = (days: number) => {
    if (days === 0) return 'วันนี้';
    if (days === 1) return 'พรุ่งนี้';
    return `อีก ${days} วัน`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 mb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">
                วันหยุดที่กำลังจะถึง
              </h3>
              <Badge variant="secondary" className="text-xs">
                {visibleHolidays.length} วัน
              </Badge>
            </div>

            <AnimatePresence mode="wait">
              {!isExpanded ? (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Show first holiday */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {visibleHolidays[0].name}
                    </span>
                    <Badge
                      variant={getDaysUntil(visibleHolidays[0].holiday_date || '') <= 1 ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {getDaysLabel(getDaysUntil(visibleHolidays[0].holiday_date || ''))}
                    </Badge>
                    <span className="text-muted-foreground">
                      ({format(parseISO(visibleHolidays[0].holiday_date || ''), 'EEEE d MMM', { locale: th })})
                    </span>
                  </div>
                  {visibleHolidays.length > 1 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 h-auto mt-1 text-primary"
                      onClick={() => setIsExpanded(true)}
                    >
                      ดูทั้งหมด {visibleHolidays.length} วันหยุด
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 mt-2"
                >
                  {visibleHolidays.map((holiday) => (
                    <div
                      key={String(holiday.id)}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{holiday.name}</span>
                        <Badge
                          variant={getDaysUntil(holiday.holiday_date || '') <= 1 ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {getDaysLabel(getDaysUntil(holiday.holiday_date || ''))}
                        </Badge>
                        <span className="text-muted-foreground hidden sm:inline">
                          {format(parseISO(holiday.holiday_date || ''), 'EEEE d MMM yyyy', { locale: th })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDismiss(String(holiday.id))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto text-muted-foreground"
                    onClick={() => setIsExpanded(false)}
                  >
                    ย่อ
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/holidays">
            <Button variant="outline" size="sm">
              ดูปฏิทิน
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleDismissAll}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
