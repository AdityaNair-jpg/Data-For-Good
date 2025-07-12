# DataForGood Python Backend

This backend receives data from the browser extension and uploads it to AWS S3.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables:**
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: AWS region (default: us-east-1)
   - `S3_BUCKET`: Name of your S3 bucket

   You can set these in your shell or in a `.env` file (with a tool like `python-dotenv`).

3. **Run the server:**
   ```bash
   python app.py
   ```

## API

- **POST /collect**
  - Receives JSON data and uploads it to S3 as a unique file.
  - Example request:
    ```bash
    curl -X POST http://localhost:5000/collect -H "Content-Type: application/json" -d '{"key": "value"}'
    ```
