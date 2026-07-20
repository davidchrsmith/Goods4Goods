from django.urls import path
from . import views

urlpatterns = [
    path("", views.create_trade_request, name="create_trade_request"),
    path("incoming/", views.incoming_trade_requests, name="incoming_trades"),
    path("outgoing/", views.outgoing_trade_requests, name="outgoing_trades"),
    path("<uuid:trade_id>/", views.trade_request_detail, name="trade_detail"),
]
