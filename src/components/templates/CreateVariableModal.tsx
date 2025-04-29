import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface CreateVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (variableName: string) => void;
}

const CreateVariableModal: React.FC<CreateVariableModalProps> = ({ isOpen, onClose, onSave }) => {
  const [variableName, setVariableName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmedName = variableName.trim();
    // Basic validation: Not empty and potentially restrict characters
    if (!trimmedName) {
      setError('Variable name cannot be empty.');
      return;
    }
    // Example: Allow only letters, numbers, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
        setError('Variable name can only contain letters, numbers, and underscores.');
        return;
    }
    
    onSave(trimmedName);
    setVariableName(''); // Reset for next time
    setError('');
    onClose();
  };

  const handleClose = () => {
    setVariableName('');
    setError('');
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}> 
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4"
                >
                  Create New Template Variable
                </Dialog.Title>
                <div className="mt-2">
                  <Label htmlFor="variable-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Variable Name
                  </Label>
                  <Input
                    id="variable-name"
                    type="text"
                    value={variableName}
                    onChange={(e) => {
                      setVariableName(e.target.value);
                      if(error) setError(''); // Clear error on typing
                    }}
                    placeholder="e.g., client_name"
                    className="mt-1 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    autoFocus
                  />
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use only letters, numbers, and underscores. Example: `case_number`.
                  </p>
                  {error && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    Insert Variable
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateVariableModal; 