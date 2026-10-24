# Netlify deployment status

The interface improvements in this project are ready in the source, but the complete app is **not deployable to Netlify by uploading this ZIP alone**. The application calls an Express API (`backend/server.mjs`) and stores imported student rows in a local SQLite file. A Netlify static deployment will not run that Express server or preserve its SQLite file.

To make a public URL work, the backend needs a separate persistent Node hosting service or a hosted database, and the frontend must be configured with that backend URL. Since the CSV contains student records, also add authentication/access controls before publishing it. No Netlify config is added here that would misleadingly publish a non-working frontend.
