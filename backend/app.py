import os
import uuid
import json
from flask import Flask, request, jsonify
import boto3
from transformers import pipeline
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()
import google.generativeai as genai
import requests as pyrequests
from PIL import Image
from io import BytesIO
import base64

app = Flask(__name__)
CORS(app)

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
S3_BUCKET = os.environ.get('S3_BUCKET', 'your-s3-bucket-name')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

s3 = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

# Hugging Face zero-shot classifier
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
candidate_labels = ["politics", "comedy", "educational", "sports", "entertainment", "technology", "news", 
                "lifestyle", "music", "gaming", "food", "travel", "fashion", "art", "animals", "memes", "science",
                 "history", "health", "business", "religion", "philosophy", "literature", "mathematics", "physics", 
                 "chemistry", "biology", "geology", "astronomy", "environment", "technology", "engineering", "medicine", 
                 "law", "education", "psychology", "sociology", "economics", "finance", "marketing", "management", 
                 "entrepreneurship"]

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
else:
    gemini_model = None


def safe_print_value(value, field_name):
    """Safely print a value, handling binary data appropriately"""
    if isinstance(value, bytes):
        return f"{field_name}: <binary data, {len(value)} bytes>"
    elif isinstance(value, str):
        if len(value) > 100:
            return f"{field_name}: <text, {len(value)} chars, preview: {repr(value[:50])}...>"
        return f"{field_name}: {repr(value)}"
    else:
        return f"{field_name}: {value}"


def safe_print_item(item, item_index=None):
    """Safely print an item's summary without exposing binary data"""
    try:
        if not isinstance(item, dict):
            print(f"Item {item_index}: Not a dict, type: {type(item)}")
            return
        
        summary_parts = []
        if item_index is not None:
            summary_parts.append(f"Item {item_index}:")
        
        for key, value in item.items():
            try:
                if key == 'text':
                    if isinstance(value, str):
                        # Check if string contains binary data (non-printable chars)
                        if any(ord(c) < 32 or ord(c) > 126 for c in value[:100]):
                            summary_parts.append(f"text=<binary_string_{len(value)}_chars>")
                        else:
                            summary_parts.append(f"text_length={len(value)}")
                    elif isinstance(value, bytes):
                        summary_parts.append(f"text=<binary_data_{len(value)}_bytes>")
                    else:
                        summary_parts.append(f"text=<{type(value).__name__}>")
                elif key in ['imageUrl', 'mediaUrl']:
                    if isinstance(value, str) and not any(ord(c) < 32 or ord(c) > 126 for c in value[:100]):
                        summary_parts.append(f"{key}={value}")
                    elif isinstance(value, bytes):
                        summary_parts.append(f"{key}=<binary_data_{len(value)}_bytes>")
                    else:
                        summary_parts.append(f"{key}=<{type(value).__name__}>")
                elif key == 'image_data' or (isinstance(value, bytes) and len(value) > 50):
                    summary_parts.append(f"{key}=<binary_data_{len(value)}_bytes>")
                else:
                    # Extra safety check for any other field
                    if isinstance(value, bytes):
                        summary_parts.append(f"{key}=<binary_data_{len(value)}_bytes>")
                    elif isinstance(value, str):
                        if any(ord(c) < 32 or ord(c) > 126 for c in value[:100]):
                            summary_parts.append(f"{key}=<binary_string_{len(value)}_chars>")
                        elif len(str(value)) < 50:
                            summary_parts.append(f"{key}={repr(value)}")
                        else:
                            summary_parts.append(f"{key}=<{type(value).__name__}>")
                    else:
                        summary_parts.append(f"{key}={repr(value) if len(str(value)) < 50 else f'<{type(value).__name__}>'}")
            except Exception as e:
                summary_parts.append(f"{key}=<error_printing_value>")
        
        print(" ".join(summary_parts))
    except Exception as e:
        print(f"Error in safe_print_item: {e}")
        print(f"Item type: {type(item)}")


