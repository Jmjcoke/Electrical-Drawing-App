import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';

interface ComponentSpecification {
  manufacturer: string;
  model_number: string;
  category: string;
  voltage_rating: number;
  current_rating: number;
  power_rating?: number;
  dimensions: { [key: string]: number };
  certifications: string[];
  installation_notes: string;
  datasheet_url?: string;
  price_estimate?: number;
  availability: string;
  replacement_parts: string[];
}

interface RecognitionResult {
  component_id: string;
  category: string;
  confidence: number;
  confidence_level: 'low' | 'medium' | 'high' | 'very_high';
  bounding_box: [number, number, number, number];
  specifications?: ComponentSpecification;
  visual_features: { [key: string]: any };
  recognition_timestamp: string;
  alternative_matches: Array<{
    category: string;
    confidence: number;
  }>;
}

interface ComponentIntelligencePanelProps {
  selectedComponent?: RecognitionResult;
  recognitionResults: RecognitionResult[];
  onComponentSelect: (component: RecognitionResult) => void;
  onSpecificationLookup: (componentId: string) => void;
  onBatchRecognition: () => void;
  isProcessing: boolean;
  recognitionStats?: {
    total_recognitions: number;
    categories: { [key: string]: number };
    confidence_levels: { [key: string]: number };
    cache_hit_ratio: number;
  };
}

