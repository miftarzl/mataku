# Use lightweight python base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install minimal OS dependencies required by OpenCV & PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Environment variable for port
ENV PORT=80

# Expose app port
EXPOSE 80

# Command to run application with Gunicorn production server
CMD ["gunicorn", "--bind", "0.0.0.0:80", "--workers", "2", "--threads", "4", "--timeout", "120", "app:app"]
