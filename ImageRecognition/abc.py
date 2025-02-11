from transformers import AutoImageProcessor, AutoModelForImageClassification

# Load the model
model_name = "andupets/real-estate-image-classification"
processor = AutoImageProcessor.from_pretrained(model_name)
model = AutoModelForImageClassification.from_pretrained(model_name)

# Get class labels
class_labels = model.config.id2label

# Print all class names
print("Classes in the model:")
for class_id, class_name in class_labels.items():
    print(f"{class_id}: {class_name}")
