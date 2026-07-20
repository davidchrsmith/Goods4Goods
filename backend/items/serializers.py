from rest_framework import serializers
from .models import Item
from users.serializers import UserSerializer


class ItemSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(source="user.id", read_only=True)
    owner_profile = UserSerializer(source="user", read_only=True)

    class Meta:
        model = Item
        fields = [
            "id", "user_id", "owner_profile", "title", "description",
            "condition", "estimated_value", "image_urls", "is_available",
            "status", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user_id", "owner_profile", "created_at", "updated_at"]


class ItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ["title", "description", "condition", "estimated_value", "image_urls"]
