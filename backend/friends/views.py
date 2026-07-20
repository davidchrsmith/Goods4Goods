from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from .models import Friendship
from .serializers import FriendshipSerializer
from users.models import User


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def friend_requests(request):
    if request.method == "GET":
        # Incoming pending requests
        requests = Friendship.objects.filter(
            addressee=request.user, status="pending"
        ).select_related("requester", "addressee")
        return Response(FriendshipSerializer(requests, many=True).data)

    # POST: send a friend request
    addressee_id = request.data.get("addressee_id")
    if not addressee_id:
        return Response({"detail": "addressee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    if str(addressee_id) == str(request.user.pk):
        return Response({"detail": "Cannot add yourself."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        addressee = User.objects.get(pk=addressee_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    existing = Friendship.objects.filter(
        Q(requester=request.user, addressee=addressee)
        | Q(requester=addressee, addressee=request.user)
    ).first()

    if existing:
        return Response({"detail": "Connection already exists."}, status=status.HTTP_409_CONFLICT)

    friendship = Friendship.objects.create(requester=request.user, addressee=addressee)
    return Response(FriendshipSerializer(friendship).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def outgoing_friend_requests(request):
    requests = Friendship.objects.filter(
        requester=request.user, status="pending"
    ).select_related("requester", "addressee")
    return Response(FriendshipSerializer(requests, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def respond_to_friend_request(request, friendship_id):
    try:
        friendship = Friendship.objects.get(pk=friendship_id, addressee=request.user)
    except Friendship.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get("status")
    if new_status not in ("accepted", "declined"):
        return Response(
            {"detail": "status must be 'accepted' or 'declined'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    friendship.status = new_status
    friendship.save()
    return Response(FriendshipSerializer(friendship).data)
