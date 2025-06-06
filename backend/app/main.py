from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
import os
from typing import Optional
import logging
from .website_cloner import WebsiteCloner
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Gemini
if os.getenv("GEMINI_API_KEY"):
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-pro')

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
    use_ai: bool = False

async def enhance_code(html: str, css: str) -> dict:
    """Enhance the code using Gemini."""
    try:
        if not os.getenv("GEMINI_API_KEY"):
            return {"success": False, "error": "Gemini API key not configured"}

        prompt = f"""You are a web development expert. Analyze and enhance this website code.

HTML:
```html
{html[:2000]}  # First 2000 chars for context
```

CSS:
```css
{css[:2000]}  # First 2000 chars for context
```

Please enhance this code by:
1. Improving accessibility (ARIA labels, semantic HTML)
2. Optimizing performance
3. Ensuring responsive design
4. Adding missing meta tags
5. Cleaning up the code

Return only the enhanced HTML and CSS code, no explanations. Format:

HTML:
```html
[your html code]
```

CSS:
```css
[your css code]
```"""

        response = model.generate_content(prompt)
        response_text = response.text

        # Extract HTML and CSS
        html_start = response_text.find("```html") + 7
        html_end = response_text.find("```", html_start)
        enhanced_html = response_text[html_start:html_end].strip()

        css_start = response_text.find("```css") + 6
        css_end = response_text.find("```", css_start)
        enhanced_css = response_text[css_start:css_end].strip()

        return {
            "success": True,
            "html": enhanced_html or html,  # Fallback to original if empty
            "css": enhanced_css or css  # Fallback to original if empty
        }
    except Exception as e:
        logger.error(f"Failed to enhance code: {str(e)}")
        return {"success": False, "error": str(e)}

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
        
        # If AI enhancement is requested
        enhanced_url = None
        if url_input.use_ai:
            try:
                # Read the cloned files
                with open(os.path.join(result["output_folder"], "index.html"), "r", encoding="utf-8") as f:
                    html_content = f.read()
                
                # Extract CSS from HTML
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html_content, 'html.parser')
                css_content = ""
                
                # Get inline styles
                for style in soup.find_all('style'):
                    if style.string:
                        css_content += style.string + "\n"
                
                # Enhance the code
                enhanced = await enhance_code(html_content, css_content)
                
                if enhanced["success"]:
                    # Save enhanced version
                    enhanced_dir = os.path.join(result["output_folder"], "enhanced")
                    os.makedirs(enhanced_dir, exist_ok=True)
                    
                    # Create enhanced HTML file
                    enhanced_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Clone of {url_input.url}</title>
    <style>
{enhanced["css"]}
    </style>
</head>
<body>
{enhanced["html"]}
</body>
</html>"""
                    
                    with open(os.path.join(enhanced_dir, "index.html"), "w", encoding="utf-8") as f:
                        f.write(enhanced_html)
                    
                    enhanced_url = f"/cloned_sites/{domain}/enhanced/index.html"
            except Exception as e:
                logger.error(f"Failed to enhance code: {str(e)}")
                # Continue with regular clone if enhancement fails
        
        # Return the result
        response = {
            "success": True,
            "message": "Website cloned successfully",
            "files_count": result["files_count"],
            "cloned_url": f"/cloned_sites/{domain}/index.html",
            "files": result["files"]
        }
        
        if enhanced_url:
            response["enhanced_url"] = enhanced_url
        
        return response
        
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
