"use client";

import React, { useState, useEffect, useCallback, DragEvent, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { 
    activeCaseIdAtom, 
    uploadModalOpenAtom, 
    newAITemplateDraftModalOpenAtom, 
    templateImportModalOpenAtom,
    currentCaseDocumentsAtom,
    newAIDocumentDraftModalOpenAtom,
    initialFilesForUploadAtom,
    chatDocumentContextIdsAtom
} from '@/atoms/appAtoms';
import { cn } from "@/lib/utils";
import { Folder, FileText, LayoutGrid, List, Plus, Upload, FolderPlus, FilePlus, Sparkles, Edit, FileUp, Play } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription } from "@/components/ui/Alert";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose
} from "@/components/ui/Dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import * as caseService from '@/services/caseService';
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { Case } from '@/types/case';
import { Document } from '@/types/document';
import { DocumentTemplate } from '@/services/templateService';
import Breadcrumb from '../common/Breadcrumb';
import { Label } from "@/components/ui/Label"
import { toast } from "sonner"
import { MoreHorizontal } from 'lucide-react';
import CaseManagementModal from '../cases/CaseManagementModal';
import UploadModal from '@/components/documents/UploadModal';
import NewAITemplateDraftModal from '../templates/NewAITemplateDraftModal';
import NewAIDocumentDraftModal from '../documents/NewAIDocumentDraftModal';
import { useTemplate } from '@/lib/templateUtils';
import CaseRequiredDialog from '@/components/common/CaseRequiredDialog';

// Basic types for the file manager
type ItemType = 'case' | 'document' | 'template';
type ViewMode = 'list' | 'grid';

interface ActionState {
    actionType: 'rename' | 'delete' | null;
    itemId: string | null;
    itemType: ItemType | null;
    currentName?: string; // Only for rename
    isBulk?: boolean; // To indicate if it's a bulk delete
}

// Disable lint rule for empty interface placeholder
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface FileManagerProps extends Record<string, unknown> {}

// Reusable Item component (adapt FolderItem/NavItem concept)
interface ListItemProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    isSelected: boolean;
    onClick: (id: string, type: ItemType) => void;
    type: ItemType;
}

const ListItem: React.FC<ListItemProps> = ({ id, label, icon, isSelected, onClick, type }) => {
    return (
        <button
            onClick={() => onClick(id, type)}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm w-full text-left rounded-md transition-colors",
                isSelected 
                    ? "bg-muted dark:bg-dark-muted text-foreground dark:text-dark-foreground" 
                    : "text-muted-foreground dark:text-dark-muted-foreground hover:bg-muted/80 dark:hover:bg-dark-muted/80 hover:text-foreground dark:hover:text-dark-foreground"
            )}
        >
            {icon}
            <span className="truncate flex-1">{label}</span>
        </button>
    );
};

// --- Grid Item Component ---
interface GridItemProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    typeLabel: string; // e.g., "Document", "Template"
    date?: string; // e.g., "Created: 2023-10-27"
    onClick: (id: string, type: ItemType) => void;
    onAction: (action: 'rename' | 'delete' | 'download' | 'view' | 'edit', id: string, type: ItemType) => void;
    type: ItemType;
    itemSubActions?: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean }[];
}

const GridItem: React.FC<GridItemProps> = ({ id, label, icon, typeLabel, date, onClick, onAction, type, itemSubActions }) => {
    // Use theme colors: primary for documents, secondary for templates
    const cardTypeClass = type === 'template'
        ? 'border-2 border-secondary bg-secondary/10 dark:bg-secondary/20 dark:border-secondary'
        : 'border-2 border-primary bg-primary/10 dark:bg-primary/20 dark:border-primary';
    const iconColorClass = type === 'template'
        ? 'text-secondary dark:text-secondary'
        : 'text-primary dark:text-primary';
    return (
        <Card 
            className={cn(
                "cursor-pointer hover:shadow-lg transition-shadow flex flex-col h-40 text-card-foreground dark:text-dark-card-foreground",
                cardTypeClass
            )}
            onClick={() => onClick(id, type)}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <div className={cn("flex-shrink-0", iconColorClass)}>{icon}</div>
                    <CardTitle className="text-sm font-medium truncate flex-shrink min-w-0">{label}</CardTitle>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                           <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {type === 'document' && <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAction('view', id, type); }}>View</DropdownMenuItem>}
                        {type === 'document' && <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAction('edit', id, type); }}>Edit</DropdownMenuItem>}
                        {type === 'template' && itemSubActions?.map((action, index) => (
                            <DropdownMenuItem key={`${id}-${action.label}`} onSelect={action.action} disabled={action.disabled}>
                                {action.label}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAction('rename', id, type); }}>Rename</DropdownMenuItem>
                        {type === 'document' && <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAction('download', id, type); }}>Download</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive dark:text-dark-destructive focus:text-destructive dark:focus:text-dark-destructive focus:bg-destructive/10 dark:focus:bg-dark-destructive/10" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAction('delete', id, type); }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="pb-3 flex-grow">
                <div className="text-xs text-muted-foreground dark:text-dark-muted-foreground mb-1">{typeLabel}</div>
                 {date && <div className="text-xs text-muted-foreground dark:text-dark-muted-foreground">{date}</div>}
            </CardContent>
        </Card>
    );
};

