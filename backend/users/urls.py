from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", views.my_profile, name="my_profile"),
    path("profile/<uuid:user_id>/", views.user_profile, name="user_profile"),
    path("lookup/", views.lookup_by_username, name="lookup_by_username"),
    path("users/search/", views.search_users, name="search_users"),
]
