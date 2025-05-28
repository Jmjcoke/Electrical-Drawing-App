# AI Training Workflow: Symbol & Legend Extraction

## Overview

The symbol and legend extraction workflow is the foundation of our AI training pipeline. It transforms PDF legend sheets into high-quality training data for electrical component recognition.

## Why Start with Legends?

Symbol legend sheets are ideal for training because they provide:
- **Clean, isolated symbols** without overlapping components
- **Clear text labels** that describe each symbol
- **Standardized representations** following NEC, IEC, or other standards
- **Manufacturer-specific variations** for comprehensive coverage

## Technical Implementation

### 1. Extraction Pipeline

```
PDF Upload → Page Segmentation → Symbol Detection → OCR → Pairing → Validation
```

#### Technologies Used:
- **YOLO/Faster R-CNN**: For symbol detection and bounding box generation
- **Tesseract OCR**: For text extraction from descriptions
- **Computer Vision**: For page segmentation and layout analysis
- **WebSocket**: For real-time progress updates

### 2. Key Components

#### Frontend Components:
- `SymbolLegendExtractor`: Main UI for the extraction workflow
- `DatasetAnnotator`: Manual verification and correction interface
- `TrainingDataUploader`: Batch upload interface for PDFs
- `TrainingJobManager`: Monitor and manage training jobs

#### Services:
- `symbolExtractionService`: API client for extraction operations
- `useSymbolExtraction`: React hook for state management

### 3. Data Flow

1. **Upload Stage**
   - User uploads legend PDFs
   - Files sent to backend for processing
   - Job ID returned for tracking

2. **Processing Stage**
   - PDF converted to high-resolution images
   - Computer vision segments the page
   - ML model detects individual symbols
   - OCR extracts text descriptions

3. **Pairing Stage**
   - Proximity algorithm pairs symbols with descriptions
   - Confidence scores calculated
   - Results validated against known patterns

4. **Review Stage**
   - User reviews extracted symbols
   - Corrections made to OCR errors
   - Symbols categorized by type

5. **Training Stage**
   - Verified symbols become training data
   - Data augmentation applied
   - Dataset split into train/validation/test

## Best Practices

### Do's:
- Use high-resolution PDFs (300+ DPI)
- Include symbols from multiple manufacturers
- Verify all symbol-description pairs
- Maintain consistent categorization
- Document electrical standards used

### Don'ts:
- Don't use low-quality scans
- Avoid handwritten annotations initially
- Don't skip verification steps
- Don't mix incompatible standards

## Supported Standards

- **NEC** (National Electrical Code)
- **IEC 60617** (International Standard)
- **ANSI Y32.9** (IEEE Standard)
- **Manufacturer-specific** (Schneider, ABB, Siemens, etc.)

## Expected Results

From a typical 10-page legend PDF:
- 100-200 unique symbols extracted
- 90-95% accuracy on text extraction
- 85-90% correct symbol-description pairing
- Processing time: ~2-3 minutes

## Integration with Training Pipeline

Extracted symbols flow into the training pipeline:

1. **Dataset Creation**: Symbols organized by category and standard
2. **Annotation**: Additional metadata added (voltage, current ratings)
3. **Training**: Models trained using extracted symbols as ground truth
4. **Validation**: Model tested against held-out symbol sets
5. **Deployment**: Trained models used for full drawing analysis

## API Endpoints

```typescript
// Start extraction
POST /api/v1/symbols/extract
Body: FormData { file, options }

// Get job status
GET /api/v1/symbols/jobs/{jobId}

// Verify symbol
PATCH /api/v1/symbols/{symbolId}/verify
Body: { corrections }

// Prepare training data
POST /api/v1/symbols/prepare-training
Body: { symbols, format, augmentations }

// WebSocket subscription
WS /ws/symbols/jobs/{jobId}
```

## Future Enhancements

1. **Multi-language OCR** for international projects
2. **3D symbol support** for BIM integration
3. **Auto-categorization** using symbol similarity
4. **Version tracking** for standard updates
5. **Collaborative verification** for team workflows

## Metrics & Monitoring

Track extraction quality with:
- Symbol detection rate
- OCR accuracy score
- Pairing confidence levels
- User correction frequency
- Training improvement metrics

This workflow creates a solid foundation for AI-powered electrical drawing analysis by starting with high-quality, verified training data from authoritative sources.