import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth(); // Get user and signOut
  const navigate = useNavigate(); // For redirect after delete

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [newEmail, setNewEmail] = React.useState(user?.email || '');
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
        // Note: Supabase updateUser doesn't strictly require current password
        // but it's good practice to verify user identity if needed
        // For simplicity here, we proceed directly if passwords match
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        toast.success("Password updated successfully!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
    } catch (error: any) {
        console.error("Error updating password:", error);
        toast.error(`Failed to update password: ${error.message}`);
    } finally {
        setIsUpdatingPassword(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === user?.email) {
        toast.info("Please enter a new, different email address.");
        return;
    }
    setIsUpdatingEmail(true);
    try {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        toast.success("Confirmation email sent! Please check your new email address to confirm the change.");
        // Reset input if desired, or leave as is until confirmed
        // setNewEmail(''); 
    } catch (error: any) {
        console.error("Error updating email:", error);
        toast.error(`Failed to update email: ${error.message}`);
    } finally {
        setIsUpdatingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // IMPORTANT: Requires a backend Supabase Edge Function 'delete-user'
      const { error } = await supabase.functions.invoke('delete-user');

      if (error) throw error;

      toast.success("Account deletion initiated. You will be logged out.");
      await signOut();
      navigate('/auth'); // Redirect to auth page

    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(`Failed to delete account: ${error.message || 'Function not available?'}`);
      setIsDeletingAccount(false); // Ensure button is re-enabled on error
    }
    // No finally block needed here as we navigate away on success
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Account Settings</h1>
      
      {/* Update Email Section */}
      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>
            Update the email address associated with your account. A confirmation will be sent to the new address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-email">Current Email</Label>
              <Input id="current-email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New Email</Label>
              <Input 
                id="new-email" 
                type="email" 
                placeholder="new.email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required 
                disabled={isUpdatingEmail}
              />
            </div>
            <Button type="submit" disabled={isUpdatingEmail || newEmail === user?.email}>
              {isUpdatingEmail ? 'Updating...' : 'Update Email'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Update Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your account password. Choose a strong, unique password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
             {/* Removed Current Password input for simplicity with Supabase flow */}
             {/* <div className="space-y-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <Input 
                id="current-password" 
                type="password" 
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required 
                disabled={isUpdatingPassword}
              />
            </div> */} 
             <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password" 
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required 
                disabled={isUpdatingPassword}
              />
            </div>
             <div className="space-y-1.5">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input 
                id="confirm-new-password" 
                type="password" 
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required 
                disabled={isUpdatingPassword}
              />
            </div>
            {/* Updated disabled condition */}
            <Button type="submit" disabled={isUpdatingPassword || !newPassword || newPassword !== confirmNewPassword}>
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Delete Account Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeletingAccount}>
                {isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account 
                  and remove your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeletingAccount}>
                  {isDeletingAccount ? 'Deleting...' : 'Yes, delete account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage; 