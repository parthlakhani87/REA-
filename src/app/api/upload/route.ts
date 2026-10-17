import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { HttpError, handler, json, requireUser } from "@/lib/api";

const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 200;

// Issues short-lived tokens so the browser uploads photos/videos straight to Vercel Blob
// (bypassing the 4.5 MB serverless request limit).
export const POST = handler(async (req: Request) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, "File storage is not configured (BLOB_READ_WRITE_TOKEN)");
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => {
      const user = await requireUser();
      return {
        allowedContentTypes: [
          "image/*",
          "video/*",
          "audio/*",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.*",
          "application/msword",
          "application/vnd.ms-excel",
          "text/plain",
          "text/csv",
        ],
        maximumSizeInBytes: MAX_MB * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: user.id }),
      };
    },
  });
  return json(result);
});
