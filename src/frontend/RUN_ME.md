# 🚀 Quick Start - Symbol Extraction Testing

Your API keys are now configured! Here's how to test the symbol extraction:

## Step 1: Start the Application

Open a terminal in the `src/frontend` directory and run:

```bash
npm run dev
```

The application will start at: **http://localhost:3000**

## Step 2: Navigate to Training Section

1. Open your browser to: **http://localhost:3000/training**
2. You'll see the AI Training Data Management page

## Step 3: Test Symbol Extraction

### Option A: Quick Test Button (Recommended)
- Look at the **bottom right corner** of the screen
- Click the **"Test Extraction"** button
- This takes you directly to the test page

### Option B: Direct Navigation
- Go to: **http://localhost:3000/test/symbol-extraction**

## Step 4: Run Your First Test

1. On the test page, you'll see two modes:
   - **Mock Mode** - Uses fake data (good for testing the UI)
   - **Live Mode** - Uses your real API keys ✅ (You can use this!)

2. Select **"Live Mode"** since you have API keys configured

3. Click **"Select PDF"** to upload a file
   - Upload any PDF with electrical symbols
   - Or click **"Download Sample PDF"** if you need a test file

4. Click **"Start Extraction"**

5. Wait a few seconds and see the results!

## What You'll See

- Number of symbols extracted
- Sample symbols with descriptions
- Confidence scores
- Category distribution (Motors, Transformers, etc.)

## Troubleshooting

If something doesn't work:

1. **Check the Console**: Press F12 in your browser and look for errors
2. **Verify API Keys**: Your keys are in `.env.local`
3. **Try Mock Mode First**: This tests the UI without API calls
4. **Restart the Server**: Stop (Ctrl+C) and run `npm run dev` again

## Your Configured Providers

✅ **OpenAI** - Ready for advanced text extraction
✅ **Azure Computer Vision** - Ready for symbol detection
❌ **Google Cloud Vision** - Not configured (optional)

## Next Steps

After successful extraction:
1. Go to **Symbol Extraction** page: http://localhost:3000/training/symbols
2. Upload more PDFs to build your symbol library
3. Review and verify extracted symbols
4. Start training your AI model!

---

**Need Help?**
- The test page shows your API configuration status
- Mock mode always works (no API needed)
- Check browser console for detailed error messages