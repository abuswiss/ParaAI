import React from 'react';
import { useAtom } from 'jotai';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { BackgroundTask, backgroundTasksAtom, removeTaskAtom } from '@/atoms/appAtoms';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// Define props if needed, but mainly relies on Jotai atom
interface TaskStatusBarProps {}

const TaskStatusBar: React.FC<TaskStatusBarProps> = () => {
  const [tasks] = useAtom(backgroundTasksAtom);
  const [, removeTask] = useAtom(removeTaskAtom);

  if (tasks.length === 0) {
    return null; // Don't render anything if there are no tasks
  }

  const getIcon = (status: BackgroundTask['status']) => {
    switch (status) {
      case 'running':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader className="h-4 w-4 text-muted-foreground" />;
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
                "bg-background/90 backdrop-blur-sm", // Theme background with blur
                task.status === 'error' ? 'border-red-500/50' : 'border-border'
              )}
            >
              <div className="flex items-center gap-2 flex-grow overflow-hidden">
                <div className="flex-shrink-0">
                  {getIcon(task.status)}
                </div>
                <div className="flex-grow overflow-hidden">
                  <p className="text-sm font-medium text-foreground truncate" title={task.name}>
                    {task.name}
                  </p>
                  {task.message && (
                    <p className="text-xs text-muted-foreground truncate" title={task.message}>
                      {task.message}
                    </p>
                  )}
                </div>
              </div>
              {/* Optional: Add progress bar if task.progress exists */}
              {/* {typeof task.progress === 'number' && ... } */}

              {/* Close button */} 
              {(task.status === 'success' || task.status === 'error') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
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