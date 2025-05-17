import React from 'react';
import { useAtom } from 'jotai';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { BackgroundTask, backgroundTasksAtom, removeTaskAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// TaskStatusBarProps can be empty if all data comes from Jotai atoms
interface TaskStatusBarProps {}

const TaskStatusBar: React.FC<TaskStatusBarProps> = () => {
  const [tasks] = useAtom(backgroundTasksAtom);
  const [, removeTask] = useAtom(removeTaskAtom);

  if (tasks.length === 0) {
    return null;
  }

  const getIcon = (status: BackgroundTask['status']) => {
    switch (status) {
      case 'running':
        return <Loader className="h-4 w-4 animate-spin text-info dark:text-dark-info" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success dark:text-dark-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive dark:text-dark-destructive" />;
      case 'pending':
        return <Loader className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4 z-50 pointer-events-none">
      <div className="max-w-md ml-auto space-y-2">
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.3 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={cn(
                "flex items-center justify-between gap-2 p-3 rounded-lg shadow-lg border pointer-events-auto",
                "bg-popover/90 dark:bg-dark-popover/90 backdrop-blur-sm",
                task.status === 'error' ? 'border-destructive/50 dark:border-dark-destructive/50' : 'border-popover-border dark:border-dark-popover-border'
              )}
            >
              <div className="flex items-center gap-2 flex-grow overflow-hidden">
                <div className="flex-shrink-0">
                  {getIcon(task.status)}
                </div>
                <div className="flex-grow overflow-hidden">
                  <p className="text-sm font-medium text-popover-foreground dark:text-dark-popover-foreground truncate" title={task.description}>
                    {task.description}
                  </p>
                </div>
              </div>
              {(task.status === 'success' || task.status === 'error') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"
                  onClick={() => removeTask(task.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TaskStatusBar; 