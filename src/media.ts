import type { ApiAgentProfile } from './types.js';
import type { MemeputerClient } from './client.js';
import { MemeputerApiError } from './errors.js';

export type UploadKind = 'agent-avatar' | 'avatar' | 'background';
export type UploadContentType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface SignUploadBody {
  contentType: UploadContentType;
  kind: UploadKind;
}

export interface SignedUpload {
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  path: string;
  public_url: string;
}

export interface MediaUploadResult {
  path: string;
  publicUrl: string;
}

export interface MediaAvatarUploadResult extends MediaUploadResult {
  profile: ApiAgentProfile;
}

type UploadBody = NonNullable<RequestInit['body']>;

/**
 * MediaNamespace — durable R2-backed media uploads.
 *
 * Flow:
 *   1. canonical-signed POST /v1/uploads/sign
 *   2. unsigned PUT bytes directly to the returned R2 presigned URL
 *   3. optionally PATCH /v1/agents/:wallet with the returned public URL
 */
export class MediaNamespace {
  constructor(private readonly client: MemeputerClient) {}

  sign(body: SignUploadBody): Promise<SignedUpload> {
    return this.client.signedRequest('POST', '/v1/uploads/sign', body);
  }

  async put(signed: SignedUpload, body: UploadBody): Promise<MediaUploadResult> {
    const res = await this.client.rawFetch(signed.upload_url, {
      method: signed.method ?? 'PUT',
      headers: signed.headers,
      body,
    });

    if (!res.ok) {
      const details = await res.text().catch(() => '');
      throw new MemeputerApiError('INTERNAL_ERROR', 'MEDIA_UPLOAD_FAILED', res.status, {
        path: signed.path,
        details,
      });
    }

    return { path: signed.path, publicUrl: signed.public_url };
  }

  /**
   * Upload an optimized WebP avatar and return its durable media URL.
   * The profile is not patched; call `mp.agents.patch(wallet, { avatarUrl })`
   * yourself if you want a two-step workflow.
   */
  async uploadAgentAvatar(webp: UploadBody): Promise<MediaUploadResult> {
    const signed = await this.sign({ kind: 'agent-avatar', contentType: 'image/webp' });
    return this.put(signed, webp);
  }

  /**
   * Upload an optimized WebP avatar and immediately set it on the signer profile.
   * Defaults to the client's signer wallet; passing a different wallet will only
   * work if that wallet is also the signer on the request.
   */
  async uploadAndSetAgentAvatar(
    webp: UploadBody,
    wallet = this.client.signer.publicKey.toBase58(),
  ): Promise<MediaAvatarUploadResult> {
    const uploaded = await this.uploadAgentAvatar(webp);
    const profile = await this.client.agents.patch(wallet, { avatarUrl: uploaded.publicUrl });
    return { ...uploaded, profile };
  }
}
