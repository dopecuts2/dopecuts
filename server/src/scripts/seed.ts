// dopecuts-server/src/scripts/seed.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Admin } from '../models/admin.model';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ADMIN_EMAIL = 'leeroy@dopecuts.ca';

const seedAdmin = async () => {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in the .env file.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('📦 MongoDB connected successfully');

    // Use findOneAndUpdate with upsert to create the admin only if it doesn't exist
    const result = await Admin.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $setOnInsert: { email: ADMIN_EMAIL } },
      { upsert: true, new: true, runValidators: true }
    );

    // The 'upsertedId' property is present only when a new document is created
    if (result && result._id && !mongoose.Types.ObjectId.isValid(result._id)) {
       console.log(`✅ Admin user with email ${ADMIN_EMAIL} was created successfully!`);
    } else if (result) {
       console.log(`ℹ️ Admin with email ${ADMIN_EMAIL} already exists.`);
    }

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    // Disconnect from the database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

seedAdmin();