import React, { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { AnimatePresence, motion } from 'framer-motion';
import { backgroundTasksAtom, clearCompletedTasksAtom, BackgroundTask, TaskStatus } from '@/atoms/appAtoms';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Progress } from "@/components/ui/progress"; // Assuming progress component exists

const StatusIndicator: React.FC = () => {
    const [tasks, setTasks] = useAtom(backgroundTasksAtom);
    const clearTasks = useSetAtom(clearCompletedTasksAtom);

    // Effect to periodically clear completed tasks
    useEffect(() => {
        const interval = setInterval(() => {
            clearTasks();
        }, 2000); // Check every 2 seconds
        return () => clearInterval(interval);
    }, [clearTasks]);

    const getStatusIcon = (status: TaskStatus) => {
        switch (status) {
            case 'running':
            case 'pending':
                return <Spinner size="xs" className="text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        },
        exit: { opacity: 0, y: 20 }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
    };

    // Only render if there are tasks
    if (tasks.length === 0) {
        return null;
    }

    return (
        <motion.div 
            className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <AnimatePresence initial={false}>
                {tasks.map((task) => (
                    <motion.div
                        key={task.id}
                        layout // Animate layout changes (add/remove)
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg shadow-md text-xs w-64",
                            task.status === 'error' ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/50" :
                            task.status === 'success' ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800/50" :
                            "bg-background/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-border"
                        )}
                    >
                        <div className="flex-shrink-0">
                            {getStatusIcon(task.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" title={task.description}>{task.description}</p>
                            {typeof task.progress === 'number' && task.status === 'running' && (
                                <Progress value={task.progress} className="h-1 mt-1" />
                            )}
                             {task.status === 'error' && (
                                <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">Failed</p>
                            )}
                             {task.status === 'success' && (
                                <p className="text-green-600 dark:text-green-400 text-xs mt-0.5">Completed</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default StatusIndicator; 