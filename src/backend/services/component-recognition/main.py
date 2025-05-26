"""
Intelligent Component Recognition Engine

Enhances existing component detection with specification mapping and ML-based classification.
Integrates with component specifications database for intelligent component identification.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
import cv2
import numpy as np
import asyncio
import logging
from datetime import datetime
import uuid
import json
import requests
from PIL import Image
import io
import base64
import tensorflow as tf
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Component Recognition Engine",
    description="Intelligent electrical component recognition with specification mapping",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Component Specifications API URL
COMPONENT_SPECS_API_URL = os.getenv("COMPONENT_SPECS_API_URL", "http://localhost:8003")

# Pydantic models
class BoundingBox(BaseModel):
    x: float = Field(..., description="X coordinate (normalized 0-1)")
    y: float = Field(..., description="Y coordinate (normalized 0-1)")
    width: float = Field(..., description="Width (normalized 0-1)")
    height: float = Field(..., description="Height (normalized 0-1)")

class ComponentDetection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str = Field(..., description="Component category")
    confidence: float = Field(..., description="Detection confidence (0-1)")
    bounding_box: BoundingBox = Field(..., description="Component location")
    visual_features: Dict[str, Any] = Field(default_factory=dict, description="Extracted visual features")
    text_content: Optional[str] = Field(None, description="OCR extracted text")
    part_number: Optional[str] = Field(None, description="Detected part number")
    specifications: Optional[Dict[str, Any]] = Field(None, description="Matched component specifications")
    similarity_score: Optional[float] = Field(None, description="Specification matching score")

class RecognitionRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image")
    enhance_ocr: bool = Field(True, description="Apply OCR for text extraction")
    match_specifications: bool = Field(True, description="Match with component database")
    confidence_threshold: float = Field(0.5, description="Minimum confidence threshold")

class RecognitionResponse(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    detected_components: List[ComponentDetection]
    processing_time: float
    total_components: int
    matched_specifications: int
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ComponentClassifier:
    """ML-based component classification system"""
    
    def __init__(self):
        self.model = None
        self.feature_extractor = None
        self.text_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.category_mapping = {
            0: "breaker",
            1: "switch", 
            2: "outlet",
            3: "light_fixture",
            4: "motor",
            5: "transformer",
            6: "panel",
            7: "junction_box",
            8: "conduit",
            9: "wire",
            10: "other"
        }
        self.load_models()
    
    def load_models(self):
        """Load pre-trained classification models"""
        try:
            # In production, load actual trained models
            # For now, we'll use a placeholder approach
            logger.info("Loading component classification models...")
            
            # Placeholder for CNN model (would load actual trained model)
            self.model = self._create_placeholder_model()
            
            # Load feature extraction model (pre-trained ResNet or similar)
            self.feature_extractor = tf.keras.applications.ResNet50(
                weights='imagenet',
                include_top=False,
                pooling='avg'
            )
            
            logger.info("Models loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            # Fallback to rule-based classification
            self.model = None
            self.feature_extractor = None
    
    def _create_placeholder_model(self):
        """Create a placeholder model structure"""
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(512, activation='relu', input_shape=(2048,)),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(len(self.category_mapping), activation='softmax')
        ])
        return model
    
    def extract_visual_features(self, image: np.ndarray) -> np.ndarray:
        """Extract visual features from component image"""
        try:
            if self.feature_extractor is None:
                return self._extract_traditional_features(image)
            
            # Preprocess image for ResNet
            resized = cv2.resize(image, (224, 224))
            if len(resized.shape) == 3:
                resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            
            # Normalize and add batch dimension
            processed = tf.cast(resized, tf.float32) / 255.0
            processed = tf.expand_dims(processed, 0)
            
            # Extract features
            features = self.feature_extractor(processed)
            return features.numpy().flatten()
            
        except Exception as e:
            logger.error(f"Error extracting visual features: {e}")
            return self._extract_traditional_features(image)
    
    def _extract_traditional_features(self, image: np.ndarray) -> np.ndarray:
        """Extract traditional computer vision features as fallback"""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        features = []
        
        # Shape analysis
        contours, _ = cv2.findContours(gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            # Aspect ratio
            x, y, w, h = cv2.boundingRect(largest_contour)
            aspect_ratio = w / h if h > 0 else 1
            
            features.extend([area / (gray.shape[0] * gray.shape[1]), circularity, aspect_ratio])
        else:
            features.extend([0, 0, 1])
        
        # Texture features (basic)
        mean_intensity = np.mean(gray)
        std_intensity = np.std(gray)
        features.extend([mean_intensity / 255.0, std_intensity / 255.0])
        
        # Edge density
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])
        features.append(edge_density)
        
        # Pad to match expected feature size
        while len(features) < 100:
            features.append(0.0)
        
        return np.array(features[:100])
    
    def classify_component(self, image: np.ndarray, text_content: str = None) -> Tuple[str, float]:
        """Classify component type with confidence score"""
        try:
            # Extract visual features
            visual_features = self.extract_visual_features(image)
            
            if self.model is not None:
                # Use trained model
                prediction = self.model.predict(visual_features.reshape(1, -1))
                class_idx = np.argmax(prediction)
                confidence = float(prediction[0][class_idx])
                category = self.category_mapping.get(class_idx, "other")
            else:
                # Fallback to rule-based classification
                category, confidence = self._rule_based_classification(image, text_content)
            
            return category, confidence
            
        except Exception as e:
            logger.error(f"Error in component classification: {e}")
            return "other", 0.1
    
    def _rule_based_classification(self, image: np.ndarray, text_content: str = None) -> Tuple[str, float]:
        """Rule-based classification fallback"""
        features = self._extract_traditional_features(image)
        
        # Simple heuristics based on shape and size
        aspect_ratio = features[2] if len(features) > 2 else 1.0
        circularity = features[1] if len(features) > 1 else 0.0
        edge_density = features[5] if len(features) > 5 else 0.0
        
        # Text-based hints
        if text_content:
            text_lower = text_content.lower()
            if any(keyword in text_lower for keyword in ['breaker', 'cb', 'circuit']):
                return "breaker", 0.8
            elif any(keyword in text_lower for keyword in ['switch', 'sw']):
                return "switch", 0.8
            elif any(keyword in text_lower for keyword in ['outlet', 'receptacle', 'gfci']):
                return "outlet", 0.8
            elif any(keyword in text_lower for keyword in ['panel', 'board']):
                return "panel", 0.8
        
        # Shape-based classification
        if circularity > 0.7:
            return "outlet", 0.6  # Round outlets
        elif aspect_ratio > 2.0:
            return "conduit", 0.6  # Long thin components
        elif aspect_ratio < 0.5:
            return "conduit", 0.6  # Tall thin components
        elif edge_density > 0.3:
            return "panel", 0.5  # Complex shapes with many edges
        else:
            return "other", 0.3

class TextExtractor:
    """OCR and text extraction for component identification"""
    
    def __init__(self):
        self.ocr_engine = None
        self.part_number_patterns = [
            r'[A-Z]{2,4}[-_]?\d{2,6}[A-Z]?',  # Standard part numbers
            r'\d{4,6}[A-Z]{1,3}',  # Numeric with suffix
            r'[A-Z]\d{3,5}',  # Letter + numbers
            r'\d{1,3}A',  # Amperage ratings
            r'\d{1,3}V',  # Voltage ratings
        ]
        self.setup_ocr()
    
    def setup_ocr(self):
        """Initialize OCR engine"""
        try:
            import pytesseract
            self.ocr_engine = pytesseract
            logger.info("OCR engine initialized")
        except ImportError:
            logger.warning("Tesseract not available, using fallback text extraction")
            self.ocr_engine = None
    
    def extract_text(self, image: np.ndarray) -> str:
        """Extract text from component image"""
        try:
            if self.ocr_engine is None:
                return self._extract_text_fallback(image)
            
            # Preprocess image for better OCR
            processed = self._preprocess_for_ocr(image)
            
            # Extract text
            text = self.ocr_engine.image_to_string(processed, config='--psm 6')
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error in text extraction: {e}")
            return ""
    
    def _preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image to improve OCR accuracy"""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Enhance contrast
        enhanced = cv2.equalizeHist(gray)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(enhanced)
        
        # Threshold
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return thresh
    
    def _extract_text_fallback(self, image: np.ndarray) -> str:
        """Fallback text extraction without OCR"""
        # This would implement a simpler character recognition approach
        # For now, return empty string
        return ""
    
    def extract_part_number(self, text: str) -> Optional[str]:
        """Extract potential part number from text"""
        import re
        
        for pattern in self.part_number_patterns:
            matches = re.findall(pattern, text.upper())
            if matches:
                return matches[0]
        
        return None

