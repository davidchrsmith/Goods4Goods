from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TradeRequest
from .serializers import TradeRequestSerializer
from items.models import Item
from users.models import User


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_trade_request(request):
    requester_item_id = request.data.get("requester_item_id")
    target_item_id = request.data.get("target_item_id")

    if not requester_item_id or not target_item_id:
        return Response(
            {"detail": "requester_item_id and target_item_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        requester_item = Item.objects.get(pk=requester_item_id, user=request.user, is_available=True)
    except Item.DoesNotExist:
        return Response({"detail": "Your item not found or unavailable."}, status=status.HTTP_404_NOT_FOUND)

    try:
        target_item = Item.objects.get(pk=target_item_id, is_available=True)
    except Item.DoesNotExist:
        return Response({"detail": "Target item not found or unavailable."}, status=status.HTTP_404_NOT_FOUND)

    if target_item.user == request.user:
        return Response({"detail": "Cannot request a trade with yourself."}, status=status.HTTP_400_BAD_REQUEST)

    if TradeRequest.objects.filter(requester_item=requester_item, target_item=target_item).exists():
        return Response({"detail": "Trade request already sent."}, status=status.HTTP_409_CONFLICT)

    trade = TradeRequest.objects.create(
        requester=request.user,
        requester_item=requester_item,
        target_user=target_item.user,
        target_item=target_item,
        status="pending",
    )
    return Response(TradeRequestSerializer(trade).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def incoming_trade_requests(request):
    trades = TradeRequest.objects.filter(
        target_user=request.user, status="pending"
    ).select_related("requester", "requester_item", "target_item", "target_user")
    return Response(TradeRequestSerializer(trades, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def outgoing_trade_requests(request):
    trades = TradeRequest.objects.filter(
        requester=request.user, status="pending"
    ).select_related("requester", "requester_item", "target_item", "target_user")
    return Response(TradeRequestSerializer(trades, many=True).data)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def trade_request_detail(request, trade_id):
    try:
        trade = TradeRequest.objects.get(pk=trade_id)
    except TradeRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        # Only the requester can cancel
        if trade.requester != request.user:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        trade.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH - respond to a trade request (target user only)
    new_status = request.data.get("status")
    if new_status not in ("accepted", "declined"):
        return Response({"detail": "status must be 'accepted' or 'declined'."}, status=status.HTTP_400_BAD_REQUEST)

    if trade.target_user != request.user:
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    trade.status = new_status
    trade.save()
    return Response(TradeRequestSerializer(trade).data)
