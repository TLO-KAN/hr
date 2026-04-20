/**
 * CSV Export Utilities
 * Safely handles Thai characters, numbers, and special Unicode
 */

interface ExportRow {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Escape CSV value (handles commas, quotes, newlines)
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert data to CSV format
 */
export function dataToCSV(data: ExportRow[], headers?: string[]): string {
  if (data.length === 0) return '';

  // Use provided headers or derive from first row
  const cols = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = cols.map(escapeCsvValue).join(',');
  
  // Create data rows
  const dataRows = data.map(row => 
    cols.map(col => escapeCsvValue(row[col])).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file to client
 */
export function downloadCSV(
  data: ExportRow[],
  filename: string,
  headers?: string[]
): void {
  const csv = dataToCSV(data, headers);
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel Thai support
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format leave request for CSV export
 */
export function formatLeaveRequestForExport(request: any): ExportRow {
  return {
    'รหัสพนักงาน': request.employee_code || '',
    'ชื่อ-นามสกุล': `${request.first_name} ${request.last_name}` || '',
    'แผนก': request.department_name || '',
    'ประเภทลา': request.leave_type || '',
    'วันที่เริ่มลา': request.start_date || '',
    'วันที่สิ้นสุดลา': request.end_date || '',
    'จำนวนวันลา': request.total_days || '',
    'เหตุผล': request.reason || '',
    'สถานะ': request.status || '',
    'วันที่ยื่น': request.created_at?.split('T')[0] || '',
  };
}

/**
 * Format employee balance for CSV export
 */
export function formatEmployeeBalanceForExport(balance: any): ExportRow {
  return {
    'รหัสพนักงาน': balance.employee_code || '',
    'ชื่อ-นามสกุล': `${balance.first_name} ${balance.last_name}` || '',
    'แผนก': balance.department_name || '',
    'อายุงาน (ปี)': balance.years_of_service || 0,
    'พักร้อนสิทธิ์': balance.vacation_quota || 0,
    'พักร้อนใช้': balance.vacation_used || 0,
    'พักร้อนคงเหลือ': balance.vacation_remaining || 0,
    'ป่วยสิทธิ์': balance.sick_quota || 0,
    'ป่วยใช้': balance.sick_used || 0,
    'ป่วยคงเหลือ': balance.sick_remaining || 0,
    'กิจสิทธิ์': balance.personal_quota || 0,
    'กิจใช้': balance.personal_used || 0,
    'กิจคงเหลือ': balance.personal_remaining || 0,
  };
}

/**
 * Format employee list row for CSV export
 */
export function formatEmployeeForExport(employee: any): ExportRow {
  const firstName = employee?.first_name || '';
  const lastName = employee?.last_name || '';
  const firstNameEn = employee?.first_name_en || '';
  const lastNameEn = employee?.last_name_en || '';
  const nickname = employee?.nickname || '';
  const departmentName =
    employee?.department_name ||
    (typeof employee?.department === 'object' && employee?.department?.name) ||
    (typeof employee?.department === 'string' ? employee.department : '') ||
    '';
  const positionName =
    employee?.position_name ||
    (typeof employee?.position === 'object' && employee?.position?.name) ||
    (typeof employee?.position === 'string' ? employee.position : '') ||
    '';

  return {
    'รหัสพนักงาน': employee?.employee_code || '',
    'ชื่อ': firstName,
    'นามสกุล': lastName,
    'ชื่อเล่น': nickname,
    'ชื่ออังกฤษ': firstNameEn,
    'นามสกุลอังกฤษ': lastNameEn,
    'ชื่อ-นามสกุล': `${firstName} ${lastName}`.trim(),
    'ชื่อ-นามสกุล (EN)': `${firstNameEn} ${lastNameEn}`.trim(),
    'อีเมล': employee?.email || '',
    'เบอร์โทร': employee?.phone || '',
    'แผนก': departmentName,
    'ตำแหน่ง': positionName,
    'ประเภทพนักงาน': employee?.employee_type || '',
    'สถานะ': employee?.status || '',
    'วันเริ่มงาน': employee?.start_date || '',
  };
}

/**
 * Create filename with date
 */
export function createExportFilename(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${prefix}-${dateStr}.csv`;
}
