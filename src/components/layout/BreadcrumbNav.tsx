import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  path?: string; // Path is optional, last item might not have a path
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5">
      {items.map((item, index) => (
        <React.Fragment key={item.name + index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
          )}
          {item.path ? (
            <Link
              to={item.path}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              {item.name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300" aria-current="page">
              {item.name}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbNav; 