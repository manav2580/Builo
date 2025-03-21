from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
import requests
from io import BytesIO
from PIL import Image

app = FastAPI()

# Load the model
pipe = pipeline("image-classification", model="andupets/real-estate-image-classification")

class ImageRequest(BaseModel):
    url: str

@app.post("/classify")
async def classify_image(request: ImageRequest):
    try:
        # Download the image
        response = requests.get(request.url)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))

        # Perform classification
        results = pipe(image)
        print(results)
        return {"predictions": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Image Classification API is running"}
