import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { useForm } from 'react-hook-form';

// Matches the interface in EditPage.tsx
interface VariableEditPopupProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  variableName: string;
  currentValue: string | null; // Changed from initialValue for consistency
  variableDescription: string | null;
  position: { from: number; to: number } | null; // Added position
  onClose: () => void; // For explicit close handling
  onOpenChange: (open: boolean) => void; // Keep for Popover control
  onSaveValue: (details: {
    variableName: string;
    newValue: string;
    currentDescription: string | null;
    position: { from: number; to: number };
  }) => void;
}

interface FormData {
  value: string;
}

export const VariableEditPopup: React.FC<VariableEditPopupProps> = ({
  isOpen,
  anchorElement,
  variableName,
  currentValue, // Changed from initialValue
  variableDescription,
  position, // Added
  onClose, // Added
  onOpenChange, // Kept for Popover
  onSaveValue, // Changed from onSave
}) => {
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>({
    defaultValues: {
      value: currentValue || ''
    }
  });

  // Effect to update form value if currentValue prop changes (e.g. clicking different var)
  React.useEffect(() => {
    setValue('value', currentValue || '');
  }, [currentValue, setValue]);

  const onSubmit = (data: FormData) => {
    if (!position) {
      console.error('Variable position is missing, cannot save.');
      // Optionally notify the user with a toast
      return;
    }
    onSaveValue({
      variableName,
      newValue: data.value,
      currentDescription: variableDescription,
      position: position, // Pass position back
    });
    // onOpenChange(false); // EditPage now controls isOpen via onClose through setVariablePopupState
    onClose(); // Call the new onClose prop
  };

  // Handle Popover's onOpenChange to call our onClose when popover closes externally
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
    // Allow parent to also react to onOpenChange if needed, though onClose is primary now
    if (onOpenChange) {
        onOpenChange(open);
    }
  };

  // DummyTrigger remains the same
  const DummyTrigger = React.forwardRef<HTMLSpanElement>((props, ref) => (
      <span ref={ref} style={{ position: 'absolute', pointerEvents: 'none', opacity: 0 }} />
  ));
  DummyTrigger.displayName = 'DummyTrigger';

  // popupStyle calculation remains the same
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties>({});
  React.useEffect(() => {
    if (anchorElement && isOpen && anchorElement !== document.body) {
      const rect = anchorElement.getBoundingClientRect();
      setPopupStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        zIndex: 9999,
      });
    } else if (!anchorElement && isOpen) { // Center if no anchor
        setPopupStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
        });
    } else {
      setPopupStyle({});
    }
  }, [anchorElement, isOpen]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
          <DummyTrigger />
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 space-y-3 bg-card dark:bg-dark-card text-card-foreground dark:text-dark-card-foreground shadow-xl border border-card-border dark:border-dark-card-border rounded-lg backdrop-blur-md"
        side="bottom"
        align="start"
        style={popupStyle}
        onOpenAutoFocus={(e) => e.preventDefault()} // Prevent default focus stealing
        // onInteractOutside={(e) => { // More explicit closing if needed
        //   onClose(); 
        // }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="variableValueEdit" className="font-semibold text-foreground">
              {variableName}
            </Label>
            {variableDescription && (
              <p className="text-xs text-muted-foreground italic">
                {variableDescription}
              </p>
            )}
          </div>
          <Input
            id="variableValueEdit"
            {...register('value')}
            placeholder={`Enter value...`}
            autoFocus
            className="h-9"
          />
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8">
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="h-8">
              Update
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}; 