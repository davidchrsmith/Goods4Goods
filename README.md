# Goods4Goods

A peer-to-peer barter marketplace built with React Native (Expo) and Django REST Framework.

## Tech Stack

- **Frontend**: React Native (Expo ~54), TypeScript
- **Backend**: Django 4.2, Django REST Framework, SimpleJWT
- **Database**: SQLite (development), PostgreSQL-ready for production
- **UI**: React Native Elements (@rneui/themed)

## Project Structure

```
/                   React Native frontend (Expo)
  api/              API client and service functions
  components/       Screen components
  hooks/            Custom hooks
/backend/           Django REST API
  users/            Authentication and user profiles
  items/            Item listings and image upload
  trades/           Trade request workflow
  messaging/        Conversations and messages
  friends/          Friend requests
```

## Running Locally

Two processes are required: the Django backend and the Expo frontend.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will be available at `http://localhost:8000`.

### Frontend

In a separate terminal, from the project root:

```bash
npm install
npx expo start
```

Press `w` to open in the browser, `a` for Android emulator, or scan the QR code with the Expo Go app on a physical device.

> On an Android emulator, change `localhost` in `api/client.ts` to `10.0.2.2`.  
> On a physical device, change it to your machine's local IP address.

## Environment Variables

The backend `SECRET_KEY` in `backend/backend/settings.py` is a placeholder. Before deploying to production, replace it with a strong random key stored in an environment variable and set `DEBUG = False`.

No environment variables are required to run in development.

## Features

- User registration and JWT authentication
- Item listings with image upload
- Swipe-based item discovery
- Trade request workflow (propose, accept, decline)
- In-app messaging with per-conversation read receipts
- Friend system
- Location-based filtering

