"""
Advanced Storage Management for ELECTRICAL ORCHESTRATOR
Handles S3 operations, backup strategies, and file lifecycle management
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError
import hashlib
import json

logger = logging.getLogger(__name__)

class StorageManager:
    """Advanced storage management with backup and lifecycle policies"""
    
    def __init__(self, bucket_name: str, region: str = 'us-east-1'):
        self.bucket_name = bucket_name
        self.region = region
        self.s3_client = boto3.client('s3', region_name=region)
        
        # Storage tiers for cost optimization
        self.storage_classes = {
            'active': 'STANDARD',
            'archive': 'GLACIER',
            'deep_archive': 'DEEP_ARCHIVE'
        }
        
        # Initialize bucket if it doesn't exist
        self._ensure_bucket_exists()
        self._setup_lifecycle_policies()

    def _ensure_bucket_exists(self):
        """Ensure S3 bucket exists and is properly configured"""
        try:
            # Check if bucket exists
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"S3 bucket {self.bucket_name} exists")
            
        except ClientError as e:
            error_code = int(e.response['Error']['Code'])
            if error_code == 404:
                # Bucket doesn't exist, create it
                try:
                    if self.region == 'us-east-1':
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={'LocationConstraint': self.region}
                        )
                    
                    logger.info(f"Created S3 bucket: {self.bucket_name}")
                    
                    # Enable versioning for backup capabilities
                    self.s3_client.put_bucket_versioning(
                        Bucket=self.bucket_name,
                        VersioningConfiguration={'Status': 'Enabled'}
                    )
                    
                    # Set up encryption
                    self.s3_client.put_bucket_encryption(
                        Bucket=self.bucket_name,
                        ServerSideEncryptionConfiguration={
                            'Rules': [{
                                'ApplyServerSideEncryptionByDefault': {
                                    'SSEAlgorithm': 'AES256'
                                }
                            }]
                        }
                    )
                    
                except Exception as create_error:
                    logger.error(f"Failed to create bucket {self.bucket_name}: {create_error}")
                    raise
            else:
                logger.error(f"Error accessing bucket {self.bucket_name}: {e}")
                raise

    def _setup_lifecycle_policies(self):
        """Set up S3 lifecycle policies for automatic cost optimization"""
        try:
            lifecycle_rules = [
                {
                    'ID': 'electrical-drawings-lifecycle',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'projects/'},
                    'Transitions': [
                        {
                            'Days': 90,
                            'StorageClass': 'STANDARD_IA'  # Infrequent Access after 90 days
                        },
                        {
                            'Days': 365,
                            'StorageClass': 'GLACIER'  # Archive after 1 year
                        }
                    ]
                },
                {
                    'ID': 'thumbnails-lifecycle',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'thumbnails/'},
                    'Transitions': [
                        {
                            'Days': 30,
                            'StorageClass': 'STANDARD_IA'  # Thumbnails to IA after 30 days
                        }
                    ]
                },
                {
                    'ID': 'cleanup-incomplete-uploads',
                    'Status': 'Enabled',
                    'Filter': {},
                    'AbortIncompleteMultipartUpload': {
                        'DaysAfterInitiation': 7
                    }
                }
            ]
            
            self.s3_client.put_bucket_lifecycle_configuration(
                Bucket=self.bucket_name,
                LifecycleConfiguration={'Rules': lifecycle_rules}
            )
            
            logger.info("S3 lifecycle policies configured successfully")
            
        except Exception as e:
            logger.warning(f"Failed to set up lifecycle policies: {e}")

    def upload_file(self, file_content: bytes, key: str, metadata: Dict[str, str] = None,
                   content_type: str = 'application/octet-stream') -> Dict[str, Any]:
        """Upload file with enhanced metadata and backup capabilities"""
        try:
            # Calculate file hash for integrity checking
            file_hash = hashlib.sha256(file_content).hexdigest()
            
            # Prepare metadata
            upload_metadata = {
                'upload_timestamp': datetime.utcnow().isoformat(),
                'file_hash': file_hash,
                'file_size': str(len(file_content)),
                'content_type': content_type
            }
            
            if metadata:
                upload_metadata.update(metadata)
            
            # Upload file
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_content,
                ContentType=content_type,
                Metadata=upload_metadata,
                ServerSideEncryption='AES256'
            )
            
            # Get object information
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            
            return {
                'success': True,
                'key': key,
                'version_id': response.get('VersionId'),
                'etag': response.get('ETag', '').strip('"'),
                'file_hash': file_hash,
                'size': len(file_content),
                'upload_timestamp': upload_metadata['upload_timestamp']
            }
            
        except Exception as e:
            logger.error(f"Failed to upload file {key}: {e}")
            return {'success': False, 'error': str(e)}

    def download_file(self, key: str, version_id: str = None) -> Dict[str, Any]:
        """Download file with integrity verification"""
        try:
            # Prepare download parameters
            download_params = {'Bucket': self.bucket_name, 'Key': key}
            if version_id:
                download_params['VersionId'] = version_id
            
            # Download file
            response = self.s3_client.get_object(**download_params)
            file_content = response['Body'].read()
            
            # Verify integrity if hash is available in metadata
            metadata = response.get('Metadata', {})
            stored_hash = metadata.get('file_hash')
            
            if stored_hash:
                calculated_hash = hashlib.sha256(file_content).hexdigest()
                if stored_hash != calculated_hash:
                    logger.warning(f"File integrity check failed for {key}")
                    return {
                        'success': False,
                        'error': 'File integrity verification failed'
                    }
            
            return {
                'success': True,
                'content': file_content,
                'metadata': metadata,
                'content_type': response.get('ContentType'),
                'last_modified': response.get('LastModified'),
                'version_id': response.get('VersionId')
            }
            
        except Exception as e:
            logger.error(f"Failed to download file {key}: {e}")
            return {'success': False, 'error': str(e)}

    def create_backup(self, key: str, backup_bucket: str = None) -> Dict[str, Any]:
        """Create backup copy of a file"""
        try:
            backup_bucket = backup_bucket or f"{self.bucket_name}-backup"
            
            # Ensure backup bucket exists
            try:
                self.s3_client.head_bucket(Bucket=backup_bucket)
            except ClientError:
                # Create backup bucket if it doesn't exist
                if self.region == 'us-east-1':
                    self.s3_client.create_bucket(Bucket=backup_bucket)
                else:
                    self.s3_client.create_bucket(
                        Bucket=backup_bucket,
                        CreateBucketConfiguration={'LocationConstraint': self.region}
                    )
            
            # Copy file to backup bucket
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_key = f"backup_{timestamp}/{key}"
            
            self.s3_client.copy_object(
                CopySource={'Bucket': self.bucket_name, 'Key': key},
                Bucket=backup_bucket,
                Key=backup_key,
                MetadataDirective='COPY'
            )
            
            return {
                'success': True,
                'backup_bucket': backup_bucket,
                'backup_key': backup_key,
                'backup_timestamp': timestamp
            }
            
        except Exception as e:
            logger.error(f"Failed to create backup for {key}: {e}")
            return {'success': False, 'error': str(e)}

    def list_file_versions(self, key: str) -> List[Dict[str, Any]]:
        """List all versions of a file"""
        try:
            response = self.s3_client.list_object_versions(
                Bucket=self.bucket_name,
                Prefix=key
            )
            
            versions = []
            for version in response.get('Versions', []):
                if version['Key'] == key:
                    versions.append({
                        'version_id': version['VersionId'],
                        'last_modified': version['LastModified'],
                        'size': version['Size'],
                        'etag': version['ETag'].strip('"'),
                        'is_latest': version['IsLatest']
                    })
            
            # Sort by last modified (newest first)
            versions.sort(key=lambda x: x['last_modified'], reverse=True)
            
            return versions
            
        except Exception as e:
            logger.error(f"Failed to list versions for {key}: {e}")
            return []

    def delete_file(self, key: str, delete_all_versions: bool = False) -> Dict[str, Any]:
        """Delete file with optional version cleanup"""
        try:
            deleted_versions = []
            
            if delete_all_versions:
                # Delete all versions of the file
                versions = self.list_file_versions(key)
                
                for version in versions:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=key,
                        VersionId=version['version_id']
                    )
                    deleted_versions.append(version['version_id'])
            else:
                # Just delete the current version (create delete marker)
                response = self.s3_client.delete_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
                deleted_versions.append(response.get('VersionId'))
            
            return {
                'success': True,
                'deleted_versions': deleted_versions,
                'delete_all_versions': delete_all_versions
            }
            
        except Exception as e:
            logger.error(f"Failed to delete file {key}: {e}")
            return {'success': False, 'error': str(e)}

    def get_storage_usage(self) -> Dict[str, Any]:
        """Get storage usage statistics"""
        try:
            # Get bucket size and object count
            total_size = 0
            object_count = 0
            storage_classes = {}
            
            paginator = self.s3_client.get_paginator('list_objects_v2')
            
            for page in paginator.paginate(Bucket=self.bucket_name):
                for obj in page.get('Contents', []):
                    object_count += 1
                    total_size += obj['Size']
                    
                    # Track storage class distribution
                    storage_class = obj.get('StorageClass', 'STANDARD')
                    storage_classes[storage_class] = storage_classes.get(storage_class, 0) + 1
            
            # Convert bytes to more readable format
            def format_bytes(bytes_value):
                for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                    if bytes_value < 1024.0:
                        return f"{bytes_value:.2f} {unit}"
                    bytes_value /= 1024.0
                return f"{bytes_value:.2f} PB"
            
            return {
                'bucket_name': self.bucket_name,
                'total_size_bytes': total_size,
                'total_size_formatted': format_bytes(total_size),
                'object_count': object_count,
                'storage_class_distribution': storage_classes,
                'average_object_size': total_size / max(object_count, 1)
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage usage: {e}")
            return {'error': str(e)}

    def cleanup_old_files(self, prefix: str, days_old: int = 365) -> Dict[str, Any]:
        """Clean up files older than specified days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            objects_to_delete = []
            paginator = self.s3_client.get_paginator('list_objects_v2')
            
            for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
                for obj in page.get('Contents', []):
                    if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                        objects_to_delete.append({'Key': obj['Key']})
            
            if objects_to_delete:
                # Delete objects in batches
                deleted_count = 0
                batch_size = 1000  # S3 delete limit
                
                for i in range(0, len(objects_to_delete), batch_size):
                    batch = objects_to_delete[i:i + batch_size]
                    
                    response = self.s3_client.delete_objects(
                        Bucket=self.bucket_name,
                        Delete={'Objects': batch}
                    )
                    
                    deleted_count += len(response.get('Deleted', []))
                
                return {
                    'success': True,
                    'deleted_count': deleted_count,
                    'cutoff_date': cutoff_date.isoformat()
                }
            else:
                return {
                    'success': True,
                    'deleted_count': 0,
                    'message': 'No files found older than specified date'
                }
                
        except Exception as e:
            logger.error(f"Failed to cleanup old files: {e}")
            return {'success': False, 'error': str(e)}

    def generate_presigned_url(self, key: str, expiration: int = 3600, 
                             operation: str = 'get_object') -> str:
        """Generate presigned URL for secure file access"""
        try:
            url = self.s3_client.generate_presigned_url(
                operation,
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            return url
            
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {key}: {e}")
            return None