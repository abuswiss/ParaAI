import React from 'react';
import { useCopilot } from '@/context/CopilotContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Lightbulb, Target, Loader2, AlertCircle, Workflow } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopilotGoalType } from '@/types/aiCopilot';

interface CopilotTaskConfigurationProps {}

const AUTO_DETECT_VALUE = "__AUTO_DETECT__"; // Define a constant for the special value

const CopilotTaskConfiguration: React.FC<CopilotTaskConfigurationProps> = () => {
  const {
    primaryGoal,
    setPrimaryGoal,
    primaryGoalType,
    setPrimaryGoalType,
    selectedDocumentsContent,
    initiateCoPilotAnalysis,
    isLoading,
    error,
    clearAIOutputAndError
  } = useCopilot();

  const handleInitiate = () => {
    clearAIOutputAndError();
    initiateCoPilotAnalysis();
  };

  const canInitiate = selectedDocumentsContent.length > 0 && primaryGoal.trim() !== '';

  const formatGoalTypeLabel = (goalType: string) => {
    return goalType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <Card className="shadow-md dark:bg-slate-800">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
            <Target className="mr-2 h-5 w-5 text-primary" />
            Configure AI CoPilot Task
        </CardTitle>
        <CardDescription>
          Define the primary objective and optionally specify a task type for the AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="primary-goal-type" className="text-base font-semibold text-foreground dark:text-dark-foreground flex items-center mb-1">
            <Workflow className="mr-2 h-4 w-4 text-muted-foreground" />
            Specific Task Type (Optional)
          </Label>
          <Select
            value={primaryGoalType || AUTO_DETECT_VALUE}
            onValueChange={(value) => {
              setPrimaryGoalType(value === AUTO_DETECT_VALUE ? null : value as CopilotGoalType);
            }}
          >
            <SelectTrigger id="primary-goal-type" className="w-full dark:bg-slate-700/50 dark:text-gray-100 dark:border-slate-600">
              <SelectValue placeholder="Auto-detect from goal description" />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-800">
              <SelectItem value={AUTO_DETECT_VALUE} className="dark:hover:bg-slate-700">
                Auto-detect from goal description
              </SelectItem>
              {Object.values(CopilotGoalType).map((goalType) => (
                <SelectItem key={goalType} value={goalType} className="dark:hover:bg-slate-700">
                  {formatGoalTypeLabel(goalType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
            Specifying a task type can improve accuracy for common tasks. If unsure, leave as "Auto-detect".
          </p>
        </div>

        <div>
          <Label htmlFor="primary-goal" className="text-base font-semibold text-foreground dark:text-dark-foreground">
            Primary Goal for this Session
          </Label>
          <Textarea
            id="primary-goal"
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value)}
            placeholder="e.g., Draft responses to these Interrogatories, Identify potential objections for these Requests for Production, Suggest Requests for Admission based on this case summary..."
            rows={4}
            className="mt-1 resize-none dark:bg-slate-700/50 dark:text-gray-100 dark:border-slate-600 focus:ring-primary dark:focus:ring-offset-slate-800"
          />
          <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
            Clearly state what you want the AI to achieve with the selected document(s).
          </p>
        </div>

        {selectedDocumentsContent.length > 0 && (
            <div className="p-3 bg-muted/30 dark:bg-slate-700/30 rounded-md border border-dashed dark:border-slate-600">
                <h4 className="font-semibold text-sm mb-1.5 text-foreground dark:text-dark-foreground flex items-center">
                    <Lightbulb className="mr-2 h-4 w-4 text-yellow-500" />
                    Context Summary
                </h4>
                <p className="text-xs text-muted-foreground dark:text-slate-300">
                    The AI will use content from {selectedDocumentsContent.length} selected document(s):
                </p>
                <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5">
                    {selectedDocumentsContent.map(doc => (
                        <li key={doc.id} className="text-xs text-muted-foreground dark:text-slate-400 truncate" title={doc.filename}>
                            {doc.filename}
                        </li>
                    ))}
                </ul>
            </div>
        )}

        <Button 
            onClick={handleInitiate} 
            disabled={!canInitiate || isLoading}
            size="lg"
            className="w-full transition-all duration-150 ease-in-out transform active:scale-95"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
          ) : (
            <>Analyze Documents & Generate Insights</>
          )}
        </Button>

        {error && !isLoading && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-md flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default CopilotTaskConfiguration; 