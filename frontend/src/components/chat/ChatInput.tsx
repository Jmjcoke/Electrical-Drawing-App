import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Autocomplete,
  Chip,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Tooltip,
  Alert,
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Query, AutocompleteOption, UploadedFile } from '../../types/chat';
import { validateChatInput, generateSuggestions, formatChatValidationErrors } from '../../utils/chatValidation';

interface ChatInputProps {
  onSendMessage: (message: string, type: 'component_identification' | 'general_question' | 'schematic_analysis') => void;
  disabled?: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  queryHistory: Query[];
  uploadedFiles: UploadedFile[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  connectionStatus,
  queryHistory,
  uploadedFiles
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [inputValue, setInputValue] = useState('');
  const [queryType, setQueryType] = useState<'component_identification' | 'general_question' | 'schematic_analysis'>('general_question');
  const [isComposing, setIsComposing] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate autocomplete options
  const autocompleteOptions = useMemo((): AutocompleteOption[] => {
    const options: AutocompleteOption[] = [];

    // Suggested questions based on uploaded files
    if (uploadedFiles.length > 0) {
      const suggestions = [
        { label: 'What components are in this schematic?', category: 'suggested' as const, value: 'What components are in this schematic?' },
        { label: 'Identify all resistors in this circuit', category: 'suggested' as const, value: 'Identify all resistors in this circuit' },
        { label: 'What is the voltage rating of this circuit?', category: 'suggested' as const, value: 'What is the voltage rating of this circuit?' },
        { label: 'Explain the purpose of this electrical diagram', category: 'suggested' as const, value: 'Explain the purpose of this electrical diagram' },
        { label: 'Are there any safety concerns with this wiring?', category: 'suggested' as const, value: 'Are there any safety concerns with this wiring?' },
        { label: 'What type of electrical system is this?', category: 'suggested' as const, value: 'What type of electrical system is this?' }
      ];
      options.push(...suggestions);
    }

    // Recent query history (last 10 unique queries)
    const recentQueries = queryHistory
      .slice(-10)
      .map(query => ({
        label: query.text,
        category: 'history' as const,
        value: query.text
      }))
      .filter((option, index, self) => 
        self.findIndex(o => o.value === option.value) === index
      );
    
    options.push(...recentQueries);

    // Template questions by category
    const templates: Record<string, AutocompleteOption[]> = {
      component_identification: [
        { label: 'Identify all capacitors', category: 'template', value: 'Identify all capacitors in this schematic' },
        { label: 'Find all inductors', category: 'template', value: 'Find all inductors in this circuit' },
        { label: 'List all integrated circuits', category: 'template', value: 'List all integrated circuits shown' }
      ],
      general_question: [
        { label: 'How does this circuit work?', category: 'template', value: 'How does this circuit work?' },
        { label: 'What is the purpose of this diagram?', category: 'template', value: 'What is the purpose of this diagram?' },
        { label: 'Are there any errors in this schematic?', category: 'template', value: 'Are there any errors in this schematic?' }
      ],
      schematic_analysis: [
        { label: 'Analyze the power consumption', category: 'template', value: 'Analyze the power consumption of this circuit' },
        { label: 'Check for design violations', category: 'template', value: 'Check for design violations in this schematic' },
        { label: 'Evaluate signal integrity', category: 'template', value: 'Evaluate signal integrity in this design' }
      ]
    };

    if (templates[queryType]) {
      options.push(...templates[queryType]);
    }

    return options;
  }, [uploadedFiles.length, queryHistory, queryType]);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    const message = inputValue.trim();
    if (!message || disabled || isComposing) {
      return;
    }

    // Validate input
    const validation = validateChatInput(message, {
      maxLength: 2000,
      requireDocuments: uploadedFiles.length === 0,
      checkForSpam: true
    });

    if (!validation.isValid) {
      setValidationError(formatChatValidationErrors(validation));
      return;
    }

    // Clear any previous validation errors
    setValidationError('');
    setShowSuggestions(false);

    // Use sanitized content
    const sanitizedMessage = validation.sanitizedContent || message;
    onSendMessage(sanitizedMessage, queryType);
    setInputValue('');
    
    // Focus back to input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [inputValue, disabled, isComposing, onSendMessage, queryType, uploadedFiles.length]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isComposing]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    
    // Clear validation errors when user starts typing
    if (validationError) {
      setValidationError('');
    }
    
    // Show suggestions for short or vague inputs
    if (value.trim().length > 0 && value.trim().length < 20) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [validationError]);

