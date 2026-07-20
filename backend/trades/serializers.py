from rest_framework import serializers
from .models import TradeRequest
from items.serializers import ItemSerializer
from users.serializers import UserSerializer


class TradeRequestSerializer(serializers.ModelSerializer):
    requester_id = serializers.CharField(source="requester.id", read_only=True)
    target_user_id = serializers.CharField(source="target_user.id", read_only=True)
    requester_item_id = serializers.CharField(source="requester_item.id", read_only=True)
    target_item_id = serializers.CharField(source="target_item.id", read_only=True)
    requester_item = ItemSerializer(read_only=True)
    target_item = ItemSerializer(read_only=True)
    requester_profile = UserSerializer(source="requester", read_only=True)
    target_profile = UserSerializer(source="target_user", read_only=True)

    class Meta:
        model = TradeRequest
        fields = [
            "id", "requester_id", "requester_item_id", "target_user_id", "target_item_id",
            "requester_item", "target_item", "requester_profile", "target_profile",
            "status", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "requester_id", "created_at", "updated_at"]
