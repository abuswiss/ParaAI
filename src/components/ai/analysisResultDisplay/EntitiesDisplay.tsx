import React, { useState } from 'react';
import { EntitiesResult, Entity } from '@/services/documentAnalysisService';
import { Users, Building, Calendar, MapPin, Gavel, DollarSign, Tag, Copy, MessageSquarePlus, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface EntitiesDisplayProps {
  result: EntitiesResult;
  onCopyItem: (text: string, itemName?: string) => void;
  onAddItemToContext: (itemText: string, itemTypeLabel: string) => void;
  onItemHover: (item: Entity | null) => void;
  onItemClick: (item: Entity) => void;
}

const getEntityIconAndStyle = (type: Entity['type']) => {
  // Default style
  let icon = <Tag className="h-4 w-4 mr-1.5 flex-shrink-0 text-muted-foreground dark:text-dark-muted-foreground" />;
  let badgeVariant: "default" | "primary" | "secondary" | "outline" | "destructive" | "info" | "success" | "warning" = 'default';
  let textColor = 'text-muted-foreground dark:text-dark-muted-foreground';

  switch (type) {
    case 'PERSON': 
      icon = <Users className="h-4 w-4 mr-1.5 flex-shrink-0 text-primary dark:text-dark-primary" />;
      badgeVariant = 'primary';
      textColor = 'text-primary dark:text-dark-primary';
      break;
    case 'ORGANIZATION': 
      icon = <Building className="h-4 w-4 mr-1.5 flex-shrink-0 text-accent-foreground dark:text-dark-accent-foreground" />;
      badgeVariant = 'secondary'; // Assuming secondary is distinct or use 'outline' with accent border/text
      textColor = 'text-accent-foreground dark:text-dark-accent-foreground';
      break;
    case 'DATE': 
      icon = <Calendar className="h-4 w-4 mr-1.5 flex-shrink-0 text-success dark:text-dark-success" />;
      badgeVariant = 'success';
      textColor = 'text-success dark:text-dark-success';
      break;
    case 'LOCATION': 
      icon = <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0 text-destructive dark:text-dark-destructive" />;
      badgeVariant = 'destructive';
      textColor = 'text-destructive dark:text-dark-destructive';
      break;
    case 'LEGAL_TERM': 
      icon = <Gavel className="h-4 w-4 mr-1.5 flex-shrink-0 text-warning dark:text-dark-warning" />;
      badgeVariant = 'warning';
      textColor = 'text-warning dark:text-dark-warning';
      break;
    case 'FINANCIAL_TERM': 
      icon = <DollarSign className="h-4 w-4 mr-1.5 flex-shrink-0 text-info dark:text-dark-info" />;
      badgeVariant = 'info';
      textColor = 'text-info dark:text-dark-info';
      break;
  }
  return { icon, badgeVariant, textColor };
};

const EntitiesDisplay: React.FC<EntitiesDisplayProps> = ({ result, onCopyItem, onAddItemToContext, onItemHover, onItemClick }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  if (!result || !result.entities || result.entities.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
          <Tag className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
          Identified Entities
        </div>
        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground p-2">No entities found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <div className="flex items-center text-base font-semibold text-foreground dark:text-dark-foreground">
            <Tag className="h-5 w-5 mr-2 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
            Identified Entities
        </div>
        <div className="space-y-2">
            {result.entities.map((entity, index) => {
                const { icon, badgeVariant, textColor } = getEntityIconAndStyle(entity.type);
                const entityTextForActions = `${entity.text} (${entity.type})`;
                return (
                <div 
                    key={index} 
                    className="p-3 border border-card-border dark:border-dark-card-border rounded-md bg-card dark:bg-dark-card group hover:shadow-lg dark:hover:shadow-dark-lg hover:bg-card/80 dark:hover:bg-dark-card/80 backdrop-blur-sm transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => onItemHover(entity)}
                    onMouseLeave={() => onItemHover(null)}
                    onClick={() => onItemClick(entity)}
                >
                    <div className="flex items-center justify-between">
                    <div className={cn("flex-1 flex items-center min-w-0 mr-2", textColor)}>
                        {icon}
                        <span className="font-medium text-sm truncate" title={entity.text}>{entity.text}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Badge variant={badgeVariant} className="text-xs whitespace-nowrap flex-shrink-0">
                            {entity.type}
                        </Badge>
                        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                                variant="ghost" 
                                size="xs-icon" 
                                className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                                onClick={e => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(entityTextForActions).then(() => {
                                        setCopiedIndex(index);
                                        toast.success('Copied!');
                                        setTimeout(() => setCopiedIndex(null), 1200);
                                    });
                                }}
                                title="Copy Entity Details"
                            >
                                {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            {copiedIndex === index && <span className="ml-1 text-xs text-green-600">Copied!</span>}
                            <Button 
                                variant="ghost" 
                                size="xs-icon" 
                                className="h-6 w-6 p-1 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                                onClick={e => { e.stopPropagation(); onAddItemToContext(entityTextForActions, `Entity - ${entity.type}`); }}
                                title="Add Entity to Chat Context"
                            >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    </div>
                </div>
                );
            })}
        </div>
    </div>
  );
};

export default EntitiesDisplay; 