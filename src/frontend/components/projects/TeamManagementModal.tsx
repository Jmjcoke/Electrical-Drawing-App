import React, { useState, useEffect } from 'react';
import { Plus, Trash2, UserCheck, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/Avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Alert, AlertDescription } from '../ui/Alert';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useProjectStore } from '../../stores/projectStore';
import { useUserStore } from '../../stores/userStore';
import type { Project, User } from '../../types/api';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdate?: () => void;
}

interface TeamMember {
  user: User;
  role: string;
  added_at: string;
}

export const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('PROJECT_MEMBER');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addTeamMember, removeTeamMember, updateTeamMemberRole } = useProjectStore();
  const { users, fetchUsers } = useUserStore();

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen]);

  const loadAvailableUsers = async () => {
    setIsLoadingUsers(true);
    try {
      await fetchUsers();
      const currentTeamUserIds = project.team_members?.map(tm => tm.user.id) || [];
      setAvailableUsers(users.filter(user => !currentTeamUserIds.includes(user.id)));
    } catch (error) {
      setError('Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedRole) {
      setError('Please select a user and role');
      return;
    }

    setIsAddingMember(true);
    setError(null);

    try {
      await addTeamMember(project.id, selectedUserId, selectedRole);
      setSelectedUserId('');
      setSelectedRole('PROJECT_MEMBER');
      await loadAvailableUsers();
      onUpdate?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add team member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      try {
        await removeTeamMember(project.id, userId);
        await loadAvailableUsers();
        onUpdate?.();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to remove team member');
      }
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateTeamMemberRole(project.id, userId, newRole);
      onUpdate?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update team member role');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedUserId('');
    setSelectedRole('PROJECT_MEMBER');
    setError(null);
    onClose();
  };

  const filteredUsers = availableUsers.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'PROJECT_MANAGER':
        return 'default';
      case 'LEAD_ENGINEER':
        return 'secondary';
      case 'SENIOR_ENGINEER':
        return 'outline';
      case 'ENGINEER':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Team - {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setError(null)}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Add New Member Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Add Team Member</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {isLoadingUsers ? (
                  <div className="mt-2 flex items-center justify-center p-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          selectedUserId === user.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{user.full_name || user.email}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="mt-2 text-sm text-gray-500 p-3 border rounded-md">
                    No users found matching "{searchQuery}"
                  </div>
                ) : null}
              </div>

              <div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                    <SelectItem value="LEAD_ENGINEER">Lead Engineer</SelectItem>
                    <SelectItem value="SENIOR_ENGINEER">Senior Engineer</SelectItem>
                    <SelectItem value="ENGINEER">Engineer</SelectItem>
                    <SelectItem value="PROJECT_MEMBER">Project Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || !selectedRole || isAddingMember}
                  loading={isAddingMember}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </div>
            </div>
          </div>

          {/* Current Team Members */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Current Team Members ({project.team_members?.length || 0})
            </h3>

            {!project.team_members || project.team_members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No team members added yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.team_members.map((member) => (
                    <TableRow key={member.user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.user.avatar} />
                            <AvatarFallback>
                              {getInitials(member.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {member.user.full_name || member.user.email}
                            </div>
                            <div className="text-sm text-gray-500">
                              {member.user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          onValueChange={(newRole) => handleUpdateRole(member.user.id, newRole)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                            <SelectItem value="LEAD_ENGINEER">Lead Engineer</SelectItem>
                            <SelectItem value="SENIOR_ENGINEER">Senior Engineer</SelectItem>
                            <SelectItem value="ENGINEER">Engineer</SelectItem>
                            <SelectItem value="PROJECT_MEMBER">Project Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {formatDate(member.added_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user.id)}
                          disabled={member.user.id === project.created_by}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};