const ComponentIntelligencePanel: React.FC<ComponentIntelligencePanelProps> = ({
  selectedComponent,
  recognitionResults,
  onComponentSelect,
  onSpecificationLookup,
  onBatchRecognition,
  isProcessing,
  recognitionStats
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showSpecDialog, setShowSpecDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [expandedAccordions, setExpandedAccordions] = useState<{ [key: string]: boolean }>({
    specifications: true,
    alternatives: false,
    features: false
  });

  const getConfidenceColor = (confidence: number): 'error' | 'warning' | 'info' | 'success' => {
    if (confidence >= 0.95) return 'success';
    if (confidence >= 0.85) return 'info';
    if (confidence >= 0.70) return 'warning';
    return 'error';
  };

  const getConfidenceIcon = (confidenceLevel: string) => {
    switch (confidenceLevel) {
      case 'very_high':
        return <CheckCircleIcon color="success" />;
      case 'high':
        return <CheckCircleIcon color="info" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  const formatCurrency = (amount?: number): string => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDimensions = (dimensions: { [key: string]: number }): string => {
    const { width, height, depth } = dimensions;
    if (width && height && depth) {
      return `${width}" × ${height}" × ${depth}"`;
    }
    return Object.entries(dimensions)
      .map(([key, value]) => `${key}: ${value}"`)
      .join(', ');
  };

  const handleAccordionToggle = (panel: string) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  const renderSpecificationDetails = () => {
    if (!selectedComponent?.specifications) {
      return (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Component Specifications
            </Typography>
            <Typography color="textSecondary">
              No specifications available. Click on a recognized component to view details.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    const specs = selectedComponent.specifications;

    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Component Specifications
            </Typography>
            <Box>
              <Tooltip title="View Datasheet">
                <IconButton
                  onClick={() => specs.datasheet_url && window.open(specs.datasheet_url, '_blank')}
                  disabled={!specs.datasheet_url}
                >
                  <VisibilityIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Detailed Specifications">
                <IconButton onClick={() => setShowSpecDialog(true)}>
                  <InfoIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Manufacturer
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {specs.manufacturer}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Model Number
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {specs.model_number}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Category
              </Typography>
              <Chip 
                label={specs.category.replace('_', ' ').toUpperCase()} 
                size="small" 
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Voltage Rating
              </Typography>
              <Typography variant="body1">
                {specs.voltage_rating}V
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Current Rating
              </Typography>
              <Typography variant="body1">
                {specs.current_rating}A
              </Typography>
            </Grid>
            {specs.power_rating && (
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="textSecondary">
                  Power Rating
                </Typography>
                <Typography variant="body1">
                  {specs.power_rating}W
                </Typography>
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Dimensions
              </Typography>
              <Typography variant="body1">
                {formatDimensions(specs.dimensions)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Price Estimate
              </Typography>
              <Typography variant="body1" color="success.main" fontWeight="bold">
                {formatCurrency(specs.price_estimate)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Certifications
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                {specs.certifications.map((cert, index) => (
                  <Chip 
                    key={index} 
                    label={cert} 
                    size="small" 
                    variant="outlined"
                    color="secondary"
                  />
                ))}
              </Box>
            </Grid>
            {specs.installation_notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Installation Notes
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  {specs.installation_notes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderRecognitionResults = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Recognition Results
          </Typography>
          <Box>
            <Tooltip title="Recognition Statistics">
              <IconButton onClick={() => setShowStatsDialog(true)}>
                <AssessmentIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Batch Recognition">
              <IconButton 
                onClick={onBatchRecognition}
                disabled={isProcessing}
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {isProcessing && (
          <Box mb={2}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Processing components...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        <List>
          {recognitionResults.map((result, index) => (
            <ListItem
              key={result.component_id}
              button
              onClick={() => onComponentSelect(result)}
              selected={selectedComponent?.component_id === result.component_id}
              sx={{ 
                borderRadius: 1, 
                mb: 1,
                border: selectedComponent?.component_id === result.component_id ? 
                  '2px solid' : '1px solid',
                borderColor: selectedComponent?.component_id === result.component_id ? 
                  'primary.main' : 'grey.300'
              }}
            >
              <ListItemIcon>
                {getConfidenceIcon(result.confidence_level)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">
                      {result.category.replace('_', ' ').toUpperCase()}
                    </Typography>
                    <Chip
                      label={`${(result.confidence * 100).toFixed(1)}%`}
                      size="small"
                      color={getConfidenceColor(result.confidence)}
                      variant="filled"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Confidence: {result.confidence_level.replace('_', ' ')}
                    </Typography>
                    {result.specifications && (
                      <Typography variant="body2" color="primary">
                        {result.specifications.manufacturer} {result.specifications.model_number}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        {recognitionResults.length === 0 && !isProcessing && (
          <Typography color="textSecondary" textAlign="center" py={4}>
            No components recognized yet. Upload an image and run recognition.
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderAlternativeMatches = () => {
    if (!selectedComponent?.alternative_matches.length) {
      return null;
    }

    return (
      <Accordion 
        expanded={expandedAccordions.alternatives}
        onChange={() => handleAccordionToggle('alternatives')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            Alternative Matches
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List>
            {selectedComponent.alternative_matches.map((match, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={match.category.replace('_', ' ').toUpperCase()}
                  secondary={`Confidence: ${(match.confidence * 100).toFixed(1)}%`}
                />
                <Chip
                  label={`${(match.confidence * 100).toFixed(1)}%`}
                  size="small"
                  color={getConfidenceColor(match.confidence)}
                  variant="outlined"
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderVisualFeatures = () => {
    if (!selectedComponent?.visual_features) {
      return null;
    }

    const features = selectedComponent.visual_features;

    return (
      <Accordion 
        expanded={expandedAccordions.features}
        onChange={() => handleAccordionToggle('features')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            Visual Analysis
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {features.geometric && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Geometric Features
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Aspect Ratio"
                      secondary={features.geometric.aspect_ratio?.toFixed(2)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Area"
                      secondary={features.geometric.area?.toFixed(0)} 
                    />
                  </ListItem>
                  {features.geometric.circularity && (
                    <ListItem>
                      <ListItemText
                        primary="Circularity"
                        secondary={features.geometric.circularity.toFixed(3)}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            )}
            {features.texture && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Texture Features
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="LBP Uniformity"
                      secondary={features.texture.lbp_uniformity?.toFixed(3)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="GLCM Contrast"
                      secondary={features.texture.glcm_contrast?.toFixed(3)}
                    />
                  </ListItem>
                </List>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderStatisticsDialog = () => (
    <Dialog 
      open={showStatsDialog} 
      onClose={() => setShowStatsDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AssessmentIcon />
          Recognition Statistics
        </Box>
      </DialogTitle>
      <DialogContent>
        {recognitionStats && (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Overall Stats
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Total Recognitions"
                        secondary={recognitionStats.total_recognitions}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Cache Hit Ratio"
                        secondary={`${(recognitionStats.cache_hit_ratio * 100).toFixed(1)}%`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Categories
                  </Typography>
                  <List>
                    {Object.entries(recognitionStats.categories).map(([category, count]) => (
                      <ListItem key={category}>
                        <ListItemText
                          primary={category.replace('_', ' ').toUpperCase()}
                          secondary={count}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Confidence Distribution
                  </Typography>
                  <List>
                    {Object.entries(recognitionStats.confidence_levels).map(([level, count]) => (
                      <ListItem key={level}>
                        <ListItemIcon>
                          {getConfidenceIcon(level)}
                        </ListItemIcon>
                        <ListItemText
                          primary={level.replace('_', ' ').toUpperCase()}
                          secondary={`${count} components`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowStatsDialog(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Recognition" />
          <Tab label="Specifications" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && (
          <Box display="flex" flexDirection="column" gap={2}>
            {renderRecognitionResults()}
            {selectedComponent && (
              <>
                {renderAlternativeMatches()}
                {renderVisualFeatures()}
              </>
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box display="flex" flexDirection="column" gap={2}>
            {renderSpecificationDetails()}
          </Box>
        )}
      </Box>

      {renderStatisticsDialog()}
    </Box>
  );
};

export default ComponentIntelligencePanel;