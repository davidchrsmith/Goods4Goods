from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "username", "full_name", "phone",
            "avatar_url", "latitude", "longitude", "location_name",
            "location_updated_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "username", "full_name", "phone", "avatar_url",
            "latitude", "longitude", "location_name", "location_updated_at",
        ]

    def validate_username(self, value):
        if value is None:
            return value
        value = value.lower().strip()
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        if len(value) > 20:
            raise serializers.ValidationError("Username must be 20 characters or fewer.")
        import re
        if not re.match(r"^[a-z0-9_]+$", value):
            raise serializers.ValidationError("Username may only contain letters, numbers, and underscores.")
        # Check uniqueness excluding the current user
        request = self.context.get("request")
        qs = User.objects.filter(username=value)
        if request:
            qs = qs.exclude(pk=request.user.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value
