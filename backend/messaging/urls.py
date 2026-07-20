from django.urls import path
from . import views

urlpatterns = [
    path("", views.conversations, name="conversations"),
    path("<uuid:conversation_id>/messages/", views.conversation_messages, name="conversation_messages"),
    path("<uuid:conversation_id>/read/", views.mark_conversation_read, name="mark_read"),
    path("<uuid:conversation_id>/hide/", views.hide_conversation, name="hide_conversation"),
]
