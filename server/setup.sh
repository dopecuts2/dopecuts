#!/bin/bash

# Create root directories
mkdir -p src/{config,controllers,middleware,models,routes,services,utils,jobs}

# Create files in src/config
touch src/config/db.ts
touch src/config/env.ts

# Create files in src/controllers
touch src/controllers/auth.controller.ts

# Create files in src/middleware
touch src/middleware/authGuard.ts
touch src/middleware/cors.ts
touch src/middleware/rateLimiter.ts

# Create files in src/models
touch src/models/admin.model.ts
touch src/models/otp.model.ts

# Create files in src/routes
touch src/routes/auth.routes.ts
touch src/routes/index.ts

# Create files in src/services
touch src/services/emailService.ts
# Add placeholders for other services
touch src/services/s3.service.ts
touch src/services/sms.service.ts


# Create files in src/utils
touch src/utils/logger.ts

# Create root files
touch .env
touch .gitignore
touch tsconfig.json
touch server.ts

# Populate .gitignore
echo "node_modules
dist
.env
" > .gitignore

# Populate tsconfig.json
echo '{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}' > tsconfig.json

echo "✅ Project structure created successfully!"