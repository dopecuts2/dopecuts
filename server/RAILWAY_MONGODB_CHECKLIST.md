# Railway MongoDB Deployment Checklist



The code now refuses to start when `MONGO_URI` is absent or when MongoDB cannot be reached. Use this checklist in Railway without copying secret values into chat, Git, source code, or deployment logs.



1. In the Railway service, confirm that a variable named `MONGO_URI` exists for the production environment. Its value must be a complete MongoDB URI, not a placeholder or a quoted variable name.
2. 
2. If the database is MongoDB Atlas, allow Railway network access in Atlas and confirm that the database user in the URI has read/write access to the Dopecuts database.
3. 
3. Redeploy the server. A successful connection reports `MongoDB connected successfully` before the HTTP listener starts.
4. 
4. Open `https://dopecuts-production.up.railway.app/health`. A healthy deployment returns HTTP 200 with `status: ok` and `database: connected`.
5. 
5. If startup fails, use Railway deployment logs to distinguish a missing `MONGO_URI`, Atlas network access denial, database authentication failure, DNS/cluster availability problem, or malformed URI. Do not paste the URI into a log, issue, or chat.
6. 


The server intentionally exits instead of serving an API with no database connection. This prevents the client from receiving misleading success responses while bookings or services are unavailable.




