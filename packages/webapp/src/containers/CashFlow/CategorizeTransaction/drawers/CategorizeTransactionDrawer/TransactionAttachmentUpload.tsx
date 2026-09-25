import { Intent, Spinner, Tag } from '@blueprintjs/core';
import { useFormikContext } from 'formik';
import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { CategorizeTransactionFormValues } from './_utils';
import { Box, FFormGroup, Group } from '@/components';
import {
  useDeleteAttachment,
  useUploadAttachments,
} from '@/hooks/query/attachments';

interface UploadedFile {
  key: string;
  originName: string;
}

interface PendingFile {
  internalKey: string;
  originName: string;
}

/**
 * Attachment upload section for the Categorize Transaction form.
 * Files are uploaded immediately on selection; their keys are stored in
 * Formik's `attachmentKeys` field and linked to the transaction on Save.
 */
export function TransactionAttachmentUpload() {
  const { values, setFieldValue } =
    useFormikContext<CategorizeTransactionFormValues>();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files confirmed uploaded (key + display name)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // Files currently uploading (not yet returned from server)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Keep Formik in sync whenever the confirmed list changes
  useEffect(() => {
    setFieldValue(
      'attachmentKeys',
      uploadedFiles.map((f) => f.key),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles]);

  const { mutateAsync: uploadFile } = useUploadAttachments();
  const { mutate: deleteFile } = useDeleteAttachment();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file

    for (const file of files) {
      const internalKey = `pending-${Date.now()}-${Math.random()}`;

      setPendingFiles((prev) => [
        ...prev,
        { internalKey, originName: file.name },
      ]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('internalKey', internalKey);

      try {
        const result = await uploadFile(formData);
        setUploadedFiles((prev) => [
          ...prev,
          { key: result.key, originName: file.name },
        ]);
      } catch {
        // Upload failed — just remove from pending; show nothing
      } finally {
        setPendingFiles((prev) =>
          prev.filter((f) => f.internalKey !== internalKey),
        );
      }
    }
  };

  const handleRemove = (key: string) => {
    deleteFile(key, {
      onSuccess: () => {
        setUploadedFiles((prev) => prev.filter((f) => f.key !== key));
      },
    });
  };

  const hasFiles = uploadedFiles.length > 0 || pendingFiles.length > 0;

  return (
    <FFormGroup name={'attachmentKeys'} label={'Attachments'} inline>
      <AttachmentsWrap>
        <UploadButton
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          📎 Upload Receipt
        </UploadButton>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,image/heic"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {hasFiles && (
          <FilesGroup spacing={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {pendingFiles.map((f) => (
              <Tag key={f.internalKey} minimal>
                <Spinner size={10} tagName="span" />{' '}
                <span style={{ marginLeft: 4 }}>{f.originName}</span>
              </Tag>
            ))}

            {uploadedFiles.map((f) => (
              <Tag
                key={f.key}
                minimal
                onRemove={() => handleRemove(f.key)}
                intent={Intent.NONE}
              >
                {f.originName}
              </Tag>
            ))}
          </FilesGroup>
        )}
      </AttachmentsWrap>
    </FFormGroup>
  );
}

const AttachmentsWrap = styled(Box)`
  display: flex;
  flex-direction: column;
`;

const FilesGroup = styled(Group)``;

const UploadButton = styled.button`
  appearance: none;
  background: none;
  border: 1px dashed var(--color-aside-divider, #d8e1e8);
  border-radius: 3px;
  color: var(--color-text-muted, #5c7080);
  cursor: pointer;
  font-size: 13px;
  padding: 5px 10px;
  text-align: left;
  width: 100%;

  &:hover {
    background: rgba(167, 182, 194, 0.1);
    border-color: #8a9ba8;
    color: var(--color-text, #182026);
  }
`;
