import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

const { error } = await admin.storage.createBucket("shop-media", {
  public: true,
  fileSizeLimit: "5MB",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
});

if (error && !error.message.toLowerCase().includes("already exists")) throw error;
console.log("bucket shop-media OK");
