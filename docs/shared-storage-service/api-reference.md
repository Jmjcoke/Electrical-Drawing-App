# SharedStorageService API Reference

## Overview

The SharedStorageService API provides secure, controlled access to session-based file storage across microservices in the Electrical Drawing Analysis Application. It implements a permission-based model where each service has specific access rights to session directories.

## Base URL
```
http://localhost:3000/api/v1/shared-storage
```

## Authentication

The API supports two authentication methods:

### 1. Bearer Token Authentication
```http
Authorization: Bearer <service-jwt-token>
```

### 2. API Key Authentication
```http
X-API-Key: <service-api-key>
```

## Service Permissions

Each service has defined permissions in the configuration:

| Service | Read Access | Write Access | Allowed Sub-Paths |
|---------|-------------|---------------|-------------------|
| `file-processor` | ✅ | ✅ | `converted_images/`, `metadata/`, `temp/` |
| `llm-orchestrator` | ✅ | ❌ | `converted_images/`, `metadata/` |
| `response-aggregator` | ✅ | ❌ | `converted_images/`, `metadata/` |

## API Endpoints

### Health Monitoring

#### GET /health
Returns basic health status for load balancer monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-27T10:30:00.000Z",
  "service": "shared-storage-service",
  "version": "1.0.0"
}
```

#### GET /health/detailed
Returns comprehensive health information for debugging.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-27T10:30:00.000Z",
  "service": "shared-storage-service",
  "version": "1.0.0",
  "checks": {
    "filesystem": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "totalSpace": "100GB",
        "usedSpace": "25GB",
        "availableSpace": "75GB"
      }
    },
    "permissions": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "configValid": true,
        "servicesConfigured": 3
      }
    },
    "sessions": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "activeSessions": 15,
        "totalSessions": 150,
        "averageSessionSize": "2.3MB"
      }
    }
  }
}
```

#### GET /health/ready
Kubernetes readiness probe endpoint.

**Response:**
```json
{
  "status": "ready",
  "ready": true,
  "timestamp": "2024-01-27T10:30:00.000Z",
  "checks": [
    {
      "name": "filesystem",
      "status": "ready"
    },
    {
      "name": "database",
      "status": "ready"
    }
  ]
}
```

#### GET /health/live
Kubernetes liveness probe endpoint.

**Response:**
```json
{
  "status": "alive",
  "alive": true,
  "timestamp": "2024-01-27T10:30:00.000Z"
}
```

#### GET /metrics
Prometheus-compatible metrics endpoint.

**Response:**
```prometheus
# HELP shared_storage_operations_total Total number of storage operations
# TYPE shared_storage_operations_total counter
shared_storage_operations_total{operation="getSessionPath",service="file-processor"} 150
shared_storage_operations_total{operation="accessFile",service="llm-orchestrator"} 89

# HELP shared_storage_operation_duration_seconds Operation duration in seconds
# TYPE shared_storage_operation_duration_seconds histogram
shared_storage_operation_duration_seconds_bucket{operation="getSessionPath",le="0.1"} 140
shared_storage_operation_duration_seconds_bucket{operation="getSessionPath",le="0.5"} 145
shared_storage_operation_duration_seconds_bucket{operation="getSessionPath",le="1.0"} 148
shared_storage_operation_duration_seconds_bucket{operation="getSessionPath",le="2.5"} 149
shared_storage_operation_duration_seconds_bucket{operation="getSessionPath",le="5.0"} 150

# HELP shared_storage_errors_total Total number of errors by type
# TYPE shared_storage_errors_total counter
shared_storage_errors_total{error_type="PERMISSION_DENIED"} 5
shared_storage_errors_total{error_type="FILE_NOT_FOUND"} 12
```

### Core Storage API

#### GET /sessions/{sessionId}/path
Returns the absolute path to a session directory.

**Parameters:**
- `sessionId` (path): UUID of the session
- `service` (query): Name of the requesting service

**Example Request:**
```http
GET /api/v1/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000/path?service=file-processor
```

**Response:**
```json
{
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "path": "/opt/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000",
  "service": "file-processor"
}
```

#### GET /sessions/{sessionId}/files/{filepath}
Returns the contents of a specific file.

**Parameters:**
- `sessionId` (path): UUID of the session
- `filepath` (path): Relative path within session (e.g., `converted_images/page1.jpg`)
- `service` (query): Name of the requesting service

**Example Request:**
```http
GET /api/v1/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000/files/converted_images/page1.jpg?service=llm-orchestrator
```

**Response:**
Binary file content with appropriate Content-Type header.

#### GET /sessions/{sessionId}/permissions
Checks if service has permission to access session.

**Parameters:**
- `sessionId` (path): UUID of the session
- `service` (query): Name of the requesting service

**Example Request:**
```http
GET /api/v1/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000/permissions?service=file-processor
```

**Response:**
```json
{
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "service": "file-processor",
  "hasPermission": true,
  "allowedSubPaths": [
    "converted_images/",
    "metadata/",
    "temp/"
  ]
}
```

#### GET /sessions/{sessionId}/files
Lists files in session directory or subdirectory.

**Parameters:**
- `sessionId` (path): UUID of the session
- `subPath` (query, optional): Subdirectory path (e.g., `converted_images`)
- `service` (query): Name of the requesting service

**Example Request:**
```http
GET /api/v1/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000/files?subPath=converted_images&service=llm-orchestrator
```

**Response:**
```json
{
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "files": [
    "page1.jpg",
    "page2.jpg",
    "page3.jpg"
  ],
  "count": 3,
  "subPath": "converted_images"
}
```

