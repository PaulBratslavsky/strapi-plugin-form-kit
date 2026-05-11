import { useState } from 'react';
import { Button } from '@strapi/design-system';
import { useFormsApi } from '../../api';

export const CopyAiPromptButton = ({ documentId }: { documentId: string }) => {
  const { getAiPrompt } = useFormsApi();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const prompt = await getAiPrompt(documentId);
      await navigator.clipboard.writeText(prompt);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (err) {
      console.error('[strapi-forms] copy AI prompt failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="tertiary" onClick={onClick} loading={busy}>
      {done ? 'Copied AI prompt!' : 'Copy as AI prompt'}
    </Button>
  );
};
