# FIR Goshala Register

React case register backed by MongoDB. FIR records and staff sessions are persisted in MongoDB; the browser does not store case data locally.

## Configure

1. Create a MongoDB Atlas database user and allow the development machine's IP address in the Atlas network access settings.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to the cluster's standard `mongodb+srv://` connection string. A MongoDB Atlas API key alone is not a MongoDB driver connection URI.
3. Set a strong, unique `STAFF_PASSWORD` and a random `SESSION_SECRET` with at least 32 characters. Keep `.env` private and do not commit it.

## Run locally

In one terminal, start the API:

```sh
npm run server
```

In another terminal, start the React app:

```sh
npm --prefix Gow-FIR-frontend run dev
```

Open the Vite URL shown in the frontend terminal. The frontend proxies `/api` requests to the API on port 3001.

Collections: `fir_records` stores cases and `sessions` stores staff login sessions. The public view can read case records; create and update endpoints require a staff session.