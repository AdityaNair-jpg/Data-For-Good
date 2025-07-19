from celery import Celery

celery_app = Celery(
    'dataforgood',
    broker='redis://localhost:6379/0',  # Make sure Redis is running
    backend='redis://localhost:6379/0'
) 