from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Conversation, Message, HiddenConversation
from .serializers import ConversationSerializer, MessageSerializer
from users.models import User


def _get_or_create_conversation(user_a, user_b):
    """Return (conversation, created). Always stores user1 < user2 by pk string."""
    user1, user2 = (user_a, user_b) if str(user_a.pk) < str(user_b.pk) else (user_b, user_a)
    conv, created = Conversation.objects.get_or_create(user1=user1, user2=user2)
    return conv, created


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversations(request):
    if request.method == "GET":
        hidden_ids = HiddenConversation.objects.filter(user=request.user).values_list("conversation_id", flat=True)
        convs = (
            Conversation.objects.filter(user1=request.user)
            | Conversation.objects.filter(user2=request.user)
        ).exclude(id__in=hidden_ids).order_by("-last_message_at")
        return Response(
            ConversationSerializer(convs, many=True, context={"request": request}).data
        )

    # POST: create or retrieve a conversation with another user
    other_user_id = request.data.get("other_user_id")
    if not other_user_id:
        return Response({"detail": "other_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        other_user = User.objects.get(pk=other_user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    conv, created = _get_or_create_conversation(request.user, other_user)

    # Unhide if it was hidden for this user
    HiddenConversation.objects.filter(user=request.user, conversation=conv).delete()

    http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(
        ConversationSerializer(conv, context={"request": request}).data,
        status=http_status,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conversation_id):
    try:
        conv = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (conv.user1, conv.user2):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        messages = conv.messages.order_by("created_at")
        return Response(MessageSerializer(messages, many=True).data)

    # POST: send a message
    content = request.data.get("content", "").strip()
    if not content:
        return Response({"detail": "content is required."}, status=status.HTTP_400_BAD_REQUEST)

    message = Message.objects.create(conversation=conv, sender=request.user, content=content)
    conv.last_message_at = timezone.now()
    conv.save(update_fields=["last_message_at"])

    # Unhide conversation for the other participant
    other = conv.user2 if conv.user1 == request.user else conv.user1
    HiddenConversation.objects.filter(user=other, conversation=conv).delete()

    return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_conversation_read(request, conversation_id):
    try:
        conv = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (conv.user1, conv.user2):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    conv.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
    return Response({"detail": "Messages marked as read."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def hide_conversation(request, conversation_id):
    try:
        conv = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.user not in (conv.user1, conv.user2):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    HiddenConversation.objects.get_or_create(user=request.user, conversation=conv)
    return Response({"detail": "Conversation hidden."})
