import uuid
from django.db import models
from django.conf import settings


class TradeRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="outgoing_trades"
    )
    requester_item = models.ForeignKey(
        "items.Item", on_delete=models.CASCADE, related_name="outgoing_trade_requests"
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="incoming_trades"
    )
    target_item = models.ForeignKey(
        "items.Item", on_delete=models.CASCADE, related_name="incoming_trade_requests"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("requester_item", "target_item")]

    def __str__(self):
        return f"{self.requester} → {self.target_user} ({self.status})"
