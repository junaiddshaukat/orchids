from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
import os
from typing import Optional
import logging
from .website_cloner import WebsiteCloner

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a directory for cloned websites if it doesn't exist
CLONED_SITES_DIR = os.path.join(os.path.dirname(__file__), "cloned_sites")
os.makedirs(CLONED_SITES_DIR, exist_ok=True)

# Mount the cloned_sites directory to serve static files
app.mount("/cloned_sites", StaticFiles(directory=CLONED_SITES_DIR), name="cloned_sites")

class URLInput(BaseModel):
    url: HttpUrl

@app.post("/api/clone")
async def clone_website(url_input: URLInput):
    try:
        # Create a WebsiteCloner instance
        cloner = WebsiteCloner(
            url=str(url_input.url),
            output_dir=CLONED_SITES_DIR
        )
        
        # Clone the website
        result = cloner.clone()
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to clone website: {result.get('error', 'Unknown error')}"
            )
        
        # Get the domain name for the URL
        domain = result["output_folder"].split(os.path.sep)[-1]
        
        # Return the result with the URL to access the cloned site
        return {
            "success": True,
            "message": "Website cloned successfully",
            "files_count": result["files_count"],
            "cloned_url": f"/cloned_sites/{domain}/index.html",
            "files": result["files"]
        }
        
    except Exception as e:
        logger.error(f"Failed to clone website: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clone website: {str(e)}"
        )

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