def classify_image_with_gemini(image_bytes):
    if not gemini_model:
        return 'unknown'
    prompt = (
        "Classify this image into one of these topics: "
        "sports, food, fashion, nature, politics, technology, music, travel, art, animals, memes, science, history, health, business, religion, philosophy, literature, mathematics, physics, chemistry, biology, geology, astronomy, environment, technology, engineering, medicine, law, education, psychology, sociology, economics, finance, marketing, management, entrepreneurship. "
        "Return only the topic label."
    )
    try:
        # Convert bytes to PIL Image for Gemini
        image = Image.open(BytesIO(image_bytes))
        
        response = gemini_model.generate_content([
            prompt,
            image
        ])
        
        print("Gemini API response received successfully")
        topic = response.text.strip() if hasattr(response, 'text') else str(response)
        print("Gemini extracted topic:", topic)
        return topic
    except Exception as e:
        print("Gemini classification error:", e)
        return 'unknown'


def download_image(url):
    try:
        resp = pyrequests.get(url)
        resp.raise_for_status()
        print("Downloaded image size:", len(resp.content), "bytes")
        return resp.content
    except Exception as e:
        print("Image download error:", e)
        return None


def process_item(item):
    """Process a single item and return the topic"""
    text = item.get('text', '')
    image_url = item.get('imageUrl') or item.get('mediaUrl')
    image_data = item.get('image_data')  # Direct binary image data
    
    topic = 'unknown'
    
    # Handle text classification
    if text and isinstance(text, str):
        try:
            print("Calling classifier for text...")
            result = classifier(text, candidate_labels)
            print("Classifier result:", result)
            topic = result['labels'][0]
        except Exception as e:
            print("Classifier error:", e)
            topic = 'unknown'
    
    # Handle image classification
    elif image_url and isinstance(image_url, str):
        print("Processing image from URL for Gemini classification:", image_url)
        image_bytes = download_image(image_url)
        if image_bytes:
            topic = classify_image_with_gemini(image_bytes)
    
    # Handle direct binary image data
    elif image_data and isinstance(image_data, bytes):
        print("Processing binary image data for Gemini classification")
        topic = classify_image_with_gemini(image_data)
    
    # Handle base64 encoded image data
    elif isinstance(text, str) and text.startswith('data:image/'):
        try:
            print("Processing base64 image data")
            # Extract base64 data from data URL
            header, data = text.split(',', 1)
            image_bytes = base64.b64decode(data)
            topic = classify_image_with_gemini(image_bytes)
        except Exception as e:
            print("Base64 image processing error:", e)
            topic = 'unknown'
    
    else:
        print("No valid text or image data found for classification")
    
    return topic


@app.route('/collect', methods=['POST'])
def collect():
    try:
        # Get raw data - could be JSON or binary
        content_type = request.headers.get('Content-Type', '')
        
        if 'application/json' in content_type:
            data = request.json
        else:
            # Handle other content types or raw binary data
            raw_data = request.get_data()
            try:
                data = json.loads(raw_data)
            except:
                # If it's not JSON, treat as binary image data
                data = {'image_data': raw_data}
        
        # Safe logging of received data
        try:
            if isinstance(data, list):
                print(f"Received batch of {len(data)} items.")
                for i, item in enumerate(data[:3]):  # Show up to 3 items for preview
                    safe_print_item(item, i+1)
                if len(data) > 3:
                    print(f"...and {len(data)-3} more items.")
            elif isinstance(data, dict):
                print("Received single item:")
                safe_print_item(data)
            else:
                print(f"Received data of type: {type(data)}")
        except Exception as e:
            print(f"Error during safe logging: {e}")
            print(f"Data type: {type(data)}, attempting to process anyway...")
        
        results = []
        items_to_process = data if isinstance(data, list) else [data]
        
        for item in items_to_process:
            topic = process_item(item)
            item['topic'] = topic
            
            # Create a safe copy for S3 storage (remove binary data)
            safe_item = {}
            for key, value in item.items():
                if isinstance(value, bytes):
                    # Convert binary data to base64 for storage
                    safe_item[key] = base64.b64encode(value).decode('utf-8')
                    safe_item[key + '_type'] = 'base64_binary'
                else:
                    safe_item[key] = value
            
            filename = f"data/{uuid.uuid4()}.json"
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=filename,
                Body=json.dumps(safe_item)
            )
            print(f"Uploaded {filename} to S3 with topic: {topic}")
            results.append({'file': filename, 'topic': topic})
        
        return jsonify({'status': 'success', 'results': results})
        
    except Exception as e:
        print("Error in /collect:", e)
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False)