class SpecificationMatcher:
    """Matches detected components with specification database"""
    
    def __init__(self):
        self.component_specs_cache = {}
        self.cache_timeout = 300  # 5 minutes
        self.cache_timestamp = 0
    
    async def get_component_specifications(self) -> List[Dict[str, Any]]:
        """Get all component specifications with caching"""
        current_time = datetime.now().timestamp()
        
        if (current_time - self.cache_timestamp > self.cache_timeout or 
            not self.component_specs_cache):
            
            try:
                response = requests.get(f"{COMPONENT_SPECS_API_URL}/components?page_size=1000")
                if response.status_code == 200:
                    data = response.json()
                    self.component_specs_cache = data.get('components', [])
                    self.cache_timestamp = current_time
                    logger.info(f"Loaded {len(self.component_specs_cache)} component specifications")
                else:
                    logger.error(f"Failed to fetch specifications: {response.status_code}")
            except Exception as e:
                logger.error(f"Error fetching component specifications: {e}")
        
        return self.component_specs_cache
    
    async def match_specification(
        self, 
        detection: ComponentDetection
    ) -> Optional[Dict[str, Any]]:
        """Match detection with component specification"""
        specifications = await self.get_component_specifications()
        
        if not specifications:
            return None
        
        # Direct part number match (highest priority)
        if detection.part_number:
            for spec in specifications:
                if (spec.get('part_number', '').upper() == detection.part_number.upper() or
                    detection.part_number.upper() in spec.get('part_number', '').upper()):
                    detection.similarity_score = 1.0
                    return spec
        
        # Category and text-based matching
        category_matches = [
            spec for spec in specifications 
            if spec.get('category') == detection.category
        ]
        
        if not category_matches:
            return None
        
        # If we have text content, use semantic similarity
        if detection.text_content:
            best_match = await self._find_best_text_match(
                detection.text_content, 
                category_matches
            )
            if best_match:
                return best_match
        
        # Fallback to first category match
        detection.similarity_score = 0.5
        return category_matches[0]
    
    async def _find_best_text_match(
        self, 
        text_content: str, 
        specifications: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Find best specification match using text similarity"""
        if not text_content or not specifications:
            return None
        
        # Create text representations of specifications
        spec_texts = []
        for spec in specifications:
            spec_text = f"{spec.get('name', '')} {spec.get('part_number', '')} " + \
                       " ".join(spec.get('features', [])) + " " + \
                       " ".join(spec.get('applications', []))
            spec_texts.append(spec_text.lower())
        
        # Use TF-IDF for similarity matching
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
            
            all_texts = [text_content.lower()] + spec_texts
            vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
            tfidf_matrix = vectorizer.fit_transform(all_texts)
            
            # Calculate similarities
            similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
            
            # Find best match above threshold
            best_idx = np.argmax(similarities)
            best_score = similarities[best_idx]
            
            if best_score > 0.3:  # Minimum similarity threshold
                return specifications[best_idx]
        
        except Exception as e:
            logger.error(f"Error in text matching: {e}")
        
        return None

# Initialize components
classifier = ComponentClassifier()
text_extractor = TextExtractor()
spec_matcher = SpecificationMatcher()

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Component Recognition Engine started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "component-recognition"}

@app.post("/recognize", response_model=RecognitionResponse)
async def recognize_components(request: RecognitionRequest):
    """Recognize and classify electrical components in image"""
    start_time = datetime.now()
    
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_data)
        image = Image.open(io.BytesIO(image_data))
        image_np = np.array(image)
        
        # Convert PIL to OpenCV format
        if len(image_np.shape) == 3:
            image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        else:
            image_cv = image_np
        
        # Detect components (simplified - in production would use YOLO/similar)
        detections = await detect_components(
            image_cv, 
            request.enhance_ocr, 
            request.confidence_threshold
        )
        
        # Match with specifications if requested
        matched_count = 0
        if request.match_specifications:
            for detection in detections:
                spec = await spec_matcher.match_specification(detection)
                if spec:
                    detection.specifications = spec
                    matched_count += 1
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return RecognitionResponse(
            detected_components=detections,
            processing_time=processing_time,
            total_components=len(detections),
            matched_specifications=matched_count,
            metadata={
                "image_size": f"{image.width}x{image.height}",
                "enhancement_applied": request.enhance_ocr,
                "confidence_threshold": request.confidence_threshold
            }
        )
        
    except Exception as e:
        logger.error(f"Error in component recognition: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def detect_components(
    image: np.ndarray, 
    enhance_ocr: bool, 
    confidence_threshold: float
) -> List[ComponentDetection]:
    """Detect electrical components in image"""
    detections = []
    
    # Simplified detection - in production would use trained YOLO/similar
    # For now, simulate detection by dividing image into regions
    height, width = image.shape[:2]
    
    # Simulate finding 1-3 components
    num_components = min(3, max(1, int(np.random.normal(2, 0.5))))
    
    for i in range(num_components):
        # Random region (in production, this would be actual detection)
        x = np.random.uniform(0.1, 0.7)
        y = np.random.uniform(0.1, 0.7)
        w = np.random.uniform(0.1, 0.3)
        h = np.random.uniform(0.1, 0.3)
        
        # Extract component region
        x_px = int(x * width)
        y_px = int(y * height)
        w_px = int(w * width)
        h_px = int(h * height)
        
        component_region = image[y_px:y_px+h_px, x_px:x_px+w_px]
        
        if component_region.size == 0:
            continue
        
        # Classify component
        category, confidence = classifier.classify_component(component_region)
        
        if confidence < confidence_threshold:
            continue
        
        # Extract text if requested
        text_content = None
        part_number = None
        if enhance_ocr:
            text_content = text_extractor.extract_text(component_region)
            part_number = text_extractor.extract_part_number(text_content)
        
        # Extract visual features
        visual_features = classifier.extract_visual_features(component_region).tolist()
        
        detection = ComponentDetection(
            category=category,
            confidence=confidence,
            bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
            visual_features={"features": visual_features[:10]},  # Truncate for response
            text_content=text_content,
            part_number=part_number
        )
        
        detections.append(detection)
    
    return detections

@app.post("/classify-component")
async def classify_single_component(
    image: UploadFile = File(...),
    extract_text: bool = True
):
    """Classify a single component image"""
    try:
        # Read image
        image_data = await image.read()
        image_pil = Image.open(io.BytesIO(image_data))
        image_np = np.array(image_pil)
        
        # Convert to OpenCV format
        if len(image_np.shape) == 3:
            image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        else:
            image_cv = image_np
        
        # Classify
        category, confidence = classifier.classify_component(image_cv)
        
        # Extract text if requested
        text_content = None
        part_number = None
        if extract_text:
            text_content = text_extractor.extract_text(image_cv)
            part_number = text_extractor.extract_part_number(text_content)
        
        # Match with specification
        detection = ComponentDetection(
            category=category,
            confidence=confidence,
            bounding_box=BoundingBox(x=0, y=0, width=1, height=1),
            text_content=text_content,
            part_number=part_number
        )
        
        spec = await spec_matcher.match_specification(detection)
        
        return {
            "category": category,
            "confidence": confidence,
            "text_content": text_content,
            "part_number": part_number,
            "specification": spec,
            "similarity_score": detection.similarity_score
        }
        
    except Exception as e:
        logger.error(f"Error in single component classification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/status")
async def get_model_status():
    """Get status of loaded ML models"""
    return {
        "classifier_loaded": classifier.model is not None,
        "feature_extractor_loaded": classifier.feature_extractor is not None,
        "ocr_available": text_extractor.ocr_engine is not None,
        "categories": list(classifier.category_mapping.values()),
        "specs_cache_size": len(spec_matcher.component_specs_cache)
    }

@app.get("/stats")
async def get_recognition_stats():
    """Get recognition engine statistics"""
    specifications = await spec_matcher.get_component_specifications()
    
    category_counts = {}
    for spec in specifications:
        category = spec.get('category', 'unknown')
        category_counts[category] = category_counts.get(category, 0) + 1
    
    return {
        "total_specifications": len(specifications),
        "categories_available": category_counts,
        "models_loaded": {
            "classifier": classifier.model is not None,
            "feature_extractor": classifier.feature_extractor is not None,
            "ocr": text_extractor.ocr_engine is not None
        },
        "cache_status": {
            "specs_cached": len(spec_matcher.component_specs_cache),
            "cache_age": datetime.now().timestamp() - spec_matcher.cache_timestamp
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)