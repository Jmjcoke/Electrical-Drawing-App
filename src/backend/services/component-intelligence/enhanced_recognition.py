import tensorflow as tf
import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import json
import logging
import asyncio
import aiohttp
from datetime import datetime
import hashlib
from functools import lru_cache
import sqlite3
import pickle

logger = logging.getLogger(__name__)

class ComponentCategory(Enum):
    BREAKER = "breaker"
    SWITCH = "switch"
    OUTLET = "outlet"
    LIGHT_FIXTURE = "light_fixture"
    MOTOR = "motor"
    TRANSFORMER = "transformer"
    PANEL = "panel"
    CONDUIT = "conduit"
    WIRE = "wire"
    JUNCTION_BOX = "junction_box"
    METER = "meter"
    DISCONNECT = "disconnect"
    FUSE = "fuse"
    RELAY = "relay"
    CONTACTOR = "contactor"

class ConfidenceLevel(Enum):
    LOW = "low"          # 50-70%
    MEDIUM = "medium"    # 70-85%
    HIGH = "high"        # 85-95%
    VERY_HIGH = "very_high"  # 95%+

@dataclass
class ComponentSpecification:
    manufacturer: str
    model_number: str
    category: ComponentCategory
    voltage_rating: float
    current_rating: float
    power_rating: Optional[float] = None
    dimensions: Dict[str, float] = field(default_factory=dict)
    certifications: List[str] = field(default_factory=list)
    installation_notes: str = ""
    datasheet_url: Optional[str] = None
    price_estimate: Optional[float] = None
    availability: str = "unknown"
    replacement_parts: List[str] = field(default_factory=list)

@dataclass
class RecognitionResult:
    component_id: str
    category: ComponentCategory
    confidence: float
    confidence_level: ConfidenceLevel
    bounding_box: Tuple[int, int, int, int]
    specifications: Optional[ComponentSpecification] = None
    visual_features: Dict[str, Any] = field(default_factory=dict)
    recognition_timestamp: datetime = field(default_factory=datetime.now)
    alternative_matches: List[Dict[str, Any]] = field(default_factory=list)

