import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Paper,
  Popper,
  ClickAwayListener,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Switch,
  FormControlLabel,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Badge,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as AttachMoneyIcon,
  Inventory as InventoryIcon,
  SwapHoriz as SwapHorizIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface SpecificationData {
  component_id: string;
  manufacturer: string;
  model_number: string;
  category: string;
  specifications?: {
    voltage: string;
    current: string;
    power?: string;
    certifications: string[];
  };
  compliance?: {
    status: 'valid' | 'warning' | 'error' | 'unknown';
    message: string;
    color: string;
  };
  pricing?: {
    unit_price: number;
    currency: string;
  };
  availability?: {
    in_stock: boolean;
    lead_time: string | number;
  };
  alternatives?: string[];
  config: {
    show_specifications: boolean;
    show_compliance: boolean;
    show_pricing: boolean;
    show_availability: boolean;
    show_alternatives: boolean;
    transparency: number;
    position: string;
    color_scheme: string;
  };
}

interface OverlayPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpecificationOverlayProps {
  specificationData?: SpecificationData;
  position: OverlayPosition;
  visible: boolean;
  onClose: () => void;
  onRefresh: (componentId: string) => void;
  onAlternativeSelect: (alternative: string) => void;
  onConfigChange: (config: Partial<SpecificationData['config']>) => void;
  isLoading?: boolean;
}

