# API Key Configuration Guide

This guide will help you set up the necessary API keys for the Electrical Orchestrator's AI-powered features.

## Overview

The Electrical Orchestrator uses various AI services for symbol extraction, text recognition, and intelligent analysis. You need to configure at least one AI provider to enable these features.

## Supported Providers

### 1. OpenAI (Recommended for Advanced OCR)

OpenAI's GPT-4 Vision API provides superior text extraction and symbol description capabilities.

**Features:**
- Advanced OCR with context understanding
- Symbol description generation
- Text extraction from complex diagrams
- Vision-based analysis

**Setup Instructions:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. Add to your `.env` file:
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 2. Azure Computer Vision

Microsoft's Computer Vision API excels at symbol detection and object recognition.

**Features:**
- Symbol detection
- Object recognition
- OCR capabilities
- Image analysis

**Setup Instructions:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new Computer Vision resource
3. After deployment, go to "Keys and Endpoint"
4. Copy Key 1 and the Endpoint URL
5. Add to your `.env` file:
   ```
   COMPUTER_VISION_API_KEY=your-32-character-key
   COMPUTER_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   ```

### 3. Google Cloud Vision (Alternative)

Google's Cloud Vision API provides similar capabilities to Azure.

**Features:**
- Symbol detection
- Text detection
- Object localization
- Document analysis

**Setup Instructions:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Cloud Vision API
4. Go to Credentials and create an API key
5. Add to your `.env` file:
   ```
   GOOGLE_CLOUD_VISION_API_KEY=your-api-key
   ```

### 4. Custom ML Model (Optional)

For organizations with custom-trained models.

**Setup Instructions:**
1. Deploy your model with a REST API endpoint
2. Implement authentication (Bearer token recommended)
3. Add to your `.env` file:
   ```
   CUSTOM_ML_MODEL_ENDPOINT=https://your-ml-model-endpoint.com
   CUSTOM_ML_MODEL_API_KEY=your-custom-api-key
   ```

## Security Best Practices

### 1. Environment Variables
- **NEVER** commit API keys to version control
- Use `.env.local` for local development
- Use secure environment variable management in production (e.g., AWS Secrets Manager, Azure Key Vault)

### 2. API Key Rotation
- Rotate API keys regularly (recommended: every 90 days)
- Monitor API key usage for anomalies
- Revoke compromised keys immediately

### 3. Access Control
- Limit API key permissions to minimum required
- Use separate keys for development/staging/production
- Implement IP whitelisting where supported

### 4. Server-Side Only
- API keys must only be used server-side
- Never expose API keys in client-side code
- Use Next.js API routes as a proxy

## Configuration in the Application

### 1. Using the Settings UI

1. Navigate to `/settings/api-keys` in the application
2. Test your API keys using the validation tool
3. View available features based on configured providers

### 2. Programmatic Configuration

The application automatically detects configured API keys from environment variables. No code changes are required.

### 3. Feature Availability

Different features require different providers:

| Feature | OpenAI | Azure CV | Google CV | Custom |
|---------|---------|----------|-----------|---------|
| Symbol Detection | ✓ | ✓ | ✓ | ✓ |
| Advanced OCR | ✓ | ✓ | ✓ | - |
| Text Extraction | ✓ | ✓ | ✓ | - |
| Symbol Description | ✓ | - | - | ✓ |
| Vision Analysis | ✓ | ✓ | ✓ | ✓ |

## Troubleshooting

### API Key Not Working

1. **Check Format**: Ensure the key matches the expected format
   - OpenAI: Starts with `sk-`
   - Azure: 32 character hex string
   - Google: 39 character alphanumeric with dashes

2. **Verify Endpoint**: For Azure, ensure the endpoint URL is correct

3. **Check Permissions**: Ensure the API key has necessary permissions

4. **Test Manually**: Use the validation tool in `/settings/api-keys`

### Rate Limiting

- OpenAI: 3 RPM for free tier, higher for paid
- Azure: Varies by pricing tier
- Google: 1800 requests per minute

Consider implementing request queuing and caching to handle rate limits.

### Cost Management

1. Set up billing alerts in provider dashboards
2. Monitor usage through provider analytics
3. Implement caching to reduce API calls
4. Use appropriate confidence thresholds

## Support

For issues with API key configuration:
1. Check the application logs for detailed error messages
2. Use the built-in validation tool
3. Refer to provider-specific documentation
4. Contact support with sanitized error logs (remove API keys)