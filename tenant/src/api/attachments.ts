/**
 * Attachments — polymorphic file API client.
 *
 * Replaces the per-feature `requestXxxUploadUrl` helpers with one set of
 * routes that take an owner_type + owner_id. The UI uses
 * `AttachmentTimeline` (read) + `AttachmentUploader` (write) on top of these.
 *
 * Upload protocol (matches CLAUDE.md §10 PII pattern):
 *   1. POST /attachments/{owner_type}/{owner_id}/upload-url with file meta
 *      → backend creates the attachment row + signs a presigned PUT URL.
 *   2. Client PUTs the bytes straight to MinIO/R2 (API never touches them).
 *   3. Optional PATCH later to set/edit `note` or reorder photos.
 *
 * The row appears in subsequent GETs immediately; if the PUT fails, the
 * row stays but its signed GET 404s, which the UI renders as a broken
 * thumbnail with a remove button — the user can clean it up themselves.
 */
import api from './client';

export type AttachmentOwnerType =
  | 'device'
  | 'purchase'
  | 'sale'
  | 'counterparty'
  | 'installment'
  | 'catalog_model';

export type AttachmentKind =
  | 'device_photo'
  | 'seller_doc'
  | 'buyer_doc'
  | 'receipt'
  | 'warranty'
  | 'repair'
  | 'other';

export interface AttachmentOut {
  id: number;
  owner_type: AttachmentOwnerType;
  owner_id: number;
  kind: AttachmentKind;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  note: string | null;
  sort_order: number;
  uploaded_at: string;
  /** Fresh presigned GET (15 min TTL) minted per list call. */
  signed_url: string;
}

export interface UploadUrlRequest {
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind?: AttachmentKind;
  note?: string | null;
}

export interface UploadUrlResponse {
  url: string;
  s3_key: string;
  attachment_id: number;
}

export async function listAttachments(
  ownerType: AttachmentOwnerType,
  ownerId: number,
  kind?: AttachmentKind,
): Promise<AttachmentOut[]> {
  const { data } = await api.get<AttachmentOut[]>(
    `/attachments/${ownerType}/${ownerId}`,
    { params: kind ? { kind } : undefined },
  );
  return data;
}

/**
 * Device timeline aggregates files from the device + its purchase + its
 * sales in chronological order. Single round-trip — the backend does the
 * three joins so the client doesn't need to know about purchase/sale ids.
 */
export async function listDeviceTimeline(
  deviceId: number,
): Promise<AttachmentOut[]> {
  const { data } = await api.get<AttachmentOut[]>(
    `/attachments/device/${deviceId}/timeline`,
  );
  return data;
}

export async function requestUpload(
  ownerType: AttachmentOwnerType,
  ownerId: number,
  payload: UploadUrlRequest,
): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>(
    `/attachments/${ownerType}/${ownerId}/upload-url`,
    payload,
  );
  return data;
}

export async function patchAttachment(
  id: number,
  patch: { note?: string | null; sort_order?: number },
): Promise<AttachmentOut> {
  const { data } = await api.patch<AttachmentOut>(`/attachments/${id}`, patch);
  return data;
}

export async function deleteAttachment(id: number): Promise<void> {
  await api.delete(`/attachments/${id}`);
}
