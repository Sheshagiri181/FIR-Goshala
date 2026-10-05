# FIR Goshala Register

A React FIR case register for recording cow transportation, field reports, goshala custody, advocate details, and final orders. Boat transport details are optional.

## Connect to MongoDB Atlas

The browser talks to the Express API; the API connects to MongoDB Atlas. Keep the Atlas connection string and staff credentials in the root `.env` file, never in frontend code. The `.env` file is ignored by Git.

1. In Atlas, create a database user and allow the server's IP address under **Network Access**.
2. Copy `.env.example` to `.env` in the repository root.
3. Set `MONGODB_URI` to the Atlas connection string, including a database name, and replace the staff username, password, and token secret. Use a unique staff password and a random token secret of at least 32 characters.
4. Install backend dependencies with `npm install`.
5. Run the API from the repository root with `npm start`.
6. In another terminal, run the frontend with `npm --prefix Gow-FIR-frontend run dev`, then open the Vite URL it prints.

The API connects to Atlas before it starts listening. Check `http://localhost:3001/api/health` to confirm the database connection. The Vite dev server proxies `/api` requests to the API.

Existing records previously saved in browser local storage are not automatically copied to Atlas. They remain in that browser's storage; plan a migration before removing or clearing the old browser data.

## Local frontend only

```sh
npm --prefix Gow-FIR-frontend run dev
```

The frontend needs the API and a working Atlas connection to load or save records.