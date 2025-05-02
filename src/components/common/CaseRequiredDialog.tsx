import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { FolderPlus } from 'lucide-react';

interface CaseRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: string; // e.g., "use this template", "upload a document"
}

const CaseRequiredDialog: React.FC<CaseRequiredDialogProps> = ({
  isOpen,
  onClose,
  action
}) => {
  const navigate = useNavigate();

  const handleGoToCases = () => {
    navigate('/files', { state: { action: 'createCase' } });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Case Selection Required</DialogTitle>
          <DialogDescription>
            You need to select or create a case before you can {action}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          <FolderPlus className="h-16 w-16 text-muted-foreground" />
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:order-1">
            Cancel
          </Button>
          <Button onClick={handleGoToCases} className="sm:order-2">
            Go to Case Manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CaseRequiredDialog; 