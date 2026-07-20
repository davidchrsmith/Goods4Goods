import uuid
from django.db import models
from django.conf import settings


class Item(models.Model):
    CONDITION_CHOICES = [
        ("New", "New"),
        ("Like New", "Like New"),
        ("Good", "Good"),
        ("Fair", "Fair"),
        ("Poor", "Poor"),
    ]
    STATUS_CHOICES = [
        ("available", "Available"),
        ("traded", "Traded"),
        ("unavailable", "Unavailable"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=255)
    description = models.TextField()
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    estimated_value = models.FloatField(default=0)
    image_urls = models.JSONField(default=list)
    is_available = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="available")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
