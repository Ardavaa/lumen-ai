FROM python:3.13-slim

# Install ffmpeg and OpenCV dependencies (required for video/audio processing)
RUN apt-get update && \
    apt-get install -y ffmpeg libsm6 libxext6 && \
    rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces requires running as a non-root user
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install uv (blazing fast python package manager)
RUN pip install --no-cache-dir uv

# Copy dependency files first to leverage Docker cache
COPY --chown=user pyproject.toml uv.lock ./

# Sync dependencies (creates .venv inside /app)
RUN uv sync --frozen --no-dev

# Copy the rest of the application code
COPY --chown=user . .

# Create cache directory for Hugging Face models with proper permissions
RUN mkdir -p /app/.hf_cache && \
    chown -R user:user /app/.hf_cache || true

ENV HF_HOME="/app/.hf_cache"

# Hugging Face routes traffic to port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Run FastAPI via Uvicorn
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
