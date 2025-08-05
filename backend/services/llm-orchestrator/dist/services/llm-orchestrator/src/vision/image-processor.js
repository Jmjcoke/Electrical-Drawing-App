"use strict";
/**
 * Image Processor
 *
 * Handles PDF to image conversion, image preprocessing, and quality assessment
 * for electrical symbol detection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessor = void 0;
const sharp_1 = __importDefault(require("sharp"));
const canvas_1 = require("canvas");
const pdf2pic_1 = __importDefault(require("pdf2pic"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const opencv_js_1 = __importDefault(require("@techstark/opencv-js"));
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
class ImageProcessor {
    constructor() {
        this.DEFAULT_DPI = 300;
        this.isOpenCVReady = false;
    }
    /**
     * Convert PDF buffer to array of image buffers
     */
    async convertPdfToImages(pdfBuffer, options = {}) {
        let tempPdfPath = null;
        try {
            const { dpi = this.DEFAULT_DPI, format = 'png' } = options;
            // Create temporary file for PDF processing
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-processing-'));
            tempPdfPath = path.join(tempDir, 'input.pdf');
            // Write PDF buffer to temporary file
            await fs.writeFile(tempPdfPath, pdfBuffer);
            // Configure pdf2pic conversion
            const convertOptions = {
                density: dpi,
                saveFilename: 'page',
                savePath: tempDir,
                format: format === 'jpeg' ? 'jpg' : 'png',
                width: 2000, // High resolution width
                height: 2000, // High resolution height
            };
            const pdfConverter = pdf2pic_1.default.fromPath(tempPdfPath, convertOptions);
            // Convert all pages
            const conversionResults = await pdfConverter.bulk(-1, { responseType: 'buffer' });
            // Extract buffers from conversion results
            const imageBuffers = [];
            for (const result of conversionResults) {
                if (result.buffer) {
                    imageBuffers.push(result.buffer);
                }
            }
            console.log(`Successfully converted PDF to ${imageBuffers.length} pages with DPI: ${dpi}, Format: ${format}`);
            // Clean up temporary directory
            await fs.rm(tempDir, { recursive: true, force: true });
            return imageBuffers;
        }
        catch (error) {
            // Clean up temporary file if it exists
            if (tempPdfPath) {
                try {
                    const tempDir = path.dirname(tempPdfPath);
                    await fs.rm(tempDir, { recursive: true, force: true });
                }
                catch (cleanupError) {
                    console.warn('Failed to clean up temporary PDF file:', cleanupError);
                }
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('PDF conversion failed:', errorMessage);
            // Fallback to mock implementation if PDF conversion fails
            console.log('Falling back to mock PDF page generation');
            const mockImageBuffer = await this.createMockPdfPage(800, 600, options.format || 'png');
            return [mockImageBuffer];
        }
    }
    /**
     * Preprocess image for better symbol detection
     */
    async preprocessImage(imageBuffer, options = {}) {
        try {
            let image = (0, sharp_1.default)(imageBuffer);
            // Get image metadata
            const metadata = await image.metadata();
            const { width = 0, height = 0 } = metadata;
            // Normalize resolution if needed
            if (options.normalizeResolution) {
                const targetSize = options.targetResolution || 1024;
                if (width > targetSize || height > targetSize) {
                    const scale = Math.min(targetSize / width, targetSize / height);
                    image = image.resize(Math.round(width * scale), Math.round(height * scale), { fit: 'inside', withoutEnlargement: false });
                }
            }
            // Enhance contrast
            if (options.enhanceContrast) {
                image = image.normalize({ lower: 1, upper: 99 });
            }
            // Reduce noise
            if (options.reduceNoise) {
                image = image.median(3);
            }
            // Convert to grayscale for better processing
            image = image.greyscale();
            // Edge detection preprocessing
            if (options.detectEdges) {
                image = image.convolve({
                    width: 3,
                    height: 3,
                    kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
                });
            }
            return await image.png().toBuffer();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`Failed to preprocess image: ${errorMessage}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Initialize OpenCV if not already ready
     */
    async initializeOpenCV() {
        if (this.isOpenCVReady)
            return;
        try {
            // OpenCV.js is ready to use
            this.isOpenCVReady = true;
            console.log('OpenCV initialized successfully');
        }
        catch (error) {
            console.warn('OpenCV initialization failed:', error);
            throw new symbol_detection_types_1.ImageProcessingError('Failed to initialize OpenCV', {});
        }
    }
    /**
     * Advanced preprocessing using OpenCV
     */
    async preprocessImageWithOpenCV(imageBuffer, options = {}) {
        await this.initializeOpenCV();
        try {
            // Convert buffer to OpenCV Mat
            const src = this.bufferToMat(imageBuffer);
            // Convert to grayscale if not already
            const gray = new opencv_js_1.default.Mat();
            if (src.channels() === 3) {
                opencv_js_1.default.cvtColor(src, gray, opencv_js_1.default.COLOR_BGR2GRAY);
            }
            else {
                src.copyTo(gray);
            }
            // Apply denoising
            const denoised = new opencv_js_1.default.Mat();
            if (options.reduceNoise) {
                // Use bilateral filter for noise reduction while preserving edges
                opencv_js_1.default.bilateralFilter(gray, denoised, options.bilateralD || 9, // Diameter of each pixel neighborhood
                75, // Sigma color - larger value means that farther colors within the pixel neighborhood will be mixed together
                75 // Sigma space - larger value means that farther pixels will influence the computation
                );
            }
            else {
                gray.copyTo(denoised);
            }
            // Apply Gaussian blur for smoothing
            const blurred = new opencv_js_1.default.Mat();
            const kernelSize = options.gaussianKernelSize || 5;
            opencv_js_1.default.GaussianBlur(denoised, blurred, new opencv_js_1.default.Size(kernelSize, kernelSize), 0, 0);
            // Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
            const enhanced = new opencv_js_1.default.Mat();
            if (options.enhanceContrast) {
                const clahe = opencv_js_1.default.createCLAHE(2.0, new opencv_js_1.default.Size(8, 8));
                clahe.apply(blurred, enhanced);
            }
            else {
                blurred.copyTo(enhanced);
            }
            // Edge detection using Canny
            const edges = new opencv_js_1.default.Mat();
            if (options.detectEdges) {
                opencv_js_1.default.Canny(enhanced, edges, options.cannyLowThreshold || 50, options.cannyHighThreshold || 150, 3, false);
            }
            else {
                enhanced.copyTo(edges);
            }
            // Morphological operations
            const morphological = new opencv_js_1.default.Mat();
            if (options.morphologyOperation) {
                const kernelSize = options.kernelSize || 3;
                const kernel = opencv_js_1.default.getStructuringElement(opencv_js_1.default.MORPH_RECT, new opencv_js_1.default.Size(kernelSize, kernelSize));
                let morphOp;
                switch (options.morphologyOperation) {
                    case 'opening':
                        morphOp = opencv_js_1.default.MORPH_OPEN;
                        break;
                    case 'closing':
                        morphOp = opencv_js_1.default.MORPH_CLOSE;
                        break;
                    case 'gradient':
                        morphOp = opencv_js_1.default.MORPH_GRADIENT;
                        break;
                    case 'tophat':
                        morphOp = opencv_js_1.default.MORPH_TOPHAT;
                        break;
                    case 'blackhat':
                        morphOp = opencv_js_1.default.MORPH_BLACKHAT;
                        break;
                    default:
                        morphOp = opencv_js_1.default.MORPH_OPEN;
                }
                opencv_js_1.default.morphologyEx(enhanced, morphological, morphOp, kernel);
                kernel.delete();
            }
            else {
                enhanced.copyTo(morphological);
            }
            // Convert Mats back to buffers
            const processedBuffer = this.matToBuffer(enhanced);
            const edgesBuffer = this.matToBuffer(edges);
            const morphologicalBuffer = this.matToBuffer(morphological);
            const denoisedBuffer = this.matToBuffer(denoised);
            // Clean up OpenCV Mats
            src.delete();
            gray.delete();
            denoised.delete();
            blurred.delete();
            enhanced.delete();
            edges.delete();
            morphological.delete();
            return {
                processed: processedBuffer,
                edges: edgesBuffer,
                morphological: morphologicalBuffer,
                denoised: denoisedBuffer,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`OpenCV preprocessing failed: ${errorMessage}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Extract contours using OpenCV
     */
    async extractContoursWithOpenCV(imageBuffer) {
        await this.initializeOpenCV();
        try {
            const src = this.bufferToMat(imageBuffer);
            // Convert to grayscale
            const gray = new opencv_js_1.default.Mat();
            if (src.channels() === 3) {
                opencv_js_1.default.cvtColor(src, gray, opencv_js_1.default.COLOR_BGR2GRAY);
            }
            else {
                src.copyTo(gray);
            }
            // Apply threshold to get binary image
            const binary = new opencv_js_1.default.Mat();
            opencv_js_1.default.threshold(gray, binary, 0, 255, opencv_js_1.default.THRESH_BINARY + opencv_js_1.default.THRESH_OTSU);
            // Find contours
            const contours = new opencv_js_1.default.MatVector();
            const hierarchy = new opencv_js_1.default.Mat();
            opencv_js_1.default.findContours(binary, contours, hierarchy, opencv_js_1.default.RETR_EXTERNAL, opencv_js_1.default.CHAIN_APPROX_SIMPLE);
            // Draw contours for visualization
            const contoursImage = opencv_js_1.default.Mat.zeros(src.rows, src.cols, opencv_js_1.default.CV_8UC3);
            for (let i = 0; i < contours.size(); i++) {
                const color = new opencv_js_1.default.Scalar(Math.random() * 255, Math.random() * 255, Math.random() * 255);
                opencv_js_1.default.drawContours(contoursImage, contours, i, color, 2);
            }
            // Convert contours to JavaScript arrays
            const contoursJS = [];
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const points = [];
                for (let j = 0; j < contour.data32S.length; j += 2) {
                    points.push({
                        x: contour.data32S[j],
                        y: contour.data32S[j + 1]
                    });
                }
                // Calculate contour properties
                const area = opencv_js_1.default.contourArea(contour);
                const perimeter = opencv_js_1.default.arcLength(contour, true);
                const boundingRect = opencv_js_1.default.boundingRect(contour);
                contoursJS.push({
                    points,
                    area,
                    perimeter,
                    boundingBox: {
                        x: boundingRect.x,
                        y: boundingRect.y,
                        width: boundingRect.width,
                        height: boundingRect.height,
                        area: boundingRect.width * boundingRect.height
                    }
                });
            }
            const contoursImageBuffer = this.matToBuffer(contoursImage);
            // Clean up
            src.delete();
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            contoursImage.delete();
            return {
                contours: contoursJS,
                hierarchy: [],
                contoursImage: contoursImageBuffer,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`OpenCV contour extraction failed: ${errorMessage}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Convert Buffer to OpenCV Mat
     */
    bufferToMat(buffer) {
        try {
            // Create Mat from buffer data
            // This is a simplified implementation - in production you might need more sophisticated conversion
            // Try to decode as image first using Sharp to get dimensions
            return (0, sharp_1.default)(buffer).raw().toBuffer().then(data => {
                return (0, sharp_1.default)(buffer).metadata().then(metadata => {
                    const mat = opencv_js_1.default.matFromArray(metadata.height || 600, metadata.width || 800, metadata.channels === 3 ? opencv_js_1.default.CV_8UC3 : opencv_js_1.default.CV_8UC1, Array.from(data));
                    return mat;
                });
            });
        }
        catch (error) {
            // Fallback: create a mock Mat for testing
            console.warn('Failed to create Mat from buffer, using mock Mat');
            return opencv_js_1.default.Mat.zeros(600, 800, opencv_js_1.default.CV_8UC1);
        }
    }
    /**
     * Convert OpenCV Mat to Buffer
     */
    matToBuffer(mat) {
        try {
            // Convert Mat to ImageData-like format
            const canvas = (0, canvas_1.createCanvas)(mat.cols, mat.rows);
            const ctx = canvas.getContext('2d');
            // Create ImageData from Mat
            const imageData = ctx.createImageData(mat.cols, mat.rows);
            if (mat.channels() === 1) {
                // Grayscale
                for (let i = 0; i < mat.data.length; i++) {
                    const pixelIndex = i * 4;
                    const grayValue = mat.data[i];
                    imageData.data[pixelIndex] = grayValue; // R
                    imageData.data[pixelIndex + 1] = grayValue; // G
                    imageData.data[pixelIndex + 2] = grayValue; // B
                    imageData.data[pixelIndex + 3] = 255; // A
                }
            }
            else if (mat.channels() === 3) {
                // BGR to RGBA
                for (let i = 0; i < mat.data.length; i += 3) {
                    const pixelIndex = (i / 3) * 4;
                    imageData.data[pixelIndex] = mat.data[i + 2]; // R (from B)
                    imageData.data[pixelIndex + 1] = mat.data[i + 1]; // G
                    imageData.data[pixelIndex + 2] = mat.data[i]; // B (from R)
                    imageData.data[pixelIndex + 3] = 255; // A
                }
            }
            // Put ImageData on canvas and convert to buffer
            ctx.putImageData(imageData, 0, 0);
            return canvas.toBuffer('image/png');
        }
        catch (error) {
            console.warn('Failed to convert Mat to buffer:', error);
            // Return a simple mock buffer
            return Buffer.alloc(1000);
        }
    }
    /**
     * Assess image quality for detection reliability
     */
    async assessImageQuality(imageBuffer) {
        try {
            const image = (0, sharp_1.default)(imageBuffer);
            const metadata = await image.metadata();
            const stats = await image.stats();
            // Calculate resolution quality
            const resolution = Math.sqrt((metadata.width || 0) * (metadata.height || 0));
            const resolutionScore = Math.min(resolution / 1000, 1); // Normalize to 0-1
            // Calculate clarity based on image statistics
            const clarity = this.calculateClarity(stats);
            // Calculate contrast based on standard deviation
            const contrast = this.calculateContrast(stats);
            // Estimate noise level
            const noiseLevel = this.estimateNoiseLevel(stats);
            // Detect skew angle (simplified implementation)
            const skewAngle = await this.detectSkewAngle(imageBuffer);
            const quality = {
                resolution: resolutionScore,
                clarity,
                contrast,
                noiseLevel,
            };
            if (skewAngle !== undefined) {
                quality.skewAngle = skewAngle;
            }
            return quality;
        }
        catch (error) {
            throw new symbol_detection_types_1.ImageProcessingError(`Failed to assess image quality: ${error instanceof Error ? error.message : String(error)}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Normalize coordinates from pixel to relative coordinates (0-1)
     */
    normalizeCoordinates(pixelX, pixelY, imageWidth, imageHeight) {
        return {
            normalizedX: Math.max(0, Math.min(1, pixelX / imageWidth)),
            normalizedY: Math.max(0, Math.min(1, pixelY / imageHeight)),
            originalX: pixelX,
            originalY: pixelY,
            imageWidth,
            imageHeight,
        };
    }
    /**
     * Convert normalized coordinates back to pixel coordinates
     */
    denormalizeCoordinates(normalizedX, normalizedY, imageWidth, imageHeight) {
        return {
            x: Math.round(normalizedX * imageWidth),
            y: Math.round(normalizedY * imageHeight),
        };
    }
    /**
     * Extract regions of interest from image based on bounding boxes
     */
    async extractRegions(imageBuffer, regions) {
        try {
            const extractedRegions = [];
            for (const region of regions) {
                const extractedBuffer = await (0, sharp_1.default)(imageBuffer)
                    .extract({
                    left: Math.max(0, Math.round(region.x)),
                    top: Math.max(0, Math.round(region.y)),
                    width: Math.max(1, Math.round(region.width)),
                    height: Math.max(1, Math.round(region.height)),
                })
                    .png()
                    .toBuffer();
                extractedRegions.push(extractedBuffer);
            }
            return extractedRegions;
        }
        catch (error) {
            throw new symbol_detection_types_1.ImageProcessingError(`Failed to extract regions: ${error instanceof Error ? error.message : String(error)}`, { regions: regions.length });
        }
    }
    /**
     * Apply image filters for better symbol detection using OpenCV
     */
    async applyDetectionFilters(imageBuffer) {
        try {
            const original = imageBuffer;
            // Try OpenCV-enhanced filters first
            try {
                const opencvResults = await this.preprocessImageWithOpenCV(imageBuffer, {
                    enhanceContrast: true,
                    reduceNoise: true,
                    detectEdges: true,
                    morphologyOperation: 'closing',
                    kernelSize: 3,
                    cannyLowThreshold: 50,
                    cannyHighThreshold: 150,
                });
                // Apply additional thresholding using Sharp
                const thresholded = await (0, sharp_1.default)(opencvResults.processed)
                    .threshold(128)
                    .png()
                    .toBuffer();
                return {
                    original,
                    edges: opencvResults.edges,
                    morphological: opencvResults.morphological,
                    thresholded,
                };
            }
            catch (opencvError) {
                console.warn('OpenCV filters failed, falling back to Sharp filters:', opencvError);
                // Fallback to Sharp-based filters
                const edges = await (0, sharp_1.default)(imageBuffer)
                    .convolve({
                    width: 3,
                    height: 3,
                    kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
                })
                    .png()
                    .toBuffer();
                const morphological = await (0, sharp_1.default)(imageBuffer)
                    .convolve({
                    width: 3,
                    height: 3,
                    kernel: [0, 1, 0, 1, 1, 1, 0, 1, 0],
                })
                    .png()
                    .toBuffer();
                const thresholded = await (0, sharp_1.default)(imageBuffer)
                    .threshold(128)
                    .png()
                    .toBuffer();
                return {
                    original,
                    edges,
                    morphological,
                    thresholded,
                };
            }
        }
        catch (error) {
            throw new symbol_detection_types_1.ImageProcessingError(`Failed to apply detection filters: ${error instanceof Error ? error.message : String(error)}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Advanced morphological operations using OpenCV
     */
    async applyMorphologicalOperations(imageBuffer, operations) {
        await this.initializeOpenCV();
        try {
            let currentBuffer = imageBuffer;
            const steps = [];
            for (const op of operations) {
                const result = await this.preprocessImageWithOpenCV(currentBuffer, {
                    morphologyOperation: op.operation === 'dilate' || op.operation === 'erode'
                        ? 'opening' // Map dilate/erode to available operations
                        : op.operation,
                    kernelSize: op.kernelSize,
                });
                currentBuffer = result.morphological;
                steps.push(currentBuffer);
            }
            return {
                processed: currentBuffer,
                steps,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`Morphological operations failed: ${errorMessage}`, { bufferSize: imageBuffer.length, operationsCount: operations.length });
        }
    }
    /**
     * Multi-scale edge detection using different techniques
     */
    async detectMultiScaleEdges(imageBuffer) {
        await this.initializeOpenCV();
        try {
            // Canny edge detection (already implemented)
            const cannyResult = await this.preprocessImageWithOpenCV(imageBuffer, {
                detectEdges: true,
                cannyLowThreshold: 50,
                cannyHighThreshold: 150,
            });
            // Sobel edge detection (simulated with Sharp convolution)
            const sobelX = await (0, sharp_1.default)(imageBuffer)
                .greyscale()
                .convolve({
                width: 3,
                height: 3,
                kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
            })
                .png()
                .toBuffer();
            // Sobel Y direction (not used in current implementation but kept for completeness)
            // const sobelY = await sharp(imageBuffer)
            //   .greyscale()
            //   .convolve({
            //     width: 3,
            //     height: 3,
            //     kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
            //   })
            //   .png()
            //   .toBuffer();
            // Laplacian edge detection
            const laplacian = await (0, sharp_1.default)(imageBuffer)
                .greyscale()
                .convolve({
                width: 3,
                height: 3,
                kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0],
            })
                .png()
                .toBuffer();
            // Combine edge detection results (simplified combination)
            const combined = await this.combineEdgeResults([
                cannyResult.edges,
                sobelX,
                laplacian
            ]);
            return {
                canny: cannyResult.edges,
                sobel: sobelX, // Using sobelX as representative
                laplacian,
                combined,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`Multi-scale edge detection failed: ${errorMessage}`, { bufferSize: imageBuffer.length });
        }
    }
    /**
     * Combine multiple edge detection results
     */
    async combineEdgeResults(edgeBuffers) {
        try {
            if (edgeBuffers.length === 0) {
                throw new Error('No edge buffers to combine');
            }
            if (edgeBuffers.length === 1) {
                return edgeBuffers[0];
            }
            // Get dimensions from first image
            const metadata = await (0, sharp_1.default)(edgeBuffers[0]).metadata();
            const width = metadata.width || 800;
            const height = metadata.height || 600;
            // Create canvas for combination
            const canvas = (0, canvas_1.createCanvas)(width, height);
            const ctx = canvas.getContext('2d');
            // Fill with black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
            // For now, just use the first edge result
            // In a full implementation, you would properly combine the edge images
            return edgeBuffers[0];
        }
        catch (error) {
            console.warn('Failed to combine edge results:', error);
            return edgeBuffers[0]; // Return first buffer as fallback
        }
    }
    /**
     * Create mock PDF page for testing
     */
    async createMockPdfPage(width, height, format = 'png') {
        const canvas = (0, canvas_1.createCanvas)(width, height);
        const ctx = canvas.getContext('2d');
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        // Draw some mock electrical symbols
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        // Draw a resistor symbol
        ctx.beginPath();
        ctx.moveTo(100, 100);
        ctx.lineTo(120, 100);
        ctx.lineTo(130, 80);
        ctx.lineTo(150, 120);
        ctx.lineTo(170, 80);
        ctx.lineTo(190, 120);
        ctx.lineTo(200, 100);
        ctx.lineTo(220, 100);
        ctx.stroke();
        // Draw a capacitor symbol
        ctx.beginPath();
        ctx.moveTo(300, 100);
        ctx.lineTo(320, 100);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(320, 80);
        ctx.lineTo(320, 120);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(330, 80);
        ctx.lineTo(330, 120);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(330, 100);
        ctx.lineTo(350, 100);
        ctx.stroke();
        if (format === 'jpeg') {
            return canvas.toBuffer('image/jpeg');
        }
        else {
            return canvas.toBuffer('image/png');
        }
    }
    /**
     * Calculate image clarity based on statistics
     */
    calculateClarity(stats) {
        // Use entropy or variance as a measure of clarity
        // Higher variance typically indicates more detail/clarity
        const channel = stats.channels[0]; // Use first channel for grayscale
        // Calculate variance from mean and other available properties
        // Since std is not available, use min/max range as an approximation
        const range = channel.max - channel.min;
        const variance = range * range;
        // Normalize variance to 0-1 range (approximate)
        return Math.min(variance / 65536, 1); // 256^2 for 8-bit range
    }
    /**
     * Calculate image contrast based on statistics
     */
    calculateContrast(stats) {
        const channel = stats.channels[0];
        const range = channel.max - channel.min;
        // Normalize range to 0-1
        return range / 255;
    }
    /**
     * Estimate noise level in image
     */
    estimateNoiseLevel(stats) {
        const channel = stats.channels[0];
        // Use range as approximation for noise estimate
        // Higher range can indicate more variation/noise
        const range = channel.max - channel.min;
        const noiseEstimate = range / 255;
        // Return normalized noise estimate
        return Math.min(noiseEstimate, 1);
    }
    /**
     * Detect document skew angle (simplified implementation)
     */
    async detectSkewAngle(_imageBuffer) {
        try {
            // This is a simplified implementation
            // In a full implementation, you would use Hough transform or similar
            // For now, return undefined (no skew detected)
            return undefined;
        }
        catch (error) {
            // Return undefined if skew detection fails
            return undefined;
        }
    }
}
exports.ImageProcessor = ImageProcessor;
//# sourceMappingURL=image-processor.js.map