class ComponentDatabase:
    def __init__(self, db_path: str = "component_database.sqlite"):
        self.db_path = db_path
        self._init_database()
        
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                category TEXT NOT NULL,
                voltage_rating REAL,
                current_rating REAL,
                power_rating REAL,
                dimensions TEXT,
                certifications TEXT,
                installation_notes TEXT,
                datasheet_url TEXT,
                price_estimate REAL,
                availability TEXT,
                replacement_parts TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS component_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id INTEGER,
                feature_vector BLOB,
                image_hash TEXT,
                extraction_method TEXT,
                FOREIGN KEY (component_id) REFERENCES components (id)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_manufacturer_model 
            ON components (manufacturer, model_number)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_category 
            ON components (category)
        """)
        
        conn.commit()
        conn.close()
        
        # Initialize with sample data if empty
        self._populate_sample_data()
    
    def _populate_sample_data(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM components")
        count = cursor.fetchone()[0]
        
        if count == 0:
            sample_components = [
                ComponentSpecification(
                    manufacturer="Square D",
                    model_number="QO120",
                    category=ComponentCategory.BREAKER,
                    voltage_rating=120,
                    current_rating=20,
                    dimensions={"width": 1.0, "height": 2.0, "depth": 2.5},
                    certifications=["UL 489", "CSA"],
                    datasheet_url="https://example.com/datasheet",
                    price_estimate=15.50
                ),
                ComponentSpecification(
                    manufacturer="Leviton",
                    model_number="5325-W",
                    category=ComponentCategory.OUTLET,
                    voltage_rating=125,
                    current_rating=15,
                    dimensions={"width": 2.75, "height": 4.5, "depth": 1.5},
                    certifications=["UL 498"],
                    price_estimate=8.25
                ),
                ComponentSpecification(
                    manufacturer="Siemens",
                    model_number="BQD315",
                    category=ComponentCategory.BREAKER,
                    voltage_rating=240,
                    current_rating=15,
                    dimensions={"width": 1.0, "height": 3.0, "depth": 2.5},
                    certifications=["UL 489"],
                    price_estimate=22.75
                )
            ]
            
            for spec in sample_components:
                self.add_component(spec)
        
        conn.close()
    
    def add_component(self, spec: ComponentSpecification) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO components 
            (manufacturer, model_number, category, voltage_rating, current_rating,
             power_rating, dimensions, certifications, installation_notes,
             datasheet_url, price_estimate, availability, replacement_parts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            spec.manufacturer,
            spec.model_number,
            spec.category.value,
            spec.voltage_rating,
            spec.current_rating,
            spec.power_rating,
            json.dumps(spec.dimensions),
            json.dumps(spec.certifications),
            spec.installation_notes,
            spec.datasheet_url,
            spec.price_estimate,
            spec.availability,
            json.dumps(spec.replacement_parts)
        ))
        
        component_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return component_id
    
    def search_components(self, 
                         category: Optional[ComponentCategory] = None,
                         manufacturer: Optional[str] = None,
                         voltage_range: Optional[Tuple[float, float]] = None,
                         current_range: Optional[Tuple[float, float]] = None) -> List[ComponentSpecification]:
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT * FROM components WHERE 1=1"
        params = []
        
        if category:
            query += " AND category = ?"
            params.append(category.value)
        
        if manufacturer:
            query += " AND manufacturer LIKE ?"
            params.append(f"%{manufacturer}%")
        
        if voltage_range:
            query += " AND voltage_rating BETWEEN ? AND ?"
            params.extend(voltage_range)
        
        if current_range:
            query += " AND current_rating BETWEEN ? AND ?"
            params.extend(current_range)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        components = []
        for row in rows:
            spec = ComponentSpecification(
                manufacturer=row[1],
                model_number=row[2],
                category=ComponentCategory(row[3]),
                voltage_rating=row[4],
                current_rating=row[5],
                power_rating=row[6],
                dimensions=json.loads(row[7]) if row[7] else {},
                certifications=json.loads(row[8]) if row[8] else [],
                installation_notes=row[9] or "",
                datasheet_url=row[10],
                price_estimate=row[11],
                availability=row[12] or "unknown",
                replacement_parts=json.loads(row[13]) if row[13] else []
            )
            components.append(spec)
        
        return components

class FeatureExtractor:
    def __init__(self):
        self.sift = cv2.SIFT_create()
        self.orb = cv2.ORB_create()
        
    def extract_visual_features(self, image: np.ndarray, 
                              bbox: Tuple[int, int, int, int]) -> Dict[str, Any]:
        x, y, w, h = bbox
        roi = image[y:y+h, x:x+w]
        
        if roi.size == 0:
            return {}
        
        # Convert to grayscale if needed
        if len(roi.shape) == 3:
            gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        else:
            gray_roi = roi
        
        features = {
            "geometric": self._extract_geometric_features(gray_roi),
            "texture": self._extract_texture_features(gray_roi),
            "edge": self._extract_edge_features(gray_roi),
            "keypoints": self._extract_keypoint_features(gray_roi),
            "color": self._extract_color_features(roi) if len(roi.shape) == 3 else {}
        }
        
        return features
    
    def _extract_geometric_features(self, image: np.ndarray) -> Dict[str, float]:
        h, w = image.shape[:2]
        
        # Find contours for shape analysis
        edges = cv2.Canny(image, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return {"aspect_ratio": w/h, "area": w*h}
        
        # Use largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        perimeter = cv2.arcLength(largest_contour, True)
        
        # Calculate shape descriptors
        if perimeter > 0:
            circularity = 4 * np.pi * area / (perimeter ** 2)
        else:
            circularity = 0
        
        # Bounding rectangle
        x, y, bw, bh = cv2.boundingRect(largest_contour)
        extent = area / (bw * bh) if bw * bh > 0 else 0
        
        return {
            "aspect_ratio": w / h,
            "area": area,
            "perimeter": perimeter,
            "circularity": circularity,
            "extent": extent,
            "width": w,
            "height": h
        }
    
    def _extract_texture_features(self, image: np.ndarray) -> Dict[str, float]:
        # Local Binary Pattern
        from skimage.feature import local_binary_pattern
        
        lbp = local_binary_pattern(image, 8, 1, method='uniform')
        lbp_hist, _ = np.histogram(lbp.ravel(), bins=10, range=(0, 10))
        lbp_hist = lbp_hist.astype(float)
        lbp_hist /= (lbp_hist.sum() + 1e-6)
        
        # Gray Level Co-occurrence Matrix features
        glcm_features = self._calculate_glcm_features(image)
        
        return {
            "lbp_uniformity": np.sum(lbp_hist ** 2),
            "lbp_entropy": -np.sum(lbp_hist * np.log2(lbp_hist + 1e-6)),
            **glcm_features
        }
    
    def _calculate_glcm_features(self, image: np.ndarray) -> Dict[str, float]:
        from skimage.feature import graycomatrix, graycoprops
        
        # Reduce image depth for GLCM computation
        image_reduced = (image // 32).astype(np.uint8)
        
        try:
            glcm = graycomatrix(image_reduced, [1], [0, np.pi/4, np.pi/2, 3*np.pi/4], levels=8)
            
            contrast = graycoprops(glcm, 'contrast')[0, 0]
            dissimilarity = graycoprops(glcm, 'dissimilarity')[0, 0]
            homogeneity = graycoprops(glcm, 'homogeneity')[0, 0]
            energy = graycoprops(glcm, 'energy')[0, 0]
            
            return {
                "glcm_contrast": contrast,
                "glcm_dissimilarity": dissimilarity,
                "glcm_homogeneity": homogeneity,
                "glcm_energy": energy
            }
        except:
            return {
                "glcm_contrast": 0.0,
                "glcm_dissimilarity": 0.0,
                "glcm_homogeneity": 0.0,
                "glcm_energy": 0.0
            }
    
    def _extract_edge_features(self, image: np.ndarray) -> Dict[str, float]:
        # Canny edge detection
        edges = cv2.Canny(image, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # Sobel gradients
        grad_x = cv2.Sobel(image, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(image, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
        
        return {
            "edge_density": edge_density,
            "mean_gradient": np.mean(gradient_magnitude),
            "std_gradient": np.std(gradient_magnitude)
        }
    
    def _extract_keypoint_features(self, image: np.ndarray) -> Dict[str, Any]:
        # SIFT keypoints
        keypoints_sift, descriptors_sift = self.sift.detectAndCompute(image, None)
        
        # ORB keypoints  
        keypoints_orb, descriptors_orb = self.orb.detectAndCompute(image, None)
        
        return {
            "sift_keypoint_count": len(keypoints_sift),
            "orb_keypoint_count": len(keypoints_orb),
            "sift_descriptors": descriptors_sift.tolist() if descriptors_sift is not None else [],
            "orb_descriptors": descriptors_orb.tolist() if descriptors_orb is not None else []
        }
    
    def _extract_color_features(self, image: np.ndarray) -> Dict[str, Any]:
        if len(image.shape) != 3:
            return {}
        
        # Color histograms
        hist_b = cv2.calcHist([image], [0], None, [32], [0, 256])
        hist_g = cv2.calcHist([image], [1], None, [32], [0, 256])
        hist_r = cv2.calcHist([image], [2], None, [32], [0, 256])
        
        # Normalize histograms
        hist_b = hist_b.flatten() / np.sum(hist_b)
        hist_g = hist_g.flatten() / np.sum(hist_g)
        hist_r = hist_r.flatten() / np.sum(hist_r)
        
        # Color moments
        mean_color = np.mean(image.reshape(-1, 3), axis=0)
        std_color = np.std(image.reshape(-1, 3), axis=0)
        
        return {
            "color_hist_b": hist_b.tolist(),
            "color_hist_g": hist_g.tolist(),
            "color_hist_r": hist_r.tolist(),
            "mean_color": mean_color.tolist(),
            "std_color": std_color.tolist()
        }

class MLComponentClassifier:
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.class_names = [category.value for category in ComponentCategory]
        self.feature_extractor = FeatureExtractor()
        
        if model_path and tf.io.gfile.exists(model_path):
            self.model = tf.keras.models.load_model(model_path)
        else:
            self._create_default_model()
    
    def _create_default_model(self):
        # Create a simple CNN for component classification
        self.model = tf.keras.Sequential([
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(224, 224, 3)),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(64, activation='relu'),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(len(self.class_names), activation='softmax')
        ])
        
        self.model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
    
    def preprocess_image(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
        x, y, w, h = bbox
        roi = image[y:y+h, x:x+w]
        
        if roi.size == 0:
            roi = np.zeros((224, 224, 3), dtype=np.uint8)
        
        # Resize to model input size
        roi_resized = cv2.resize(roi, (224, 224))
        
        # Normalize
        roi_normalized = roi_resized.astype(np.float32) / 255.0
        
        return np.expand_dims(roi_normalized, axis=0)
    
    def classify_component(self, image: np.ndarray, 
                          bbox: Tuple[int, int, int, int]) -> Tuple[ComponentCategory, float, List[Dict[str, Any]]]:
        
        preprocessed = self.preprocess_image(image, bbox)
        predictions = self.model.predict(preprocessed, verbose=0)
        
        # Get top 3 predictions
        top_indices = np.argsort(predictions[0])[-3:][::-1]
        
        primary_category = ComponentCategory(self.class_names[top_indices[0]])
        primary_confidence = float(predictions[0][top_indices[0]])
        
        alternatives = []
        for i in range(1, min(3, len(top_indices))):
            idx = top_indices[i]
            alternatives.append({
                "category": self.class_names[idx],
                "confidence": float(predictions[0][idx])
            })
        
        return primary_category, primary_confidence, alternatives

class EnhancedComponentRecognition:
    def __init__(self, database_path: str = "component_database.sqlite"):
        self.database = ComponentDatabase(database_path)
        self.classifier = MLComponentClassifier()
        self.feature_extractor = FeatureExtractor()
        self.recognition_cache = {}
        
    @lru_cache(maxsize=1000)
    def _get_image_hash(self, image_bytes: bytes) -> str:
        return hashlib.md5(image_bytes).hexdigest()
    
    async def recognize_component(self, image: np.ndarray, 
                                bbox: Tuple[int, int, int, int],
                                enable_specification_lookup: bool = True) -> RecognitionResult:
        
        # Check cache first
        image_bytes = image.tobytes()
        cache_key = f"{self._get_image_hash(image_bytes)}_{bbox}"
        
        if cache_key in self.recognition_cache:
            logger.debug(f"Cache hit for component recognition: {cache_key}")
            return self.recognition_cache[cache_key]
        
        # Extract visual features
        visual_features = self.feature_extractor.extract_visual_features(image, bbox)
        
        # Classify component using ML model
        category, confidence, alternatives = self.classifier.classify_component(image, bbox)
        
        # Determine confidence level
        if confidence >= 0.95:
            confidence_level = ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.85:
            confidence_level = ConfidenceLevel.HIGH
        elif confidence >= 0.70:
            confidence_level = ConfidenceLevel.MEDIUM
        else:
            confidence_level = ConfidenceLevel.LOW
        
        # Generate component ID
        component_id = f"{category.value}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        # Create recognition result
        result = RecognitionResult(
            component_id=component_id,
            category=category,
            confidence=confidence,
            confidence_level=confidence_level,
            bounding_box=bbox,
            visual_features=visual_features,
            alternative_matches=alternatives
        )
        
        # Lookup specifications if enabled and confidence is sufficient
        if enable_specification_lookup and confidence >= 0.70:
            result.specifications = await self._lookup_specifications(
                category, visual_features, confidence
            )
        
        # Cache the result
        self.recognition_cache[cache_key] = result
        
        logger.info(f"Component recognized: {category.value} with {confidence:.2%} confidence")
        
        return result
    
    async def _lookup_specifications(self, category: ComponentCategory, 
                                   visual_features: Dict[str, Any],
                                   confidence: float) -> Optional[ComponentSpecification]:
        
        # Search database for similar components
        candidates = self.database.search_components(category=category)
        
        if not candidates:
            logger.warning(f"No specifications found for category: {category.value}")
            return None
        
        # For now, return the first candidate
        # In a real implementation, you would use feature matching to find the best match
        best_match = candidates[0]
        
        logger.info(f"Specification lookup found: {best_match.manufacturer} {best_match.model_number}")
        
        return best_match
    
    async def batch_recognize_components(self, image: np.ndarray, 
                                       bboxes: List[Tuple[int, int, int, int]]) -> List[RecognitionResult]:
        
        tasks = []
        for bbox in bboxes:
            task = self.recognize_component(image, bbox)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        logger.info(f"Batch recognition completed for {len(bboxes)} components")
        
        return results
    
    def get_recognition_statistics(self) -> Dict[str, Any]:
        if not self.recognition_cache:
            return {"total_recognitions": 0}
        
        categories = {}
        confidence_levels = {}
        
        for result in self.recognition_cache.values():
            category = result.category.value
            confidence_level = result.confidence_level.value
            
            categories[category] = categories.get(category, 0) + 1
            confidence_levels[confidence_level] = confidence_levels.get(confidence_level, 0) + 1
        
        return {
            "total_recognitions": len(self.recognition_cache),
            "categories": categories,
            "confidence_levels": confidence_levels,
            "cache_hit_ratio": self._calculate_cache_hit_ratio()
        }
    
    def _calculate_cache_hit_ratio(self) -> float:
        # This would be implemented with proper cache hit tracking
        return 0.75  # Placeholder
    
    def export_recognition_data(self, filepath: str):
        with open(filepath, 'wb') as f:
            pickle.dump(self.recognition_cache, f)
        
        logger.info(f"Recognition data exported to {filepath}")
    
    def import_recognition_data(self, filepath: str):
        with open(filepath, 'rb') as f:
            imported_data = pickle.load(f)
            self.recognition_cache.update(imported_data)
        
        logger.info(f"Recognition data imported from {filepath}")

# Example usage and testing
async def test_enhanced_recognition():
    recognition_engine = EnhancedComponentRecognition()
    
    # Create a test image
    test_image = np.random.randint(0, 255, (800, 600, 3), dtype=np.uint8)
    test_bbox = (100, 100, 200, 150)
    
    # Recognize component
    result = await recognition_engine.recognize_component(test_image, test_bbox)
    
    print(f"Recognition Result:")
    print(f"Category: {result.category.value}")
    print(f"Confidence: {result.confidence:.2%}")
    print(f"Confidence Level: {result.confidence_level.value}")
    print(f"Bounding Box: {result.bounding_box}")
    
    if result.specifications:
        print(f"Specifications: {result.specifications.manufacturer} {result.specifications.model_number}")
    
    # Get statistics
    stats = recognition_engine.get_recognition_statistics()
    print(f"Recognition Statistics: {stats}")

if __name__ == "__main__":
    asyncio.run(test_enhanced_recognition())