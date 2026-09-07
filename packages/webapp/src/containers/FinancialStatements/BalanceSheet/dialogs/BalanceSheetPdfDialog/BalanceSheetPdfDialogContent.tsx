import { AnchorButton } from '@blueprintjs/core';
import { useBalanceSheetContext } from '../../BalanceSheetProvider';
import {
  DialogContent,
  PdfDocumentPreview,
  FormattedMessage as T,
} from '@/components';
import { useBalanceSheetPdf } from '@/hooks/query';

export function BalanceSheetPdfDialogContent() {
  const { httpQuery } = useBalanceSheetContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { isLoading, pdfUrl } = useBalanceSheetPdf(httpQuery as any);
  const isLoaded = !isLoading && !!pdfUrl;

  return (
    <DialogContent>
      <div className="dialog__header-actions">
        <AnchorButton
          href={pdfUrl}
          target={'__blank'}
          disabled={!isLoaded}
          small
          minimal
          outlined
        >
          <T id={'pdf_preview.preview.button'} />
        </AnchorButton>

        <AnchorButton
          href={pdfUrl}
          download={'invoice.pdf'}
          disabled={!isLoaded}
          small
          minimal
          outlined
        >
          <T id={'pdf_preview.download.button'} />
        </AnchorButton>
      </div>

      <PdfDocumentPreview
        height={760}
        width={1000}
        isLoading={isLoading}
        url={pdfUrl}
      />
    </DialogContent>
  );
}
