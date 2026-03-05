import boto3
import os
from botocore.client import Config
from botocore.exceptions import ClientError


class Storage:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=f"http://{os.getenv('MINIO_ENDPOINT', 'localhost:9000')}",
            aws_access_key_id=os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
            aws_secret_access_key=os.getenv('MINIO_SECRET_KEY', 'minioadmin'),
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        self.buckets = ['uploads', 'outputs', 'audio-cache']
        self._ensure_buckets()
        self._setup_cors()  # <-- Настраиваем CORS при инициализации

    def _ensure_buckets(self):
        existing_buckets = [b['Name'] for b in self.s3.list_buckets()['Buckets']]
        for bucket in self.buckets:
            if bucket not in existing_buckets:
                self.s3.create_bucket(Bucket=bucket)

    def _setup_cors(self):
        """
        Настраивает CORS политику для всех бакетов MinIO.
        Разрешает браузеру загружать файлы напрямую по presigned URL.
        """
        # Для локальной разработки можно '*', для продакшена укажите конкретные origins
        allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '*').split(',')

        cors_config = {
            'CORSRules': [{
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
                'AllowedOrigins': allowed_origins,
                'ExposeHeaders': [
                    'ETag',
                    'Content-Range',
                    'Accept-Ranges',
                    'Content-Length',
                    'Content-Type'
                ],
                'MaxAgeSeconds': 3600,
            }]
        }

        for bucket in self.buckets:
            try:
                self.s3.put_bucket_cors(
                    Bucket=bucket,
                    CORSConfiguration=cors_config
                )
                print(f"✓ CORS configured for bucket: {bucket}")
            except ClientError as e:
                print(f"✗ CORS setup failed for {bucket}: {e}")
            except Exception as e:
                print(f"✗ Unexpected error for {bucket}: {e}")

    def upload_file(self, file_data, filename, bucket='uploads'):
        self.s3.upload_fileobj(file_data, bucket, filename)
        return filename

    def get_presigned_url(self, filename, bucket='uploads', expires_in=3600):
        """Генерирует presigned URL для скачивания файла"""
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': filename},
            ExpiresIn=expires_in
        )

    def download_file(self, filename, local_path, bucket='uploads'):
        self.s3.download_file(bucket, filename, local_path)


storage = Storage()