  const handleAutocompleteChange = useCallback((_: React.SyntheticEvent, value: string | AutocompleteOption | null) => {
    if (value && typeof value === 'object') {
      handleInputChange(value.value);
      // Auto-detect query type based on suggestion
      if (value.category === 'template' || value.label.toLowerCase().includes('identify') || value.label.toLowerCase().includes('find')) {
        setQueryType('component_identification');
      } else if (value.label.toLowerCase().includes('analyze') || value.label.toLowerCase().includes('check') || value.label.toLowerCase().includes('evaluate')) {
        setQueryType('schematic_analysis');
      }
    }
  }, [handleInputChange]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return theme.palette.success.main;
      case 'connecting': return theme.palette.warning.main;
      case 'disconnected': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      {/* Query Type and Connection Status */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: 1
        }}
      >
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Question Type</InputLabel>
          <Select
            value={queryType}
            label="Question Type"
            onChange={(e) => setQueryType(e.target.value as typeof queryType)}
            disabled={disabled}
          >
            <MenuItem value="general_question">General Question</MenuItem>
            <MenuItem value="component_identification">Component Identification</MenuItem>
            <MenuItem value="schematic_analysis">Schematic Analysis</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: getConnectionStatusColor()
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {getConnectionStatusText()}
          </Typography>
        </Box>
      </Box>

      {/* Input Area */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Autocomplete
          freeSolo
          fullWidth
          options={autocompleteOptions}
          groupBy={(option) => {
            switch (option.category) {
              case 'suggested': return 'Suggested Questions';
              case 'history': return 'Recent Questions';
              case 'template': return 'Templates';
              default: return '';
            }
          }}
          getOptionLabel={(option) => 
            typeof option === 'string' ? option : option.label
          }
          value={null}
          inputValue={inputValue}
          onInputChange={(_, value) => handleInputChange(value)}
          onChange={handleAutocompleteChange}
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              ref={inputRef}
              placeholder={
                uploadedFiles.length === 0 
                  ? "Upload a document to start asking questions..."
                  : "Ask a question about your uploaded documents..."
              }
              multiline
              minRows={1}
              maxRows={4}
              variant="outlined"
              onKeyPress={handleKeyPress}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              disabled={disabled}
              InputProps={{
                ...params.InputProps,
                sx: {
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Box>
                <Typography variant="body2">
                  {option.label}
                </Typography>
                <Chip
                  label={option.category}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 16, mt: 0.5 }}
                />
              </Box>
            </Box>
          )}
        />

        <Tooltip title={disabled ? "Upload a document first" : "Send message (Enter)"}>
          <span>
            <IconButton
              type="submit"
              disabled={disabled || !inputValue.trim() || isComposing}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark
                },
                '&:disabled': {
                  bgcolor: theme.palette.action.disabled,
                  color: theme.palette.action.disabled
                }
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* File indicators */}
      {uploadedFiles.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {uploadedFiles.slice(0, 3).map((file) => (
            <Chip
              key={file.fileId}
              label={file.originalName}
              size="small"
              icon={<AttachFileIcon />}
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
          {uploadedFiles.length > 3 && (
            <Chip
              label={`+${uploadedFiles.length - 3} more`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>
      )}

      {/* Validation Error Display */}
      <Collapse in={!!validationError}>
        <Alert 
          severity="error" 
          variant="outlined"
          sx={{ mt: 1 }}
          onClose={() => setValidationError('')}
        >
          <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
            {validationError}
          </Typography>
        </Alert>
      </Collapse>

      {/* Suggestions Display */}
      <Collapse in={showSuggestions && !validationError}>
        <Alert 
          severity="info" 
          variant="outlined"
          icon={<WarningIcon />}
          sx={{ mt: 1 }}
          onClose={() => setShowSuggestions(false)}
        >
          <Typography variant="body2" gutterBottom>
            Need help with your question?
          </Typography>
          <Box sx={{ mt: 1 }}>
            {generateSuggestions(inputValue, uploadedFiles.length > 0).slice(0, 2).map((suggestion, index) => (
              <Typography 
                key={index}
                variant="body2" 
                sx={{ 
                  cursor: 'pointer',
                  color: 'info.main',
                  '&:hover': { textDecoration: 'underline' },
                  mb: 0.5
                }}
                onClick={() => {
                  handleInputChange(suggestion);
                  setShowSuggestions(false);
                }}
              >
                • {suggestion}
              </Typography>
            ))}
          </Box>
        </Alert>
      </Collapse>
    </Box>
  );
};