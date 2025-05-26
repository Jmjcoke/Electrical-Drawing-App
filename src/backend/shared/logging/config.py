"""
Centralized logging configuration for ELECTRICAL ORCHESTRATOR
Provides structured JSON logging with correlation IDs for microservices
"""

import os
import sys
import logging
import logging.config
from datetime import datetime
import json
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields from the record
        if hasattr(record, 'request_id'):
            log_entry["request_id"] = record.request_id
        
        if hasattr(record, 'user_id'):
            log_entry["user_id"] = record.user_id
            
        if hasattr(record, 'service'):
            log_entry["service"] = record.service
            
        # Add any additional custom fields
        for key, value in record.__dict__.items():
            if key not in log_entry and not key.startswith('_') and key not in [
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                'thread', 'threadName', 'processName', 'process', 'message'
            ]:
                try:
                    # Only include JSON-serializable values
                    json.dumps(value)
                    log_entry[key] = value
                except (TypeError, ValueError):
                    log_entry[key] = str(value)
        
        # Add exception information if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry, ensure_ascii=False)

def setup_logging():
    """Setup centralized logging configuration"""
    
    # Get log level from environment
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    
    # Determine if we should use JSON formatting
    use_json = os.getenv("LOG_FORMAT", "json").lower() == "json"
    
    # Base logging configuration
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JSONFormatter,
            },
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "json" if use_json else "standard",
                "level": log_level,
            },
        },
        "loggers": {
            # Root logger
            "": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            # Application loggers
            "electrical_orchestrator": {
                "handlers": ["console"],
                "level": log_level,
                "propagate": False,
            },
            # External library loggers
            "uvicorn": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "handlers": ["console"],
                "level": "WARNING",  # Reduce SQL query noise
                "propagate": False,
            },
            "alembic": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "httpx": {
                "handlers": ["console"],
                "level": "WARNING",  # Reduce HTTP request noise
                "propagate": False,
            },
        },
    }
    
    # Apply the configuration
    logging.config.dictConfig(config)
    
    # Log the configuration
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured successfully",
        extra={
            "log_level": log_level,
            "log_format": "json" if use_json else "standard",
            "service": os.getenv("SERVICE_NAME", "unknown")
        }
    )

def get_logger(name: str, service: str = None) -> logging.Logger:
    """Get a configured logger with optional service context"""
    logger = logging.getLogger(name)
    
    # Add service context if provided
    if service:
        logger = logging.LoggerAdapter(logger, {"service": service})
    
    return logger

class CorrelationIDFilter(logging.Filter):
    """Filter to add correlation ID to log records"""
    
    def __init__(self, correlation_id: str = None):
        super().__init__()
        self.correlation_id = correlation_id
    
    def filter(self, record: logging.LogRecord) -> bool:
        if self.correlation_id:
            record.correlation_id = self.correlation_id
        return True

def add_correlation_id(logger: logging.Logger, correlation_id: str):
    """Add correlation ID filter to logger"""
    filter_obj = CorrelationIDFilter(correlation_id)
    logger.addFilter(filter_obj)
    return logger

# Security-related logging helpers
def log_security_event(
    event_type: str,
    user_id: str = None,
    ip_address: str = None,
    details: Dict[str, Any] = None
):
    """Log security-related events with standard format"""
    logger = logging.getLogger("security")
    
    extra = {
        "event_type": event_type,
        "category": "security",
    }
    
    if user_id:
        extra["user_id"] = user_id
    if ip_address:
        extra["ip_address"] = ip_address
    if details:
        extra.update(details)
    
    logger.warning(f"Security event: {event_type}", extra=extra)

def log_audit_event(
    action: str,
    resource_type: str,
    resource_id: str = None,
    user_id: str = None,
    changes: Dict[str, Any] = None
):
    """Log audit events for compliance tracking"""
    logger = logging.getLogger("audit")
    
    extra = {
        "action": action,
        "resource_type": resource_type,
        "category": "audit",
    }
    
    if resource_id:
        extra["resource_id"] = resource_id
    if user_id:
        extra["user_id"] = user_id
    if changes:
        extra["changes"] = changes
    
    logger.info(f"Audit: {action} on {resource_type}", extra=extra)