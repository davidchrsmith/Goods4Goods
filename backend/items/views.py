import os
import uuid
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

from .models import Item
from .serializers import ItemSerializer, ItemWriteSerializer
from trades.models import TradeRequest


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def my_items(request):
    """GET: list current user's items. POST: create a new item."""
    if request.method == "GET":
        items = Item.objects.filter(user=request.user)
        return Response(ItemSerializer(items, many=True).data)

    serializer = ItemWriteSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    item = serializer.save(user=request.user)
    return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def discover_items(request):
    """Return available items from other users, excluding already-requested ones."""
    user = request.user

    # Get IDs of items already requested (pending or accepted) by this user
    requested_ids = TradeRequest.objects.filter(
        requester=user,
        status__in=["pending", "accepted"],
    ).values_list("target_item_id", flat=True)

    # Get IDs of items involved in any accepted trade with this user's items
    user_item_ids = Item.objects.filter(user=user).values_list("id", flat=True)
    accepted_trades = TradeRequest.objects.filter(
        status="accepted",
    ).filter(
        requester_item_id__in=user_item_ids,
    ) | TradeRequest.objects.filter(
        status="accepted",
    ).filter(
        target_item_id__in=user_item_ids,
    )
    accepted_item_ids = set()
    for trade in accepted_trades:
        accepted_item_ids.add(trade.requester_item_id)
        accepted_item_ids.add(trade.target_item_id)

    items = (
        Item.objects.filter(is_available=True, status="available")
        .exclude(user=user)
        .exclude(id__in=requested_ids)
        .exclude(id__in=accepted_item_ids)
        .select_related("user")
    )
    return Response(ItemSerializer(items, many=True).data)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def item_detail(request, item_id):
    try:
        item = Item.objects.get(pk=item_id, user=request.user)
    except Item.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(ItemSerializer(item).data)

    if request.method == "PUT":
        serializer = ItemWriteSerializer(item, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # Allow toggling is_available and status directly
        item = serializer.save()
        if "is_available" in request.data:
            item.is_available = request.data["is_available"]
        if "status" in request.data:
            item.status = request.data["status"]
        item.save()
        return Response(ItemSerializer(item).data)

    # DELETE
    # Remove associated trade requests first
    TradeRequest.objects.filter(requester_item=item).delete()
    TradeRequest.objects.filter(target_item=item).delete()
    item.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_image(request):
    """Upload a single image file and return its URL."""
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(file.name)[1].lower() or ".jpg"
    filename = f"items/{request.user.id}/{uuid.uuid4()}{ext}"
    save_path = os.path.join(settings.MEDIA_ROOT, filename)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "wb") as f:
        for chunk in file.chunks():
            f.write(chunk)

    url = request.build_absolute_uri(f"{settings.MEDIA_URL}{filename}")
    return Response({"url": url}, status=status.HTTP_201_CREATED)
