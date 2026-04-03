import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  icon: Icon,
}) => {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          {/* Title with accent underline */}
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-oxblood-primary/10">
                <Icon className="w-6 h-6 text-oxblood-primary" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-text-primary tracking-tight">
                {title}
              </h1>
              <div className="mt-1 h-0.5 w-16 bg-oxblood-primary rounded-full" />
            </div>
          </div>

          {/* Description */}
          {description && (
            <p className="mt-3 text-text-secondary text-base max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {/* Action slot */}
        {action && (
          <div className="w-full md:w-auto md:flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
