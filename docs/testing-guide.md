# Symbol Extraction Testing Guide

## Quick Start

1. **Navigate to Training Section**
   - Go to `/training` in your app
   - You'll see a "Test Extraction" button in the bottom right (development mode only)

2. **Configure API Keys (Optional)**
   - Click "API Keys" button or go to `/settings/api-keys`
   - Add at least one provider key:
     - OpenAI API key
     - Azure Computer Vision key
     - Google Cloud Vision API key

3. **Test Symbol Extraction**
   - Go to `/test/symbol-extraction`
   - Choose test mode:
     - **Mock Mode**: Uses simulated data (no API calls needed)
     - **Live Mode**: Makes real API calls (requires configured keys)

## Testing Workflow

### 1. Mock Mode Testing (No API Required)
```
1. Select "Mock Mode" 
2. Upload any PDF file
3. Click "Start Extraction"
4. View simulated results with sample symbols
```

### 2. Live Mode Testing (API Keys Required)
```
1. Configure API keys in settings
2. Select "Live Mode"
3. Upload a real symbol legend PDF
4. Click "Start Extraction"
5. View actual extraction results
```

## Sample Data

The mock mode returns:
- 3 sample symbols (Circuit Breaker, Motor, Transformer)
- Confidence scores (89-94%)
- Category distribution
- Processing statistics

## API Configuration

### Environment Variables (.env.local)
```bash
# OpenAI (for advanced text extraction)
OPENAI_API_KEY=sk-...

# Azure Computer Vision (for symbol detection)
AZURE_COMPUTER_VISION_KEY=...
AZURE_COMPUTER_VISION_ENDPOINT=https://....cognitiveservices.azure.com/

# Google Cloud Vision (alternative provider)
GOOGLE_CLOUD_VISION_API_KEY=...
```

### Getting API Keys

1. **OpenAI**
   - Sign up at https://platform.openai.com
   - Create API key in dashboard
   - Add billing (required for API usage)

2. **Azure Computer Vision**
   - Create Azure account
   - Create Computer Vision resource
   - Copy key and endpoint from resource page

3. **Google Cloud Vision**
   - Create Google Cloud account
   - Enable Vision API
   - Create credentials (API key)

## Expected Results

### Successful Extraction
- Total symbols extracted: 30-50 per page
- Average confidence: 85-95%
- Categories: Protection, Motors, Distribution, etc.
- Processing time: 10-30 seconds per page

### Common Issues
1. **No API Keys**: Configure at least one provider
2. **Invalid PDF**: Ensure PDF contains clear symbol legends
3. **Low Quality**: Use high-resolution PDFs (300+ DPI)
4. **Rate Limits**: Check API provider limits

## Development Tips

1. **Start with Mock Mode** to understand the workflow
2. **Use Sample PDFs** from manufacturer catalogs
3. **Monitor API Usage** to avoid unexpected charges
4. **Test Different Providers** to compare accuracy
5. **Save Results** for training data preparation

## Next Steps

After successful extraction:
1. Review and verify symbols in `/training/symbols`
2. Create training datasets in `/training/datasets`
3. Annotate symbols in `/training/annotate`
4. Start training jobs in `/training/jobs`