const FileManager: React.FC<FileManagerProps> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchInputRef = useRef<HTMLInputElement>(null); // Ref for the search input
    const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom);
    const [activeCase, setActiveCase] = useState<Case | null>(null); // State for active case details
    const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom); // Read and write atom state
    const [isNewAITemplateModalOpen, setIsNewAITemplateModalOpen] = useAtom(newAITemplateDraftModalOpenAtom);
    const [isNewAIDocumentDraftModalOpen, setIsNewAIDocumentDraftModalOpen] = useAtom(newAIDocumentDraftModalOpenAtom); // Use the new atom
    const setIsTemplateImportModalOpen = useSetAtom(templateImportModalOpenAtom);
    const setCurrentDocuments = useSetAtom(currentCaseDocumentsAtom as any); // Get setter for the shared atom
    const setChatDocumentContextIds = useSetAtom(chatDocumentContextIdsAtom); // Get setter for context IDs
    const [isDraggingOver, setIsDraggingOver] = useState(false); // State for visual feedback

    // State for managing case management modal
    const [isManageCasesModalOpen, setIsManageCasesModalOpen] = useState(false);

    // State for fetched data
    const [cases, setCases] = useState<Case[]>([]);
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);

    // State for loading and errors
    const [isCasesLoading, setIsCasesLoading] = useState(true);
    const [casesError, setCasesError] = useState<string | null>(null);
    const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
    const [templatesError, setTemplatesError] = useState<string | null>(null);
    const [isDocumentsLoading, setIsDocumentsLoading] = useState(false); // Only load when case selected
    const [documentsError, setDocumentsError] = useState<string | null>(null);

    // State for UI controls
    const [selectedItemId, setSelectedItemId] = useState<string | null>(activeCaseId);
    const [selectedItemType, setSelectedItemType] = useState<ItemType | null>(activeCaseId ? 'case' : null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<string[]>([]); // For multi-selection

    // State for managing actions (rename/delete modals)
    const [actionState, setActionState] = useState<ActionState>({ actionType: null, itemId: null, itemType: null });
    const [newItemName, setNewItemName] = useState('');

    // NEW state for template fetching loader
    const [isFetchingTemplateContent, setIsFetchingTemplateContent] = useState<boolean>(false);

    const setInitialFiles = useSetAtom(initialFilesForUploadAtom); // Get setter for the atom

    const [isCaseRequiredDialogOpen, setIsCaseRequiredDialogOpen] = useState(false);
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

    // Effect to focus search input based on navigation state
    useEffect(() => {
        if (location.state?.focusSearch) {
            console.log('Focus search triggered by navigation state:', location.state.focusSearch);
            searchInputRef.current?.focus();
            setSearchTerm(''); // Clear any previous search term

            // Determine which view to show based on focusSearch value
            if (location.state.focusSearch === 'matters' || location.state.focusSearch === 'cases') {
                // If we want to show all matters initially or a general view for searching matters:
                // This might mean clearing selectedItemType or setting it to a general 'files' view if that existed.
                // For now, focusing search will apply to whatever view (matters/templates) is active or becomes active.
                // If a specific matter was selected, this won't change it, search applies within.
                // To show a top-level search for matters, we might need to handle selectedItemType here:
                // setSelectedItemId(null);
                // setSelectedItemType(null); // This shows the general "Select a matter or template..." view.
            } else if (location.state.focusSearch === 'templates') {
                setSelectedItemId('templates'); // Special ID for template category
                setSelectedItemType('template');
                setActiveCaseId(null);
            }
            // Clear the state to prevent re-triggering (optional, router might handle this)
            // navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, setActiveCaseId]); // Added setActiveCaseId

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const caseIdFromURL = queryParams.get('caseId');
        
        if (caseIdFromURL) {
            console.log('Selecting case from URL parameter:', caseIdFromURL);
            setSelectedItemId(caseIdFromURL);
            setSelectedItemType('case');
            setActiveCaseId(caseIdFromURL);
        }
    }, [location.search, setActiveCaseId]);

    // --- Drag and Drop Handlers ---
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if leaving the actual target, not a child
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
             return;
        }
        setIsDraggingOver(false);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow dropping
        e.stopPropagation();
        setIsDraggingOver(true); // Keep active while dragging over
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            console.log('Files dropped:', files);
            // Set the dropped files in the atom
            setInitialFiles(files);
            // Open the modal
            setIsUploadModalOpen(true);
        }
    };

    // Fetch initial data (cases and templates)
    const fetchInitialData = useCallback(async () => {
        setIsCasesLoading(true);
        setIsTemplatesLoading(true);
        setCasesError(null);
        setTemplatesError(null);
        try {
            const [caseRes, templateRes] = await Promise.all([
                caseService.getUserCases(),
                templateService.getAvailableTemplates()
            ]);

            if (caseRes.error) throw new Error(`Cases Error: ${caseRes.error.message}`);
            setCases(caseRes.data || []);

            if (templateRes.error) throw new Error(`Templates Error: ${templateRes.error.message}`);
            setTemplates(templateRes.data || []);

        } catch (err: unknown) {
            console.error("Error fetching initial file manager data:", err);
            // Type checking for error message
            const message = err instanceof Error ? err.message : String(err);
            if (message?.includes('Cases Error:')) setCasesError(message);
            if (message?.includes('Templates Error:')) setTemplatesError(message);
        } finally {
            setIsCasesLoading(false);
            setIsTemplatesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Fetch documents and case details when selected item changes to a case
    const fetchCaseAndDocs = useCallback(async (caseId: string) => {
        // Fetch case details
        const { data: caseData } = await caseService.getCaseById(caseId);
        setActiveCase(caseData);

        setIsDocumentsLoading(true);
        setDocumentsError(null);
        setDocuments([]); 
        setCurrentDocuments([]); // Clear shared atom too
        try {
            const { data: docData, error } = await documentService.getUserDocuments(caseId);
            if (error) throw error;
            const fetchedDocs = docData || [];
            setDocuments(fetchedDocs as Document[]); 
            setCurrentDocuments(fetchedDocs as any); // Update shared atom
        } catch (err: unknown) { 
            console.error(`Error fetching documents for case ${caseId}:`, err);
            setDocumentsError(err instanceof Error ? err.message : String(err)); 
            setCurrentDocuments([]); // Clear shared atom on error
        } finally {
            setIsDocumentsLoading(false);
        }
    }, [setCurrentDocuments]); // Removed selectedItemId, selectedItemType from deps, keep setCurrentDocuments

    useEffect(() => {
        if (selectedItemType === 'case' && selectedItemId) {
            fetchCaseAndDocs(selectedItemId);
        } else {
            // Clear local and shared state if no case is selected
            setDocuments([]);
            setCurrentDocuments([]); 
            setDocumentsError(null);
            setActiveCase(null);
        }
    }, [selectedItemId, selectedItemType, fetchCaseAndDocs, setCurrentDocuments]);

    // Handle closing the upload modal and refreshing if needed
    const handleUploadModalClose = useCallback((refreshNeeded?: boolean) => {
        setIsUploadModalOpen(false); // Close the modal
        if (refreshNeeded && activeCaseId) {
            console.log('Refresh triggered after upload for case:', activeCaseId);
            fetchCaseAndDocs(activeCaseId);
        }
    }, [setIsUploadModalOpen, activeCaseId, fetchCaseAndDocs]);

    // Helper to refresh lists after mutation
    const refreshData = useCallback(async (mutatedItemType: ItemType, currentSelectedCaseId: string | null) => {
        if (mutatedItemType === 'document' && selectedItemType === 'case' && currentSelectedCaseId) {
            setIsDocumentsLoading(true);
            const { data, error } = await documentService.getUserDocuments(currentSelectedCaseId);
            setDocuments((data || []) as Document[]); 
            setCurrentDocuments((data || []) as any); // Update shared atom
            if(error) {
                setDocumentsError(error.message);
                // Don't show toast here, error is displayed in the main area
            }
            setIsDocumentsLoading(false);
        } else if (mutatedItemType === 'template') {
            setIsTemplatesLoading(true);
            const { data, error } = await templateService.getAvailableTemplates();
            setTemplates(data || []);
            setCurrentDocuments([]); // Also clear documents if viewing templates
            if(error) {
                setTemplatesError(error.message);
                // Don't show toast here, error is displayed in the sidebar
            } 
            setIsTemplatesLoading(false);
        }
        // Optionally refresh cases if case actions are added
    }, [selectedItemType, setCurrentDocuments]); // Added setCurrentDocuments dependency

    // --- NEW: Handler for closing the AI Document Draft modal ---
    const handleAIDraftModalClose = useCallback((refreshNeeded?: boolean) => {
        setIsNewAIDocumentDraftModalOpen(false); // Close the correct modal
        if (refreshNeeded && activeCaseId) {
            console.log('Refresh triggered after AI draft generation for case:', activeCaseId);
            fetchCaseAndDocs(activeCaseId); // Refresh documents if needed
        }
    }, [setIsNewAIDocumentDraftModalOpen, activeCaseId, fetchCaseAndDocs]); // fetchCaseAndDocs depends on setCurrentDocuments

    // --- Handler for closing the AI Template Draft modal ---
    const handleAITemplateModalClose = useCallback((refreshNeeded?: boolean) => {
        setIsNewAITemplateModalOpen(false); // Close the template modal
        if (refreshNeeded) {
            console.log('Refresh triggered after AI Template generation.');
            // Call refreshData specifically for templates
            refreshData('template', activeCaseId); // Pass 'template' type
        }
    }, [setIsNewAITemplateModalOpen, activeCaseId, refreshData]); // Add refreshData to dependencies

    // Handle sidebar item selection
    const handleSelectItem = (id: string, type: ItemType) => {
        setSelectedItemId(id);
        setSelectedItemType(type);
        // Also update the global activeCaseId if a case is selected
        if (type === 'case') {
            setActiveCaseId(id);
        } else {
            setActiveCaseId(null); // Clear active case if selecting templates etc.
        }
    };

    // Handle item click (use template or view document)
    const handleItemClick = async (itemId: string, itemType: ItemType) => {
        if (itemType === 'document') {
            console.log(`Adding document ${itemId} to chat context.`);
            setChatDocumentContextIds(prev => [...new Set([...prev, itemId])]);
            navigate(`/review/document/${itemId}`);
        } else if (itemType === 'template') {
            setPendingTemplateId(itemId);
            if (!activeCaseId) {
                setIsCaseRequiredDialogOpen(true);
                return;
            }
            navigate(`/ai/templates/${itemId}/fill`);
        }
    };
    
    // Handle case required dialog close
    const handleCaseRequiredDialogClose = () => {
        setIsCaseRequiredDialogOpen(false);
        setPendingTemplateId(null);
    };
    
    // Handle case selection from dialog
    const handleCaseSelected = (selectedCaseId: string) => {
        if (pendingTemplateId && selectedCaseId) {
            navigate(`/ai/templates/${pendingTemplateId}/fill`);
            setPendingTemplateId(null);
        }
        setIsCaseRequiredDialogOpen(false);
    };

    // Action handler (rename, delete, download, edit)
    const handleItemAction = async (action: 'rename' | 'delete' | 'download' | 'view' | 'edit', itemId: string, itemType: ItemType) => {
        console.log('Action:', action, 'Item:', itemId, 'Type:', itemType);
        // Clear selection when a single item action is taken, unless it's delete which might be part of bulk
        if (action !== 'delete') {
            setSelectedItems([]);
        }

        switch (action) {
            case 'view':
                if (itemType === 'document') {
                    navigate(`/review/document/${itemId}`);
                }
                break;
            case 'edit': 
                if (itemType === 'template') {
                    navigate(`/ai/templates/${itemId}/fill`);
                } else if (itemType === 'document') {
                    console.log(`Adding document ${itemId} to chat context before editing.`);
                    setChatDocumentContextIds(prev => [...new Set([...prev, itemId])]);
                    navigate(`/review/document/${itemId}`);
                }
                break;
            case 'rename':
                initiateAction('rename', itemId, itemType);
                break;
            case 'delete':
                initiateAction('delete', itemId, itemType);
                break;
            case 'download': 
                // Download logic remains the same (only for documents)
                if (itemType === 'document') {
                    const docToDownload = documents.find(d => d.id === itemId);
                    if (!docToDownload || !docToDownload.storagePath || !docToDownload.filename) { 
                        toast.error('Could not download document: Missing information.');
                        return;
                    }
                    const toastId = toast.loading('Preparing download...');
                    try {
                        const { data: url, error } = await documentService.getDocumentUrl(docToDownload.storagePath);
                        if (error) throw error;
                        if (!url) throw new Error('Failed to get download URL');
                        const a = window.document.createElement('a');
                        a.href = url;
                        a.download = docToDownload.filename || 'download'; 
                        window.document.body.appendChild(a);
                        a.click();
                        window.document.body.removeChild(a);
                        toast.success('Download started.', { id: toastId });
                    } catch (err: unknown) { 
                        toast.error(`Failed to download document: ${err instanceof Error ? err.message : String(err)}`, { id: toastId });
                    }
                } else {
                    toast.info('Download action is not applicable for templates.');
                }
                break;
        }
    };

    // Helper function to initiate an action (opens the relevant dialog)
    const initiateAction = (action: 'rename' | 'delete', itemId: string, itemType: ItemType) => {
        if (action === 'rename') {
            const currentItem = itemType === 'document'
                // Find in Document[] state
                ? documents.find(d => d.id === itemId) 
                : templates.find(t => t.id === itemId);
            // Get name based on type (filename for Document, name for DocumentTemplate)
            const currentName = itemType === 'document'
                ? (currentItem as Document)?.filename 
                : (currentItem as DocumentTemplate)?.name;

            if (!currentItem || !currentName) {
                console.error(`Cannot find ${itemType} with ID ${itemId} or name is missing for renaming.`);
                toast.error(`Could not find the ${itemType} to rename.`);
                return;
            }
            setNewItemName(currentName); 
            setActionState({ actionType: 'rename', itemId, itemType, currentName });
        } else if (action === 'delete') {
            setActionState({ actionType: 'delete', itemId, itemType });
        }
    };

     // Handle the actual rename operation
     const handleRenameConfirm = async () => {
        if (actionState.actionType !== 'rename' || !actionState.itemId || !actionState.itemType || !actionState.currentName) return;

        const { itemId, itemType, currentName } = actionState;
        const finalNewName = newItemName.trim();

        if (!finalNewName || finalNewName === currentName) {
            setActionState({ actionType: null, itemId: null, itemType: null }); // Close dialog
            return; // No change or empty name
        }

        try {
            setSearchTerm(''); // Clear search on rename
            let result;
            if (itemType === 'document') {
                result = await documentService.updateDocument(itemId, { filename: finalNewName });
            } else { // template
                result = await templateService.updateTemplate(itemId, { name: finalNewName });
            }
            if (result.error) throw result.error;
            await refreshData(itemType, selectedItemId); // Refresh the list
            toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} renamed successfully.`);
        } catch (err: unknown) {
            console.error(`Error renaming ${itemType}:`, err);
            // Type checking for error message
            toast.error(`Failed to rename ${itemType}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setActionState({ actionType: null, itemId: null, itemType: null }); // Close dialog
        }
    };

    // Handle the actual delete operation
    const handleDeleteConfirm = async () => {
        if (actionState.actionType !== 'delete' || (!actionState.itemId && !actionState.isBulk)) return;

        const itemsToDelete = actionState.isBulk ? selectedItems : (actionState.itemId ? [actionState.itemId] : []);
        const itemTypeToDelete = actionState.itemType; // Assuming bulk delete is for the same item type currently visible

        if (itemsToDelete.length === 0) {
            setActionState({ actionType: null, itemId: null, itemType: null });
            return;
        }
        const currentSelectedCaseIdBeforeDelete = activeCaseId;


        try {
            setSearchTerm(''); // Clear search on delete
            let allSucceeded = true;
            for (const itemIdToDelete of itemsToDelete) {
                let result;
                if (itemTypeToDelete === 'document') {
                    result = await documentService.deleteDocument(itemIdToDelete);
                } else { // template
                    result = await templateService.deleteTemplate(itemIdToDelete);
                }
                if (result.error) {
                    allSucceeded = false;
                    toast.error(`Failed to delete ${itemTypeToDelete} ${itemIdToDelete}: ${result.error.message}`);
                    // Continue trying to delete others
                }
            }

            if (allSucceeded) {
                toast.success(`${itemsToDelete.length} ${itemTypeToDelete}(s) deleted successfully.`);
            } else {
                toast.warning(`Some ${itemTypeToDelete}s could not be deleted. Please check notifications.`);
            }
            
            // If deleting the currently selected item (single delete scenario), clear selection
            if (!actionState.isBulk && actionState.itemId === selectedItemId && itemTypeToDelete === selectedItemType) {
                setSelectedItemId(null);
                setSelectedItemType(null);
                setActiveCaseId(null); // Clear global active case ID too
            }
            
            setSelectedItems([]); // Clear multi-selection
            await refreshData(itemTypeToDelete as ItemType, currentSelectedCaseIdBeforeDelete); // Refresh the list

        } catch (err: unknown) {
            console.error(`Error deleting ${itemTypeToDelete}(s):`, err);
            toast.error(`Failed to delete ${itemTypeToDelete}(s): ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setActionState({ actionType: null, itemId: null, itemType: null }); // Close dialog
        }
    };

    // Helper to refresh only the cases list
    const refreshCases = useCallback(async () => {
        setIsCasesLoading(true);
        setCasesError(null);
        try {
            const { data, error } = await caseService.getUserCases();
            if (error) throw error;
            setCases(data || []);
        } catch (err: any) {
            console.error("Failed to refresh cases:", err);
            setCasesError(`Failed to reload cases: ${err.message}`);
        } finally {
            setIsCasesLoading(false);
        }
    }, []);

    // Render functions for table rows (kept for list view)
    const renderDocumentRow = (doc: Document) => (
        <tr 
            key={doc.id} 
            className={cn("hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors cursor-pointer", isSelectedItems.includes(doc.id) && "bg-muted/60 dark:bg-dark-muted/60")}
            onClick={() => handleItemClick(doc.id, 'document')}
        >
            <td className="px-3 py-2.5 whitespace-nowrap">
                <input 
                    type="checkbox" 
                    className="h-4 w-4 accent-primary"
                    checked={selectedItems.includes(doc.id)}
                    onChange={(e) => handleToggleSelectItem(doc.id)}
                    onClick={(e) => e.stopPropagation()} 
                />
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                </div>
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden sm:table-cell">
                {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden md:table-cell">
                {formatContentType(doc.contentType)}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 data-[state=open]:bg-muted" onClick={(e: React.MouseEvent) => e.stopPropagation()}> 
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('view', doc.id, 'document'); }}>View</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('edit', doc.id, 'document'); }}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('rename', doc.id, 'document'); }}>Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('download', doc.id, 'document'); }}>Download</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive dark:text-dark-destructive focus:text-destructive dark:focus:text-dark-destructive focus:bg-destructive/10 dark:focus:bg-dark-destructive/10" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('delete', doc.id, 'document'); }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );

    const renderTemplateRow = (template: DocumentTemplate) => (
        <tr 
            key={template.id} 
            className={cn("hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors cursor-pointer", isSelectedItems.includes(template.id) && "bg-muted/60 dark:bg-dark-muted/60")}
            onClick={() => handleItemClick(template.id, 'template')}
        >
            <td className="px-3 py-2.5 whitespace-nowrap">
                <input 
                    type="checkbox" 
                    className="h-4 w-4 accent-primary"
                    checked={selectedItems.includes(template.id)}
                    onChange={(e) => handleToggleSelectItem(template.id)} 
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                    <span className="truncate">{template.name}</span>
                </div>
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden sm:table-cell">
                {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'N/A'}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden md:table-cell">
                {template.category || 'N/A'}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 data-[state=open]:bg-muted" onClick={(e: React.MouseEvent) => e.stopPropagation()}> 
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleItemClick(template.id, 'template')} disabled={!activeCaseId}>
                            <Play className="mr-2 h-4 w-4"/>Use Template
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleItemAction('edit', template.id, 'template')}><Edit className="mr-2 h-4 w-4"/>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleItemAction('rename', template.id, 'template')}>Rename</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive dark:text-dark-destructive focus:text-destructive dark:focus:text-dark-destructive focus:bg-destructive/10 dark:focus:bg-dark-destructive/10" onSelect={() => handleItemAction('delete', template.id, 'template')}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );

    // --- Breadcrumbs Logic ---
    const getTitleAndBreadcrumbs = useCallback(() => {
        let breadcrumbItems: { label: string; href?: string }[] = [{ label: 'Files' }]; 

        switch (selectedItemType) {
            case 'template':
                breadcrumbItems = [{ label: 'Templates' }];
                break;
            case 'case': { // Keep curly braces for scope
                const matterName = activeCase?.name || `Matter (${selectedItemId?.substring(0, 6)}...)`; 
                breadcrumbItems = [
                    { label: 'Matters', href: '/files' }, 
                    { label: matterName },
                ];
                // break; // Explicit break shouldn't be needed due to braces, but try adding if error persists
                break;
            }
            default:
                 breadcrumbItems = [{ label: 'Files' }]; 
                 break;
        }
        return { breadcrumbItems };
    }, [selectedItemType, selectedItemId, activeCase]);

    const { breadcrumbItems } = getTitleAndBreadcrumbs();

    // Filtering logic based on search term
    const filteredCases = useMemo(() => 
        cases.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [cases, searchTerm]
    );

    const filteredTemplates = useMemo(() => 
        templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [templates, searchTerm]
    );

    const filteredDocuments = useMemo(() => 
        documents.filter(d => d.filename?.toLowerCase().includes(searchTerm.toLowerCase())),
        [documents, searchTerm]
    );

    // Placeholder handler for AI Document Generation
    const handleGenerateAIDocument = () => {
        if (!selectedItemId || selectedItemType !== 'case') {
            // Check if there's an active case, otherwise prompt to select one.
            // This logic might need to be adjusted based on UX for AI doc generation without a pre-selected case.
            toast.error("Please select a matter first to generate a document for it.");
            return;
        }
        // Open the new AI Document Draft modal
        setIsNewAIDocumentDraftModalOpen(true);
    };
    
    const handleToggleSelectItem = (itemId: string) => {
        setSelectedItems(prevSelected =>
            prevSelected.includes(itemId)
                ? prevSelected.filter(id => id !== itemId)
                : [...prevSelected, itemId]
        );
    };

    const handleBulkDelete = () => {
        if (selectedItems.length === 0) {
            toast.info("No items selected for deletion.");
            return;
        }
        // Determine item type from the current view context (e.g., if viewing documents, type is 'document')
        // This assumes all selected items are of the same type as the current view.
        const currentViewItemType = selectedItemType === 'case' ? 'document' : 'template';
        if (!currentViewItemType) {
            toast.error("Cannot determine item type for bulk deletion.");
            return;
        }
        setActionState({ actionType: 'delete', itemId: null, itemType: currentViewItemType, isBulk: true });
    };

    // --- Render Logic ---
    const renderGridContent = () => {
        // Grid items for templates
        const templateItems = filteredTemplates.map(template => (
            <GridItem 
                key={`template-${template.id}`}
                id={template.id}
                label={template.name}
                icon={<FileText className="h-4 w-4 text-primary flex-shrink-0" />}
                typeLabel={template.category || 'Template'}
                date={`Updated: ${new Date(template.updatedAt || '').toLocaleDateString()}`}
                onClick={handleItemClick}
                onAction={handleItemAction}
                type="template"
                itemSubActions={[
                    { 
                        label: 'Use Template', 
                        icon: <Play className="h-4 w-4" />, 
                        action: () => navigate(`/ai/templates/${template.id}/fill`),
                        disabled: !activeCaseId 
                    },
                    { 
                        label: 'Edit Details', 
                        icon: <Edit className="h-4 w-4" />, 
                        action: () => navigate(`/ai/templates/${template.id}/fill`)
                    },
                ]}
            />
        ));

        // Grid items for documents
        const documentItems = filteredDocuments.map(doc => (
            <GridItem 
                key={`document-${doc.id}`}
                id={doc.id}
                label={doc.filename || `Document ${doc.id}`}
                icon={<FileText className="h-4 w-4 text-primary flex-shrink-0" />}
                typeLabel={doc.contentType || 'Document'}
                date={`Created: ${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}`}
                onClick={handleItemClick}
                onAction={handleItemAction}
                type="document"
            />
        ));

        // Combine items
        const allItems = [...templateItems, ...documentItems];

        if (isTemplatesLoading || isDocumentsLoading) {
            return <div className="flex justify-center items-center h-64"><Spinner /></div>;
        }
        if (templatesError || documentsError) {
            return <Alert variant="destructive"><AlertDescription>{templatesError || documentsError}</AlertDescription></Alert>;
        }
        if (allItems.length === 0) {
            return <p className="text-center text-muted-foreground py-8">No {activeCaseId ? 'documents or templates' : 'templates'} found{searchTerm ? ' matching search' : ''}.</p>;
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allItems.map(item => (
                    <div key={item.props.id} className="relative">
                        <input
                            type="checkbox"
                            className="absolute top-2 left-2 h-4 w-4 z-10 accent-primary"
                            checked={selectedItems.includes(item.props.id)}
                            onChange={() => handleToggleSelectItem(item.props.id)}
                            onClick={(e) => e.stopPropagation()} // Prevent card click when toggling checkbox
                        />
                        {item}
                    </div>
                ))}
            </div>
        );
    };

    const renderListContent = () => {
        const items: (Document | DocumentTemplate)[] = selectedItemType === 'case' ? filteredDocuments : filteredTemplates;
        const itemType: ItemType = selectedItemType === 'case' ? 'document' : 'template';

        if ((selectedItemType === 'case' && isDocumentsLoading) || (selectedItemType === 'template' && isTemplatesLoading)) {
            return <div className="flex justify-center items-center h-64"><Spinner /></div>;
        }
        if ((selectedItemType === 'case' && documentsError) || (selectedItemType === 'template' && templatesError)) {
            return <Alert variant="destructive"><AlertDescription>{documentsError || templatesError}</AlertDescription></Alert>;
        }
        if (items.length === 0) {
            return <p className="text-center text-muted-foreground py-8">No {itemType}s found{searchTerm ? ' matching search' : ''}.</p>;
        }

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border dark:divide-dark-border">
                    <thead className="bg-muted/50 dark:bg-dark-muted/50">
                        <tr>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-dark-muted-foreground w-10">
                                <input 
                                    type="checkbox" 
                                    className="h-4 w-4 accent-primary"
                                    checked={selectedItems.length > 0 && selectedItems.length === items.length}
                                    onChange={() => {
                                        if (selectedItems.length === items.length) {
                                            setSelectedItems([]);
                                        } else {
                                            setSelectedItems(items.map(i => i.id));
                                        }
                                    }}
                                />
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-dark-muted-foreground">Name</th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-dark-muted-foreground hidden sm:table-cell">
                                {itemType === 'document' ? 'Uploaded' : 'Created'}
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-dark-muted-foreground hidden md:table-cell">
                                {itemType === 'document' ? 'Type' : 'Category'}
                            </th>
                            <th scope="col" className="relative px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-dark-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-dark-border bg-background dark:bg-dark-background">
                        {items.map((item) => {
                            const isSelected = selectedItems.includes(item.id);
                            const commonProps = {
                                onRename: () => handleItemAction('rename', item.id, itemType),
                                onDelete: () => handleItemAction('delete', item.id, itemType),
                            };
                            if (itemType === 'document') {
                                const doc = item as Document;
                                return (
                                    <tr 
                                        key={doc.id} 
                                        className={cn("hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors cursor-pointer", isSelected && "bg-muted/60 dark:bg-dark-muted/60")}
                                        onClick={() => handleItemClick(doc.id, 'document')}
                                    >
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 accent-primary"
                                                checked={isSelected} 
                                                onChange={() => handleToggleSelectItem(doc.id)}
                                                onClick={(e) => e.stopPropagation()} 
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                                                <span className="truncate">{doc.filename}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden sm:table-cell">
                                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden md:table-cell">
                                            {formatContentType(doc.contentType)}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 data-[state=open]:bg-muted" onClick={(e: React.MouseEvent) => e.stopPropagation()}> 
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('view', doc.id, 'document'); }}>View</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('edit', doc.id, 'document'); }}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); commonProps.onRename(); }}>Rename</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleItemAction('download', doc.id, 'document'); }}>Download</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive dark:text-dark-destructive focus:text-destructive dark:focus:text-dark-destructive focus:bg-destructive/10 dark:focus:bg-dark-destructive/10" onClick={(e: React.MouseEvent) => { e.stopPropagation(); commonProps.onDelete(); }}>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            } else {
                                const template = item as DocumentTemplate;
                                return (
                                    <tr 
                                        key={template.id} 
                                        className={cn("hover:bg-muted/50 dark:hover:bg-dark-muted/50 transition-colors cursor-pointer", isSelected && "bg-muted/60 dark:bg-dark-muted/60")}
                                        onClick={() => handleItemClick(template.id, 'template')}
                                    >
                                         <td className="px-3 py-2.5 whitespace-nowrap">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 accent-primary"
                                                checked={isSelected} 
                                                onChange={() => handleToggleSelectItem(template.id)} 
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-foreground dark:text-dark-foreground">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground flex-shrink-0" />
                                                <span className="truncate">{template.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden sm:table-cell">
                                            {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground dark:text-dark-muted-foreground hidden md:table-cell">
                                            {template.category || 'N/A'}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 data-[state=open]:bg-muted" onClick={(e: React.MouseEvent) => e.stopPropagation()}> 
                                                       <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handleItemClick(template.id, 'template')} disabled={!activeCaseId}>
                                                        <Play className="mr-2 h-4 w-4"/>Use Template
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleItemAction('edit', template.id, 'template')}><Edit className="mr-2 h-4 w-4"/>Edit Details</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => commonProps.onRename()}>Rename</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive dark:text-dark-destructive focus:text-destructive dark:focus:text-dark-destructive focus:bg-destructive/10 dark:focus:bg-dark-destructive/10" onSelect={() => commonProps.onDelete()}>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            }
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // Helper function to format content type
    const formatContentType = (contentType: string | null | undefined): string => {
        if (!contentType) return 'N/A';
        if (contentType.includes('pdf')) return 'PDF Document';
        if (contentType.includes('wordprocessingml')) return 'Word Document';
        if (contentType.includes('msword')) return 'Word Document (Legacy)';
        if (contentType.includes('plain')) return 'Text File';
        if (contentType.includes('csv')) return 'CSV File';
        if (contentType.includes('excel') || contentType.includes('spreadsheetml')) return 'Excel Spreadsheet';
        if (contentType.includes('image')) return 'Image';
        // Add more mappings as needed
        return contentType; // Fallback to original if not mapped
    };

    return (
        <div className="flex h-full bg-background text-foreground dark:text-dark-foreground overflow-hidden">
            {/* Sidebar Section */}
            <ScrollArea className="w-64 border-r border-border dark:border-dark-border p-2 shrink-0">
                 {/* Cases Folder */} 
                 <h3 className="text-xs font-semibold uppercase text-muted-foreground dark:text-dark-muted-foreground px-2 mt-2">Matters</h3>
                 <div className="pl-1 space-y-1 mb-4">
                     {isCasesLoading && <Spinner size="sm" className="mx-auto" />}
                     {casesError && <Alert variant="destructive" className="text-xs p-1"><AlertDescription>{casesError}</AlertDescription></Alert>}
                     {!isCasesLoading && !casesError && filteredCases.map(c => (
                         <ListItem 
                             key={c.id} 
                             id={c.id} 
                             label={c.name}
                             icon={<Folder className="h-4 w-4 flex-shrink-0" />} 
                             isSelected={selectedItemType === 'case' && selectedItemId === c.id}
                             onClick={handleSelectItem}
                             type='case'
                         />
                     ))}
                     {!isCasesLoading && !casesError && filteredCases.length === 0 && (
                        <p className="text-xs text-foreground/70 dark:text-muted-foreground italic px-2 py-2">No matters found.</p>
                     )}
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground mt-1" 
                        onClick={() => setIsManageCasesModalOpen(true)}
                     >
                         <FolderPlus className="h-4 w-4 mr-2"/> Manage Matters...
                     </Button>
                 </div>

                {/* Templates Folder */} 
                <h3 className="text-xs font-semibold uppercase text-muted-foreground dark:text-dark-muted-foreground px-2 mt-3">Templates</h3>
                <div className="pl-1 space-y-1 mb-4">
                    {isTemplatesLoading && <Spinner size="sm" className="mx-auto"/>}
                    {templatesError && <Alert variant="destructive" className="text-xs p-1"><AlertDescription>{templatesError}</AlertDescription></Alert>}
                    {!isTemplatesLoading && !templatesError && (
                         <ListItem 
                             id="templates" // Special ID for the template category
                             label="All Templates"
                             icon={<FileText className="h-4 w-4 flex-shrink-0" />}
                             isSelected={selectedItemType === 'template'}
                             onClick={(id, type) => { // Modified onClick to directly set template view
                                 handleSelectItem(id, type);
                                 setActiveCaseId(null); // Ensure no case is active when viewing all templates
                             }}
                             type='template'
                         />
                     )}
                     <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground mt-1" onClick={() => setIsNewAITemplateModalOpen(true)}>
                         <Plus className="h-4 w-4 mr-2"/> Manage Templates...
                     </Button>
                 </div>
             </ScrollArea>

            {/* Main Content Area */}
            <div
                className={cn(
                    "flex-1 flex flex-col overflow-hidden transition-colors",
                    isDraggingOver && "bg-primary/10 dark:bg-dark-primary/10 border-2 border-dashed border-primary dark:border-dark-primary" // Themed drag over
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Toolbar */}
                 <div className="p-2 border-b border-border dark:border-dark-border flex items-center justify-between shrink-0">
                    {/* Left side (Breadcrumbs) */}
                    <div>
                        <Breadcrumb items={breadcrumbItems} />
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        {selectedItems.length > 0 && (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-8"
                                onClick={handleBulkDelete}
                            >
                                Delete ({selectedItems.length})
                            </Button>
                        )}
                        <Input 
                            ref={searchInputRef} // Assign the ref here
                            placeholder="Search current view..." // Updated placeholder
                            className="h-8 w-48 placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {/* TODO: Implement view mode toggle */}
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')} aria-label="List view">
                           <List className="h-4 w-4" />
                        </Button>
                        <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')} aria-label="Grid view">
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        {/* AI Generate Dropdown */} 
                        <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8">
                                     <Sparkles className="h-4 w-4 mr-2" />
                                     Generate...
                                </Button>
                            </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                    onSelect={handleGenerateAIDocument}
                                    disabled={selectedItemType !== 'case'} // Only enable if a case is selected
                                >
                                    Generate Document
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    onSelect={() => setIsNewAITemplateModalOpen(true)}
                                >
                                    Generate Template
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Upload Button */} 
                        <Button 
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                        </Button>
                        
                         {/* Create Blank Document/Template Buttons */} 
                         {selectedItemType === 'case' && selectedItemId && (
                            <Button 
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => navigate(`/review/document/new?caseId=${selectedItemId}`)}
                             >
                                <FilePlus className="h-4 w-4 mr-2" />
                                New Document
                            </Button>
                        )}
                        {selectedItemType === 'template' && (
                             <Button 
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => setIsNewAITemplateModalOpen(true)}
                            >
                                <FilePlus className="h-4 w-4 mr-2" />
                                New Template
                            </Button>
                        )}

                        {/* Import Button (Templates View Only) */} 
                        {selectedItemType === 'template' && (
                            <Button 
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => setIsTemplateImportModalOpen(true)}
                            >
                                <FileUp className="h-4 w-4 mr-2" />
                                Import
                            </Button>
                        )}
                    </div>
                 </div>

                 {/* Content Display */}
                 <ScrollArea className="flex-grow p-4 relative"> {/* Add relative positioning */}
                     {/* Add a pointer-events-none overlay if needed during drag to prevent ScrollArea issues */}
                     {isDraggingOver && <div className="absolute inset-0 bg-transparent pointer-events-none z-10"></div>} {/* Ensure overlay is above content */}
                     {/* Display template fetching loader */} 
                     {isFetchingTemplateContent && ( 
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
                          <Spinner size="lg" />
                         </div>
                     )}
                     {/* Conditional Rendering based on viewMode */}

                     {/* === Case Documents View === */} 
                     {selectedItemType === 'case' && (
                         <> 
                             {isDocumentsLoading && <div className="flex justify-center items-center pt-10"><Spinner size="lg" /></div>}
                             {documentsError && <Alert variant="destructive" className="m-4"><AlertDescription>{documentsError}</AlertDescription></Alert>}
                             {!isDocumentsLoading && !documentsError && (
                                viewMode === 'grid' ? renderGridContent() : renderListContent()
                             )}
                         </>
                     )}

                    {/* === Templates View === */} 
                    {selectedItemType === 'template' && (
                         <>
                             {isTemplatesLoading && <div className="flex justify-center items-center pt-10"><Spinner size="lg" /></div>}
                             {templatesError && <Alert variant="destructive" className="m-4"><AlertDescription>{templatesError}</AlertDescription></Alert>}
                             {!isTemplatesLoading && !templatesError && (
                                viewMode === 'grid' ? renderGridContent() : renderListContent()
                             )}
                         </>
                     )}

                     {/* === Initial/Empty State === */} 
                     {selectedItemType === null && (
                         <div className="flex flex-col items-center justify-center h-full pt-20">
                             <Folder className="h-16 w-16 text-muted-foreground/50 mb-4" /> 
                             <p className="text-muted-foreground">Select a matter or template category to view files.</p>
                         </div>
                     )}
                 </ScrollArea>
            </div>

            {/* Rename Dialog */} 
            <Dialog open={actionState.actionType === 'rename'} onOpenChange={(open) => !open && setActionState({ actionType: null, itemId: null, itemType: null })}> 
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename {actionState.itemType}</DialogTitle>
                        <DialogDescription>
                            Enter a new name for the {actionState.itemType}. 
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">
                                Name
                            </Label>
                            <Input 
                               id="name" 
                               value={newItemName}
                               onChange={(e) => setNewItemName(e.target.value)}
                               className="col-span-3" 
                               onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()} // Allow Enter to submit
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button> {/* Changed from secondary to outline */}
                        </DialogClose>
                        <Button type="button" variant="primary" onClick={handleRenameConfirm}>Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */} 
            <AlertDialog open={actionState.actionType === 'delete'} onOpenChange={(open) => !open && setActionState({ actionType: null, itemId: null, itemType: null })}> 
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete {actionState.isBulk ? `${selectedItems.length} item(s)` : `the ${actionState.itemType} '${actionState.itemId}'`}.
                            {/* TODO: Fetch name for delete confirmation? */}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className={cn(buttonVariants({ variant: "destructive" }))}> 
                            Yes, delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modals Section */}
            <CaseManagementModal 
                isOpen={isManageCasesModalOpen} 
                onClose={() => setIsManageCasesModalOpen(false)} 
                onCasesUpdated={refreshCases}
            />
            <UploadModal 
                isOpen={isUploadModalOpen}
                onClose={handleUploadModalClose} 
            />
            <NewAITemplateDraftModal
                isOpen={isNewAITemplateModalOpen}
                onClose={handleAITemplateModalClose}
            />
            <NewAIDocumentDraftModal 
                isOpen={isNewAIDocumentDraftModalOpen}
                onClose={handleAIDraftModalClose}
                activeCaseId={activeCaseId}
                onSuccess={(newDocId) => {
                    navigate(`/review/document/${newDocId}`);
                }}
            />
            <CaseRequiredDialog
                isOpen={isCaseRequiredDialogOpen}
                onClose={handleCaseRequiredDialogClose}
                action="use this template"
            />
        </div>
    );
};

export default FileManager;
