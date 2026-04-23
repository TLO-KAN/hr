import React from 'react';

interface MobileTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper for tables on mobile devices
 * Handles horizontal scrolling and responsive layout
 */
export const MobileTableWrapper: React.FC<MobileTableWrapperProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`w-full overflow-x-auto -mx-4 sm:mx-0 rounded-lg border ${className}`}>
      <div className="inline-block min-w-full">
        {children}
      </div>
    </div>
  );
};

/**
 * Card-based responsive table for mobile < 640px
 * Switches from table to card layout on small screens
 */
export const ResponsiveTable: React.FC<{
  headers: string[];
  rows: Array<Record<string, React.ReactNode>>;
  className?: string;
}> = ({ headers, rows, className = '' }) => {
  return (
    <div className={`space-y-4 sm:space-y-0 ${className}`}>
      {/* Mobile: Cards */}
      <div className="sm:hidden space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className="bg-white border rounded-lg p-4 space-y-2">
            {headers.map((header, hIdx) => (
              <div key={hIdx} className="flex justify-between items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground">{header}</span>
                <span className="text-right">{row[header]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden sm:block w-full overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className="px-4 py-3 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t hover:bg-muted/50">
                {headers.map((header, hIdx) => (
                  <td key={hIdx} className="px-4 py-3">
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
