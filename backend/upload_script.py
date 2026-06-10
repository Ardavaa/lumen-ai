import os
from huggingface_hub import HfApi

api = HfApi()

print("Uploading to Hugging Face Spaces...")
api.upload_folder(
    folder_path=".",
    repo_id="notardavey/lumen-ai-backend",
    repo_type="space",
    ignore_patterns=[
        ".venv/**", 
        ".hf_cache/**", 
        "__pycache__/**", 
        ".git/**", 
        ".pytest_cache/**", 
        ".ruff_cache/**", 
        ".env",
        "upload_script.py"
    ]
)
print("Upload complete!")
