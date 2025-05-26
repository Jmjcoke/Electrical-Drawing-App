import asyncio
import aiohttp
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import numpy as np
from functools import lru_cache
import sqlite3
import redis
from concurrent.futures import ThreadPoolExecutor
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlparse
import hashlib

logger = logging.getLogger(__name__)

class SpecificationSource(Enum):
    MANUFACTURER_API = "manufacturer_api"
    DISTRIBUTOR_API = "distributor_api"
    LOCAL_DATABASE = "local_database"
    WEB_SCRAPING = "web_scraping"
    USER_INPUT = "user_input"
    CACHED = "cached"

class ValidationStatus(Enum):
    VALID = "valid"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"

@dataclass
class SpecificationValidation:
    status: ValidationStatus
    message: str
    code: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class RealTimeSpecification:
    component_id: str
    manufacturer: str
    model_number: str
    category: str
    specifications: Dict[str, Any]
    source: SpecificationSource
    last_updated: datetime
    validation: Optional[SpecificationValidation] = None
    availability: Dict[str, Any] = field(default_factory=dict)
    pricing: Dict[str, Any] = field(default_factory=dict)
    alternatives: List[str] = field(default_factory=list)
    compliance_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class OverlayConfiguration:
    show_specifications: bool = True
    show_compliance: bool = True
    show_pricing: bool = False
    show_availability: bool = True
    show_alternatives: bool = False
    transparency: float = 0.8
    position: str = "auto"  # auto, top, bottom, left, right
    color_scheme: str = "default"  # default, high_contrast, dark, light

