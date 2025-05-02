"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Trash2, Edit, Plus } from 'lucide-react';
import * as caseService from '@/services/caseService';
import { Case } from '@/types/case';
import { toast } from 'sonner';

interface CaseManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCasesUpdated: () => void; // Callback to refresh the case list in FileManager
}

const CaseManagementModal: React.FC<CaseManagementModalProps> = ({ isOpen, onClose, onCasesUpdated }) => {
    const [cases, setCases] = useState<Case[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newCaseName, setNewCaseName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // TODO: Add states for rename/delete operations

    useEffect(() => {
        if (isOpen) {
            fetchCases();
            setNewCaseName(''); // Reset new case name input
            setError(null); // Reset error
        }
    }, [isOpen]);

    const fetchCases = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await caseService.getUserCases();
            if (fetchError) throw fetchError;
            setCases(data || []);
        } catch (err: any) {
            console.error("Failed to fetch cases:", err);
            setError(`Failed to load cases: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCase = async () => {
        const trimmedName = newCaseName.trim();
        if (!trimmedName) {
            toast.warning("Please enter a name for the new case.");
            return;
        }
        setIsCreating(true);
        try {
            const { error: createError } = await caseService.createCase({ name: trimmedName });
            if (createError) throw createError;
            toast.success(`Case "${trimmedName}" created successfully.`);
            setNewCaseName(''); // Clear input
            await fetchCases(); // Refresh list within the modal
            onCasesUpdated(); // Notify FileManager to refresh its list
        } catch (err: any) {
            console.error("Failed to create case:", err);
            toast.error(`Failed to create case: ${err.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    // TODO: Implement handleRenameCase and handleDeleteCase functions

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Cases</DialogTitle>
                    <DialogDescription>
                        Create new cases, or rename/delete existing ones.
                    </DialogDescription>
                </DialogHeader>

                {/* Create New Case Section */}
                <div className="flex items-center gap-2 mt-4">
                    <Input 
                        placeholder="New case name..."
                        value={newCaseName}
                        onChange={(e) => setNewCaseName(e.target.value)}
                        disabled={isCreating}
                        onKeyDown={(e) => e.key === 'Enter' && !isCreating && handleCreateCase()}
                    />
                    <Button onClick={handleCreateCase} disabled={!newCaseName.trim() || isCreating}>
                        {isCreating ? <Spinner size="sm" className="mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Create Case
                    </Button>
                </div>

                {/* Existing Cases List */}
                <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Existing Cases</h4>
                    {error && <Alert variant="destructive" className="mb-2"><AlertDescription>{error}</AlertDescription></Alert>}
                    <ScrollArea className="h-[300px] pr-3">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <Spinner />
                            </div>
                        ) : cases.length > 0 ? (
                            <ul className="space-y-2">
                                {cases.map((c) => (
                                    <li key={c.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                        <span className="font-medium truncate pr-2">{c.name}</span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                // onClick={() => handleInitiateRename(c)} // TODO
                                                title="Rename Case"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-destructive hover:text-destructive/80"
                                                // onClick={() => handleInitiateDelete(c)} // TODO
                                                title="Delete Case"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground italic py-4">No cases found.</p>
                        )}
                    </ScrollArea>
                </div>

                {/* TODO: Add Rename/Delete confirmation dialogs */}

                <DialogFooter className="mt-6">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CaseManagementModal; 