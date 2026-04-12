import { useEffect, useState } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const WORKING_HOURS_KEY = 'company_working_hours';
const LEAVE_RULES_KEY = 'company_leave_validation_rules';

interface WorkingHours {
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  working_hours_per_day: number;
}

interface LeaveValidationRules {
  vacation: { advance_days: number; description: string };
  personal: { advance_days: number; description: string };
  sick: { retroactive_days: number; description: string };
}

export function WorkingHoursSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    start_time: '08:30',
    end_time: '17:30',
    break_start: '12:00',
    break_end: '13:00',
    working_hours_per_day: 8,
  });

  const [leaveRules, setLeaveRules] = useState<LeaveValidationRules>({
    vacation: { advance_days: 3, description: 'ลาพักร้อนต้องแจ้งล่วงหน้าอย่างน้อย 3 วัน' },
    personal: { advance_days: 1, description: 'ลากิจต้องแจ้งล่วงหน้าอย่างน้อย 1 วัน' },
    sick: { retroactive_days: 7, description: 'ลาป่วยแจ้งย้อนหลังได้ไม่เกิน 7 วัน' },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const workingHoursRaw = localStorage.getItem(WORKING_HOURS_KEY);
      const leaveRulesRaw = localStorage.getItem(LEAVE_RULES_KEY);

      if (workingHoursRaw) {
        setWorkingHours(JSON.parse(workingHoursRaw));
      }

      if (leaveRulesRaw) {
        setLeaveRules(JSON.parse(leaveRulesRaw));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkingHours = async () => {
    setSaving(true);
    try {
      // Calculate working hours per day
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      
      const totalMinutes = parseTime(workingHours.end_time) - parseTime(workingHours.start_time);
      const breakMinutes = parseTime(workingHours.break_end) - parseTime(workingHours.break_start);
      const netWorkingMinutes = totalMinutes - breakMinutes;
      const hoursPerDay = netWorkingMinutes / 60;

      const updatedHours = { ...workingHours, working_hours_per_day: hoursPerDay };

      localStorage.setItem(WORKING_HOURS_KEY, JSON.stringify(updatedHours));

      setWorkingHours(updatedHours);
      toast({ title: 'บันทึกเวลาทำงานสำเร็จ' });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLeaveRules = async () => {
    setSaving(true);
    try {
      localStorage.setItem(LEAVE_RULES_KEY, JSON.stringify(leaveRules));

      toast({ title: 'บันทึกกฎการลาสำเร็จ' });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Working Hours Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle>เวลาทำงาน</CardTitle>
          </div>
          <CardDescription>กำหนดเวลาเข้า-ออกงานและพักเที่ยง เพื่อใช้ในการคำนวณการลาครึ่งวัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>เวลาเข้างาน</Label>
              <Input
                type="time"
                value={workingHours.start_time}
                onChange={(e) => setWorkingHours({ ...workingHours, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เวลาเลิกงาน</Label>
              <Input
                type="time"
                value={workingHours.end_time}
                onChange={(e) => setWorkingHours({ ...workingHours, end_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เริ่มพักเที่ยง</Label>
              <Input
                type="time"
                value={workingHours.break_start}
                onChange={(e) => setWorkingHours({ ...workingHours, break_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>สิ้นสุดพักเที่ยง</Label>
              <Input
                type="time"
                value={workingHours.break_end}
                onChange={(e) => setWorkingHours({ ...workingHours, break_end: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              ชั่วโมงทำงานต่อวัน: <span className="font-semibold">{workingHours.working_hours_per_day} ชั่วโมง</span>
            </div>
            <Button onClick={handleSaveWorkingHours} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              บันทึก
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Validation Rules Card */}
      <Card>
        <CardHeader>
          <CardTitle>กฎการแจ้งลาล่วงหน้า</CardTitle>
          <CardDescription>กำหนดจำนวนวันที่ต้องแจ้งล่วงหน้าสำหรับการลาแต่ละประเภท</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2 p-4 bg-info/10 rounded-lg border border-info/20">
              <Label className="text-info font-medium">ลาพักร้อน</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="30"
                  className="w-20"
                  value={leaveRules.vacation.advance_days}
                  onChange={(e) => setLeaveRules({
                    ...leaveRules,
                    vacation: {
                      ...leaveRules.vacation,
                      advance_days: parseInt(e.target.value) || 0,
                      description: `ลาพักร้อนต้องแจ้งล่วงหน้าอย่างน้อย ${e.target.value} วัน`,
                    },
                  })}
                />
                <span className="text-sm text-muted-foreground">วันล่วงหน้า</span>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-success/10 rounded-lg border border-success/20">
              <Label className="text-success font-medium">ลากิจ</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="30"
                  className="w-20"
                  value={leaveRules.personal.advance_days}
                  onChange={(e) => setLeaveRules({
                    ...leaveRules,
                    personal: {
                      ...leaveRules.personal,
                      advance_days: parseInt(e.target.value) || 0,
                      description: `ลากิจต้องแจ้งล่วงหน้าอย่างน้อย ${e.target.value} วัน`,
                    },
                  })}
                />
                <span className="text-sm text-muted-foreground">วันล่วงหน้า</span>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-warning/10 rounded-lg border border-warning/20">
              <Label className="text-warning font-medium">ลาป่วย</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="30"
                  className="w-20"
                  value={leaveRules.sick.retroactive_days}
                  onChange={(e) => setLeaveRules({
                    ...leaveRules,
                    sick: {
                      ...leaveRules.sick,
                      retroactive_days: parseInt(e.target.value) || 0,
                      description: `ลาป่วยแจ้งย้อนหลังได้ไม่เกิน ${e.target.value} วัน`,
                    },
                  })}
                />
                <span className="text-sm text-muted-foreground">วันย้อนหลัง</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={handleSaveLeaveRules} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              บันทึก
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