class ManufacturerAPIClient:
    def __init__(self):
        self.api_clients = {
            "square_d": SquareDAPIClient(),
            "siemens": SiemensAPIClient(),
            "eaton": EatonAPIClient(),
            "leviton": LevitonAPIClient(),
            "cooper": CooperAPIClient()
        }
        self.session = None
    
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                "User-Agent": "Electrical-Orchestrator/1.0",
                "Accept": "application/json"
            }
        )
    
    async def close(self):
        if self.session:
            await self.session.close()
    
    async def get_specification(self, manufacturer: str, model_number: str) -> Optional[Dict[str, Any]]:
        manufacturer_key = manufacturer.lower().replace(" ", "_")
        
        if manufacturer_key in self.api_clients:
            try:
                client = self.api_clients[manufacturer_key]
                return await client.get_specification(model_number, self.session)
            except Exception as e:
                logger.error(f"Error getting specification from {manufacturer}: {e}")
                return None
        
        # Generic manufacturer API fallback
        return await self._generic_api_lookup(manufacturer, model_number)
    
    async def _generic_api_lookup(self, manufacturer: str, model_number: str) -> Optional[Dict[str, Any]]:
        # Implement generic manufacturer API lookup logic
        search_urls = [
            f"https://api.{manufacturer.lower()}.com/products/{model_number}",
            f"https://{manufacturer.lower()}.com/api/specifications/{model_number}",
            f"https://catalog.{manufacturer.lower()}.com/product/{model_number}"
        ]
        
        for url in search_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._normalize_specification_data(data)
            except Exception as e:
                logger.debug(f"Failed to fetch from {url}: {e}")
                continue
        
        return None
    
    def _normalize_specification_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Normalize different manufacturer API responses to common format
        normalized = {
            "voltage_rating": self._extract_voltage(data),
            "current_rating": self._extract_current(data),
            "power_rating": self._extract_power(data),
            "dimensions": self._extract_dimensions(data),
            "certifications": self._extract_certifications(data),
            "installation_notes": self._extract_notes(data),
            "datasheet_url": self._extract_datasheet_url(data),
            "compliance": self._extract_compliance(data)
        }
        
        return {k: v for k, v in normalized.items() if v is not None}
    
    def _extract_voltage(self, data: Dict[str, Any]) -> Optional[float]:
        voltage_fields = ["voltage", "voltage_rating", "rated_voltage", "nominal_voltage"]
        for field in voltage_fields:
            if field in data:
                try:
                    return float(str(data[field]).replace("V", "").strip())
                except (ValueError, TypeError):
                    continue
        return None
    
    def _extract_current(self, data: Dict[str, Any]) -> Optional[float]:
        current_fields = ["current", "current_rating", "rated_current", "amperage"]
        for field in current_fields:
            if field in data:
                try:
                    return float(str(data[field]).replace("A", "").strip())
                except (ValueError, TypeError):
                    continue
        return None
    
    def _extract_power(self, data: Dict[str, Any]) -> Optional[float]:
        power_fields = ["power", "power_rating", "wattage", "watts"]
        for field in power_fields:
            if field in data:
                try:
                    return float(str(data[field]).replace("W", "").strip())
                except (ValueError, TypeError):
                    continue
        return None
    
    def _extract_dimensions(self, data: Dict[str, Any]) -> Optional[Dict[str, float]]:
        if "dimensions" in data:
            dims = data["dimensions"]
            if isinstance(dims, dict):
                return dims
            elif isinstance(dims, str):
                # Parse dimension string like "2.5 x 4.0 x 1.5 inches"
                return self._parse_dimension_string(dims)
        return None
    
    def _parse_dimension_string(self, dim_str: str) -> Dict[str, float]:
        # Extract dimensions from various string formats
        import re
        
        # Pattern for "width x height x depth"
        pattern = r"(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)"
        match = re.search(pattern, dim_str.lower())
        
        if match:
            return {
                "width": float(match.group(1)),
                "height": float(match.group(2)),
                "depth": float(match.group(3))
            }
        
        return {}
    
    def _extract_certifications(self, data: Dict[str, Any]) -> Optional[List[str]]:
        cert_fields = ["certifications", "approvals", "standards", "listings"]
        for field in cert_fields:
            if field in data:
                certs = data[field]
                if isinstance(certs, list):
                    return certs
                elif isinstance(certs, str):
                    return [cert.strip() for cert in certs.split(",")]
        return None
    
    def _extract_notes(self, data: Dict[str, Any]) -> Optional[str]:
        note_fields = ["installation_notes", "notes", "instructions", "remarks"]
        for field in note_fields:
            if field in data and data[field]:
                return str(data[field])
        return None
    
    def _extract_datasheet_url(self, data: Dict[str, Any]) -> Optional[str]:
        url_fields = ["datasheet_url", "datasheet", "specification_sheet", "technical_data"]
        for field in url_fields:
            if field in data and data[field]:
                return str(data[field])
        return None
    
    def _extract_compliance(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        compliance_fields = ["compliance", "codes", "standards_compliance"]
        for field in compliance_fields:
            if field in data:
                return data[field]
        return None

class SquareDAPIClient:
    async def get_specification(self, model_number: str, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
        # Square D (Schneider Electric) API implementation
        api_url = f"https://www.se.com/us/en/api/products/{model_number}"
        
        try:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_square_d_response(data)
        except Exception as e:
            logger.error(f"Square D API error: {e}")
        
        return None
    
    def _parse_square_d_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Parse Square D specific response format
        product = data.get("product", {})
        
        return {
            "voltage_rating": product.get("voltage"),
            "current_rating": product.get("current"),
            "power_rating": product.get("power"),
            "dimensions": product.get("dimensions"),
            "certifications": product.get("certifications", []),
            "installation_notes": product.get("installation_instructions"),
            "datasheet_url": product.get("datasheet_url"),
            "compliance": {
                "nec": product.get("nec_compliant", False),
                "ul_listed": product.get("ul_listed", False),
                "csa_certified": product.get("csa_certified", False)
            }
        }

class SiemensAPIClient:
    async def get_specification(self, model_number: str, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
        # Siemens API implementation
        api_url = f"https://mall.industry.siemens.com/mall/api/products/{model_number}"
        
        try:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_siemens_response(data)
        except Exception as e:
            logger.error(f"Siemens API error: {e}")
        
        return None
    
    def _parse_siemens_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Parse Siemens specific response format
        specifications = data.get("specifications", {})
        
        return {
            "voltage_rating": specifications.get("ratedVoltage"),
            "current_rating": specifications.get("ratedCurrent"),
            "power_rating": specifications.get("ratedPower"),
            "dimensions": {
                "width": specifications.get("width"),
                "height": specifications.get("height"),
                "depth": specifications.get("depth")
            },
            "certifications": specifications.get("approvals", []),
            "datasheet_url": data.get("datasheetUrl")
        }

class EatonAPIClient:
    async def get_specification(self, model_number: str, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
        # Eaton API implementation
        api_url = f"https://www.eaton.com/api/products/{model_number}"
        
        try:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_eaton_response(data)
        except Exception as e:
            logger.error(f"Eaton API error: {e}")
        
        return None
    
    def _parse_eaton_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Parse Eaton specific response format
        product_data = data.get("productData", {})
        
        return {
            "voltage_rating": product_data.get("voltage"),
            "current_rating": product_data.get("amperage"),
            "power_rating": product_data.get("watts"),
            "certifications": product_data.get("listings", []),
            "datasheet_url": product_data.get("technicalDocuments", {}).get("datasheet")
        }

class LevitonAPIClient:
    async def get_specification(self, model_number: str, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
        # Leviton API implementation
        api_url = f"https://www.leviton.com/api/products/{model_number}"
        
        try:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_leviton_response(data)
        except Exception as e:
            logger.error(f"Leviton API error: {e}")
        
        return None
    
    def _parse_leviton_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Parse Leviton specific response format
        specs = data.get("specifications", {})
        
        return {
            "voltage_rating": specs.get("voltage"),
            "current_rating": specs.get("amperage"),
            "certifications": specs.get("certifications", []),
            "datasheet_url": data.get("resources", {}).get("datasheet")
        }

class CooperAPIClient:
    async def get_specification(self, model_number: str, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
        # Cooper Industries API implementation
        api_url = f"https://www.cooperindustries.com/api/products/{model_number}"
        
        try:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_cooper_response(data)
        except Exception as e:
            logger.error(f"Cooper API error: {e}")
        
        return None
    
    def _parse_cooper_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Parse Cooper specific response format
        product = data.get("product", {})
        
        return {
            "voltage_rating": product.get("voltage"),
            "current_rating": product.get("current"),
            "certifications": product.get("approvals", []),
            "datasheet_url": product.get("datasheet")
        }

class SpecificationValidator:
    def __init__(self):
        self.nec_rules = self._load_nec_rules()
        self.ieee_standards = self._load_ieee_standards()
        self.ul_standards = self._load_ul_standards()
    
    def _load_nec_rules(self) -> Dict[str, Any]:
        # Load NEC validation rules
        return {
            "voltage_limits": {
                "low_voltage": {"min": 0, "max": 600},
                "medium_voltage": {"min": 600, "max": 35000},
                "high_voltage": {"min": 35000, "max": 138000}
            },
            "conductor_sizing": {
                "copper": {
                    "14_awg": {"max_current": 15, "max_voltage": 600},
                    "12_awg": {"max_current": 20, "max_voltage": 600},
                    "10_awg": {"max_current": 30, "max_voltage": 600}
                }
            },
            "protection_requirements": {
                "gfci": ["bathrooms", "kitchens", "garages", "outdoors"],
                "afci": ["bedrooms", "living_areas"]
            }
        }
    
    def _load_ieee_standards(self) -> Dict[str, Any]:
        # Load IEEE standards for validation
        return {
            "ieee_1584": {  # Arc Flash
                "min_working_distance": 18,  # inches
                "ppe_categories": {
                    "0": {"cal_cm2": 1.2, "arc_rating": 4},
                    "1": {"cal_cm2": 4, "arc_rating": 4},
                    "2": {"cal_cm2": 8, "arc_rating": 8},
                    "3": {"cal_cm2": 25, "arc_rating": 25},
                    "4": {"cal_cm2": 40, "arc_rating": 40}
                }
            },
            "ieee_519": {  # Harmonic Distortion
                "voltage_distortion_limits": {
                    "69kv_below": 5.0,  # %THD
                    "69kv_to_161kv": 2.5,
                    "161kv_above": 1.5
                }
            }
        }
    
    def _load_ul_standards(self) -> Dict[str, Any]:
        # Load UL standards for validation
        return {
            "ul_489": {  # Circuit Breakers
                "test_requirements": ["overload", "short_circuit", "endurance"],
                "temperature_rise_limits": 65  # °C
            },
            "ul_498": {  # Receptacles
                "test_voltages": [120, 240, 277, 480],
                "contact_resistance": 0.1  # ohms max
            }
        }
    
    def validate_specification(self, spec: RealTimeSpecification) -> SpecificationValidation:
        validations = []
        
        # Validate electrical parameters
        electrical_validation = self._validate_electrical_parameters(spec)
        if electrical_validation:
            validations.append(electrical_validation)
        
        # Validate NEC compliance
        nec_validation = self._validate_nec_compliance(spec)
        if nec_validation:
            validations.append(nec_validation)
        
        # Validate certifications
        cert_validation = self._validate_certifications(spec)
        if cert_validation:
            validations.append(cert_validation)
        
        # Determine overall status
        if any(v.status == ValidationStatus.ERROR for v in validations):
            overall_status = ValidationStatus.ERROR
            message = "Critical validation errors found"
        elif any(v.status == ValidationStatus.WARNING for v in validations):
            overall_status = ValidationStatus.WARNING
            message = "Validation warnings present"
        else:
            overall_status = ValidationStatus.VALID
            message = "All validations passed"
        
        return SpecificationValidation(
            status=overall_status,
            message=message,
            details={"validations": [v.__dict__ for v in validations]}
        )
    
    def _validate_electrical_parameters(self, spec: RealTimeSpecification) -> Optional[SpecificationValidation]:
        specs = spec.specifications
        
        # Check voltage rating
        voltage = specs.get("voltage_rating")
        if voltage and (voltage < 0 or voltage > 1000000):
            return SpecificationValidation(
                status=ValidationStatus.ERROR,
                message="Voltage rating out of reasonable range",
                code="VOLTAGE_RANGE_ERROR"
            )
        
        # Check current rating
        current = specs.get("current_rating")
        if current and (current < 0 or current > 10000):
            return SpecificationValidation(
                status=ValidationStatus.ERROR,
                message="Current rating out of reasonable range",
                code="CURRENT_RANGE_ERROR"
            )
        
        # Check power consistency
        power = specs.get("power_rating")
        if voltage and current and power:
            calculated_power = voltage * current
            if abs(power - calculated_power) / calculated_power > 0.1:  # 10% tolerance
                return SpecificationValidation(
                    status=ValidationStatus.WARNING,
                    message="Power rating inconsistent with voltage and current",
                    code="POWER_INCONSISTENCY"
                )
        
        return None
    
    def _validate_nec_compliance(self, spec: RealTimeSpecification) -> Optional[SpecificationValidation]:
        # Validate against NEC requirements
        voltage = spec.specifications.get("voltage_rating")
        
        if voltage:
            voltage_limits = self.nec_rules["voltage_limits"]
            
            if voltage > voltage_limits["low_voltage"]["max"]:
                if "medium_voltage" not in spec.compliance_data.get("categories", []):
                    return SpecificationValidation(
                        status=ValidationStatus.WARNING,
                        message="Component may require medium voltage compliance",
                        code="NEC_VOLTAGE_CATEGORY"
                    )
        
        return None
    
    def _validate_certifications(self, spec: RealTimeSpecification) -> Optional[SpecificationValidation]:
        certifications = spec.specifications.get("certifications", [])
        
        # Check for required UL listing based on component category
        if spec.category in ["breaker", "outlet", "switch"]:
            ul_listed = any("UL" in cert for cert in certifications)
            if not ul_listed:
                return SpecificationValidation(
                    status=ValidationStatus.WARNING,
                    message="Component should be UL listed for this application",
                    code="UL_LISTING_MISSING"
                )
        
        return None

class ProcessControlValidator:
    """Specialized validator for process control and safety systems"""
    
    def __init__(self):
        self.sil_requirements = self._load_sil_requirements()
        self.iec_standards = self._load_iec_standards()
        self.safety_functions = self._load_safety_functions()
    
    def _load_sil_requirements(self) -> Dict[str, Any]:
        """Load SIL (Safety Integrity Level) requirements per IEC 61508"""
        return {
            "sil_1": {
                "pfd_range": {"min": 1e-2, "max": 1e-1},
                "description": "Low safety consequence",
                "applications": ["Non-critical process control"]
            },
            "sil_2": {
                "pfd_range": {"min": 1e-3, "max": 1e-2},
                "description": "Moderate safety consequence",
                "applications": ["Standard safety functions"]
            },
            "sil_3": {
                "pfd_range": {"min": 1e-4, "max": 1e-3},
                "description": "High safety consequence",
                "applications": ["Critical safety systems"]
            },
            "sil_4": {
                "pfd_range": {"min": 1e-5, "max": 1e-4},
                "description": "Very high safety consequence",
                "applications": ["Nuclear, aviation safety"]
            }
        }
    
    def _load_iec_standards(self) -> Dict[str, Any]:
        """Load IEC standards for process control validation"""
        return {
            "iec_61508": {  # Functional Safety
                "lifecycle_phases": [
                    "concept", "scope_definition", "hazard_analysis",
                    "requirements", "design", "implementation",
                    "integration", "validation", "operation"
                ],
                "safety_functions": ["ESD", "Fire_Gas", "Process_Shutdown"]
            },
            "iec_61511": {  # Process Industry Safety
                "sis_components": ["sensors", "logic_solver", "final_elements"],
                "proof_test_intervals": {"sil_1": 12, "sil_2": 12, "sil_3": 6, "sil_4": 3}
            },
            "iec_62061": {  # Machinery Safety
                "categories": ["B", "1", "2", "3", "4"],
                "performance_levels": ["a", "b", "c", "d", "e"]
            }
        }
    
    def _load_safety_functions(self) -> Dict[str, Any]:
        """Load common safety function definitions"""
        return {
            "emergency_shutdown": {
                "acronym": "ESD",
                "description": "Emergency shutdown system",
                "typical_sil": "sil_2",
                "response_time": "< 10 seconds",
                "components": ["pressure_switches", "shutdown_valves", "logic_solver"]
            },
            "fire_gas_detection": {
                "acronym": "FGS",
                "description": "Fire and gas detection system",
                "typical_sil": "sil_2",
                "response_time": "< 30 seconds",
                "components": ["gas_detectors", "flame_detectors", "alarm_panels"]
            },
            "high_integrity_pressure_protection": {
                "acronym": "HIPPS",
                "description": "High integrity pressure protection system",
                "typical_sil": "sil_3",
                "response_time": "< 2 seconds",
                "components": ["pressure_transmitters", "safety_valves", "isolation_valves"]
            },
            "burner_management": {
                "acronym": "BMS",
                "description": "Burner management system",
                "typical_sil": "sil_2",
                "response_time": "< 5 seconds",
                "components": ["flame_scanners", "gas_valves", "ignition_systems"]
            }
        }
    
    def validate_safety_system(self, spec: 'RealTimeSpecification') -> SpecificationValidation:
        """Validate safety instrumented system components"""
        validations = []
        
        # Check SIL rating compliance
        sil_validation = self._validate_sil_compliance(spec)
        if sil_validation:
            validations.append(sil_validation)
        
        # Validate safety function requirements
        function_validation = self._validate_safety_function(spec)
        if function_validation:
            validations.append(function_validation)
        
        # Check proof test requirements
        proof_test_validation = self._validate_proof_test_requirements(spec)
        if proof_test_validation:
            validations.append(proof_test_validation)
        
        # Determine overall validation status
        if any(v.status == ValidationStatus.ERROR for v in validations):
            overall_status = ValidationStatus.ERROR
            message = "Safety system validation errors found"
        elif any(v.status == ValidationStatus.WARNING for v in validations):
            overall_status = ValidationStatus.WARNING
            message = "Safety system validation warnings"
        else:
            overall_status = ValidationStatus.VALID
            message = "Safety system validation passed"
        
        return SpecificationValidation(
            status=overall_status,
            message=message,
            details={"safety_validations": [v.__dict__ for v in validations]}
        )
    
    def _validate_sil_compliance(self, spec: 'RealTimeSpecification') -> Optional[SpecificationValidation]:
        """Validate SIL rating compliance"""
        safety_data = spec.compliance_data.get("safety", {})
        claimed_sil = safety_data.get("sil_rating")
        
        if claimed_sil and claimed_sil in self.sil_requirements:
            # Check if component supports claimed SIL level
            pfd_value = safety_data.get("pfd")  # Probability of Failure on Demand
            
            if pfd_value:
                sil_req = self.sil_requirements[claimed_sil]
                if not (sil_req["pfd_range"]["min"] <= pfd_value <= sil_req["pfd_range"]["max"]):
                    return SpecificationValidation(
                        status=ValidationStatus.ERROR,
                        message=f"PFD value {pfd_value} not within {claimed_sil} range",
                        code="SIL_PFD_MISMATCH"
                    )
        
        return None
    
    def _validate_safety_function(self, spec: 'RealTimeSpecification') -> Optional[SpecificationValidation]:
        """Validate against safety function requirements"""
        safety_function = spec.compliance_data.get("safety", {}).get("safety_function")
        
        if safety_function and safety_function in self.safety_functions:
            function_spec = self.safety_functions[safety_function]
            
            # Check response time requirements
            response_time = spec.specifications.get("response_time")
            if response_time:
                required_time = function_spec.get("response_time", "").replace("< ", "").replace(" seconds", "")
                try:
                    required_time_float = float(required_time)
                    if response_time > required_time_float:
                        return SpecificationValidation(
                            status=ValidationStatus.WARNING,
                            message=f"Response time {response_time}s exceeds requirement for {safety_function}",
                            code="RESPONSE_TIME_WARNING"
                        )
                except ValueError:
                    pass
        
        return None
    
    def _validate_proof_test_requirements(self, spec: 'RealTimeSpecification') -> Optional[SpecificationValidation]:
        """Validate proof test interval requirements"""
        safety_data = spec.compliance_data.get("safety", {})
        sil_rating = safety_data.get("sil_rating")
        proof_test_interval = safety_data.get("proof_test_interval_months")
        
        if sil_rating and proof_test_interval:
            iec_61511 = self.iec_standards["iec_61511"]
            max_interval = iec_61511["proof_test_intervals"].get(sil_rating)
            
            if max_interval and proof_test_interval > max_interval:
                return SpecificationValidation(
                    status=ValidationStatus.WARNING,
                    message=f"Proof test interval {proof_test_interval} months exceeds {sil_rating} requirement",
                    code="PROOF_TEST_INTERVAL_WARNING"
                )
        
        return None

@dataclass
class ProcessControlSpecification:
    """Extended specification for process control devices"""
    base_specification: RealTimeSpecification
    process_parameters: Dict[str, Any] = field(default_factory=dict)
    safety_functions: List[str] = field(default_factory=list)
    sil_rating: Optional[str] = None
    proof_test_interval: Optional[int] = None  # months
    operating_conditions: Dict[str, Any] = field(default_factory=dict)
    control_loop_tag: Optional[str] = None
    instrument_tag: Optional[str] = None

class RealTimeSpecificationIntelligence:
    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379):
        self.manufacturer_client = ManufacturerAPIClient()
        self.validator = SpecificationValidator()
        self.process_validator = ProcessControlValidator()
        self.cache = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    async def initialize(self):
        await self.manufacturer_client.initialize()
    
    async def close(self):
        await self.manufacturer_client.close()
        self.executor.shutdown(wait=True)
    
    async def get_real_time_specification(self, 
                                        manufacturer: str, 
                                        model_number: str,
                                        component_id: str,
                                        category: str) -> RealTimeSpecification:
        
        cache_key = f"spec:{manufacturer}:{model_number}"
        
        # Try cache first
        cached_spec = await self._get_cached_specification(cache_key)
        if cached_spec:
            cached_spec.component_id = component_id
            cached_spec.category = category
            return cached_spec
        
        # Get specification from manufacturer API
        spec_data = await self.manufacturer_client.get_specification(manufacturer, model_number)
        
        if not spec_data:
            # Fallback to local database or default values
            spec_data = await self._get_fallback_specification(manufacturer, model_number, category)
            source = SpecificationSource.LOCAL_DATABASE
        else:
            source = SpecificationSource.MANUFACTURER_API
        
        # Create specification object
        real_time_spec = RealTimeSpecification(
            component_id=component_id,
            manufacturer=manufacturer,
            model_number=model_number,
            category=category,
            specifications=spec_data,
            source=source,
            last_updated=datetime.now()
        )
        
        # Validate specification
        validation = self.validator.validate_specification(real_time_spec)
        real_time_spec.validation = validation
        
        # Process control and safety validation if applicable
        if self._is_process_control_device(category):
            safety_validation = self.process_validator.validate_safety_system(real_time_spec)
            if safety_validation.status != ValidationStatus.VALID:
                # Merge safety validation with general validation
                if validation.status == ValidationStatus.VALID:
                    real_time_spec.validation = safety_validation
                else:
                    # Combine validations
                    combined_details = validation.details.copy()
                    combined_details.update(safety_validation.details)
                    real_time_spec.validation = SpecificationValidation(
                        status=ValidationStatus.ERROR if safety_validation.status == ValidationStatus.ERROR else validation.status,
                        message=f"{validation.message}; {safety_validation.message}",
                        details=combined_details
                    )
        
        # Get availability and pricing data
        real_time_spec.availability = await self._get_availability_data(manufacturer, model_number)
        real_time_spec.pricing = await self._get_pricing_data(manufacturer, model_number)
        real_time_spec.alternatives = await self._get_alternative_components(category, spec_data)
        
        # Cache the result
        await self._cache_specification(cache_key, real_time_spec)
        
        return real_time_spec
    
    async def _get_cached_specification(self, cache_key: str) -> Optional[RealTimeSpecification]:
        try:
            cached_data = self.cache.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                
                # Check if cache is still valid (24 hours)
                last_updated = datetime.fromisoformat(data["last_updated"])
                if datetime.now() - last_updated < timedelta(hours=24):
                    # Reconstruct specification object
                    spec = RealTimeSpecification(
                        component_id=data["component_id"],
                        manufacturer=data["manufacturer"],
                        model_number=data["model_number"],
                        category=data["category"],
                        specifications=data["specifications"],
                        source=SpecificationSource.CACHED,
                        last_updated=last_updated
                    )
                    
                    if data.get("validation"):
                        spec.validation = SpecificationValidation(**data["validation"])
                    
                    spec.availability = data.get("availability", {})
                    spec.pricing = data.get("pricing", {})
                    spec.alternatives = data.get("alternatives", [])
                    
                    return spec
        except Exception as e:
            logger.error(f"Error retrieving cached specification: {e}")
        
        return None
    
    async def _cache_specification(self, cache_key: str, spec: RealTimeSpecification):
        try:
            cache_data = {
                "component_id": spec.component_id,
                "manufacturer": spec.manufacturer,
                "model_number": spec.model_number,
                "category": spec.category,
                "specifications": spec.specifications,
                "source": spec.source.value,
                "last_updated": spec.last_updated.isoformat(),
                "validation": spec.validation.__dict__ if spec.validation else None,
                "availability": spec.availability,
                "pricing": spec.pricing,
                "alternatives": spec.alternatives
            }
            
            # Cache for 24 hours
            self.cache.setex(cache_key, 24 * 3600, json.dumps(cache_data, default=str))
            
        except Exception as e:
            logger.error(f"Error caching specification: {e}")
    
    async def _get_fallback_specification(self, manufacturer: str, model_number: str, category: str) -> Dict[str, Any]:
        # Return basic specification data based on category
        fallback_specs = {
            "breaker": {
                "voltage_rating": 240,
                "current_rating": 20,
                "certifications": ["UL 489"],
                "installation_notes": "Standard circuit breaker installation"
            },
            "outlet": {
                "voltage_rating": 120,
                "current_rating": 15,
                "certifications": ["UL 498"],
                "installation_notes": "Standard duplex receptacle"
            },
            "switch": {
                "voltage_rating": 120,
                "current_rating": 15,
                "certifications": ["UL 20"],
                "installation_notes": "Single pole toggle switch"
            }
        }
        
        return fallback_specs.get(category, {
            "voltage_rating": 120,
            "current_rating": 15,
            "certifications": [],
            "installation_notes": "Standard electrical component"
        })
    
    async def _get_availability_data(self, manufacturer: str, model_number: str) -> Dict[str, Any]:
        # Get real-time availability from distributors
        availability_sources = [
            "https://api.digikey.com/",
            "https://api.mouser.com/",
            "https://api.arrow.com/"
        ]
        
        # For now, return mock availability data
        return {
            "in_stock": True,
            "quantity_available": 1000,
            "lead_time_days": 1,
            "distributors": ["Digi-Key", "Mouser", "Arrow"],
            "last_checked": datetime.now().isoformat()
        }
    
    async def _get_pricing_data(self, manufacturer: str, model_number: str) -> Dict[str, Any]:
        # Get real-time pricing from distributors
        # For now, return mock pricing data
        return {
            "unit_price": 15.50,
            "currency": "USD",
            "quantity_breaks": [
                {"quantity": 1, "price": 15.50},
                {"quantity": 10, "price": 14.25},
                {"quantity": 100, "price": 12.75}
            ],
            "last_updated": datetime.now().isoformat()
        }
    
    async def _get_alternative_components(self, category: str, specifications: Dict[str, Any]) -> List[str]:
        # Find alternative components with similar specifications
        voltage = specifications.get("voltage_rating")
        current = specifications.get("current_rating")
        
        # For now, return mock alternatives
        alternatives = {
            "breaker": ["QO120", "BQ120", "CH120"],
            "outlet": ["5325-W", "CR15", "1107-W"],
            "switch": ["1451-W", "CS115", "1461-W"]
        }
        
        return alternatives.get(category, [])
    
    def _is_process_control_device(self, category: str) -> bool:
        """Check if device category requires process control validation"""
        process_categories = [
            "pressure_transmitter", "temperature_transmitter", "flow_transmitter",
            "level_transmitter", "ph_transmitter", "conductivity_transmitter",
            "safety_valve", "control_valve", "shutdown_valve",
            "gas_detector", "flame_detector", "smoke_detector",
            "safety_plc", "safety_relay", "emergency_stop",
            "pressure_switch", "temperature_switch", "level_switch"
        ]
        return category.lower() in process_categories
    
    async def get_process_control_specification(self,
                                              manufacturer: str,
                                              model_number: str,
                                              component_id: str,
                                              category: str,
                                              process_parameters: Optional[Dict[str, Any]] = None) -> ProcessControlSpecification:
        """Get enhanced specification for process control devices"""
        
        # Get base specification
        base_spec = await self.get_real_time_specification(
            manufacturer, model_number, component_id, category
        )
        
        # Enhance with process control data
        process_spec = ProcessControlSpecification(
            base_specification=base_spec,
            process_parameters=process_parameters or {},
        )
        
        # Extract process-specific information
        await self._enhance_process_specification(process_spec)
        
        return process_spec
    
    async def _enhance_process_specification(self, process_spec: ProcessControlSpecification):
        """Enhance specification with process control specific data"""
        base_spec = process_spec.base_specification
        
        # Extract SIL rating from compliance data
        safety_data = base_spec.compliance_data.get("safety", {})
        process_spec.sil_rating = safety_data.get("sil_rating")
        process_spec.proof_test_interval = safety_data.get("proof_test_interval_months")
        
        # Extract process parameters
        specs = base_spec.specifications
        process_spec.process_parameters.update({
            "measurement_range": {
                "min": specs.get("measurement_range_min"),
                "max": specs.get("measurement_range_max"),
                "units": specs.get("measurement_units")
            },
            "accuracy": specs.get("accuracy"),
            "repeatability": specs.get("repeatability"),
            "response_time": specs.get("response_time"),
            "operating_temperature": {
                "min": specs.get("operating_temp_min"),
                "max": specs.get("operating_temp_max")
            },
            "operating_pressure": {
                "min": specs.get("operating_pressure_min"),
                "max": specs.get("operating_pressure_max")
            }
        })
        
        # Extract tag information if available
        process_spec.instrument_tag = specs.get("instrument_tag")
        process_spec.control_loop_tag = specs.get("control_loop_tag")
        
        # Identify safety functions
        safety_functions = []
        if "emergency_shutdown" in str(specs).lower():
            safety_functions.append("emergency_shutdown")
        if "fire" in str(specs).lower() or "gas" in str(specs).lower():
            safety_functions.append("fire_gas_detection")
        if "pressure_protection" in str(specs).lower():
            safety_functions.append("high_integrity_pressure_protection")
        
        process_spec.safety_functions = safety_functions
    
    def create_specification_overlay(self, 
                                   spec: RealTimeSpecification,
                                   config: OverlayConfiguration) -> Dict[str, Any]:
        
        overlay_data = {
            "component_id": spec.component_id,
            "manufacturer": spec.manufacturer,
            "model_number": spec.model_number,
            "category": spec.category.replace("_", " ").title(),
            "config": config.__dict__
        }
        
        if config.show_specifications:
            overlay_data["specifications"] = {
                "voltage": f"{spec.specifications.get('voltage_rating', 'N/A')}V",
                "current": f"{spec.specifications.get('current_rating', 'N/A')}A",
                "power": f"{spec.specifications.get('power_rating', 'N/A')}W" if spec.specifications.get('power_rating') else None,
                "certifications": spec.specifications.get('certifications', [])
            }
        
        if config.show_compliance and spec.validation:
            overlay_data["compliance"] = {
                "status": spec.validation.status.value,
                "message": spec.validation.message,
                "color": self._get_status_color(spec.validation.status)
            }
        
        if config.show_pricing and spec.pricing:
            overlay_data["pricing"] = {
                "unit_price": spec.pricing.get("unit_price"),
                "currency": spec.pricing.get("currency", "USD")
            }
        
        if config.show_availability and spec.availability:
            overlay_data["availability"] = {
                "in_stock": spec.availability.get("in_stock", False),
                "lead_time": spec.availability.get("lead_time_days", "Unknown")
            }
        
        if config.show_alternatives and spec.alternatives:
            overlay_data["alternatives"] = spec.alternatives[:3]  # Show top 3
        
        return overlay_data
    
    def _get_status_color(self, status: ValidationStatus) -> str:
        color_map = {
            ValidationStatus.VALID: "#4CAF50",      # Green
            ValidationStatus.WARNING: "#FF9800",    # Orange
            ValidationStatus.ERROR: "#F44336",      # Red
            ValidationStatus.UNKNOWN: "#9E9E9E"     # Gray
        }
        return color_map.get(status, "#9E9E9E")

# Example usage and testing
async def test_specification_intelligence():
    intelligence = RealTimeSpecificationIntelligence()
    await intelligence.initialize()
    
    try:
        # Test standard specification lookup
        spec = await intelligence.get_real_time_specification(
            manufacturer="Square D",
            model_number="QO120",
            component_id="comp_001",
            category="breaker"
        )
        
        print(f"Standard Specification Retrieved:")
        print(f"Manufacturer: {spec.manufacturer}")
        print(f"Model: {spec.model_number}")
        print(f"Source: {spec.source.value}")
        print(f"Validation: {spec.validation.status.value if spec.validation else 'None'}")
        
        # Test process control specification
        process_spec = await intelligence.get_process_control_specification(
            manufacturer="Rosemount",
            model_number="3051S",
            component_id="PT-001",
            category="pressure_transmitter",
            process_parameters={
                "process_fluid": "Natural Gas",
                "operating_temperature": {"min": -40, "max": 85},
                "hazardous_area": "Class I, Div 1"
            }
        )
        
        print(f"\nProcess Control Specification Retrieved:")
        print(f"Base Manufacturer: {process_spec.base_specification.manufacturer}")
        print(f"SIL Rating: {process_spec.sil_rating}")
        print(f"Safety Functions: {process_spec.safety_functions}")
        print(f"Instrument Tag: {process_spec.instrument_tag}")
        print(f"Process Parameters: {json.dumps(process_spec.process_parameters, indent=2)}")
        
        # Test overlay creation
        config = OverlayConfiguration(
            show_specifications=True,
            show_compliance=True,
            show_pricing=True
        )
        
        overlay = intelligence.create_specification_overlay(spec, config)
        print(f"\nOverlay Data: {json.dumps(overlay, indent=2)}")
        
        # Test safety system validation
        safety_spec = RealTimeSpecification(
            component_id="safety_valve_001",
            manufacturer="Emerson",
            model_number="8D Series",
            category="safety_valve",
            specifications={
                "response_time": 8.0,  # seconds
                "measurement_range_min": 0,
                "measurement_range_max": 1000,
                "measurement_units": "psi"
            },
            source=SpecificationSource.MANUFACTURER_API,
            last_updated=datetime.now(),
            compliance_data={
                "safety": {
                    "sil_rating": "sil_2",
                    "pfd": 5e-3,
                    "safety_function": "emergency_shutdown",
                    "proof_test_interval_months": 12
                }
            }
        )
        
        safety_validation = intelligence.process_validator.validate_safety_system(safety_spec)
        print(f"\nSafety System Validation:")
        print(f"Status: {safety_validation.status.value}")
        print(f"Message: {safety_validation.message}")
        
    finally:
        await intelligence.close()

async def test_process_control_validation():
    """Test process control and safety systems validation"""
    validator = ProcessControlValidator()
    
    # Test SIL compliance validation
    test_spec = RealTimeSpecification(
        component_id="test_transmitter",
        manufacturer="Test Manufacturer",
        model_number="TEST-001",
        category="pressure_transmitter",
        specifications={"response_time": 1.0},
        source=SpecificationSource.LOCAL_DATABASE,
        last_updated=datetime.now(),
        compliance_data={
            "safety": {
                "sil_rating": "sil_3",
                "pfd": 5e-4,  # Within SIL 3 range
                "safety_function": "high_integrity_pressure_protection"
            }
        }
    )
    
    validation_result = validator.validate_safety_system(test_spec)
    print(f"Process Control Validation Test:")
    print(f"Status: {validation_result.status.value}")
    print(f"Message: {validation_result.message}")
    
    return validation_result.status == ValidationStatus.VALID

if __name__ == "__main__":
    asyncio.run(test_specification_intelligence())