import React from 'react';
import { ListChecks, AlertTriangle, Info, CheckSquare, FileQuestion, Users } from 'lucide-react'; // Added more icons

interface SimpleListDisplayProps {
  title: string;
  items: string[] | undefined;
  iconType?: 'suggestedSteps' | 'potentialIssues' | 'generalInfo' | 'requestsForAdmission' | 'interrogatories' | 'requestsForProduction';
  itemClassName?: string;
  listClassName?: string;
  titleClassName?: string;
}

const SimpleListDisplay: React.FC<SimpleListDisplayProps> = ({
  title,
  items,
  iconType,
  itemClassName = "text-sm text-foreground/90 dark:text-slate-300",
  listClassName = "list-disc list-inside pl-4 space-y-1",
  titleClassName = "text-md font-semibold text-foreground dark:text-dark-foreground flex items-center"
}) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400 italic">No {title.toLowerCase()} provided.</p>;
  }

  let IconComponent;
  switch (iconType) {
    case 'suggestedSteps':
      IconComponent = <ListChecks className="mr-2 h-5 w-5 text-purple-500 flex-shrink-0" />;
      break;
    case 'potentialIssues':
      IconComponent = <AlertTriangle className="mr-2 h-5 w-5 text-red-500 flex-shrink-0" />;
      break;
    case 'requestsForAdmission':
      IconComponent = <CheckSquare className="mr-2 h-5 w-5 text-teal-500 flex-shrink-0" />;
      break;
    case 'interrogatories':
      IconComponent = <FileQuestion className="mr-2 h-5 w-5 text-indigo-500 flex-shrink-0" />;
      break;
    case 'requestsForProduction':
      IconComponent = <Users className="mr-2 h-5 w-5 text-sky-500 flex-shrink-0" />;
      break;
    case 'generalInfo':
    default:
      IconComponent = <Info className="mr-2 h-5 w-5 text-blue-500 flex-shrink-0" />;
      break;
  }

  return (
    <div className="space-y-1.5">
      <h4 className={titleClassName}>
        {IconComponent} {title}
      </h4>
      <ul className={listClassName}>
        {items.map((item, index) => (
          <li key={index} className={itemClassName}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SimpleListDisplay; 