import React from 'react';
import {
  Box,
  Typography,
  useTheme,
  keyframes,
  styled,
} from '@mui/material';
import { SmartToy as BotIcon } from '@mui/icons-material';

// Bouncing dots animation
const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

const BouncingDot = styled(Box)(({ theme }) => ({
  width: 8,
  height: 8,
  backgroundColor: theme.palette.text.secondary,
  borderRadius: '50%',
  display: 'inline-block',
  animation: `${bounce} 1.4s infinite ease-in-out`,
  '&:nth-of-type(1)': {
    animationDelay: '-0.32s',
  },
  '&:nth-of-type(2)': {
    animationDelay: '-0.16s',
  },
  '&:nth-of-type(3)': {
    animationDelay: '0s',
  },
}));

const pulseAnimation = keyframes`
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.4;
  }
`;

interface TypingIndicatorProps {
  message?: string;
  showAvatar?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  message = "AI is thinking...",
  showAvatar = true
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        mb: 2,
        px: 1,
        animation: `${pulseAnimation} 2s infinite ease-in-out`,
      }}
    >
      {/* Avatar */}
      {showAvatar && (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: theme.palette.secondary.main,
            color: 'white',
            mx: 1,
            flexShrink: 0
          }}
        >
          <BotIcon />
        </Box>
      )}

      {/* Typing Bubble */}
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: theme.palette.divider,
          boxShadow: theme.shadows[1],
          position: 'relative',
          minWidth: '80px',
          '&::before': showAvatar ? {
            content: '""',
            position: 'absolute',
            top: '10px',
            left: '-6px',
            width: 0,
            height: 0,
            borderRight: `6px solid ${theme.palette.background.paper}`,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
          } : {}
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 1
          }}
        >
          {/* Typing message */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: '0.875rem',
              fontStyle: 'italic'
            }}
          >
            {message}
          </Typography>

          {/* Bouncing dots */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              py: 0.5
            }}
          >
            <BouncingDot />
            <BouncingDot />
            <BouncingDot />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};