#### GET /sessions/{sessionId}/files/{filepath}/exists
Checks if a specific file exists.

**Parameters:**
- `sessionId` (path): UUID of the session
- `filepath` (path): Relative path within session
- `service` (query): Name of the requesting service

**Example Request:**
```http
GET /api/v1/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000/files/converted_images/page1.jpg/exists?service=file-processor
```

**Response:**
```json
{
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "filepath": "converted_images/page1.jpg",
  "exists": true,
  "size": 245760,
  "modified": "2024-01-27T09:15:30.000Z"
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Service 'unauthorized-service' is not authorized to access session",
    "details": {
      "sessionId": "123e4567-e89b-12d3-a456-426614174000",
      "service": "unauthorized-service"
    },
    "timestamp": "2024-01-27T10:30:00.000Z"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `PERMISSION_DENIED` | Service lacks permission to access resource | 403 |
| `FILE_NOT_FOUND` | Requested file does not exist | 404 |
| `SESSION_NOT_FOUND` | Session directory does not exist | 404 |
| `SERVICE_UNAUTHORIZED` | Service name is not recognized | 403 |
| `PATH_TRAVERSAL_DETECTED` | Path traversal attempt detected | 400 |
| `FILE_ACCESS_ERROR` | File system access error | 500 |
| `INVALID_SESSION_ID` | Session ID format is invalid | 400 |
| `INVALID_SERVICE_NAME` | Service name is not valid | 400 |
| `INTERNAL_ERROR` | Unexpected internal error | 500 |

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Health endpoints**: 100 requests per minute per service
- **Core storage endpoints**: 1000 requests per minute per service
- **Metrics endpoint**: 10 requests per minute per service

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643280000
```

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class SharedStorageClient {
  constructor(baseUrl, serviceName, apiKey) {
    this.baseUrl = baseUrl;
    this.serviceName = serviceName;
    this.apiKey = apiKey;
  }

  async getSessionPath(sessionId) {
    const response = await axios.get(
      `${this.baseUrl}/sessions/${sessionId}/path`,
      {
        headers: {
          'X-API-Key': this.apiKey
        },
        params: {
          service: this.serviceName
        }
      }
    );
    return response.data;
  }

  async listFiles(sessionId, subPath = '') {
    const response = await axios.get(
      `${this.baseUrl}/sessions/${sessionId}/files`,
      {
        headers: {
          'X-API-Key': this.apiKey
        },
        params: {
          service: this.serviceName,
          subPath: subPath || undefined
        }
      }
    );
    return response.data;
  }

  async downloadFile(sessionId, filepath) {
    const response = await axios.get(
      `${this.baseUrl}/sessions/${sessionId}/files/${filepath}`,
      {
        headers: {
          'X-API-Key': this.apiKey
        },
        params: {
          service: this.serviceName
        },
        responseType: 'stream'
      }
    );
    return response.data;
  }
}

// Usage
const client = new SharedStorageClient(
  'http://localhost:3000/api/v1/shared-storage',
  'file-processor',
  'your-api-key'
);

const sessionPath = await client.getSessionPath('123e4567-e89b-12d3-a456-426614174000');
console.log('Session path:', sessionPath.path);
```

### Python

```python
import requests
from typing import List, Dict, Any

class SharedStorageClient:
    def __init__(self, base_url: str, service_name: str, api_key: str):
        self.base_url = base_url
        self.service_name = service_name
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key
        })

    def get_session_path(self, session_id: str) -> Dict[str, Any]:
        """Get session path for a specific session."""
        params = {'service': self.service_name}
        response = self.session.get(
            f"{self.base_url}/sessions/{session_id}/path",
            params=params
        )
        response.raise_for_status()
        return response.json()

    def list_files(self, session_id: str, sub_path: str = "") -> Dict[str, Any]:
        """List files in session directory."""
        params = {'service': self.service_name}
        if sub_path:
            params['subPath'] = sub_path

        response = self.session.get(
            f"{self.base_url}/sessions/{session_id}/files",
            params=params
        )
        response.raise_for_status()
        return response.json()

    def download_file(self, session_id: str, filepath: str) -> bytes:
        """Download a specific file."""
        params = {'service': self.service_name}
        response = self.session.get(
            f"{self.base_url}/sessions/{session_id}/files/{filepath}",
            params=params
        )
        response.raise_for_status()
        return response.content

# Usage
client = SharedStorageClient(
    base_url="http://localhost:3000/api/v1/shared-storage",
    service_name="llm-orchestrator",
    api_key="your-api-key"
)

# Get session path
session_info = client.get_session_path("123e4567-e89b-12d3-a456-426614174000")
print(f"Session path: {session_info['path']}")

# List files
files = client.list_files("123e4567-e89b-12d3-a456-426614174000", "converted_images")
print(f"Files: {files['files']}")
```

## Versioning

The API uses semantic versioning:

- **v1.0.0**: Initial release with core functionality
- **v1.1.0**: Added bulk operations and improved error handling
- **v1.2.0**: Enhanced monitoring and metrics

API versioning is handled through the URL path: `/api/v1/shared-storage/...`

## Changelog

### v1.0.0 (Current)
- Initial release with core SharedStorageService functionality
- Health monitoring endpoints
- Basic file access operations
- Permission-based access control
- Comprehensive error handling

## Support

For API support and questions:
- **Documentation**: [Interactive API Docs](http://localhost:3000/docs/api)
- **Issues**: [GitHub Issues](https://github.com/your-org/electrical-drawing-app/issues)
- **Email**: devops@electrical-drawing-app.com
