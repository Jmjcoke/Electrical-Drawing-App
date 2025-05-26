# API Integration Features - Advanced Package
# Real-time manufacturer API integration

from .process_control_features import (
    ManufacturerAPIClient,
    SquareDAPIClient,
    SiemensAPIClient,
    EatonAPIClient,
    LevitonAPIClient,
    CooperAPIClient
)

# Aliases for easier access
ManufacturerAPIManager = ManufacturerAPIClient
RealTimeDataService = ManufacturerAPIClient

__all__ = [
    'ManufacturerAPIManager',
    'RealTimeDataService',
    'SquareDAPIClient',
    'SiemensAPIClient', 
    'EatonAPIClient',
    'LevitonAPIClient',
    'CooperAPIClient'
]