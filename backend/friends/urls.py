from django.urls import path
from . import views

urlpatterns = [
    path("", views.friend_requests, name="friend_requests"),
    path("outgoing/", views.outgoing_friend_requests, name="outgoing_friend_requests"),
    path("<uuid:friendship_id>/", views.respond_to_friend_request, name="respond_friend_request"),
]
