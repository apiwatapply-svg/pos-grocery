import crypto from "node:crypto";
import { env } from "../../config/env.js";

export type UploadedImage = {
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

function hasCloudinaryConfig() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function createSignature(params: Record<string, string | number>, apiSecret: string) {
  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export async function uploadProductImageToCloudinary(input: {
  fileName: string;
  dataUri: string;
}): Promise<UploadedImage> {
  if (!hasCloudinaryConfig() || env.NODE_ENV === "test") {
    const publicId = `${env.CLOUDINARY_UPLOAD_FOLDER}/${input.fileName.replace(/\W+/g, "-")}`;
    return {
      publicId,
      secureUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
      thumbnailUrl: `https://res.cloudinary.com/demo/image/upload/c_thumb,w_240/${publicId}`,
      format: input.fileName.split(".").at(-1),
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder: env.CLOUDINARY_UPLOAD_FOLDER,
    timestamp,
  };
  const signature = createSignature(params, env.CLOUDINARY_API_SECRET ?? "");
  const form = new FormData();
  form.append("file", input.dataUri);
  form.append("api_key", env.CLOUDINARY_API_KEY ?? "");
  form.append("folder", env.CLOUDINARY_UPLOAD_FOLDER);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error("Cloudinary upload failed.");
  }

  const data = (await response.json()) as {
    public_id: string;
    secure_url: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  };

  return {
    publicId: data.public_id,
    secureUrl: data.secure_url,
    thumbnailUrl: data.secure_url.replace("/upload/", "/upload/c_thumb,w_240/"),
    width: data.width,
    height: data.height,
    format: data.format,
    bytes: data.bytes,
  };
}
