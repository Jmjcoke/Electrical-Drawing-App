import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

interface SessionExpirationDialogProps {
  open: boolean;
  timeRemaining: number; // milliseconds
  onExtendSession?: () => void;
  onNewSession: () => void;
  onClose: () => void;
  canExtend?: boolean;
}

export const SessionExpirationDialog: React.FC<SessionExpirationDialogProps> = ({
  open,
  timeRemaining,
  onExtendSession,
  onNewSession,
  onClose,
  canExtend = false
}) => {
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  // Update display time every second
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setDisplayTime(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  // Update display time when prop changes
  useEffect(() => {
    setDisplayTime(timeRemaining);
  }, [timeRemaining]);

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getProgressValue = (): number => {
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Math.max(0, (displayTime / fiveMinutes) * 100);
  };

  const isExpired = displayTime <= 0;
  const isUrgent = displayTime <= 60 * 1000; // Less than 1 minute

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isExpired}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isExpired ? (
            <WarningIcon color="error" />
          ) : (
            <ScheduleIcon color={isUrgent ? 'error' : 'warning'} />
          )}
          <Typography variant="h6">
            {isExpired ? 'Session Expired' : 'Session Expiring Soon'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isExpired ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Your session has expired. You'll need to start a new session to continue.
          </Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your session will expire soon. Any unsaved work may be lost.
            </Alert>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Time remaining
                </Typography>
                <Chip 
                  label={formatTimeRemaining(displayTime)}
                  color={isUrgent ? 'error' : 'warning'}
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={getProgressValue()}
                color={isUrgent ? 'error' : 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </>
        )}

        <Typography variant="body2" color="text.secondary">
          {isExpired 
            ? 'To protect your privacy, sessions are automatically cleared after a period of inactivity.'
            : 'Sessions help keep your uploaded documents and chat history organized during your visit.'
          }
        </Typography>
      </DialogContent>

      <DialogActions>
        {!isExpired && (
          <Button onClick={onClose} color="inherit">
            Continue Working
          </Button>
        )}
        
        {canExtend && !isExpired && onExtendSession && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onExtendSession}
            color="primary"
            variant="outlined"
          >
            Extend Session
          </Button>
        )}
        
        <Button
          startIcon={<HomeIcon />}
          onClick={onNewSession}
          color="primary"
          variant="contained"
        >
          {isExpired ? 'Start New Session' : 'Start Over'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};