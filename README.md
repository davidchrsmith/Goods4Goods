# Goods4Goods (G4G)

A peer-to-peer barter marketplace built with React Native and Supabase.

## Features

- 📱 Cross-platform (iOS, Android, Web)
- 📧 In-app messaging system
- 📸 Item listing with image upload
- 💫 Tinder-style discovery interface
- 🤝 Trade request system
- 💰 Item valuation (manual input, Python integration planned)

## Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Supabase
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth
- **UI**: React Native Elements

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase project and add environment variables
4. Run the app: `expo start`

## Environment Variables

Create a `.env` file with:
\`\`\`
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

## Future Enhancements

- Python-based item valuation using web scraping
- Advanced matching algorithms
- Location-based filtering
- Push notifications
\`\`\`

## **🔑 Key Points:**

1. **SQL scripts stay in Supabase** - they're one-time setup, not part of your app code
2. **Environment variables** - Never commit these to GitHub
3. **Use .gitignore** - Prevents accidental commits of sensitive files
4. **Document setup** - README helps others (and future you) understand the project

The SQL scripts are infrastructure setup that you run once in Supabase. Your app code is what goes in the repo!

