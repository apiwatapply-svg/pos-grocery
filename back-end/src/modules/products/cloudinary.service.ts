import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.ts";

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

function buildProductFolder(storeId: string) {
  return `${env.CLOUDINARY_UPLOAD_FOLDER}/${storeId}/products`;
}

export async function uploadProductImageToCloudinary(input: {
  storeId: string;
  fileName: string;
  dataUri: string;
}): Promise<UploadedImage> {
  const folder = buildProductFolder(input.storeId);
  const publicId = `${folder}/${randomUUID()}`;

  if (env.NODE_ENV === "test") {
    return {
      publicId,
      secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}`,
      thumbnailUrl: `https://res.cloudinary.com/test-cloud/image/upload/c_thumb,w_240/${publicId}`,
      format: input.fileName.split(".").at(-1),
    };
  }

  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary configuration is required for product image uploads.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder,
    public_id: publicId.split("/").pop() ?? "",
    timestamp,
  };
  const signature = createSignature(params, env.CLOUDINARY_API_SECRET ?? "");
  const form = new FormData();
  form.append("file", input.dataUri);
  form.append("api_key", env.CLOUDINARY_API_KEY ?? "");
  form.append("folder", folder);
  form.append("public_id", params.public_id);
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
