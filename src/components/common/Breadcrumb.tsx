import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-muted-foreground dark:text-dark-muted-foreground', className)}>
      <ol className="flex items-center space-x-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground mx-1.5 flex-shrink-0" />
            )}
            {item.href ? (
              <Link 
                to={item.href}
                className="hover:text-foreground dark:hover:text-dark-foreground transition-colors hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground dark:text-dark-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb; 