const SpecificationOverlay: React.FC<SpecificationOverlayProps> = ({
  specificationData,
  position,
  visible,
  onClose,
  onRefresh,
  onAlternativeSelect,
  onConfigChange,
  isLoading = false
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState(specificationData?.config || {
    show_specifications: true,
    show_compliance: true,
    show_pricing: false,
    show_availability: true,
    show_alternatives: false,
    transparency: 0.9,
    position: 'auto',
    color_scheme: 'default'
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const settingsAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (specificationData?.config) {
      setLocalConfig(specificationData.config);
    }
  }, [specificationData]);

  const handleConfigChange = useCallback((key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  }, [localConfig, onConfigChange]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircleIcon sx={{ color: '#4CAF50' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#FF9800' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#F44336' }} />;
      default:
        return <InfoIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  const getOverlayPosition = () => {
    if (localConfig.position === 'auto') {
      // Auto-position based on available space
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const overlayWidth = 320;
      const overlayHeight = 400;
      
      let x = position.x + position.width + 10;
      let y = position.y;
      
      // Adjust if overlay would go off-screen
      if (x + overlayWidth > viewportWidth) {
        x = position.x - overlayWidth - 10;
      }
      
      if (y + overlayHeight > viewportHeight) {
        y = viewportHeight - overlayHeight - 10;
      }
      
      return { x: Math.max(10, x), y: Math.max(10, y) };
    }
    
    // Manual positioning
    const positionMap = {
      'top': { x: position.x, y: position.y - 200 },
      'bottom': { x: position.x, y: position.y + position.height + 10 },
      'left': { x: position.x - 330, y: position.y },
      'right': { x: position.x + position.width + 10, y: position.y }
    };
    
    return positionMap[localConfig.position as keyof typeof positionMap] || { x: position.x, y: position.y };
  };

  const overlayPosition = getOverlayPosition();

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const renderSpecifications = () => {
    if (!localConfig.show_specifications || !specificationData?.specifications) {
      return null;
    }

    const specs = specificationData.specifications;

    return (
      <Box mb={2}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Electrical Specifications
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Voltage
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {specs.voltage}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Current
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {specs.current}
            </Typography>
          </Grid>
          {specs.power && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Power
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {specs.power}
              </Typography>
            </Grid>
          )}
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Certifications
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5}>
              {specs.certifications.map((cert, index) => (
                <Chip
                  key={index}
                  label={cert}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderCompliance = () => {
    if (!localConfig.show_compliance || !specificationData?.compliance) {
      return null;
    }

    const compliance = specificationData.compliance;

    return (
      <Box mb={2}>
        <Alert
          severity={compliance.status === 'valid' ? 'success' : 
                   compliance.status === 'warning' ? 'warning' : 'error'}
          icon={getStatusIcon(compliance.status)}
          sx={{ mb: 1 }}
        >
          <Typography variant="body2">
            {compliance.message}
          </Typography>
        </Alert>
      </Box>
    );
  };

  const renderPricing = () => {
    if (!localConfig.show_pricing || !specificationData?.pricing) {
      return null;
    }

    const pricing = specificationData.pricing;

    return (
      <Box mb={2}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          <AttachMoneyIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
          Pricing
        </Typography>
        <Typography variant="h6" color="success.main" fontWeight="bold">
          {formatCurrency(pricing.unit_price, pricing.currency)}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          Unit price (current)
        </Typography>
      </Box>
    );
  };

  const renderAvailability = () => {
    if (!localConfig.show_availability || !specificationData?.availability) {
      return null;
    }

    const availability = specificationData.availability;

    return (
      <Box mb={2}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          <InventoryIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
          Availability
        </Typography>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Chip
            label={availability.in_stock ? 'In Stock' : 'Out of Stock'}
            size="small"
            color={availability.in_stock ? 'success' : 'error'}
            variant="filled"
          />
        </Box>
        <Typography variant="body2" color="textSecondary">
          Lead time: {availability.lead_time} {typeof availability.lead_time === 'number' ? 'days' : ''}
        </Typography>
      </Box>
    );
  };

  const renderAlternatives = () => {
    if (!localConfig.show_alternatives || !specificationData?.alternatives?.length) {
      return null;
    }

    return (
      <Box mb={2}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          <SwapHorizIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
          Alternatives
        </Typography>
        <List dense>
          {specificationData.alternatives.map((alternative, index) => (
            <ListItem
              key={index}
              button
              onClick={() => onAlternativeSelect(alternative)}
              sx={{ py: 0.5, px: 1, borderRadius: 1 }}
            >
              <ListItemText
                primary={alternative}
                primaryTypographyProps={{ variant: 'body2' }}
              />
              <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderSettings = () => (
    <Popper
      open={showSettings}
      anchorEl={settingsAnchorRef.current}
      placement="left-start"
      transition
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 10],
          },
        },
      ]}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={350}>
          <Paper sx={{ p: 2, minWidth: 280 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Overlay Settings
            </Typography>
            
            <Box mb={2}>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                Display Options
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.show_specifications}
                    onChange={(e) => handleConfigChange('show_specifications', e.target.checked)}
                    size="small"
                  />
                }
                label="Specifications"
                sx={{ display: 'block', mb: 0.5 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.show_compliance}
                    onChange={(e) => handleConfigChange('show_compliance', e.target.checked)}
                    size="small"
                  />
                }
                label="Compliance"
                sx={{ display: 'block', mb: 0.5 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.show_pricing}
                    onChange={(e) => handleConfigChange('show_pricing', e.target.checked)}
                    size="small"
                  />
                }
                label="Pricing"
                sx={{ display: 'block', mb: 0.5 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.show_availability}
                    onChange={(e) => handleConfigChange('show_availability', e.target.checked)}
                    size="small"
                  />
                }
                label="Availability"
                sx={{ display: 'block', mb: 0.5 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.show_alternatives}
                    onChange={(e) => handleConfigChange('show_alternatives', e.target.checked)}
                    size="small"
                  />
                }
                label="Alternatives"
                sx={{ display: 'block' }}
              />
            </Box>

            <Box mb={2}>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                Transparency
              </Typography>
              <Slider
                value={localConfig.transparency}
                onChange={(_, value) => handleConfigChange('transparency', value)}
                min={0.3}
                max={1.0}
                step={0.1}
                size="small"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>

            <Box mb={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={localConfig.position}
                  onChange={(e) => handleConfigChange('position', e.target.value)}
                  label="Position"
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  <MenuItem value="top">Top</MenuItem>
                  <MenuItem value="bottom">Bottom</MenuItem>
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FormControl size="small" fullWidth>
                <InputLabel>Color Scheme</InputLabel>
                <Select
                  value={localConfig.color_scheme}
                  onChange={(e) => handleConfigChange('color_scheme', e.target.value)}
                  label="Color Scheme"
                >
                  <MenuItem value="default">Default</MenuItem>
                  <MenuItem value="high_contrast">High Contrast</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>
        </Fade>
      )}
    </Popper>
  );

  if (!visible || !specificationData) {
    return null;
  }

  return (
    <ClickAwayListener onClickAway={() => setShowSettings(false)}>
      <Box
        ref={overlayRef}
        sx={{
          position: 'fixed',
          left: overlayPosition.x,
          top: overlayPosition.y,
          zIndex: 1300,
          opacity: localConfig.transparency
        }}
      >
        <Card
          elevation={8}
          sx={{
            width: 320,
            maxHeight: 500,
            overflow: 'auto',
            backgroundColor: localConfig.color_scheme === 'dark' ? 'grey.900' : 
                           localConfig.color_scheme === 'light' ? 'background.paper' : 'background.default'
          }}
        >
          <CardContent sx={{ pb: 1 }}>
            {/* Header */}
            <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
              <Box flex={1}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem' }}>
                  {specificationData.manufacturer}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {specificationData.model_number}
                </Typography>
                <Chip 
                  label={specificationData.category} 
                  size="small" 
                  color="primary" 
                  sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }}
                />
              </Box>
              <Box>
                <Tooltip title="Refresh Data">
                  <IconButton 
                    size="small" 
                    onClick={() => onRefresh(specificationData.component_id)}
                    disabled={isLoading}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                  <IconButton 
                    ref={settingsAnchorRef}
                    size="small" 
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton size="small" onClick={onClose}>
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Loading indicator */}
            {isLoading && (
              <Box mb={2}>
                <LinearProgress size="small" />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                  Updating specification data...
                </Typography>
              </Box>
            )}

            {/* Content sections */}
            {renderSpecifications()}
            {renderCompliance()}
            {renderPricing()}
            {renderAvailability()}
            {renderAlternatives()}

            {/* Footer info */}
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="textSecondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
          </CardContent>
        </Card>

        {/* Settings panel */}
        {renderSettings()}
      </Box>
    </ClickAwayListener>
  );
};

export default SpecificationOverlay;