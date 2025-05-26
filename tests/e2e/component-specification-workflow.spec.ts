/**
 * End-to-End tests for Component Specification Workflow
 * 
 * Tests the complete user journey from PDF loading to component specification viewing
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Component Specification Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Navigate to application
    await page.goto('/');
    
    // Wait for application to load
    await page.waitForSelector('[data-testid="pdf-viewer"]');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Complete workflow: PDF upload to component specification viewing', async () => {
    // Step 1: Upload PDF
    await test.step('Upload electrical drawing PDF', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/sample-electrical-drawing.pdf');
      
      // Wait for PDF to load
      await page.waitForSelector('[data-testid="pdf-canvas"]');
      await expect(page.locator('[data-testid="pdf-canvas"]')).toBeVisible();
    });

    // Step 2: Wait for component detection
    await test.step('Wait for automatic component detection', async () => {
      // Wait for component detection to complete
      await page.waitForSelector('[data-testid="component-detection-complete"]', { timeout: 30000 });
      
      // Verify components are detected
      const componentCount = await page.locator('[data-testid="detected-component"]').count();
      expect(componentCount).toBeGreaterThan(0);
    });

    // Step 3: Click on a detected component
    await test.step('Click on detected component', async () => {
      const firstComponent = page.locator('[data-testid="detected-component"]').first();
      await firstComponent.click();
      
      // Wait for specification panel to appear
      await page.waitForSelector('[data-testid="component-information-panel"]');
      await expect(page.locator('[data-testid="component-information-panel"]')).toBeVisible();
    });

    // Step 4: Verify component specifications are displayed
    await test.step('Verify component specifications are displayed', async () => {
      // Check for component name
      await expect(page.locator('[data-testid="component-name"]')).toBeVisible();
      
      // Check for manufacturer information
      await expect(page.locator('[data-testid="manufacturer-info"]')).toBeVisible();
      
      // Check for electrical ratings
      await expect(page.locator('[data-testid="electrical-ratings"]')).toBeVisible();
      
      // Verify voltage and current ratings are shown
      await expect(page.locator('[data-testid="voltage-rating"]')).toContainText('V');
      await expect(page.locator('[data-testid="current-rating"]')).toContainText('A');
    });

    // Step 5: Test component overlay
    await test.step('Test hover overlay functionality', async () => {
      // Move mouse over a component to trigger overlay
      const componentElement = page.locator('[data-testid="detected-component"]').nth(1);
      await componentElement.hover();
      
      // Wait for overlay to appear
      await page.waitForSelector('[data-testid="specification-overlay"]');
      await expect(page.locator('[data-testid="specification-overlay"]')).toBeVisible();
      
      // Verify overlay contains quick specs
      await expect(page.locator('[data-testid="quick-specs"]')).toBeVisible();
      
      // Move mouse away to hide overlay
      await page.mouse.move(0, 0);
      await expect(page.locator('[data-testid="specification-overlay"]')).not.toBeVisible();
    });

    // Step 6: Test component search functionality
    await test.step('Test component search functionality', async () => {
      // Open search panel
      await page.click('[data-testid="search-panel-toggle"]');
      await expect(page.locator('[data-testid="component-search-panel"]')).toBeVisible();
      
      // Search for components
      await page.fill('[data-testid="search-input"]', 'breaker');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="search-results"]');
      const searchResults = await page.locator('[data-testid="search-result-item"]').count();
      expect(searchResults).toBeGreaterThan(0);
      
      // Click on a search result
      await page.click('[data-testid="search-result-item"]');
      
      // Verify component is selected
      await expect(page.locator('[data-testid="selected-component"]')).toBeVisible();
    });
  });

  test('Component specification accuracy validation', async () => {
    await test.step('Upload known test PDF with specific components', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/test-panel-schedule.pdf');
      
      await page.waitForSelector('[data-testid="pdf-canvas"]');
    });

    await test.step('Verify specific component specifications', async () => {
      // Wait for component processing
      await page.waitForSelector('[data-testid="component-detection-complete"]');
      
      // Look for specific component (e.g., 20A breaker)
      const breakerComponent = page.locator('[data-component-type="breaker"][data-current-rating="20"]');
      await breakerComponent.click();
      
      // Verify specifications match expected values
      await expect(page.locator('[data-testid="current-rating"]')).toContainText('20 A');
      await expect(page.locator('[data-testid="voltage-rating"]')).toContainText('120 V');
      await expect(page.locator('[data-testid="component-category"]')).toContainText('Breaker');
    });

    await test.step('Verify compliance information accuracy', async () => {
      // Check UL listing
      await expect(page.locator('[data-testid="ul-listed"]')).toBeVisible();
      
      // Check NEMA rating
      await expect(page.locator('[data-testid="nema-rating"]')).toContainText('1');
      
      // Verify NEC compliance
      await expect(page.locator('[data-testid="nec-compliant"]')).toBeVisible();
    });
  });

  test('Performance benchmarks for component recognition', async () => {
    await test.step('Measure PDF processing time', async () => {
      const startTime = Date.now();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/large-electrical-drawing.pdf');
      
      // Wait for initial PDF load
      await page.waitForSelector('[data-testid="pdf-canvas"]');
      const pdfLoadTime = Date.now() - startTime;
      
      // PDF should load within 5 seconds
      expect(pdfLoadTime).toBeLessThan(5000);
    });

    await test.step('Measure component detection time', async () => {
      const detectionStartTime = Date.now();
      
      // Wait for component detection to complete
      await page.waitForSelector('[data-testid="component-detection-complete"]');
      const detectionTime = Date.now() - detectionStartTime;
      
      // Component detection should complete within 15 seconds
      expect(detectionTime).toBeLessThan(15000);
      
      // Verify reasonable number of components detected
      const componentCount = await page.locator('[data-testid="detected-component"]').count();
      expect(componentCount).toBeGreaterThan(0);
      expect(componentCount).toBeLessThan(100); // Reasonable upper limit
    });

    await test.step('Measure specification retrieval time', async () => {
      const specStartTime = Date.now();
      
      // Click on first component
      await page.click('[data-testid="detected-component"]');
      
      // Wait for specifications to load
      await page.waitForSelector('[data-testid="component-specifications-loaded"]');
      const specTime = Date.now() - specStartTime;
      
      // Specification retrieval should be under 2 seconds
      expect(specTime).toBeLessThan(2000);
    });
  });

  test('Component specification data integrity', async () => {
    await test.step('Upload PDF and detect components', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/sample-electrical-drawing.pdf');
      
      await page.waitForSelector('[data-testid="component-detection-complete"]');
    });

    await test.step('Verify data consistency across different views', async () => {
      // Select a component
      await page.click('[data-testid="detected-component"]');
      
      // Get component data from information panel
      const panelPartNumber = await page.locator('[data-testid="part-number"]').textContent();
      const panelVoltage = await page.locator('[data-testid="voltage-rating"]').textContent();
      
      // Open overlay for same component
      await page.hover('[data-testid="detected-component"]');
      await page.waitForSelector('[data-testid="specification-overlay"]');
      
      // Verify data consistency
      const overlayPartNumber = await page.locator('[data-testid="overlay-part-number"]').textContent();
      const overlayVoltage = await page.locator('[data-testid="overlay-voltage"]').textContent();
      
      expect(panelPartNumber).toBe(overlayPartNumber);
      expect(panelVoltage).toBe(overlayVoltage);
    });

    await test.step('Verify specification links and documentation', async () => {
      // Check that datasheet link is valid
      const datasheetLink = page.locator('[data-testid="datasheet-link"]');
      if (await datasheetLink.isVisible()) {
        const href = await datasheetLink.getAttribute('href');
        expect(href).toMatch(/^https?:\/\/.+\.(pdf|html)$/);
      }
      
      // Check installation guide
      const installGuide = page.locator('[data-testid="installation-guide-link"]');
      if (await installGuide.isVisible()) {
        const href = await installGuide.getAttribute('href');
        expect(href).toMatch(/^https?:\/\/.+/);
      }
    });
  });

  test('Multi-component comparison workflow', async () => {
    await test.step('Enable multi-select mode', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/sample-electrical-drawing.pdf');
      
      await page.waitForSelector('[data-testid="component-detection-complete"]');
      
      // Enable multi-select mode in search panel
      await page.click('[data-testid="search-panel-toggle"]');
      await page.click('[data-testid="multi-select-toggle"]');
    });

    await test.step('Select multiple components for comparison', async () => {
      // Select first component
      await page.click('[data-testid="detected-component"]:nth-child(1)');
      
      // Select second component
      await page.click('[data-testid="detected-component"]:nth-child(2)');
      
      // Verify both are selected
      const selectedCount = await page.locator('[data-testid="selected-component"]').count();
      expect(selectedCount).toBe(2);
    });

    await test.step('Open comparison view', async () => {
      // Click compare button
      await page.click('[data-testid="compare-components-btn"]');
      
      // Wait for comparison overlay
      await page.waitForSelector('[data-testid="component-comparison-overlay"]');
      await expect(page.locator('[data-testid="component-comparison-overlay"]')).toBeVisible();
      
      // Verify comparison table shows both components
      const comparisonRows = await page.locator('[data-testid="comparison-row"]').count();
      expect(comparisonRows).toBeGreaterThan(0);
      
      // Verify component specifications are compared
      await expect(page.locator('[data-testid="voltage-comparison"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-comparison"]')).toBeVisible();
    });
  });

  test('Error handling and edge cases', async () => {
    await test.step('Handle invalid PDF upload', async () => {
      // Try to upload non-PDF file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/invalid-file.txt');
      
      // Should show error message
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText('Invalid file type');
    });

    await test.step('Handle PDF with no detectable components', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/empty-drawing.pdf');
      
      await page.waitForSelector('[data-testid="pdf-canvas"]');
      
      // Wait for detection to complete
      await page.waitForSelector('[data-testid="component-detection-complete"]');
      
      // Should show "no components" message
      await expect(page.locator('[data-testid="no-components-message"]')).toBeVisible();
    });

    await test.step('Handle component with no specification match', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/unknown-components.pdf');
      
      await page.waitForSelector('[data-testid="component-detection-complete"]');
      
      // Click on component with no specification
      await page.click('[data-testid="detected-component"]');
      
      // Should show "no specification" message
      await expect(page.locator('[data-testid="no-specification-message"]')).toBeVisible();
    });

    await test.step('Handle network errors gracefully', async () => {
      // Intercept and fail API requests
      await page.route('/api/component-specifications/**', route => {
        route.abort('failed');
      });
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/sample-electrical-drawing.pdf');
      
      await page.waitForSelector('[data-testid="pdf-canvas"]');
      
      // Click on component - should handle API failure
      await page.click('[data-testid="detected-component"]');
      
      // Should show error message instead of crashing
      await expect(page.locator('[data-testid="api-error-message"]')).toBeVisible();
    });
  });

  test('Accessibility compliance', async () => {
    await test.step('Upload PDF and test keyboard navigation', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/fixtures/sample-electrical-drawing.pdf');
      
      await page.waitForSelector('[data-testid="component-detection-complete"]');
    });

    await test.step('Verify keyboard accessibility', async () => {
      // Tab through components
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      
      // Should be able to focus on components
      expect(focusedElement).toBeTruthy();
      
      // Press Enter to select component
      await page.keyboard.press('Enter');
      
      // Information panel should open
      await expect(page.locator('[data-testid="component-information-panel"]')).toBeVisible();
    });

    await test.step('Verify screen reader support', async () => {
      // Check for proper ARIA labels
      const components = page.locator('[data-testid="detected-component"]');
      
      for (let i = 0; i < await components.count(); i++) {
        const component = components.nth(i);
        
        // Should have accessible name
        const ariaLabel = await component.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        
        // Should have role
        const role = await component.getAttribute('role');
        expect(role).toBeTruthy();
      }
    });

    await test.step('Check color contrast and visual accessibility', async () => {
      // Take screenshot for manual review
      await page.screenshot({ path: 'tests/screenshots/accessibility-check.png' });
      
      // Verify focus indicators are visible
      await page.keyboard.press('Tab');
      
      // Should have visible focus ring
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});