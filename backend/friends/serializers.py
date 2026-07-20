from rest_framework import serializers
from .models import Friendship
from users.serializers import UserSerializer


class FriendshipSerializer(serializers.ModelSerializer):
    requester_id = serializers.CharField(source="requester.id", read_only=True)
    addressee_id = serializers.CharField(source="addressee.id", read_only=True)
    requester_profile = UserSerializer(source="requester", read_only=True)
    addressee_profile = UserSerializer(source="addressee", read_only=True)

    class Meta:
        model = Friendship
        fields = [
            "id", "requester_id", "addressee_id",
            "requester_profile", "addressee_profile",
            "status", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "requester_id", "created_at", "updated_at"]
