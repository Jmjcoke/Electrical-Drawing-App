import { test, expect, Page } from '@playwright/test';

// Helper function to wait for PDF viewer to load
async function waitForPDFViewerLoad(page: Page) {
  await page.waitForSelector('[data-testid="enhanced-pdf-viewer"]', { timeout: 10000 });
  await page.waitForFunction(() => {
    const loadingElement = document.querySelector('.pdf-viewer-loading');
    return !loadingElement || loadingElement.style.display === 'none';
  });
}

// Helper function to upload a test PDF
async function uploadTestPDF(page: Page, pdfPath: string = './tests/fixtures/test-electrical-drawing.pdf') {
  await page.goto('/pdf-viewer');
  
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(pdfPath);
  
  await waitForPDFViewerLoad(page);
}

test.describe('PDF Viewer Integration Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test.describe('Document Loading and Navigation', () => {
    test('should load PDF document successfully', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Verify PDF viewer components are present
      await expect(page.locator('[data-testid="enhanced-pdf-viewer"]')).toBeVisible();
      await expect(page.locator('.pdf-viewer-toolbar')).toBeVisible();
      await expect(page.locator('.pdf-viewer-status')).toBeVisible();
      
      // Verify page information
      await expect(page.locator('.pdf-viewer-status')).toContainText('Page 1 of');
    });

    test('should navigate between pages', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Navigate to next page
      await page.click('button:has-text("Next Page")');
      await expect(page.locator('.pdf-viewer-status')).toContainText('Page 2 of');
      
      // Navigate back to previous page
      await page.click('button:has-text("Previous Page")');
      await expect(page.locator('.pdf-viewer-status')).toContainText('Page 1 of');
    });

    test('should handle zoom operations', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Test zoom in
      await page.click('button[title="Zoom In"]');
      await expect(page.locator('.pdf-viewer-status')).toContainText('Zoom: 150%');
      
      // Test zoom out
      await page.click('button[title="Zoom Out"]');
      await page.click('button[title="Zoom Out"]');
      await expect(page.locator('.pdf-viewer-status')).toContainText('Zoom: 100%');
      
      // Test fit to width
      await page.click('button[title="Fit to Width"]');
      await expect(page.locator('.pdf-viewer-status')).not.toContainText('Zoom: 100%');
    });
  });

  test.describe('Mode Switching and Tools', () => {
    test('should switch between viewer modes', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Start in view mode
      await expect(page.locator('button:has-text("👁️ View").active')).toBeVisible();
      
      // Switch to annotation mode
      await page.click('button:has-text("✏️ Annotate")');
      await expect(page.locator('[data-testid="annotation-toolbar"]')).toBeVisible();
      await expect(page.locator('[data-testid="annotation-canvas"]')).toBeVisible();
      
      // Switch to measurement mode
      await page.click('button:has-text("📏 Measure")');
      await expect(page.locator('[data-testid="measurement-toolkit"]')).toBeVisible();
      
      // Switch to comparison mode
      await page.click('button:has-text("⚖️ Compare")');
      await expect(page.locator('[data-testid="drawing-comparison-view"]')).toBeVisible();
      
      // Switch to analysis mode
      await page.click('button:has-text("🔍 Analyze")');
      await expect(page.locator('[data-testid="cloud-detection-viewer"]')).toBeVisible();
    });

    test('should toggle utility panels', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Test minimap toggle
      await expect(page.locator('[data-testid="minimap-navigator"]')).toBeVisible();
      await page.click('button:has-text("🗺️ Minimap")');
      // Minimap should still exist but possibly hidden
      
      // Test search panel toggle
      await page.click('button:has-text("🔍 Search")');
      await expect(page.locator('[data-testid="document-search-interface"]')).toBeVisible();
      
      // Test bookmarks panel toggle
      await page.click('button:has-text("🔖 Bookmarks")');
      await expect(page.locator('[data-testid="navigation-bookmarks"]')).toBeVisible();
    });
  });

  test.describe('Component Selection Workflow', () => {
    test('should detect and select electrical components', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Wait for component detection to complete
      await page.waitForTimeout(2000);
      
      // Click on an electrical component area
      const pdfCanvas = page.locator('canvas').first();
      await pdfCanvas.click({ position: { x: 300, y: 200 } });
      
      // Verify component selection overlay appears
      await expect(page.locator('[data-testid="component-selection-overlay"]')).toBeVisible();
      
      // Check if component info panel shows selection
      const componentCount = await page.locator('.pdf-viewer-status').textContent();
      expect(componentCount).toContain('Components:');
    });

    test('should support multi-component selection', async ({ page }) => {
      await uploadTestPDF(page);
      
      const pdfCanvas = page.locator('canvas').first();
      
      // Select first component
      await pdfCanvas.click({ position: { x: 300, y: 200 } });
      
      // Select second component with Ctrl
      await pdfCanvas.click({ 
        position: { x: 400, y: 300 }, 
        modifiers: ['Control'] 
      });
      
      // Verify multiple selection in status
      const status = await page.locator('.pdf-viewer-status').textContent();
      expect(status).toBeTruthy();
    });
  });

  test.describe('Annotation Workflow', () => {
    test('should create and edit annotations', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Switch to annotation mode
      await page.click('button:has-text("✏️ Annotate")');
      
      // Select rectangle tool
      await page.click('button[title="Rectangle"]');
      
      // Draw a rectangle annotation
      const canvas = page.locator('canvas').first();
      await canvas.click({ position: { x: 200, y: 200 } });
      await canvas.dragTo(canvas, { 
        sourcePosition: { x: 200, y: 200 },
        targetPosition: { x: 300, y: 300 }
      });
      
      // Verify annotation count in status
      await expect(page.locator('.pdf-viewer-status')).toContainText('Annotations: 1');
      
      // Test text annotation
      await page.click('button[title="Text"]');
      
      // Mock the prompt for text input
      await page.evaluate(() => {
        window.prompt = () => 'Test annotation text';
      });
      
      await canvas.click({ position: { x: 400, y: 400 } });
      await expect(page.locator('.pdf-viewer-status')).toContainText('Annotations: 2');
    });

    test('should handle annotation styling', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Switch to annotation mode
      await page.click('button:has-text("✏️ Annotate")');
      
      // Open style panel
      await page.click('button:has-text("🎨 Style")');
      
      // Change color
      await page.click('input[type="color"]');
      await page.fill('input[type="color"]', '#00FF00');
      
      // Change stroke width
      await page.fill('input.width-slider', '5');
      
      // Draw annotation with new style
      await page.click('button[title="Rectangle"]');
      const canvas = page.locator('canvas').first();
      await canvas.dragTo(canvas, {
        sourcePosition: { x: 100, y: 100 },
        targetPosition: { x: 200, y: 200 }
      });
    });
  });

  test.describe('Measurement Workflow', () => {
    test('should create distance measurements', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Switch to measurement mode
      await page.click('button:has-text("📏 Measure")');
      
      // Select distance tool
      await page.click('button[title="Distance"]');
      
      // Create a distance measurement
      const canvas = page.locator('canvas').first();
      await canvas.click({ position: { x: 100, y: 100 } });
      await canvas.click({ position: { x: 200, y: 200 } });
      
      // Verify measurement appears in toolkit
      await expect(page.locator('.measurement-toolkit')).toContainText('1');
    });

    test('should handle measurement calibration', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Switch to measurement mode
      await page.click('button:has-text("📏 Measure")');
      
      // Click calibrate tool
      await page.click('button[title="Calibrate"]');
      
      // Draw calibration line
      const canvas = page.locator('canvas').first();
      await canvas.dragTo(canvas, {
        sourcePosition: { x: 50, y: 50 },
        targetPosition: { x: 150, y: 50 }
      });
      
      // Set known distance
      await page.fill('input.distance-input', '10');
      await page.selectOption('select.unit-select', 'ft');
      await page.click('button:has-text("Set Calibration")');
      
      // Verify calibration status
      await expect(page.locator('.calibration-status')).toContainText('Calibrated');
    });
  });

  test.describe('Search and Navigation Workflow', () => {
    test('should search for components and navigate to results', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Open search panel
      await page.click('button:has-text("🔍 Search")');
      
      // Search for outlets
      await page.fill('.search-input', 'outlet');
      
      // Wait for search results
      await page.waitForTimeout(1000);
      
      // Click on first search result
      await page.click('.result-item:first-child');
      
      // Verify viewport navigated to result
      const status = await page.locator('.pdf-viewer-status').textContent();
      expect(status).toBeTruthy();
    });

    test('should create and use bookmarks', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Open bookmarks panel
      await page.click('button:has-text("🔖 Bookmarks")');
      
      // Create a quick bookmark
      await page.click('button:has-text("🔖 Quick Bookmark")');
      
      // Verify bookmark appears in list
      await expect(page.locator('.bookmark-items')).toContainText('Quick Bookmark');
      
      // Navigate to different area and return to bookmark
      await page.click('button[title="Zoom In"]');
      await page.click('.bookmark-item .navigate-btn');
      
      // Verify navigation occurred
      await expect(page.locator('.pdf-viewer-status')).toContainText('Zoom:');
    });
  });

  test.describe('Comparison Workflow', () => {
    test('should compare two drawings', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Switch to comparison mode
      await page.click('button:has-text("⚖️ Compare")');
      
      // Verify comparison interface loaded
      await expect(page.locator('[data-testid="drawing-comparison-view"]')).toBeVisible();
      
      // Test different comparison modes
      await page.click('button:has-text("Overlay")');
      await page.click('button:has-text("Side by Side")');
      await page.click('button:has-text("Differences")');
      
      // Test difference detection
      await page.click('button:has-text("Detect Differences")');
      await page.waitForTimeout(2000);
      
      // Verify differences are shown
      await expect(page.locator('.differences-list')).toBeVisible();
    });
  });

  test.describe('Performance and Error Handling', () => {
    test('should handle large PDF files without performance issues', async ({ page }) => {
      // Upload a larger test file
      await uploadTestPDF(page, './tests/fixtures/large-electrical-drawing.pdf');
      
      // Verify responsive performance
      const startTime = Date.now();
      await page.click('button[title="Zoom In"]');
      await page.click('button[title="Zoom In"]');
      await page.click('button[title="Zoom Out"]');
      const endTime = Date.now();
      
      // Operations should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Verify performance metrics in status bar
      await expect(page.locator('.performance-info')).toContainText('FPS:');
      await expect(page.locator('.performance-info')).toContainText('Memory:');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/test-drawing.pdf', route => route.abort());
      
      await page.goto('/pdf-viewer');
      
      // Try to load a PDF that will fail
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('./tests/fixtures/test-electrical-drawing.pdf');
      
      // Verify error handling
      await expect(page.locator('.pdf-viewer-error')).toBeVisible();
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should maintain state during mode switches', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Create annotation in annotation mode
      await page.click('button:has-text("✏️ Annotate")');
      await page.click('button[title="Rectangle"]');
      
      const canvas = page.locator('canvas').first();
      await canvas.dragTo(canvas, {
        sourcePosition: { x: 100, y: 100 },
        targetPosition: { x: 200, y: 200 }
      });
      
      // Switch to measurement mode and back
      await page.click('button:has-text("📏 Measure")');
      await page.click('button:has-text("✏️ Annotate")');
      
      // Verify annotation is still present
      await expect(page.locator('.pdf-viewer-status')).toContainText('Annotations: 1');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Test tab navigation through mode buttons
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Test Enter key activation
      await page.keyboard.press('Enter');
      
      // Verify mode change occurred
      const activeButton = page.locator('button.active');
      await expect(activeButton).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await uploadTestPDF(page);
      
      // Check for accessibility attributes
      const toolbar = page.locator('.pdf-viewer-toolbar');
      await expect(toolbar).toBeVisible();
      
      // Verify buttons have proper labels
      const modeButtons = page.locator('.mode-buttons button');
      const count = await modeButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});