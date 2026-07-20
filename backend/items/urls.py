from django.urls import path
from . import views

urlpatterns = [
    path("", views.my_items, name="my_items"),
    path("discover/", views.discover_items, name="discover_items"),
    path("<uuid:item_id>/", views.item_detail, name="item_detail"),
    path("upload-image/", views.upload_image, name="upload_image"),
]
