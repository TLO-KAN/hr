import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Baby, Heart } from 'lucide-react';
import { buildApiUrl } from '@/config/api';

interface LeaveBalanceItem {
  key: string;
  label: string;
  color: string;
  icon?: React.ElementType;
  quota: number;
  used: number;
  remaining: number;
  isProrated: boolean;
  accruedAmount?: number;
  totalEntitlement?: number;
  isFirstYear?: boolean;
  nextUnlockDays?: number;
}

interface LeaveBalanceDisplayProps {
  compact?: boolean; // If true, show smaller version
}

export function LeaveBalanceDisplay({ compact = false }: LeaveBalanceDisplayProps) {
  const { employee } = useAuth();
  const [balanceCards, setBalanceCards] = useState<LeaveBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntitlements();
  }, [employee]);

  const fetchEntitlements = async () => {
    if (!employee) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl('/leave-entitlements/my'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        setError(`Error: ${res.status}`);
        setBalanceCards([]);
        return;
      }

      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      buildBalanceCards(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading entitlements');
      setBalanceCards([]);
    } finally {
      setLoading(false);
    }
  };

  const buildBalanceCards = (data: any[]) => {
    const leaveTypeConfig: Record<string, { label: string; color: string; icon?: React.ElementType; order: number }> = {
      vacation: { label: 'ลาพักร้อน', color: 'bg-info', order: 1 },
      annual: { label: 'ลาพักร้อน', color: 'bg-info', order: 1 },
      sick: { label: 'ลาป่วย', color: 'bg-warning', order: 2 },
      personal: { label: 'ลากิจ', color: 'bg-success', order: 3 },
      maternity: { label: 'ลาคลอด', color: 'bg-pink-500', icon: Baby, order: 4 },
      paternity: { label: 'ลาช่วยภรรยาคลอด', color: 'bg-blue-500', icon: Heart, order: 5 },
      other: { label: 'ลาอื่นๆ', color: 'bg-muted-foreground', order: 6 },
    };

    const isFemale = employee?.gender && ['female', 'f', 'หญิง'].includes(String(employee.gender).toLowerCase());

    const cards: LeaveBalanceItem[] = data
      .filter((ent) => {
        const quota = Number(ent.prorated_quota ?? ent.entitled_days ?? ent.balance_days ?? 0);
        const isValidQuota = quota > 0;
        const isMaternityleaveFemale = ent.leave_type === 'maternity' ? isFemale : true;
        const isPaternity = ent.leave_type === 'paternity';
        return isValidQuota && isMaternityleaveFemale && !isPaternity;
      })
      .map((ent) => ({
        key: ent.leave_type,
        label: leaveTypeConfig[ent.leave_type]?.label || ent.leave_type,
        color: leaveTypeConfig[ent.leave_type]?.color || 'bg-muted',
        icon: leaveTypeConfig[ent.leave_type]?.icon,
        quota: Number(ent.prorated_quota ?? ent.entitled_days ?? 0),
        used: Number(ent.used_days ?? 0),
        remaining: Number(ent.remaining_days ?? 0),
        isProrated: Number(ent.base_quota ?? ent.total_entitlement ?? 0) !== Number(ent.prorated_quota ?? ent.entitled_days ?? 0),
        accruedAmount: Number(ent.accrued_amount ?? ent.prorated_quota ?? ent.entitled_days ?? 0),
        totalEntitlement: Number(ent.total_entitlement ?? ent.base_quota ?? ent.prorated_quota ?? ent.entitled_days ?? 0),
        isFirstYear: Boolean(ent.is_first_year),
        nextUnlockDays: Number(ent.next_unlock_days ?? 0.5),
      }))
      .sort((a, b) => (leaveTypeConfig[a.key]?.order || 99) - (leaveTypeConfig[b.key]?.order || 99));

    setBalanceCards(cards);
  };

  if (loading) {
    return (
      <div className={`grid ${compact ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-4'}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (balanceCards.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
        ไม่พบข้อมูลสิทธิ์วันลา กรุณาติดต่อ HR
      </div>
    );
  }

  return (
    <div className={`grid ${compact ? 'grid-cols-2 gap-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4'}`}>
      {balanceCards.map((card, index) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card>
            <CardContent className={`${compact ? 'pt-3' : 'pt-4 sm:pt-6'}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <span className={`${compact ? 'text-xs' : 'text-xs sm:text-sm'} font-medium text-muted-foreground`}>
                  {card.label}
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {card.isProrated && (
                    <span className={`${compact ? 'text-[10px]' : 'text-[10px] sm:text-xs'} px-1 sm:px-1.5 py-0.5 bg-primary/10 text-primary rounded`}>
                      Pro-rate
                    </span>
                  )}
                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${card.color}`} />
                </div>
              </div>
              <div className="flex items-end gap-1 sm:gap-2">
                <span className={`${compact ? 'text-lg' : 'text-xl sm:text-3xl'} font-bold`}>
                  {card.remaining.toFixed(1)}
                </span>
                <span className={`${compact ? 'text-[10px]' : 'text-xs sm:text-sm'} text-muted-foreground mb-0.5 sm:mb-1`}>
                  / {card.quota.toFixed(1)} วัน
                </span>
              </div>
              <p className={`${compact ? 'text-[10px]' : 'text-[10px] sm:text-xs'} text-muted-foreground mt-2 sm:mt-3`}>
                ไม่ได้ใช้ {card.remaining.toFixed(1)} วัน
              </p>

              {['vacation', 'annual'].includes(card.key) && card.isFirstYear && (card.totalEntitlement || 0) > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>สะสมแล้ว {Number(card.accruedAmount || 0).toFixed(1)} วัน</span>
                    <span>เต็มปี {Number(card.totalEntitlement || 0).toFixed(1)} วัน</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-info transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, ((Number(card.accruedAmount || 0) / Number(card.totalEntitlement || 1)) * 100)))}%` }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    เดือนถัดไปจะปลดล็อกอีก {Number(card.nextUnlockDays || 0.5).toFixed(1)} วัน
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
