from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import User
from .serializers import UserSerializer, RegisterSerializer, UpdateProfileSerializer


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    tokens = get_tokens_for_user(user)
    return Response(
        {"user": UserSerializer(user).data, **tokens},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not email or not password:
        return Response(
            {"detail": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    tokens = get_tokens_for_user(user)
    return Response({"user": UserSerializer(user).data, **tokens})


@api_view(["GET"])
@permission_classes([AllowAny])
def lookup_by_username(request):
    username = request.query_params.get("username", "").strip().lower()
    if not username:
        return Response({"email": None})

    try:
        user = User.objects.get(username=username)
        return Response({"email": user.email})
    except User.DoesNotExist:
        return Response({"email": None})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def my_profile(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    serializer = UpdateProfileSerializer(
        request.user, data=request.data, partial=True, context={"request": request}
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
        return Response(UserSerializer(user).data)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_users(request):
    query = request.query_params.get("q", "").strip()
    if not query:
        return Response([])

    users = (
        User.objects.filter(username__icontains=query)
        .exclude(pk=request.user.pk)[:10]
    )
    return Response(UserSerializer(users, many=True).data)
