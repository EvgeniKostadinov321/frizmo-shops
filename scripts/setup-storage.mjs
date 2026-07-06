import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

/* Лимитът е 15MB (hero видео); MIME включва и MP4/WebM за video hero.
   Снимките се валидират отделно на app ниво (5MB, само image/*). */
const config = {
  public: true,
  fileSizeLimit: "15MB",
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "video/mp4",
    "video/webm",
  ],
};

const { error } = await admin.storage.createBucket("shop-media", config);

if (error && error.message.toLowerCase().includes("already exists")) {
  /* Съществува → обновяваме лимита/MIME (video hero изисква по-голям лимит). */
  const { error: updateError } = await admin.storage.updateBucket("shop-media", config);
  if (updateError) throw updateError;
  console.log("bucket shop-media обновен (15MB + видео MIME)");
} else if (error) {
  throw error;
} else {
  console.log("bucket shop-media създаден");
}
