"""
Project Similarity Engine
Story 4.3 Task 1: Advanced similarity calculation and project matching
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
import logging
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
from collections import defaultdict
import math

# Import ML libraries for similarity
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from scipy.spatial.distance import jaccard
from scipy.stats import pearsonr

# Import our models
from ..data_models import (
    ProjectFingerprint, SimilarityResult, SimilarityMetrics,
    ProjectCharacteristics, SimilarityWeights
)

logger = logging.getLogger(__name__)

class ProjectSimilarityEngine:
    """Advanced project similarity engine with multiple algorithms"""
    
    def __init__(self):
        self.project_index = {}
        self.fingerprint_matrix = None
        self.feature_names = []
        self.scalers = {}
        self.vectorizers = {}
        self.similarity_models = {}
        self.initialized = False
        
        # Default similarity weights
        self.default_weights = {
            'technical_similarity': 0.25,
            'scope_similarity': 0.20,
            'cost_similarity': 0.15,
            'location_similarity': 0.10,
            'timeline_similarity': 0.10,
            'complexity_similarity': 0.15,
            'industry_similarity': 0.05
        }
        
        # Similarity thresholds for different contexts
        self.similarity_thresholds = {
            'estimation_validation': 0.75,
            'risk_assessment': 0.70,
            'best_practices': 0.65,
            'general_reference': 0.60
        }
        
        # Feature categories for weighted similarity
        self.feature_categories = {
            'technical': [
                'voltage_levels', 'system_types', 'component_count',
                'circuit_complexity', 'installation_methods'
            ],
            'scope': [
                'project_area', 'total_cost', 'labor_hours',
                'component_density', 'system_count'
            ],
            'location': [
                'geographic_region', 'climate_zone', 'urban_rural',
                'accessibility', 'local_codes'
            ],
            'timeline': [
                'project_duration', 'seasonal_timing', 'schedule_pressure',
                'milestone_complexity'
            ],
            'complexity': [
                'technical_complexity', 'coordination_complexity',
                'site_complexity', 'integration_complexity'
            ]
        }
    
    async def initialize(self):
        """Initialize the similarity engine"""
        logger.info("Initializing Project Similarity Engine...")
        
        try:
            # Load historical project data for indexing
            await self._load_historical_projects()
            
            # Build similarity index
            await self._build_similarity_index()
            
            # Initialize ML models for similarity
            await self._initialize_similarity_models()
            
            # Optimize similarity weights
            await self._optimize_similarity_weights()
            
            self.initialized = True
            logger.info("✓ Project Similarity Engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize similarity engine: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for similarity engine"""
        return {
            "status": "healthy" if self.initialized else "not_initialized",
            "indexed_projects": len(self.project_index),
            "feature_dimensions": len(self.feature_names),
            "similarity_models": len(self.similarity_models),
            "ready_for_search": self.initialized and len(self.project_index) > 0
        }
    
    async def find_similar_projects(self,
                                  fingerprint: ProjectFingerprint,
                                  limit: int = 10,
                                  threshold: float = 0.6,
                                  weights: Optional[Dict[str, float]] = None,
                                  exclude_ids: List[str] = None,
                                  quick_mode: bool = False,
                                  detailed_mode: bool = False) -> List[Dict[str, Any]]:
        """Find similar projects using advanced similarity algorithms"""
        
        try:
            logger.info(f"Finding similar projects with threshold {threshold}")
            
            if not self.initialized:
                raise ValueError("Similarity engine not initialized")
            
            # Use provided weights or defaults
            similarity_weights = weights or self.default_weights
            exclude_ids = exclude_ids or []
            
            # Extract feature vector from fingerprint
            query_vector = self._fingerprint_to_vector(fingerprint)
            
            if quick_mode:
                # Fast similarity search for quick results
                similar_projects = await self._quick_similarity_search(
                    query_vector, limit, threshold, exclude_ids
                )
            else:
                # Comprehensive similarity analysis
                similar_projects = await self._comprehensive_similarity_search(
                    fingerprint, query_vector, limit, threshold, 
                    similarity_weights, exclude_ids, detailed_mode
                )
            
            # Sort by similarity score
            similar_projects.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            logger.info(f"Found {len(similar_projects)} similar projects")
            return similar_projects[:limit]
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            raise
    
    async def calculate_advanced_metrics(self,
                                       fingerprint: ProjectFingerprint,
                                       similar_projects: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate advanced similarity metrics and analysis"""
        
        if not similar_projects:
            return {
                "total_matches": 0,
                "avg_similarity": 0.0,
                "similarity_distribution": {},
                "category_breakdown": {}
            }
        
        # Extract similarity scores
        scores = [p['similarity_score'] for p in similar_projects]
        
        # Calculate distribution statistics
        similarity_stats = {
            "total_matches": len(similar_projects),
            "avg_similarity": np.mean(scores),
            "median_similarity": np.median(scores),
            "std_similarity": np.std(scores),
            "min_similarity": np.min(scores),
            "max_similarity": np.max(scores)
        }
        
        # Similarity distribution by ranges
        distribution = {
            "excellent (0.9+)": len([s for s in scores if s >= 0.9]),
            "very_good (0.8-0.9)": len([s for s in scores if 0.8 <= s < 0.9]),
            "good (0.7-0.8)": len([s for s in scores if 0.7 <= s < 0.8]),
            "moderate (0.6-0.7)": len([s for s in scores if 0.6 <= s < 0.7]),
            "low (0.5-0.6)": len([s for s in scores if 0.5 <= s < 0.6])
        }
        
        # Category breakdown analysis
        category_breakdown = await self._analyze_category_breakdown(
            fingerprint, similar_projects
        )
        
        return {
            **similarity_stats,
            "similarity_distribution": distribution,
            "category_breakdown": category_breakdown,
            "search_quality": self._assess_search_quality(scores),
            "confidence_level": self._calculate_confidence_level(scores)
        }
    
    async def get_similarity_trends(self,
                                  time_period: str,
                                  project_type: Optional[str] = None,
                                  industry: Optional[str] = None) -> Dict[str, Any]:
        """Get similarity search trends and patterns"""
        
        # Mock implementation - would analyze actual search logs
        return {
            "time_period": time_period,
            "search_volume_trend": [100, 120, 135, 150, 165, 180],
            "avg_similarity_trend": [0.72, 0.74, 0.73, 0.75, 0.76, 0.78],
            "popular_project_types": [
                {"type": "commercial", "searches": 450},
                {"type": "industrial", "searches": 320},
                {"type": "infrastructure", "searches": 180}
            ],
            "similarity_patterns": {
                "peak_search_times": ["09:00-11:00", "14:00-16:00"],
                "common_thresholds": [0.6, 0.7, 0.8],
                "typical_result_count": 12
            }
        }
    
    async def get_indexed_count(self) -> int:
        """Get count of indexed projects"""
        return len(self.project_index)
    
    async def get_project_data(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project data by ID"""
        return self.project_index.get(project_id)
    
    # Private methods for internal processing
    
    async def _load_historical_projects(self):
        """Load historical projects for similarity indexing"""
        # This would connect to the historical data service from Story 4.1
        # For now, create mock data
        mock_projects = self._generate_mock_project_data(1000)
        
        for project in mock_projects:
            self.project_index[project['project_id']] = project
        
        logger.info(f"Loaded {len(mock_projects)} projects for similarity indexing")
    
    async def _build_similarity_index(self):
        """Build similarity index for fast searching"""
        if not self.project_index:
            return
        
        # Extract features from all projects
        feature_matrices = []
        project_ids = []
        
        for project_id, project_data in self.project_index.items():
            features = self._extract_project_features(project_data)
            feature_matrices.append(features)
            project_ids.append(project_id)
        
        # Create feature matrix
        self.fingerprint_matrix = np.array(feature_matrices)
        self.project_ids = project_ids
        
        # Initialize scalers for normalization
        self.scalers['standard'] = StandardScaler()
        self.scalers['minmax'] = MinMaxScaler()
        
        # Fit scalers
        self.scalers['standard'].fit(self.fingerprint_matrix)
        self.scalers['minmax'].fit(self.fingerprint_matrix)
        
        logger.info(f"Built similarity index with {self.fingerprint_matrix.shape} feature matrix")
    
    async def _initialize_similarity_models(self):
        """Initialize ML models for similarity calculation"""
        
        # Nearest neighbors model for fast approximate search
        self.similarity_models['knn'] = NearestNeighbors(
            n_neighbors=50,
            metric='cosine',
            algorithm='ball_tree'
        )
        
        if self.fingerprint_matrix is not None:
            # Fit on normalized data
            normalized_matrix = self.scalers['standard'].transform(self.fingerprint_matrix)
            self.similarity_models['knn'].fit(normalized_matrix)
        
        # TF-IDF vectorizer for text-based similarity
        self.vectorizers['tfidf'] = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        
        logger.info("Initialized similarity models")
    
    def _extract_project_features(self, project_data: Dict[str, Any]) -> np.ndarray:
        """Extract numerical features from project data"""
        features = []
        
        # Basic project features
        features.extend([
            project_data.get('total_cost', 0) / 1000000,  # Normalize to millions
            project_data.get('labor_hours', 0) / 1000,     # Normalize to thousands
            project_data.get('component_count', 0) / 100,  # Normalize to hundreds
            project_data.get('complexity_score', 5) / 10,  # Normalize to 0-1
            project_data.get('duration_days', 90) / 365,   # Normalize to fraction of year
        ])
        
        # Project type encoding (one-hot style)
        project_types = ['commercial', 'industrial', 'residential', 'infrastructure']
        project_type = project_data.get('project_type', 'commercial')
        for ptype in project_types:
            features.append(1.0 if project_type == ptype else 0.0)
        
        # Industry encoding
        industries = ['oil_gas', 'manufacturing', 'commercial_building', 'healthcare']
        industry = project_data.get('industry_category', 'commercial_building')
        for ind in industries:
            features.append(1.0 if industry == ind else 0.0)
        
        # Location features
        location = project_data.get('location', {})
        features.extend([
            self._encode_region(location.get('state', 'CA')),
            self._encode_climate(location.get('climate_zone', 'temperate')),
            1.0 if location.get('urban_rural') == 'urban' else 0.0
        ])
        
        # Technical features
        features.extend([
            len(project_data.get('voltage_levels', [])) / 5,  # Normalize
            len(project_data.get('system_types', [])) / 10,   # Normalize
            project_data.get('installation_complexity', 3) / 5  # Normalize
        ])
        
        return np.array(features)
    
    def _fingerprint_to_vector(self, fingerprint: ProjectFingerprint) -> np.ndarray:
        """Convert project fingerprint to feature vector"""
        # Extract features from fingerprint object
        features = []
        
        # Use fingerprint features if available
        if hasattr(fingerprint, 'features') and fingerprint.features:
            features = list(fingerprint.features.values())
        else:
            # Create basic feature vector from fingerprint data
            features = [
                fingerprint.cost_metrics.get('total_cost', 0) / 1000000,
                fingerprint.scope_metrics.get('labor_hours', 0) / 1000,
                fingerprint.complexity_metrics.get('overall_score', 5) / 10,
                fingerprint.technical_metrics.get('component_count', 0) / 100,
                fingerprint.timeline_metrics.get('duration_days', 90) / 365
            ]
            
            # Add categorical encodings
            features.extend([1.0, 0.0, 0.0, 0.0])  # Mock project type
            features.extend([0.0, 1.0, 0.0, 0.0])  # Mock industry
            features.extend([0.5, 0.7, 1.0])       # Mock location
            features.extend([0.6, 0.8, 0.7])       # Mock technical
        
        return np.array(features)
    
    async def _quick_similarity_search(self,
                                     query_vector: np.ndarray,
                                     limit: int,
                                     threshold: float,
                                     exclude_ids: List[str]) -> List[Dict[str, Any]]:
        """Fast similarity search using KNN"""
        
        if self.fingerprint_matrix is None:
            return []
        
        # Normalize query vector
        query_normalized = self.scalers['standard'].transform(query_vector.reshape(1, -1))
        
        # Find nearest neighbors
        distances, indices = self.similarity_models['knn'].kneighbors(
            query_normalized, n_neighbors=min(limit * 2, len(self.project_ids))
        )
        
        similar_projects = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            project_id = self.project_ids[idx]
            
            # Skip excluded projects
            if project_id in exclude_ids:
                continue
            
            # Convert cosine distance to similarity
            similarity_score = 1 - distance
            
            if similarity_score >= threshold:
                project_data = self.project_index[project_id]
                similar_projects.append({
                    'project_id': project_id,
                    'project_name': project_data.get('project_name', f'Project {project_id}'),
                    'similarity_score': float(similarity_score),
                    'similarity_breakdown': {
                        'overall': float(similarity_score),
                        'method': 'knn_cosine'
                    },
                    'project_summary': {
                        'type': project_data.get('project_type'),
                        'industry': project_data.get('industry_category'),
                        'cost': project_data.get('total_cost'),
                        'location': project_data.get('location', {})
                    }
                })
        
        return similar_projects[:limit]
    
    async def _comprehensive_similarity_search(self,
                                             fingerprint: ProjectFingerprint,
                                             query_vector: np.ndarray,
                                             limit: int,
                                             threshold: float,
                                             weights: Dict[str, float],
                                             exclude_ids: List[str],
                                             detailed_mode: bool) -> List[Dict[str, Any]]:
        """Comprehensive similarity search with weighted multi-dimensional analysis"""
        
        similar_projects = []
        
        for project_id, project_data in self.project_index.items():
            if project_id in exclude_ids:
                continue
            
            # Calculate multi-dimensional similarity
            similarity_breakdown = await self._calculate_multidimensional_similarity(
                fingerprint, project_data, weights
            )
            
            # Overall weighted similarity
            overall_similarity = sum(
                similarity_breakdown[dimension] * weight
                for dimension, weight in weights.items()
                if dimension in similarity_breakdown
            )
            
            if overall_similarity >= threshold:
                project_summary = {
                    'project_id': project_id,
                    'project_name': project_data.get('project_name', f'Project {project_id}'),
                    'similarity_score': float(overall_similarity),
                    'similarity_breakdown': similarity_breakdown,
                    'project_summary': {
                        'type': project_data.get('project_type'),
                        'industry': project_data.get('industry_category'),
                        'cost': project_data.get('total_cost'),
                        'location': project_data.get('location', {}),
                        'complexity': project_data.get('complexity_score')
                    }
                }
                
                if detailed_mode:
                    # Add detailed project information
                    project_summary['detailed_info'] = {
                        'performance_metrics': project_data.get('performance_metrics', {}),
                        'lessons_learned': project_data.get('lessons_learned', []),
                        'risk_factors': project_data.get('risk_factors', []),
                        'success_factors': project_data.get('success_factors', [])
                    }
                
                similar_projects.append(project_summary)
        
        return similar_projects
    
    async def _calculate_multidimensional_similarity(self,
                                                   fingerprint: ProjectFingerprint,
                                                   project_data: Dict[str, Any],
                                                   weights: Dict[str, float]) -> Dict[str, float]:
        """Calculate similarity across multiple dimensions"""
        
        similarity_breakdown = {}
        
        # Technical similarity
        if 'technical_similarity' in weights:
            similarity_breakdown['technical_similarity'] = self._calculate_technical_similarity(
                fingerprint.technical_metrics, project_data
            )
        
        # Scope similarity
        if 'scope_similarity' in weights:
            similarity_breakdown['scope_similarity'] = self._calculate_scope_similarity(
                fingerprint.scope_metrics, project_data
            )
        
        # Cost similarity
        if 'cost_similarity' in weights:
            similarity_breakdown['cost_similarity'] = self._calculate_cost_similarity(
                fingerprint.cost_metrics, project_data
            )
        
        # Location similarity
        if 'location_similarity' in weights:
            similarity_breakdown['location_similarity'] = self._calculate_location_similarity(
                fingerprint.location_metrics, project_data.get('location', {})
            )
        
        # Timeline similarity
        if 'timeline_similarity' in weights:
            similarity_breakdown['timeline_similarity'] = self._calculate_timeline_similarity(
                fingerprint.timeline_metrics, project_data
            )
        
        # Complexity similarity
        if 'complexity_similarity' in weights:
            similarity_breakdown['complexity_similarity'] = self._calculate_complexity_similarity(
                fingerprint.complexity_metrics, project_data
            )
        
        # Industry similarity
        if 'industry_similarity' in weights:
            similarity_breakdown['industry_similarity'] = self._calculate_industry_similarity(
                fingerprint.project_type, fingerprint.industry_category,
                project_data.get('project_type'), project_data.get('industry_category')
            )
        
        return similarity_breakdown
    
    def _calculate_technical_similarity(self, tech_metrics: Dict, project_data: Dict) -> float:
        """Calculate technical similarity score"""
        score = 0.0
        factors = 0
        
        # Voltage level similarity
        if 'voltage_levels' in tech_metrics and 'voltage_levels' in project_data:
            fingerprint_voltages = set(tech_metrics['voltage_levels'])
            project_voltages = set(project_data['voltage_levels'])
            if fingerprint_voltages and project_voltages:
                jaccard_sim = len(fingerprint_voltages & project_voltages) / len(fingerprint_voltages | project_voltages)
                score += jaccard_sim
                factors += 1
        
        # Component count similarity
        if 'component_count' in tech_metrics and 'component_count' in project_data:
            fp_count = tech_metrics['component_count']
            proj_count = project_data['component_count']
            if fp_count > 0 and proj_count > 0:
                ratio_sim = 1 - abs(fp_count - proj_count) / max(fp_count, proj_count)
                score += max(0, ratio_sim)
                factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _calculate_scope_similarity(self, scope_metrics: Dict, project_data: Dict) -> float:
        """Calculate scope similarity score"""
        score = 0.0
        factors = 0
        
        # Labor hours similarity
        if 'labor_hours' in scope_metrics and 'labor_hours' in project_data:
            fp_hours = scope_metrics['labor_hours']
            proj_hours = project_data['labor_hours']
            if fp_hours > 0 and proj_hours > 0:
                ratio_sim = 1 - abs(fp_hours - proj_hours) / max(fp_hours, proj_hours)
                score += max(0, ratio_sim)
                factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _calculate_cost_similarity(self, cost_metrics: Dict, project_data: Dict) -> float:
        """Calculate cost similarity score"""
        if 'total_cost' not in cost_metrics or 'total_cost' not in project_data:
            return 0.5
        
        fp_cost = cost_metrics['total_cost']
        proj_cost = project_data['total_cost']
        
        if fp_cost <= 0 or proj_cost <= 0:
            return 0.5
        
        # Use logarithmic scale for cost similarity
        log_ratio = abs(math.log10(fp_cost) - math.log10(proj_cost))
        similarity = max(0, 1 - log_ratio / 2)  # Scale factor of 2 for log difference
        
        return similarity
    
    def _calculate_location_similarity(self, location_metrics: Dict, project_location: Dict) -> float:
        """Calculate location similarity score"""
        score = 0.0
        factors = 0
        
        # State/region similarity
        if 'state' in location_metrics and 'state' in project_location:
            if location_metrics['state'] == project_location['state']:
                score += 1.0
            factors += 1
        
        # Climate zone similarity
        if 'climate_zone' in location_metrics and 'climate_zone' in project_location:
            if location_metrics['climate_zone'] == project_location['climate_zone']:
                score += 0.8
            factors += 1
        
        return score / factors if factors > 0 else 0.3
    
    def _calculate_timeline_similarity(self, timeline_metrics: Dict, project_data: Dict) -> float:
        """Calculate timeline similarity score"""
        if 'duration_days' not in timeline_metrics or 'duration_days' not in project_data:
            return 0.5
        
        fp_duration = timeline_metrics['duration_days']
        proj_duration = project_data['duration_days']
        
        if fp_duration <= 0 or proj_duration <= 0:
            return 0.5
        
        ratio_sim = 1 - abs(fp_duration - proj_duration) / max(fp_duration, proj_duration)
        return max(0, ratio_sim)
    
    def _calculate_complexity_similarity(self, complexity_metrics: Dict, project_data: Dict) -> float:
        """Calculate complexity similarity score"""
        if 'overall_score' not in complexity_metrics or 'complexity_score' not in project_data:
            return 0.5
        
        fp_complexity = complexity_metrics['overall_score']
        proj_complexity = project_data['complexity_score']
        
        # Use Gaussian similarity for complexity
        diff = abs(fp_complexity - proj_complexity)
        similarity = math.exp(-(diff ** 2) / (2 * (2.0 ** 2)))  # Sigma = 2.0
        
        return similarity
    
    def _calculate_industry_similarity(self, fp_type: str, fp_industry: str, proj_type: str, proj_industry: str) -> float:
        """Calculate industry and project type similarity"""
        score = 0.0
        
        # Project type similarity (higher weight)
        if fp_type == proj_type:
            score += 0.7
        
        # Industry similarity
        if fp_industry == proj_industry:
            score += 0.3
        
        return score
    
    # Additional helper methods...
    
    def _encode_region(self, state: str) -> float:
        """Encode US state to regional value"""
        region_mapping = {
            'CA': 0.1, 'OR': 0.1, 'WA': 0.1,  # West
            'TX': 0.3, 'OK': 0.3, 'LA': 0.3,  # South
            'NY': 0.5, 'MA': 0.5, 'CT': 0.5,  # Northeast
            'IL': 0.7, 'MI': 0.7, 'OH': 0.7,  # Midwest
        }
        return region_mapping.get(state, 0.5)
    
    def _encode_climate(self, climate: str) -> float:
        """Encode climate zone to numerical value"""
        climate_mapping = {
            'tropical': 0.1,
            'subtropical': 0.3,
            'temperate': 0.5,
            'continental': 0.7,
            'arctic': 0.9
        }
        return climate_mapping.get(climate, 0.5)
    
    async def _analyze_category_breakdown(self, fingerprint: ProjectFingerprint, similar_projects: List[Dict]) -> Dict:
        """Analyze breakdown of similar projects by categories"""
        breakdown = {
            'by_type': defaultdict(int),
            'by_industry': defaultdict(int),
            'by_complexity': defaultdict(int),
            'by_cost_range': defaultdict(int)
        }
        
        for project in similar_projects:
            summary = project.get('project_summary', {})
            
            # By type
            project_type = summary.get('type', 'unknown')
            breakdown['by_type'][project_type] += 1
            
            # By industry
            industry = summary.get('industry', 'unknown')
            breakdown['by_industry'][industry] += 1
            
            # By complexity
            complexity = summary.get('complexity', 5)
            if complexity < 3:
                breakdown['by_complexity']['low'] += 1
            elif complexity < 7:
                breakdown['by_complexity']['medium'] += 1
            else:
                breakdown['by_complexity']['high'] += 1
            
            # By cost range
            cost = summary.get('cost', 0)
            if cost < 100000:
                breakdown['by_cost_range']['under_100k'] += 1
            elif cost < 500000:
                breakdown['by_cost_range']['100k_500k'] += 1
            elif cost < 1000000:
                breakdown['by_cost_range']['500k_1m'] += 1
            else:
                breakdown['by_cost_range']['over_1m'] += 1
        
        # Convert defaultdicts to regular dicts
        return {k: dict(v) for k, v in breakdown.items()}
    
    def _assess_search_quality(self, scores: List[float]) -> str:
        """Assess the quality of similarity search results"""
        if not scores:
            return "no_results"
        
        avg_score = np.mean(scores)
        score_variance = np.var(scores)
        
        if avg_score >= 0.85 and score_variance < 0.01:
            return "excellent"
        elif avg_score >= 0.75:
            return "good"
        elif avg_score >= 0.65:
            return "moderate"
        else:
            return "limited"
    
    def _calculate_confidence_level(self, scores: List[float]) -> float:
        """Calculate confidence level in similarity results"""
        if not scores:
            return 0.0
        
        # Base confidence on average score and consistency
        avg_score = np.mean(scores)
        consistency = 1 - np.std(scores) if len(scores) > 1 else 1
        
        confidence = (avg_score * 0.7 + consistency * 0.3)
        return min(1.0, max(0.0, confidence))
    
    def _generate_mock_project_data(self, count: int) -> List[Dict[str, Any]]:
        """Generate mock project data for testing"""
        projects = []
        
        project_types = ['commercial', 'industrial', 'residential', 'infrastructure']
        industries = ['oil_gas', 'manufacturing', 'commercial_building', 'healthcare']
        states = ['CA', 'TX', 'NY', 'FL', 'IL']
        
        for i in range(count):
            project = {
                'project_id': f'proj_{i:04d}',
                'project_name': f'Historical Project {i+1}',
                'project_type': np.random.choice(project_types),
                'industry_category': np.random.choice(industries),
                'total_cost': np.random.lognormal(13, 1),  # Log-normal distribution
                'labor_hours': np.random.lognormal(7, 0.8),
                'component_count': np.random.randint(10, 500),
                'complexity_score': np.random.normal(5, 2),
                'duration_days': np.random.randint(30, 365),
                'location': {
                    'state': np.random.choice(states),
                    'climate_zone': np.random.choice(['temperate', 'subtropical', 'continental']),
                    'urban_rural': np.random.choice(['urban', 'rural'])
                },
                'voltage_levels': np.random.choice([['120V', '240V'], ['480V'], ['4160V'], ['13.8kV']], p=[0.4, 0.3, 0.2, 0.1]),
                'system_types': np.random.choice([['power'], ['lighting'], ['power', 'lighting'], ['power', 'lighting', 'controls']], p=[0.2, 0.2, 0.4, 0.2]),
                'performance_metrics': {
                    'on_time': np.random.choice([True, False], p=[0.8, 0.2]),
                    'on_budget': np.random.choice([True, False], p=[0.75, 0.25]),
                    'quality_score': np.random.normal(8.5, 1.5)
                }
            }
            projects.append(project)
        
        return projects
    
    async def _optimize_similarity_weights(self):
        """Optimize similarity weights based on validation data"""
        # This would use actual validation data to optimize weights
        # For now, use the default weights
        logger.info("Using default similarity weights")
    
    async def close(self):
        """Clean up resources"""
        logger.info("Closing Project Similarity Engine")
        self.project_index.clear()
        self.fingerprint_matrix = None
        self.initialized = False
