import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative bg-cream rounded-2xl p-6 shadow-soft border border-beige-dark/50 overflow-hidden',
        'transition-all duration-200 hover:shadow-medium',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Icon */}
        <div className="p-3 rounded-xl bg-oxblood-primary/10">
          <Icon className="w-6 h-6 text-oxblood-primary" />
        </div>

        {/* Trend indicator */}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full',
              trend.isPositive
                ? 'bg-semantic-success/10 text-semantic-success'
                : 'bg-semantic-error/10 text-semantic-error'
            )}
          >
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-4">
        <p className="text-text-muted text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-text-primary mt-1 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-text-muted text-xs mt-2">{subtitle}</p>
        )}
      </div>

      {/* Decorative accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-oxblood-primary/20 via-oxblood-primary/5 to-transparent rounded-b-2xl" />
    </div>
  );
};

export default StatCard;
