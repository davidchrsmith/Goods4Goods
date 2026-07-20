from rest_framework import serializers
from .models import Conversation, Message
from users.serializers import UserSerializer


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.CharField(source="sender.id", read_only=True)
    conversation_id = serializers.CharField(source="conversation.id", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "conversation_id", "sender_id", "content", "is_read", "created_at"]
        read_only_fields = ["id", "conversation_id", "sender_id", "is_read", "created_at"]


class ConversationSerializer(serializers.ModelSerializer):
    user1_id = serializers.CharField(source="user1.id", read_only=True)
    user2_id = serializers.CharField(source="user2.id", read_only=True)
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id", "user1_id", "user2_id", "other_user",
            "last_message", "unread_count", "last_message_at", "created_at",
        ]

    def get_other_user(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        other = obj.user2 if obj.user1_id == request.user.id else obj.user1
        return UserSerializer(other).data

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if last is None:
            return None
        return MessageSerializer(last).data

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if request is None:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
