import React from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  [key: string]: string | string[];
}

interface AdvancedTableControlsProps {
  columns: Array<{ key: string; label: string; sortable?: boolean; filterable?: boolean }>;
  filters?: FilterConfig;
  sortConfig?: SortConfig;
  onSortChange?: (config: SortConfig) => void;
  onFilterChange?: (filters: FilterConfig) => void;
  filterOptions?: { [key: string]: Array<{ value: string; label: string }> };
}

export const AdvancedTableControls: React.FC<AdvancedTableControlsProps> = ({
  columns,
  filters = {},
  sortConfig,
  onSortChange,
  onFilterChange,
  filterOptions = {},
}) => {
  const [activeSort, setActiveSort] = React.useState(sortConfig);
  const [activeFilters, setActiveFilters] = React.useState(filters);

  const handleSort = (column: string) => {
    const isSortable = columns.find(c => c.key === column)?.sortable !== false;
    if (!isSortable) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (activeSort?.column === column && activeSort?.direction === 'asc') {
      direction = 'desc';
    }

    const newConfig = { column, direction };
    setActiveSort(newConfig);
    onSortChange?.(newConfig);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    const newFilters = { ...activeFilters, [filterKey]: value };
    if (!value) {
      delete newFilters[filterKey];
    }
    setActiveFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    onFilterChange?.({});
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="space-y-4 pb-4 border-b">
      {/* Sort Controls */}
      {columns.some(c => c.sortable) && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">เรียงลำดับ:</span>
          <div className="flex flex-wrap gap-2">
            {columns
              .filter(c => c.sortable !== false)
              .map(column => (
                <Button
                  key={column.key}
                  variant={activeSort?.column === column.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort(column.key)}
                  className="gap-1"
                >
                  {column.label}
                  {activeSort?.column === column.key && (
                    activeSort.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )
                  )}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {columns.some(c => c.filterable) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">ตัวกรอง:</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1 text-xs"
              >
                <X className="w-3 h-3" />
                ล้างตัวกรอง
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {columns
              .filter(c => c.filterable)
              .map(column => {
                const options = filterOptions[column.key] || [];
                if (options.length === 0) {
                  return (
                    <Input
                      key={column.key}
                      placeholder={`ค้นหา${column.label}...`}
                      value={activeFilters[column.key] || ''}
                      onChange={(e) => handleFilterChange(column.key, e.target.value)}
                      className="h-9"
                    />
                  );
                }

                return (
                  <div key={column.key} className="flex gap-2 items-center">
                    <Select
                      value={activeFilters[column.key] as string || 'all'}
                      onValueChange={(value) => handleFilterChange(column.key, value === 'all' ? '' : value)}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder={`เลือก${column.label}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for managing sort/filter state
export const useTableControls = (initialSort?: SortConfig) => {
  const [sort, setSort] = React.useState(initialSort);
  const [filters, setFilters] = React.useState<FilterConfig>({});

  const handleSort = (config: SortConfig) => {
    setSort(config);
  };

  const handleFilter = (newFilters: FilterConfig) => {
    setFilters(newFilters);
  };

  return { sort, filters, handleSort, handleFilter };
};
